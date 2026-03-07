import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "npm:stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, stripe-signature",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!stripeSecretKey || !webhookSecret) {
    console.error("[stripe-webhook] Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET");
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const stripe = new Stripe(stripeSecretKey, { apiVersion: "2025-08-27.basil" });
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      return new Response(JSON.stringify({ error: "Missing stripe-signature header" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error("[stripe-webhook] Signature verification failed:", err.message);
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[stripe-webhook] Received event: ${event.type} (${event.id})`);

    // Idempotency: check if we already processed this event
    const { data: existing } = await supabase
      .from("stripe_webhook_events")
      .select("id")
      .eq("event_id", event.id)
      .maybeSingle();

    if (existing) {
      console.log(`[stripe-webhook] Event ${event.id} already processed, skipping`);
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log the event
    await supabase.from("stripe_webhook_events").insert({
      event_id: event.id,
      event_type: event.type,
      status: "processing",
      payload_json: event,
    });

    let processingStatus = "processed";

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          await handleCheckoutCompleted(supabase, session, event.id);
          break;
        }
        case "payment_intent.succeeded": {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          await handlePaymentIntentSucceeded(supabase, paymentIntent, event.id);
          break;
        }
        case "payment_intent.payment_failed": {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          await handlePaymentIntentFailed(supabase, paymentIntent);
          break;
        }
        default:
          console.log(`[stripe-webhook] Unhandled event type: ${event.type}`);
          processingStatus = "ignored";
      }
    } catch (handlerError) {
      console.error(`[stripe-webhook] Error handling ${event.type}:`, handlerError);
      processingStatus = "error";
    }

    // Update event status
    await supabase
      .from("stripe_webhook_events")
      .update({ status: processingStatus })
      .eq("event_id", event.id);

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[stripe-webhook] Unexpected error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

/**
 * Handle checkout.session.completed — mark ticket as paid + record earnings
 */
async function handleCheckoutCompleted(
  supabase: ReturnType<typeof createClient>,
  session: Stripe.Checkout.Session,
  stripeEventId: string
) {
  const checkoutSessionId = session.id;
  console.log(`[stripe-webhook] checkout.session.completed: ${checkoutSessionId}`);

  // Find the ticket by stripe_checkout_session_id
  const { data: ticket, error } = await supabase
    .from("tickets")
    .select("id, payment_status, event_id, user_id, amount, currency")
    .eq("stripe_checkout_session_id", checkoutSessionId)
    .maybeSingle();

  if (error) {
    console.error("[stripe-webhook] Error finding ticket:", error);
    throw error;
  }

  if (!ticket) {
    console.warn(`[stripe-webhook] No ticket found for checkout session: ${checkoutSessionId}`);
    return;
  }

  if (ticket.payment_status === "paid") {
    console.log(`[stripe-webhook] Ticket ${ticket.id} already marked as paid`);
    return;
  }

  const { error: updateError } = await supabase
    .from("tickets")
    .update({
      payment_status: "paid",
      purchased_at: new Date().toISOString(),
    })
    .eq("id", ticket.id);

  if (updateError) {
    console.error("[stripe-webhook] Error updating ticket:", updateError);
    throw updateError;
  }

  console.log(`[stripe-webhook] Ticket ${ticket.id} marked as paid`);

  // Record earnings for the creator
  await recordCreatorEarning(supabase, {
    eventId: ticket.event_id,
    ticketId: ticket.id,
    buyerUserId: ticket.user_id,
    amountCents: ticket.amount ? Math.round(Number(ticket.amount) * 100) : (session.amount_total || 0),
    currency: ticket.currency || session.currency || "usd",
    stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id || null,
    stripeCheckoutSessionId: checkoutSessionId,
    stripeEventId,
  });
}

/**
 * Handle payment_intent.succeeded — fallback confirmation + record earnings
 */
async function handlePaymentIntentSucceeded(
  supabase: ReturnType<typeof createClient>,
  paymentIntent: Stripe.PaymentIntent,
  stripeEventId: string
) {
  console.log(`[stripe-webhook] payment_intent.succeeded: ${paymentIntent.id}`);

  const eventId = paymentIntent.metadata?.event_id;
  const userId = paymentIntent.metadata?.user_id;

  if (!eventId || !userId) {
    console.log("[stripe-webhook] No event_id/user_id in metadata, skipping ticket update");
    return;
  }

  // Update ticket if it exists and isn't already paid
  const { data: tickets, error } = await supabase
    .from("tickets")
    .update({ payment_status: "paid", purchased_at: new Date().toISOString() })
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .neq("payment_status", "paid")
    .select("id, amount, currency");

  if (error) {
    console.error("[stripe-webhook] Error updating ticket from payment_intent:", error);
    throw error;
  }

  // Record earnings (if not already recorded by checkout.session.completed)
  if (tickets && tickets.length > 0) {
    const ticket = tickets[0];
    await recordCreatorEarning(supabase, {
      eventId,
      ticketId: ticket.id,
      buyerUserId: userId,
      amountCents: paymentIntent.amount || 0,
      currency: paymentIntent.currency || "usd",
      stripePaymentIntentId: paymentIntent.id,
      stripeCheckoutSessionId: null,
      stripeEventId,
    });
  }
}

/**
 * Handle payment_intent.payment_failed — mark ticket as failed
 */
async function handlePaymentIntentFailed(
  supabase: ReturnType<typeof createClient>,
  paymentIntent: Stripe.PaymentIntent
) {
  console.log(`[stripe-webhook] payment_intent.payment_failed: ${paymentIntent.id}`);

  const eventId = paymentIntent.metadata?.event_id;
  const userId = paymentIntent.metadata?.user_id;

  if (!eventId || !userId) {
    console.log("[stripe-webhook] No event_id/user_id in metadata, skipping");
    return;
  }

  const { error } = await supabase
    .from("tickets")
    .update({ payment_status: "failed" })
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .eq("payment_status", "pending");

  if (error) {
    console.error("[stripe-webhook] Error marking ticket as failed:", error);
  }
}

/**
 * Record a creator earning in the creator_earnings table.
 * Uses stripe_event_id as unique key for idempotency.
 * Platform fee is 10% (configurable).
 */
async function recordCreatorEarning(
  supabase: ReturnType<typeof createClient>,
  params: {
    eventId: string;
    ticketId: string;
    buyerUserId: string;
    amountCents: number;
    currency: string;
    stripePaymentIntentId: string | null;
    stripeCheckoutSessionId: string | null;
    stripeEventId: string;
  }
) {
  // Look up creator_id from the event
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("creator_id")
    .eq("id", params.eventId)
    .maybeSingle();

  if (eventError || !event) {
    console.error("[stripe-webhook] Could not find event for earnings:", params.eventId, eventError);
    return;
  }

  // Don't record self-purchases as earnings
  if (event.creator_id === params.buyerUserId) {
    console.log("[stripe-webhook] Skipping self-purchase earnings");
    return;
  }

  const PLATFORM_FEE_PERCENT = 10;
  const platformFee = Math.round(params.amountCents * PLATFORM_FEE_PERCENT / 100);
  const amountNet = params.amountCents - platformFee;

  const { error } = await supabase.from("creator_earnings").insert({
    creator_id: event.creator_id,
    event_id: params.eventId,
    ticket_id: params.ticketId,
    user_id: params.buyerUserId,
    stripe_payment_intent_id: params.stripePaymentIntentId,
    stripe_checkout_session_id: params.stripeCheckoutSessionId,
    amount_gross: params.amountCents,
    platform_fee: platformFee,
    amount_net: amountNet,
    currency: params.currency,
    status: "succeeded",
    stripe_event_id: params.stripeEventId,
  });

  if (error) {
    // Unique constraint on stripe_event_id handles idempotency
    if (error.code === "23505") {
      console.log("[stripe-webhook] Earnings already recorded for this event, skipping");
    } else {
      console.error("[stripe-webhook] Error recording creator earning:", error);
    }
  } else {
    console.log(`[stripe-webhook] Recorded earning: $${(params.amountCents / 100).toFixed(2)} for creator ${event.creator_id}`);
  }
}
