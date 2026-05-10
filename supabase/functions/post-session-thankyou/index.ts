/**
 * post-session-thankyou
 * Sends a thank-you email to all confirmed attendees 30 minutes after
 * a session's status changes to 'completed' (live_ended_at is set).
 *
 * Designed to be called by a Supabase scheduled job or cron trigger.
 * Body: { event_id: string }
 *
 * Idempotency: logs every send to email_send_log table to prevent duplicates.
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildThankYouEmail({
  recipientName,
  sessionTitle,
  artistName,
  nextSessionTitle,
  nextSessionDate,
  nextSessionLink,
  profileLink,
}: {
  recipientName: string;
  sessionTitle: string;
  artistName: string;
  nextSessionTitle?: string | null;
  nextSessionDate?: string | null;
  nextSessionLink?: string | null;
  profileLink: string;
}) {
  const safeName = escapeHtml(recipientName);
  const safeSession = escapeHtml(sessionTitle);
  const safeArtist = escapeHtml(artistName);
  const subject = `Thank you for joining ${safeSession} — ${safeArtist}`;

  const nextSessionContent = nextSessionTitle && nextSessionLink
    ? `${safeArtist} will be hosting <strong>${escapeHtml(nextSessionTitle)}</strong>${
        nextSessionDate ? ` on ${escapeHtml(nextSessionDate)}` : ""
      } — <a href="${nextSessionLink}" style="color:#FF6B58;">Book now →</a>`
    : `Follow <a href="${profileLink}" style="color:#FF6B58;">${safeArtist}</a> to get notified when the next session is announced.`;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#0F0F11;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0F0F11;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td style="padding:0 0 24px 0;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td><span style="font-size:22px;font-weight:700;color:#FF6B58;">Exhiby</span></td>
              <td align="right" style="font-size:12px;color:#666;">From ${safeArtist}</td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="background:#17171A;border-radius:20px;border:1px solid rgba(255,255,255,0.08);padding:32px;">
          <p style="margin:0 0 8px 0;font-size:13px;color:#999;text-transform:uppercase;letter-spacing:1px;">Thank you</p>
          <h1 style="margin:0 0 20px 0;font-size:24px;font-weight:700;color:#FFFFFF;">You were there ♡</h1>
          <p style="font-size:15px;line-height:1.7;color:rgba(255,255,255,0.8);margin:0 0 20px 0;">
            Hey ${safeName}, thank you for being in the room today for <strong>${safeSession}</strong>.
          </p>
          <p style="font-size:15px;line-height:1.7;color:rgba(255,255,255,0.8);margin:0 0 28px 0;">
            ${nextSessionContent}
          </p>
          <a href="${profileLink}" style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#FF6B58,#FF0040);border-radius:50px;font-size:14px;font-weight:600;color:#FFFFFF;text-decoration:none;">
            Visit Studio →
          </a>
        </td></tr>
        <tr><td style="padding:24px 0 0 0;text-align:center;font-size:11px;color:#555;line-height:1.6;">
          You attended a session by ${safeArtist} on Exhiby.<br/>
          <a href="${profileLink}/unsubscribe" style="color:#666;text-decoration:underline;">Unsubscribe</a> ·
          <a href="https://joinexhiby.com" style="color:#666;text-decoration:underline;">Exhiby</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, html };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const brevoApiKey = Deno.env.get("BREVO_API_KEY");

    if (!brevoApiKey) {
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const { event_id } = await req.json();

    if (!event_id) {
      return new Response(JSON.stringify({ error: "event_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Fetch event + creator profile
    const { data: event, error: eventError } = await serviceClient
      .from("events")
      .select("id, title, creator_id, live_ended_at")
      .eq("id", event_id)
      .maybeSingle();

    if (eventError || !event || !event.live_ended_at) {
      return new Response(JSON.stringify({ error: "Event not found or not completed" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Check creator's auto-thankyou preference (default: ON)
    const { data: authData } = await serviceClient.auth.admin.getUserById(event.creator_id);
    const creatorMeta = authData?.user?.user_metadata;
    const autoThankyouEnabled = creatorMeta?.auto_thankyou_email !== false; // default true

    if (!autoThankyouEnabled) {
      return new Response(JSON.stringify({ skipped: true, reason: "auto_thankyou disabled by creator" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Get creator profile
    const { data: creatorProfile } = await serviceClient
      .from("profiles")
      .select("name, handle")
      .eq("user_id", event.creator_id)
      .maybeSingle();

    const artistName = creatorProfile?.name || "the artist";
    const profileSlug = creatorProfile?.handle;
    const profileLink = profileSlug
      ? `https://joinexhiby.com/${profileSlug}`
      : `https://joinexhiby.com`;

    // 4. Get upcoming session for this creator
    const { data: upcomingEvents } = await serviceClient
      .from("events")
      .select("id, title, scheduled_at")
      .eq("creator_id", event.creator_id)
      .is("live_ended_at", null)
      .gt("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(1);

    const nextEvent = upcomingEvents?.[0] || null;
    const nextSessionTitle = nextEvent?.title || null;
    const nextSessionDate = nextEvent?.scheduled_at
      ? new Date(nextEvent.scheduled_at).toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
        })
      : null;
    const nextSessionLink = nextEvent
      ? `https://joinexhiby.com/live/${nextEvent.id}`
      : null;

    // 5. Get confirmed attendees (tickets with paid/free status, excluding creator)
    const { data: tickets } = await serviceClient
      .from("tickets")
      .select("user_id")
      .eq("event_id", event_id)
      .neq("user_id", event.creator_id)
      .in("payment_status", ["paid", "free"]);

    if (!tickets || tickets.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: "no attendees" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const attendeeUserIds = [...new Set(tickets.map((t: { user_id: string }) => t.user_id))];

    // 6. Check which have already been sent (idempotency)
    const logKey = `thankyou:${event_id}`;
    const { data: existingLogs } = await serviceClient
      .from("email_send_log")
      .select("recipient_user_id")
      .eq("log_key", logKey)
      .in("recipient_user_id", attendeeUserIds);

    const alreadySent = new Set((existingLogs || []).map((l: { recipient_user_id: string }) => l.recipient_user_id));
    const targetUserIds = attendeeUserIds.filter((id) => !alreadySent.has(id));

    if (targetUserIds.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: "all already sent" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 7. Fetch attendee profiles + emails
    const { data: profiles } = await serviceClient.rpc("get_creator_profiles", {
      user_ids: targetUserIds,
    });

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
      .filter((r: { email?: string }) => !!r.email);

    // 8. Send emails + log
    let sent = 0;
    const BATCH_SIZE = 50;

    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const batch = recipients.slice(i, i + BATCH_SIZE);
      await Promise.allSettled(
        batch.map(async (r: { name: string; email: string; userId: string }) => {
          const { subject, html } = buildThankYouEmail({
            recipientName: r.name,
            sessionTitle: event.title,
            artistName,
            nextSessionTitle,
            nextSessionDate,
            nextSessionLink,
            profileLink,
          });

          const res = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: {
              "api-key": brevoApiKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              sender: { name: `${artistName} via Exhiby`, email: "studio@joinexhiby.com" },
              to: [{ email: r.email, name: r.name }],
              subject,
              htmlContent: html,
            }),
          });

          if (res.ok) {
            sent++;
            // Log to prevent re-sending
            await serviceClient.from("email_send_log").insert({
              log_key: logKey,
              recipient_user_id: r.userId,
              event_id,
              sent_at: new Date().toISOString(),
            });
          }
        })
      );
    }

    return new Response(JSON.stringify({ sent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[post-session-thankyou] Error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
