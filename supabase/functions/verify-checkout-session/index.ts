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

/**
 * Fallback verification: checks Stripe directly for a pending ticket's
 * checkout session status, and marks the ticket as paid if the session
 * completed successfully. Also records creator earnings.
 */
serve(async (req) => {
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
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY")!;

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

    const body = await req.json().catch(() => ({}));
    const event_id = body?.event_id;

    if (typeof event_id !== "string" || !uuidRegex.test(event_id)) {
      return new Response(JSON.stringify({ error: "Invalid event_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2025-08-27.basil" });

    // Find the pending ticket for this user + event
    const { data: ticket, error: ticketError } = await supabase
      .from("tickets")
      .select("id, payment_status, stripe_checkout_session_id, amount, currency")
      .eq("event_id", event_id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (ticketError || !ticket) {
      return new Response(JSON.stringify({ verified: false, reason: "no_ticket" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Already paid
    if (ticket.payment_status === "paid" || ticket.payment_status === "free") {
      return new Response(JSON.stringify({ verified: true, ticket_id: ticket.id }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Not pending or no checkout session to verify
    if (ticket.payment_status !== "pending" || !ticket.stripe_checkout_session_id) {
      return new Response(JSON.stringify({ verified: false, reason: "no_session" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check the Stripe Checkout Session directly
    console.log(`[verify-checkout] Checking session: ${ticket.stripe_checkout_session_id}`);
    const session = await stripe.checkout.sessions.retrieve(ticket.stripe_checkout_session_id);

    if (session.payment_status !== "paid") {
      console.log(`[verify-checkout] Session not paid: ${session.payment_status}`);
      return new Response(JSON.stringify({ verified: false, reason: "not_paid", stripe_status: session.payment_status }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Session is paid — update ticket
    console.log(`[verify-checkout] Session paid! Updating ticket ${ticket.id}`);
    const { error: updateError } = await supabase
      .from("tickets")
      .update({
        payment_status: "paid",
        purchased_at: new Date().toISOString(),
      })
      .eq("id", ticket.id);

    if (updateError) {
      console.error("[verify-checkout] Error updating ticket:", updateError);
      return new Response(JSON.stringify({ verified: false, reason: "update_failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Record creator earnings (same logic as webhook)
    const { data: event } = await supabase
      .from("events")
      .select("creator_id")
      .eq("id", event_id)
      .maybeSingle();

    if (event && event.creator_id !== user.id) {
      const amountCents = session.amount_total || Math.round(Number(ticket.amount || 0) * 100);
      const PLATFORM_FEE_PERCENT = 10;
      const platformFee = Math.round(amountCents * PLATFORM_FEE_PERCENT / 100);
      const amountNet = amountCents - platformFee;

      const paymentIntentId = typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id || null;

      const { error: earningsError } = await supabase.from("creator_earnings").insert({
        creator_id: event.creator_id,
        event_id,
        ticket_id: ticket.id,
        user_id: user.id,
        stripe_payment_intent_id: paymentIntentId,
        stripe_checkout_session_id: ticket.stripe_checkout_session_id,
        amount_gross: amountCents,
        platform_fee: platformFee,
        amount_net: amountNet,
        currency: ticket.currency || session.currency || "usd",
        status: "succeeded",
        stripe_event_id: `verify_${ticket.stripe_checkout_session_id}`,
      });

      if (earningsError) {
        if (earningsError.code === "23505") {
          console.log("[verify-checkout] Earnings already recorded");
        } else {
          console.error("[verify-checkout] Error recording earnings:", earningsError);
        }
      } else {
        console.log(`[verify-checkout] Recorded earning: $${(amountCents / 100).toFixed(2)} for creator ${event.creator_id}`);
      }
    }

    return new Response(JSON.stringify({ verified: true, ticket_id: ticket.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[verify-checkout] Error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
