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

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Require auth
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

    // Fetch event details
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, is_free, price, creator_id")
      .eq("id", event_id)
      .single();

    if (eventError || !event) {
      return new Response(JSON.stringify({ error: "Event not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isFree = !!event.is_free || Number(event.price ?? 0) <= 0;

    // If the event is paid, do NOT mint tickets without verified payment.
    // (Payment provider verification should be added here when monetization is enabled.)
    if (!isFree && event.creator_id !== user.id) {
      return new Response(
        JSON.stringify({
          error: "Payment verification required",
          code: "PAYMENT_NOT_CONFIGURED",
        }),
        {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Upsert ticket (idempotent)
    const { data: ticket, error: ticketError } = await supabase
      .from("tickets")
      .upsert(
        {
          event_id,
          user_id: user.id,
          purchased_at: new Date().toISOString(),
        },
        {
          onConflict: "event_id,user_id",
          ignoreDuplicates: false,
        }
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
