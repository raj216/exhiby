import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "npm:stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

/**
 * Resolve the correct platform fee % for a creator.
 *   Free plan, sessions 1–10: 0%
 *   Free plan, sessions 11+:  8%
 *   Pro / Plus:                4%
 */
async function resolveCommissionPct(
  supabase: ReturnType<typeof createClient>,
  creatorId: string
): Promise<number> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("user_id", creatorId)
    .maybeSingle();

  const plan: string = (profile?.plan as string) ?? "free";

  if (plan === "pro" || plan === "plus") return 4;

  const { data: earningRows } = await supabase
    .from("creator_earnings")
    .select("event_id")
    .eq("creator_id", creatorId)
    .eq("status", "succeeded");

  const distinctSessionCount = new Set((earningRows ?? []).map((r: { event_id: string }) => r.event_id)).size;
  if (distinctSessionCount < 10) {
    console.log(`[charge-saved-method] Creator ${creatorId} free plan session ${distinctSessionCount + 1}/10 → 0% commission`);
    return 0;
  }
  console.log(`[charge-saved-method] Creator ${creatorId} free plan session ${distinctSessionCount + 1} → 8% commission`);
  return 8;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Calculate processing fee in cents: ceil((priceCents * 29) / 1000 + 30) */
function calcProcessingFeeCents(ticketPriceCents: number): number {
  if (ticketPriceCents <= 0) return 0;
  return Math.ceil((ticketPriceCents * 29) / 1000 + 30);
}

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
    const payment_method_id = body?.payment_method_id;

    if (typeof event_id !== "string" || !uuidRegex.test(event_id)) {
      return new Response(JSON.stringify({ error: "Invalid event_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!payment_method_id || typeof payment_method_id !== "string") {
      return new Response(JSON.stringify({ error: "Missing payment_method_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2025-08-27.basil" });

    // Get event
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
    if (isFree) {
      // Free event — create ticket directly
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
        return new Response(JSON.stringify({ error: "Failed to create ticket" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({ success: true, ticket_id: ticket.id, free: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Paid event — charge saved payment method
    const ticketPriceCents = Math.round(Number(event.price) * 100);
    if (ticketPriceCents < 100) {
      return new Response(JSON.stringify({ error: "Price must be at least $1.00" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Calculate processing fee and total charge amount
    const processingFeeCents = calcProcessingFeeCents(ticketPriceCents);
    const totalChargeCents = ticketPriceCents + processingFeeCents;

    // Resolve the canonical Stripe customer from profiles
    let customerId: string;
    const { data: buyerProfile } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    customerId =
      (buyerProfile as { stripe_customer_id?: string | null } | null)?.stripe_customer_id ?? "";

    if (!customerId) {
      if (!user.email) {
        return new Response(JSON.stringify({ error: "User email required for payment" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Fallback: look up by email then persist the canonical ID
      const existing = await stripe.customers.list({ email: user.email, limit: 1 });
      if (existing.data.length > 0) {
        customerId = existing.data[0].id;
      } else {
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: { supabase_user_id: user.id },
        });
        customerId = customer.id;
      }
      await supabase
        .from("profiles")
        .update({ stripe_customer_id: customerId } as never)
        .eq("user_id", user.id);
    }

    // Create pending ticket (amount = original ticket price, NOT total)
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
      console.error("[charge-saved-method] Pending ticket error:", pendingError);
      return new Response(JSON.stringify({ error: "Failed to create pending ticket" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create and confirm PaymentIntent with saved method — charge total (ticket + fee)
    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: totalChargeCents,
        currency: "usd",
        customer: customerId,
        payment_method: payment_method_id,
        off_session: true,
        confirm: true,
        metadata: {
          event_id,
          user_id: user.id,
          ticket_id: pendingTicket.id,
          ticket_price_cents: String(ticketPriceCents),
          processing_fee_cents: String(processingFeeCents),
        },
        description: `Ticket for: ${event.title}`,
      });

      if (paymentIntent.status === "succeeded") {
        // Payment succeeded — mark ticket as paid immediately
        await supabase
          .from("tickets")
          .update({
            payment_status: "paid",
            purchased_at: new Date().toISOString(),
          })
          .eq("id", pendingTicket.id);

        console.log(`[charge-saved-method] Payment succeeded for ticket ${pendingTicket.id} (ticket: ${ticketPriceCents}c + fee: ${processingFeeCents}c = ${totalChargeCents}c)`);

        // Record creator earnings directly (webhooks may not fire for off-session charges)
        if (event.creator_id !== user.id) {
          const commissionPct = await resolveCommissionPct(supabase, event.creator_id);
          const platformFee = Math.round(ticketPriceCents * commissionPct / 100);
          const amountNet = ticketPriceCents - platformFee;

          const { error: earningsError } = await supabase.from("creator_earnings").insert({
            creator_id: event.creator_id,
            event_id,
            ticket_id: pendingTicket.id,
            user_id: user.id,
            stripe_payment_intent_id: paymentIntent.id,
            stripe_checkout_session_id: null,
            amount_gross: ticketPriceCents,
            platform_fee: platformFee,
            amount_net: amountNet,
            currency: "usd",
            status: "succeeded",
            stripe_event_id: `charge_saved_${paymentIntent.id}`,
          });

          if (earningsError) {
            if (earningsError.code === "23505") {
              console.log("[charge-saved-method] Earnings already recorded (idempotent)");
            } else {
              console.error("[charge-saved-method] Error recording earnings:", earningsError);
            }
          } else {
            console.log(`[charge-saved-method] ✅ Recorded earning: $${(ticketPriceCents / 100).toFixed(2)} gross, $${(amountNet / 100).toFixed(2)} net for creator ${event.creator_id}`);
          }
        }

        return new Response(
          JSON.stringify({
            success: true,
            ticket_id: pendingTicket.id,
            payment_intent_id: paymentIntent.id,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Payment requires action (3D Secure etc.)
      if (paymentIntent.status === "requires_action") {
        return new Response(
          JSON.stringify({
            success: false,
            requires_action: true,
            client_secret: paymentIntent.client_secret,
            payment_intent_id: paymentIntent.id,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Other status
      return new Response(
        JSON.stringify({
          success: false,
          error: `Payment status: ${paymentIntent.status}`,
          status: paymentIntent.status,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (stripeError: any) {
      console.error("[charge-saved-method] Stripe error:", stripeError);

      // Card declined or payment failed
      if (stripeError.type === "StripeCardError") {
        // Mark ticket as failed
        await supabase
          .from("tickets")
          .update({ payment_status: "failed" })
          .eq("id", pendingTicket.id);

        return new Response(
          JSON.stringify({
            success: false,
            card_error: true,
            error: stripeError.message || "Your card was declined",
            decline_code: stripeError.decline_code || null,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw stripeError;
    }
  } catch (error) {
    console.error("[charge-saved-method] Unexpected error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
