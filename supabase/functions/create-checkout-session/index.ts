import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "npm:stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Calculate processing fee in cents: ceil(priceCents * 0.029 + 30) */
function calcProcessingFeeCents(ticketPriceCents: number): number {
  if (ticketPriceCents <= 0) return 0;
  return Math.ceil(ticketPriceCents * 0.029 + 30);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY")!;

    // Verify user with anon key client
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const jwt = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getUser(jwt);
    if (claimsError || !claimsData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = claimsData.user;

    // Parse body
    const body = await req.json().catch(() => ({}));
    const event_id = body?.event_id;
    const origin = body?.origin || req.headers.get("origin") || "https://exhiby.lovable.app";

    if (typeof event_id !== "string" || !uuidRegex.test(event_id)) {
      return new Response(JSON.stringify({ error: "Invalid event_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role to fetch event and create ticket
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, is_free, price, creator_id, title")
      .eq("id", event_id)
      .single();

    if (eventError || !event) {
      return new Response(JSON.stringify({ error: "Event not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isFree = !!event.is_free || Number(event.price ?? 0) <= 0;

    // For free events, just create the ticket directly
    if (isFree) {
      const { data: ticket, error: ticketError } = await supabase
        .from("tickets")
        .upsert(
          {
            event_id,
            user_id: user.id,
            payment_status: "free",
            purchased_at: new Date().toISOString(),
          },
          { onConflict: "event_id,user_id", ignoreDuplicates: false }
        )
        .select("id")
        .single();

      if (ticketError) {
        console.error("[create-checkout-session] Free ticket error:", ticketError);
        return new Response(JSON.stringify({ error: "Failed to create ticket" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({ ticket_id: ticket.id, free: true }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Paid event — Create Stripe Checkout Session
    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2025-08-27.basil" });

    // Server-side price validation — cents
    const ticketPriceCents = Math.round(Number(event.price) * 100);
    if (ticketPriceCents < 100) {
      return new Response(JSON.stringify({ error: "Price must be at least $1.00" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Calculate processing fee and total charge
    const processingFeeCents = calcProcessingFeeCents(ticketPriceCents);
    const totalChargeCents = ticketPriceCents + processingFeeCents;

    // Create a pending ticket first (amount = original ticket price, NOT total)
    const { data: pendingTicket, error: pendingError } = await supabase
      .from("tickets")
      .upsert(
        {
          event_id,
          user_id: user.id,
          payment_status: "pending",
          amount: Number(event.price),
          currency: "usd",
          purchased_at: new Date().toISOString(),
        },
        { onConflict: "event_id,user_id", ignoreDuplicates: false }
      )
      .select("id")
      .single();

    if (pendingError || !pendingTicket) {
      console.error("[create-checkout-session] Pending ticket error:", pendingError);
      return new Response(JSON.stringify({ error: "Failed to create pending ticket" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check/create Stripe customer
    let customerId: string | undefined;
    if (user.email) {
      const customers = await stripe.customers.list({
        email: user.email,
        limit: 1,
      });
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
      }
    }

    // If no customer exists yet, create one
    if (!customerId && user.email) {
      const newCustomer = await stripe.customers.create({ email: user.email });
      customerId = newCustomer.id;
    }

    // Create Checkout Session with ticket + processing fee as separate line items
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email || undefined,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: event.title || "Studio Session Ticket",
              description: "Entry ticket for live studio session",
            },
            unit_amount: ticketPriceCents,
          },
          quantity: 1,
        },
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Processing Fee",
              description: "Secure card payment processing",
            },
            unit_amount: processingFeeCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      payment_intent_data: {
        setup_future_usage: "off_session",
        metadata: {
          event_id,
          user_id: user.id,
          ticket_id: pendingTicket.id,
          ticket_price_cents: String(ticketPriceCents),
          processing_fee_cents: String(processingFeeCents),
        },
      },
      success_url: `${origin}/live/${event_id}?payment=success`,
      cancel_url: `${origin}/live/${event_id}?payment=canceled`,
      metadata: {
        event_id,
        user_id: user.id,
        ticket_id: pendingTicket.id,
        ticket_price_cents: String(ticketPriceCents),
        processing_fee_cents: String(processingFeeCents),
      },
    });

    // Update ticket with checkout session ID
    await supabase
      .from("tickets")
      .update({ stripe_checkout_session_id: session.id })
      .eq("id", pendingTicket.id);

    console.log(
      `[create-checkout-session] Created session ${session.id} for event ${event_id} (ticket: ${ticketPriceCents}c + fee: ${processingFeeCents}c = ${totalChargeCents}c)`
    );

    return new Response(
      JSON.stringify({ url: session.url, session_id: session.id }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[create-checkout-session] Unexpected error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
