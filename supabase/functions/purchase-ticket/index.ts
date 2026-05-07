import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (origin.endsWith(".lovableproject.com") || origin.endsWith(".lovable.app")) return true;
  if (origin.startsWith("http://localhost:")) return true;
  return false;
}

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = isAllowedOrigin(origin) ? origin! : "*";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Credentials": "true",
  };
}

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Generate an RFC 5545 .ics calendar event string */
function generateICS(params: {
  uid: string;
  title: string;
  description: string;
  startAt: Date;
  endAt: Date;
  url: string;
  organizerName: string;
}): string {
  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Exhiby//Studio Session//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${params.uid}@exhiby.app`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(params.startAt)}`,
    `DTEND:${fmt(params.endAt)}`,
    `SUMMARY:${params.title}`,
    `DESCRIPTION:${params.description.replace(/\n/g, "\\n")}`,
    `URL:${params.url}`,
    `ORGANIZER;CN=${params.organizerName}:MAILTO:noreply@exhiby.app`,
    "BEGIN:VALARM",
    "TRIGGER:-PT15M",
    "ACTION:DISPLAY",
    "DESCRIPTION:Your Exhiby session starts in 15 minutes",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const jwt = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const event_id = body?.event_id;

    if (typeof event_id !== "string" || !uuidRegex.test(event_id)) {
      return new Response(JSON.stringify({ error: "Invalid event_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch event details — include fields needed for confirmation email
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, title, is_free, price, creator_id, scheduled_at, duration_minutes, category")
      .eq("id", event_id)
      .single();

    if (eventError || !event) {
      return new Response(JSON.stringify({ error: "Event not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isFree = !!event.is_free || Number(event.price ?? 0) <= 0;

    if (!isFree && event.creator_id !== user.id) {
      return new Response(
        JSON.stringify({ error: "Payment verification required", code: "PAYMENT_NOT_CONFIGURED" }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Upsert ticket (idempotent)
    const { data: ticket, error: ticketError } = await supabase
      .from("tickets")
      .upsert(
        { event_id, user_id: user.id, purchased_at: new Date().toISOString() },
        { onConflict: "event_id,user_id", ignoreDuplicates: false }
      )
      .select("id")
      .single();

    if (ticketError || !ticket) {
      console.error("[purchase-ticket] ticket upsert error", ticketError);
      return new Response(JSON.stringify({ error: "Failed to create ticket" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Send ticket confirmation email (fire-and-forget) ─────────────────
    try {
      // Fetch creator profile and buyer email in parallel
      const [profileRes, emailRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("name")
          .eq("user_id", event.creator_id)
          .maybeSingle(),
        supabase.auth.admin.getUserById(user.id),
      ]);

      const creatorName = profileRes.data?.name ?? "the artist";
      const buyerEmail = emailRes.data?.user?.email;
      const buyerName =
        emailRes.data?.user?.user_metadata?.name ??
        buyerEmail?.split("@")[0] ??
        "there";

      if (buyerEmail && event.scheduled_at) {
        const startAt = new Date(event.scheduled_at);
        const durationMs = (event.duration_minutes ?? 60) * 60 * 1000;
        const endAt = new Date(startAt.getTime() + durationMs);
        const sessionUrl = `${Deno.env.get("PUBLIC_SITE_URL") ?? "https://exhiby.app"}/s/${event_id}`;

        // Build .ics data URI
        const icsContent = generateICS({
          uid: ticket.id,
          title: event.title,
          description: `Studio session by ${creatorName} on Exhiby.\n\nJoin at: ${sessionUrl}`,
          startAt,
          endAt,
          url: sessionUrl,
          organizerName: creatorName,
        });
        const icsBase64 = btoa(icsContent);

        // Call send-notification-email with ticket_purchased type
        await supabase.functions.invoke("send-notification-email", {
          body: {
            email_type: "ticket_purchased",
            recipient_email: buyerEmail,
            recipient_name: buyerName,
            event_id,
            event_title: event.title,
            creator_name: creatorName,
            scheduled_at: event.scheduled_at,
            session_url: sessionUrl,
            is_free: isFree,
            price_cents: isFree ? 0 : Math.round(Number(event.price ?? 0) * 100),
            calendar_ics_base64: icsBase64,
          },
        });
      }
    } catch (emailErr) {
      // Non-fatal — ticket was already created, email failure shouldn't block response
      console.warn("[purchase-ticket] confirmation email failed:", emailErr);
    }

    return new Response(JSON.stringify({ ticket_id: ticket.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[purchase-ticket] unexpected error", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...getCorsHeaders(null), "Content-Type": "application/json" },
    });
  }
});
