/**
 * send-campaign-email
 * Sends a creator-authored email campaign to a segment of their audience.
 * Requires Pro/Plus plan. Segments: all | VIP | REPEAT | NEW.
 *
 * Auth: Bearer token from the logged-in creator.
 * Body: { segment, subject, body, creator_name }
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Segment = "all" | "VIP" | "REPEAT" | "NEW";

interface CampaignRequest {
  segment: Segment;
  subject: string;
  body: string;
}

const MAX_SUBJECT_LEN = 200;
const MAX_BODY_LEN = 10_000;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildEmailHtml(subject: string, body: string, creatorName: string, recipientName: string): string {
  const safeBody = escapeHtml(body)
    .replace(/\[name\]/gi, escapeHtml(recipientName))
    .replace(/\n/g, "<br />");
  const safeName = escapeHtml(creatorName);
  const safeSubject = escapeHtml(subject);

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${safeSubject}</title></head>
<body style="margin:0;padding:0;background:#0F0F11;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0F0F11;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <!-- Header -->
        <tr><td style="padding:0 0 24px 0;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <span style="font-size:22px;font-weight:700;background:linear-gradient(135deg,#FF6B58,#FF0040);-webkit-background-clip:text;color:#FF6B58;">Exhiby</span>
              </td>
              <td align="right" style="font-size:12px;color:#666;">
                Studio Update from ${safeName}
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Card -->
        <tr><td style="background:#17171A;border-radius:20px;border:1px solid rgba(255,255,255,0.08);padding:32px;">
          <p style="margin:0 0 8px 0;font-size:13px;color:#999;text-transform:uppercase;letter-spacing:1px;">From ${safeName}</p>
          <h1 style="margin:0 0 24px 0;font-size:24px;font-weight:700;color:#FFFFFF;line-height:1.2;">${safeSubject}</h1>
          <div style="font-size:15px;line-height:1.7;color:rgba(255,255,255,0.8);">${safeBody}</div>

          <div style="margin-top:32px;padding-top:24px;border-top:1px solid rgba(255,255,255,0.08);">
            <a href="https://joinexhiby.com" style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#FF6B58,#FF0040);border-radius:50px;font-size:14px;font-weight:600;color:#FFFFFF;text-decoration:none;">
              Visit Studio →
            </a>
          </div>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:24px 0 0 0;text-align:center;font-size:11px;color:#555;line-height:1.6;">
          You're receiving this because you attended a session by ${safeName} on Exhiby.<br/>
          <a href="https://joinexhiby.com" style="color:#666;text-decoration:underline;">Unsubscribe</a> ·
          <a href="https://joinexhiby.com" style="color:#666;text-decoration:underline;">Exhiby</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const brevoApiKey = Deno.env.get("BREVO_API_KEY");

    if (!brevoApiKey) {
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is authenticated
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check plan (must be pro or plus)
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("plan, name")
      .eq("user_id", user.id)
      .maybeSingle();

    const plan = profile?.plan ?? "free";
    if (plan !== "pro" && plan !== "plus") {
      return new Response(JSON.stringify({ error: "Pro plan required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SECURITY: derive sender name from server-side profile, never from client input
    const creator_name = (profile?.name && profile.name.trim()) || "A creator";

    // Rate limit: max 3 campaigns per 24h, min 6h between sends
    const { data: recentLogs } = await serviceClient
      .from("campaign_email_log")
      .select("created_at")
      .eq("creator_id", user.id)
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false });

    if (recentLogs && recentLogs.length >= 3) {
      return new Response(
        JSON.stringify({ error: "Rate limit: maximum 3 campaigns per 24 hours." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (recentLogs && recentLogs.length > 0) {
      const lastSent = new Date(recentLogs[0].created_at).getTime();
      const sixHoursMs = 6 * 60 * 60 * 1000;
      if (Date.now() - lastSent < sixHoursMs) {
        const waitMin = Math.ceil((sixHoursMs - (Date.now() - lastSent)) / 60000);
        return new Response(
          JSON.stringify({ error: `Please wait ${waitMin} minutes before sending another campaign.` }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const { segment, subject, body }: CampaignRequest = await req.json();

    if (!subject?.trim() || !body?.trim()) {
      return new Response(JSON.stringify({ error: "Subject and body required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (subject.length > MAX_SUBJECT_LEN || body.length > MAX_BODY_LEN) {
      return new Response(
        JSON.stringify({ error: `Subject must be ≤ ${MAX_SUBJECT_LEN} chars and body ≤ ${MAX_BODY_LEN} chars` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all creator events
    const { data: events } = await serviceClient
      .from("events")
      .select("id")
      .eq("creator_id", user.id);

    const eventIds = (events || []).map((e: { id: string }) => e.id);
    if (eventIds.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all attendees for this creator (unique users, excluding self)
    const { data: tickets } = await serviceClient
      .from("tickets")
      .select("user_id, event_id")
      .in("event_id", eventIds)
      .neq("user_id", user.id)
      .in("payment_status", ["paid", "free"]);

    if (!tickets || tickets.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Count sessions per user for segment filtering
    const userSessionCounts = new Map<string, number>();
    for (const t of tickets) {
      userSessionCounts.set(t.user_id, (userSessionCounts.get(t.user_id) || 0) + 1);
    }

    const segmentFilter = (userId: string) => {
      const count = userSessionCounts.get(userId) || 0;
      if (segment === "all") return true;
      if (segment === "VIP") return count >= 5;
      if (segment === "REPEAT") return count >= 2 && count < 5;
      if (segment === "NEW") return count === 1;
      return false;
    };

    const targetUserIds = [...new Set(tickets.map((t: { user_id: string }) => t.user_id))].filter(segmentFilter);

    if (targetUserIds.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch profiles + emails via get_creator_profiles RPC
    const { data: profiles } = await serviceClient.rpc("get_creator_profiles", {
      user_ids: targetUserIds,
    });

    // Also get emails from auth.users (profiles RPC may not include email)
    const { data: authUsers } = await serviceClient.auth.admin.listUsers();
    const emailMap = new Map(
      (authUsers?.users || []).map((u: { id: string; email?: string }) => [u.id, u.email])
    );

    const recipients = (profiles || [])
      .map((p: { user_id: string; name: string }) => ({
        userId: p.user_id,
        name: p.name || "there",
        email: emailMap.get(p.user_id),
      }))
      .filter((r: { email?: string }) => r.email);

    // Send emails via Brevo (batch, max 50 per request)
    let sent = 0;
    const BATCH_SIZE = 50;

    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const batch = recipients.slice(i, i + BATCH_SIZE);
      const promises = batch.map(async (r: { name: string; email: string }) => {
        const html = buildEmailHtml(subject, body, creator_name, r.name);
        const res = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            "api-key": brevoApiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sender: { name: `${creator_name} via Exhiby`, email: "studio@joinexhiby.com" },
            to: [{ email: r.email, name: r.name }],
            subject,
            htmlContent: html,
          }),
        });
        if (res.ok) sent++;
      });
      await Promise.allSettled(promises);
    }

    // Log campaign for rate-limit accounting (service role bypasses RLS deny)
    await serviceClient.from("campaign_email_log").insert({
      creator_id: user.id,
      recipient_count: sent,
      segment,
    });

    return new Response(JSON.stringify({ sent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[send-campaign-email] Error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
