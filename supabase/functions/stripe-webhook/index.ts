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

  console.log(`[stripe-webhook] ENV CHECK: STRIPE_SECRET_KEY=${stripeSecretKey ? "SET (" + stripeSecretKey.substring(0, 7) + "...)" : "MISSING"}`);
  console.log(`[stripe-webhook] ENV CHECK: STRIPE_WEBHOOK_SECRET=${webhookSecret ? "SET (" + webhookSecret.substring(0, 8) + "...)" : "MISSING"}`);
  console.log(`[stripe-webhook] ENV CHECK: SUPABASE_URL=${supabaseUrl ? "SET" : "MISSING"}`);
  console.log(`[stripe-webhook] ENV CHECK: SUPABASE_SERVICE_ROLE_KEY=${supabaseServiceKey ? "SET" : "MISSING"}`);

  if (!stripeSecretKey || !webhookSecret) {
    console.error("[stripe-webhook] FATAL: Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET");
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-12-18.acacia" });
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    console.log(`[stripe-webhook] Request method: ${req.method}`);
    console.log(`[stripe-webhook] Body length: ${body.length}`);
    console.log(`[stripe-webhook] Signature header present: ${!!signature}`);
    if (signature) {
      console.log(`[stripe-webhook] Signature preview: ${signature.substring(0, 50)}...`);
    }

    if (!signature) {
      console.error("[stripe-webhook] Missing stripe-signature header");
      return new Response(JSON.stringify({ error: "Missing stripe-signature header" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
      console.log(`[stripe-webhook] ✅ Signature verified successfully`);
    } catch (err) {
      console.error(`[stripe-webhook] ❌ Signature verification FAILED: ${err.message}`);
      return new Response(JSON.stringify({ error: "Invalid signature", detail: err.message }), {
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
    const { error: insertError } = await supabase.from("stripe_webhook_events").insert({
      event_id: event.id,
      event_type: event.type,
      status: "processing",
      payload_json: event,
    });

    if (insertError) {
      console.error("[stripe-webhook] Failed to log event:", insertError);
    }

    let processingStatus = "processed";

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          console.log(`[stripe-webhook] Processing checkout.session.completed: ${session.id}`);
          await handleCheckoutCompleted(supabase, session, event.id);
          break;
        }
        case "payment_intent.succeeded": {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          console.log(`[stripe-webhook] Processing payment_intent.succeeded: ${paymentIntent.id}`);
          await handlePaymentIntentSucceeded(supabase, paymentIntent, event.id);
          break;
        }
        case "payment_intent.payment_failed": {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          console.log(`[stripe-webhook] Processing payment_intent.payment_failed: ${paymentIntent.id}`);
          await handlePaymentIntentFailed(supabase, paymentIntent);
          break;
        }
        case "charge.succeeded": {
          const charge = event.data.object;
          console.log(`[stripe-webhook] Processing charge.succeeded: ${charge.id}, payment_intent: ${charge.payment_intent}`);
          processingStatus = "processed";
          break;
        }
        case "charge.refunded": {
          const charge = event.data.object as any;
          console.log(`[stripe-webhook] Processing charge.refunded: ${charge.id}`);
          await handleChargeRefunded(supabase, charge);
          break;
        }
        default:
          console.log(`[stripe-webhook] Unhandled event type: ${event.type}`);
          processingStatus = "ignored";
      }
    } catch (handlerError) {
      console.error(`[stripe-webhook] ❌ Error handling ${event.type}:`, handlerError);
      processingStatus = "error";
    }

    // Update event status
    await supabase
      .from("stripe_webhook_events")
      .update({ status: processingStatus })
      .eq("event_id", event.id);

    console.log(`[stripe-webhook] ✅ Event ${event.id} completed with status: ${processingStatus}`);

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[stripe-webhook] ❌ Unexpected error:", error);
    return new Response(JSON.stringify({ error: "Internal server error", detail: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

/**
 * Handle checkout.session.completed — mark ticket as paid + record earnings
 * Also handles tip checkout sessions (no ticket involved).
 */
async function handleCheckoutCompleted(
  supabase: ReturnType<typeof createClient>,
  session: Stripe.Checkout.Session,
  stripeEventId: string
) {
  const checkoutSessionId = session.id;
  console.log(`[stripe-webhook] checkout.session.completed: ${checkoutSessionId}`);
  console.log(`[stripe-webhook] Session payment_status: ${session.payment_status}`);
  console.log(`[stripe-webhook] Session amount_total: ${session.amount_total}`);

  // Check payment_intent metadata for type (tip checkout sessions store metadata on payment_intent_data)
  const piMetadata = session.metadata || {};
  const paymentIntentMetadata = typeof session.payment_intent === "object" && session.payment_intent?.metadata
    ? session.payment_intent.metadata
    : {};
  // Merge: checkout-level metadata takes priority for type detection
  const mergedMeta = { ...paymentIntentMetadata, ...piMetadata };
  console.log(`[stripe-webhook] Merged metadata:`, JSON.stringify(mergedMeta));

  // --- TIP CHECKOUT ---
  if (mergedMeta.type === "tip") {
    console.log(`[stripe-webhook] Detected TIP checkout session`);
    // Use original tip amount from metadata (excludes buyer-paid processing fee)
    const originalTipCents = mergedMeta.tip_amount_cents
      ? parseInt(mergedMeta.tip_amount_cents, 10)
      : session.amount_total || 0;
    console.log(`[stripe-webhook] Original tip amount: ${originalTipCents} cents (charge total: ${session.amount_total})`);
    await recordTipEarning(supabase, {
      eventId: mergedMeta.event_id || "",
      tipperUserId: mergedMeta.user_id || "",
      amountCents: originalTipCents,
      currency: session.currency || "usd",
      stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id || null,
      stripeCheckoutSessionId: session.id,
      stripeEventId,
    });
    return;
  }

  // --- TICKET CHECKOUT ---
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
    console.warn(`[stripe-webhook] ⚠️ No ticket found for checkout session: ${checkoutSessionId}`);
    // Try finding by metadata
    const eventId = mergedMeta.event_id;
    const userId = mergedMeta.user_id;
    if (eventId && userId) {
      console.log(`[stripe-webhook] Trying metadata fallback: event_id=${eventId}, user_id=${userId}`);
      const { data: fallbackTicket, error: fallbackError } = await supabase
        .from("tickets")
        .select("id, payment_status, event_id, user_id, amount, currency")
        .eq("event_id", eventId)
        .eq("user_id", userId)
        .maybeSingle();

      if (fallbackError) {
        console.error("[stripe-webhook] Fallback ticket lookup error:", fallbackError);
        return;
      }
      if (!fallbackTicket) {
        console.warn("[stripe-webhook] ⚠️ No ticket found via metadata fallback either");
        return;
      }
      await supabase
        .from("tickets")
        .update({ stripe_checkout_session_id: checkoutSessionId })
        .eq("id", fallbackTicket.id);

      await markTicketPaidAndRecordEarnings(supabase, fallbackTicket, session, stripeEventId);
      return;
    }
    return;
  }

  await markTicketPaidAndRecordEarnings(supabase, ticket, session, stripeEventId);
}

async function markTicketPaidAndRecordEarnings(
  supabase: ReturnType<typeof createClient>,
  ticket: { id: string; payment_status: string; event_id: string; user_id: string; amount: number | null; currency: string | null },
  session: Stripe.Checkout.Session,
  stripeEventId: string
) {
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
    console.error("[stripe-webhook] ❌ Error updating ticket:", updateError);
    throw updateError;
  }

  console.log(`[stripe-webhook] ✅ Ticket ${ticket.id} marked as paid`);

  // Record earnings for the creator
  await recordCreatorEarning(supabase, {
    eventId: ticket.event_id,
    ticketId: ticket.id,
    buyerUserId: ticket.user_id,
    amountCents: ticket.amount ? Math.round(Number(ticket.amount) * 100) : (session.amount_total || 0),
    currency: ticket.currency || session.currency || "usd",
    stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id || null,
    stripeCheckoutSessionId: session.id,
    stripeEventId,
  });
}

/**
 * Handle payment_intent.succeeded — fallback confirmation + record earnings
 * Also handles tip payments charged with saved payment methods.
 */
async function handlePaymentIntentSucceeded(
  supabase: ReturnType<typeof createClient>,
  paymentIntent: Stripe.PaymentIntent,
  stripeEventId: string
) {
  console.log(`[stripe-webhook] payment_intent.succeeded: ${paymentIntent.id}`);
  console.log(`[stripe-webhook] PI metadata:`, JSON.stringify(paymentIntent.metadata));
  console.log(`[stripe-webhook] PI amount: ${paymentIntent.amount}, currency: ${paymentIntent.currency}`);

  const meta = paymentIntent.metadata || {};

  // --- TIP (off-session charge via saved method) ---
  if (meta.type === "tip") {
    console.log(`[stripe-webhook] Detected TIP payment_intent`);
    await recordTipEarning(supabase, {
      eventId: meta.event_id || "",
      tipperUserId: meta.user_id || "",
      amountCents: paymentIntent.amount || 0,
      currency: paymentIntent.currency || "usd",
      stripePaymentIntentId: paymentIntent.id,
      stripeCheckoutSessionId: null,
      stripeEventId,
    });
    return;
  }

  // --- TICKET fallback ---
  const eventId = meta.event_id;
  const userId = meta.user_id;

  if (!eventId || !userId) {
    console.log("[stripe-webhook] No event_id/user_id in PI metadata, skipping ticket update");
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

  console.log(`[stripe-webhook] Updated ${tickets?.length || 0} tickets from PI`);

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
 * Record a creator earning for a TICKET purchase.
 * Uses stripe_event_id as unique key for idempotency.
 * Platform fee is 10%.
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
  console.log(`[stripe-webhook] Recording ticket earnings for event ${params.eventId}, amount: ${params.amountCents} cents`);

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
    if (error.code === "23505") {
      console.log("[stripe-webhook] Earnings already recorded for this event, skipping (idempotent)");
    } else {
      console.error("[stripe-webhook] ❌ Error recording creator earning:", error);
    }
  } else {
    console.log(`[stripe-webhook] ✅ Recorded ticket earning: $${(params.amountCents / 100).toFixed(2)} gross, $${(amountNet / 100).toFixed(2)} net for creator ${event.creator_id}`);
  }
}

/**
 * Record a creator earning for a TIP payment.
 * Tips have no ticket_id. Uses stripe_event_id for idempotency.
 * Platform fee is 10%.
 */
async function recordTipEarning(
  supabase: ReturnType<typeof createClient>,
  params: {
    eventId: string;
    tipperUserId: string;
    amountCents: number;
    currency: string;
    stripePaymentIntentId: string | null;
    stripeCheckoutSessionId: string | null;
    stripeEventId: string;
  }
) {
  console.log(`[stripe-webhook] Recording TIP earnings, event: ${params.eventId || "(none)"}, amount: ${params.amountCents} cents`);

  if (!params.eventId || !params.tipperUserId) {
    console.error("[stripe-webhook] Missing event_id or user_id for tip earning");
    return;
  }

  // Look up creator from the event
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("creator_id")
    .eq("id", params.eventId)
    .maybeSingle();

  if (eventError || !event) {
    console.error("[stripe-webhook] Could not find event for tip earning:", params.eventId, eventError);
    return;
  }

  // Don't record self-tips
  if (event.creator_id === params.tipperUserId) {
    console.log("[stripe-webhook] Skipping self-tip earnings");
    return;
  }

  const PLATFORM_FEE_PERCENT = 10;
  const platformFee = Math.round(params.amountCents * PLATFORM_FEE_PERCENT / 100);
  const amountNet = params.amountCents - platformFee;

  const { error } = await supabase.from("creator_earnings").insert({
    creator_id: event.creator_id,
    event_id: params.eventId,
    ticket_id: null, // Tips have no ticket
    user_id: params.tipperUserId,
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
    if (error.code === "23505") {
      console.log("[stripe-webhook] Tip earning already recorded, skipping (idempotent)");
    } else {
      console.error("[stripe-webhook] ❌ Error recording tip earning:", error);
    }
  } else {
    console.log(`[stripe-webhook] ✅ Recorded TIP earning: $${(params.amountCents / 100).toFixed(2)} gross, $${(amountNet / 100).toFixed(2)} net for creator ${event.creator_id}`);
  }
}

/**
 * Handle charge.refunded — mark ticket as refunded + update earnings
 */
async function handleChargeRefunded(
  supabase: ReturnType<typeof createClient>,
  charge: any
) {
  const paymentIntentId = charge.payment_intent;
  console.log(`[stripe-webhook] charge.refunded: ${charge.id}, pi: ${paymentIntentId}`);

  if (!paymentIntentId) {
    console.log("[stripe-webhook] No payment_intent on refunded charge, skipping");
    return;
  }

  // Find earnings by stripe_payment_intent_id
  const { data: earning, error: earningError } = await supabase
    .from("creator_earnings")
    .select("id, event_id, user_id, ticket_id")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .maybeSingle();

  if (earningError) {
    console.error("[stripe-webhook] Error finding earning for refund:", earningError);
  }

  // Update earning status to refunded
  if (earning) {
    await supabase
      .from("creator_earnings")
      .update({ status: "refunded" })
      .eq("id", earning.id);
    console.log(`[stripe-webhook] ✅ Earning ${earning.id} marked as refunded`);

    // Only update ticket if this earning had a ticket (not a tip)
    if (earning.ticket_id) {
      const { error: ticketError } = await supabase
        .from("tickets")
        .update({ payment_status: "refunded" })
        .eq("event_id", earning.event_id)
        .eq("user_id", earning.user_id)
        .eq("payment_status", "paid");

      if (ticketError) {
        console.error("[stripe-webhook] Error updating ticket for refund:", ticketError);
      } else {
        console.log(`[stripe-webhook] ✅ Ticket marked as refunded`);
      }
    }
  } else {
    console.warn(`[stripe-webhook] ⚠️ No earning found for PI: ${paymentIntentId}`);
  }
}
