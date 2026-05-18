import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function escapeHtml(unsafe: string): string {
  if (!unsafe) return "";
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ─────────────────────────────────────────────────────────────────────────────
// notify-creator-approved
// Called (fire-and-forget) from the /admin/creators page after an admin sets a
// creator application to "approved". Does two things:
//   1. Inserts an in-app notification (bell) for the creator
//   2. Sends a "You're approved" email via Brevo
// Caller MUST be an admin. The function independently re-verifies that the
// target user's creator_applications row is actually 'approved' before acting
// — never trusts the client. Idempotent: if a creator_approved notification
// already exists for the user, it skips (no duplicate email/notification).
// ─────────────────────────────────────────────────────────────────────────────

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const brevoApiKey = Deno.env.get("BREVO_API_KEY");
    if (!brevoApiKey) {
      throw new Error("BREVO_API_KEY not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // ── Require an authenticated caller ───────────────────────────────────────
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const jwt = authHeader.replace(/^Bearer\s+/i, "");

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser(jwt);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = userData.user.id;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ── Caller must be an admin ───────────────────────────────────────────────
    const { data: isAdmin, error: roleError } = await supabase.rpc("has_role", {
      _user_id: callerId,
      _role: "admin",
    });
    if (roleError || isAdmin !== true) {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const targetUserId = body?.user_id;
    if (!targetUserId || typeof targetUserId !== "string") {
      return new Response(JSON.stringify({ error: "Missing user_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Independently verify the application is genuinely approved ────────────
    const { data: application, error: appError } = await supabase
      .from("creator_applications")
      .select("status")
      .eq("user_id", targetUserId)
      .maybeSingle();

    if (appError) {
      console.error("creator_applications lookup failed:", appError);
      return new Response(JSON.stringify({ error: "Lookup failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!application || application.status !== "approved") {
      return new Response(
        JSON.stringify({ error: "Application is not approved" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Idempotency: skip if we already notified this creator ────────────────
    const { data: existing } = await supabase
      .from("notifications")
      .select("id")
      .eq("user_id", targetUserId)
      .eq("type", "creator_approved")
      .limit(1)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ sent: false, deduped: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Look up the creator's profile + email ────────────────────────────────
    const { data: profile } = await supabase
      .from("profiles")
      .select("name")
      .eq("user_id", targetUserId)
      .maybeSingle();

    const { data: authUser, error: authUserError } =
      await supabase.auth.admin.getUserById(targetUserId);

    const creatorName = escapeHtml(profile?.name || "Creator");
    const creatorEmail = authUser?.user?.email;

    // ── 1. In-app notification (bell) ────────────────────────────────────────
    const { error: notifError } = await supabase.from("notifications").insert({
      user_id: targetUserId,
      type: "creator_approved",
      title: "You're a verified creator! 🎉",
      message: "Your application was approved — your Studio is now open. Go live whenever you're ready.",
      link: "/?screen=profile",
      is_read: false,
    });
    if (notifError) {
      console.error("notification insert failed:", notifError);
      // Continue — still try the email; don't fail the whole call on the bell.
    }

    // ── 2. Approval email via Brevo ──────────────────────────────────────────
    if (!authUserError && creatorEmail) {
      const domain = "https://joinexhiby.com";
      const studioLink = `${domain}/?screen=profile`;

      const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're approved on Exhiby</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f5f5f5;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
          <tr>
            <td style="padding: 32px 32px 24px 32px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #18181b; letter-spacing: -0.5px;">EXHIBY</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 32px 32px 32px;">
              <h2 style="margin: 0 0 8px 0; font-size: 20px; font-weight: 600; color: #18181b;">
                You're a verified creator! 🎉
              </h2>
              <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #52525b;">
                Hi ${creatorName}, your application has been reviewed and <strong>approved</strong>.
                Your Studio is now open — you can go live and start sharing your process whenever you're ready.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
                <tr>
                  <td style="border-radius: 8px; background-color: #18181b;">
                    <a href="${studioLink}" target="_blank" style="display: inline-block; padding: 14px 32px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 8px;">Open Your Studio</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 32px; border-top: 1px solid #e5e5e5;">
              <p style="margin: 0; font-size: 13px; color: #a1a1aa; text-align: center;">
                You're receiving this because your creator application on Exhiby was approved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `;

      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          "api-key": brevoApiKey,
        },
        body: JSON.stringify({
          sender: { name: "Exhiby Studio", email: "studio@joinexhiby.com" },
          to: [{ email: creatorEmail, name: creatorName }],
          subject: "You're approved — your Exhiby Studio is open 🎉",
          htmlContent,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Brevo send failed:", errorText);
        // Notification already inserted; report partial success rather than 500.
        return new Response(
          JSON.stringify({ sent: false, notified: !notifError, emailFailed: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      console.error("Creator email not found:", authUserError);
      return new Response(
        JSON.stringify({ sent: false, notified: !notifError, emailFailed: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ sent: true, notified: !notifError }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in notify-creator-approved:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
