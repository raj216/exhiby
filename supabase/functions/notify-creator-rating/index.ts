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

const STAR_LABELS: Record<number, string> = {
  1: "Poor",
  2: "Fair",
  3: "Good",
  4: "Great",
  5: "Excellent",
};

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

    // Require an authenticated user
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
    const audienceUserId = userData.user.id;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const event_id = body?.event_id;

    if (!event_id) {
      return new Response(JSON.stringify({ error: "Missing event_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Look up the actual feedback row authored by this user — never trust client values
    const { data: feedback, error: feedbackError } = await supabase
      .from("session_feedback")
      .select("rating, creator_id")
      .eq("event_id", event_id)
      .eq("audience_user_id", audienceUserId)
      .maybeSingle();

    if (feedbackError || !feedback || !feedback.rating) {
      return new Response(JSON.stringify({ error: "Feedback not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rating = feedback.rating;
    const creator_id = feedback.creator_id;

    // Fetch event details
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, title, creator_id")
      .eq("id", event_id)
      .single();

    if (eventError || !event) {
      console.error("Event not found:", eventError);
      return new Response(JSON.stringify({ error: "Event not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the creator_id from feedback matches the event's creator
    if (event.creator_id !== creator_id) {
      return new Response(JSON.stringify({ error: "Creator mismatch" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch creator profile
    const { data: creatorProfile } = await supabase
      .from("profiles")
      .select("name, handle")
      .eq("user_id", creator_id)
      .single();

    // Fetch creator email from auth
    const { data: authUser, error: authUserError } = await supabase.auth.admin.getUserById(creator_id);
    if (authUserError || !authUser?.user?.email) {
      console.error("Creator email not found:", authUserError);
      return new Response(JSON.stringify({ error: "Creator email not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get updated aggregate rating for this creator
    const { data: stats } = await supabase
      .rpc("get_creator_rating_stats", { p_creator_id: creator_id });

    const creatorName = escapeHtml(creatorProfile?.name || "Creator");
    const eventTitle = escapeHtml(event.title);
    const creatorEmail = authUser.user.email;
    const starLabel = STAR_LABELS[rating] || "";
    const stars = "★".repeat(rating) + "☆".repeat(5 - rating);

    const avgRating = stats?.[0]?.average_rating
      ? parseFloat(stats[0].average_rating).toFixed(1)
      : null;
    const totalRatings = stats?.[0]?.total_ratings ?? null;

    const domain = "https://exhiby.lovable.app";
    const dashboardLink = `${domain}/?view=studio`;

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Rating Received</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f5f5f5;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 24px 32px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #18181b; letter-spacing: -0.5px;">EXHIBY</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 0 32px 32px 32px;">
              <h2 style="margin: 0 0 8px 0; font-size: 20px; font-weight: 600; color: #18181b;">
                You received a new rating! 🎉
              </h2>
              <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #52525b;">
                Someone rated your session <strong>${eventTitle}</strong>.
              </p>

              <!-- Rating box -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #fafafa; border: 1px solid #e5e5e5; border-radius: 10px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 20px; text-align: center;">
                    <p style="margin: 0 0 4px 0; font-size: 32px; letter-spacing: 4px; color: #f59e0b;">${stars}</p>
                    <p style="margin: 0; font-size: 16px; font-weight: 600; color: #18181b;">${starLabel} (${rating}/5)</p>
                  </td>
                </tr>
              </table>

              ${avgRating && totalRatings ? `
              <p style="margin: 0 0 24px 0; font-size: 14px; color: #71717a; text-align: center;">
                Your overall rating is now <strong style="color: #18181b;">${avgRating} ★</strong> from <strong style="color: #18181b;">${totalRatings}</strong> review${totalRatings !== 1 ? "s" : ""}.
              </p>
              ` : ""}

              <!-- CTA -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
                <tr>
                  <td style="border-radius: 8px; background-color: #18181b;">
                    <a href="${dashboardLink}" target="_blank" style="display: inline-block; padding: 14px 32px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 8px;">View Your Studio</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; border-top: 1px solid #e5e5e5;">
              <p style="margin: 0; font-size: 13px; color: #a1a1aa; text-align: center;">
                You're receiving this because you're a creator on Exhiby.
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
        subject: `New ${starLabel} rating for "${eventTitle}"`,
        htmlContent,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Brevo send failed:", errorText);
      return new Response(JSON.stringify({ error: "Failed to send email" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Rating notification sent to creator ${creatorEmail}`);
    return new Response(JSON.stringify({ sent: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in notify-creator-rating:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
