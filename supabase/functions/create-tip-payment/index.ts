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
    console.log(`[create-tip-payment] Creator ${creatorId} free plan session ${distinctSessionCount + 1}/10 → 0% commission`);
    return 0;
  }
  console.log(`[create-tip-payment] Creator ${creatorId} free plan session ${distinctSessionCount + 1} → 8% commission`);
  return 8;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
    const { amount, payment_method_id, event_id } = body;

    // Guard the full numeric range: rejects 0/negative, NaN, and Infinity (which
    // passed the old `amount < 1` check and blew up Math.round(amount * 100)),
    // plus an upper bound so a crafted request can't charge an arbitrary amount.
    const MAX_TIP_USD = 10000;
    if (
      typeof amount !== "number" ||
      !Number.isFinite(amount) ||
      amount < 1 ||
      amount > MAX_TIP_USD
    ) {
      return new Response(
        JSON.stringify({ error: `Invalid tip amount (must be between $1 and $${MAX_TIP_USD})` }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2025-08-27.basil" });
    const tipCents = Math.round(amount * 100);
    // Buyer-paid processing fee: ceil(price * 2.9% + 30¢)
    const processingFeeCents = Math.ceil((tipCents * 29) / 1000 + 30);
    const amountCents = tipCents + processingFeeCents;

    // Resolve the canonical Stripe customer from profiles
    const tipServiceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    let customerId: string;

    const { data: tipperProfile } = await tipServiceClient
      .from("profiles")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    customerId =
      (tipperProfile as { stripe_customer_id?: string | null } | null)?.stripe_customer_id ?? "";

    if (!customerId) {
      if (!user.email) {
        return new Response(JSON.stringify({ error: "User email required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
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
      await tipServiceClient
        .from("profiles")
        .update({ stripe_customer_id: customerId } as never)
        .eq("user_id", user.id);
    }

    if (payment_method_id) {
      // Charge saved payment method
      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amountCents,
          currency: "usd",
          customer: customerId,
          payment_method: payment_method_id,
          off_session: true,
          confirm: true,
          metadata: {
            type: "tip",
            event_id: event_id || "",
            user_id: user.id,
            tip_amount_cents: String(tipCents),
          },
          description: "Tip to creator",
        });

        if (paymentIntent.status === "succeeded") {
          // Record tip earnings directly (webhooks may not fire for off-session charges)
          if (event_id) {
            const serviceClient = tipServiceClient;
            const { data: eventData } = await serviceClient
              .from("events")
              .select("creator_id")
              .eq("id", event_id)
              .maybeSingle();

            if (eventData && eventData.creator_id !== user.id) {
              const commissionPct = await resolveCommissionPct(serviceClient, eventData.creator_id);
              const platformFee = Math.round(tipCents * commissionPct / 100);
              const amountNet = tipCents - platformFee;

              const { error: earningsError } = await serviceClient.from("creator_earnings").insert({
                creator_id: eventData.creator_id,
                event_id,
                ticket_id: null,
                user_id: user.id,
                stripe_payment_intent_id: paymentIntent.id,
                stripe_checkout_session_id: null,
                amount_gross: tipCents,
                platform_fee: platformFee,
                amount_net: amountNet,
                currency: "usd",
                status: "succeeded",
                // Deterministic idempotency key on the payment intent. The
                // stripe-webhook ALSO receives payment_intent.succeeded for this
                // off-session charge and records the same tip — using the same
                // `tip_${pi}` key on both paths lets the stripe_event_id UNIQUE
                // constraint collapse them into ONE earning (no double-count).
                stripe_event_id: `tip_${paymentIntent.id}`,
              });

              if (earningsError) {
                if (earningsError.code === "23505") {
                  console.log("[create-tip-payment] Tip earning already recorded (idempotent)");
                } else {
                  console.error("[create-tip-payment] Error recording tip earning:", earningsError);
                }
              } else {
                console.log(`[create-tip-payment] ✅ Recorded tip earning: $${(tipCents / 100).toFixed(2)} gross, $${(amountNet / 100).toFixed(2)} net`);

                // Persistent in-app notification for the creator (bell + drawer).
                // Best-effort: a notification failure must not fail the tip.
                try {
                  const { data: tipper } = await serviceClient
                    .from("profiles")
                    .select("name, handle")
                    .eq("user_id", user.id)
                    .maybeSingle();
                  const tipperName = tipper?.name || tipper?.handle || "Someone";
                  const amountStr = `$${(tipCents / 100).toFixed(2)}`;
                  const { error: notifyError } = await serviceClient.from("notifications").insert({
                    user_id: eventData.creator_id,
                    type: "tip_received",
                    title: `💝 ${amountStr} tip received`,
                    message: `${tipperName} sent you a ${amountStr} tip`,
                    link: "/settings?tab=payments",
                  });
                  if (notifyError) {
                    console.error("[create-tip-payment] Failed to insert tip notification:", notifyError);
                  } else {
                    console.log(`[create-tip-payment] ✅ Tip notification created for creator ${eventData.creator_id}`);
                  }
                } catch (notifyErr) {
                  console.error("[create-tip-payment] Tip notification exception:", notifyErr);
                }
              }
            }
          }

          return new Response(
            JSON.stringify({ success: true, payment_intent_id: paymentIntent.id }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: false, error: `Payment status: ${paymentIntent.status}` }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (stripeError: any) {
        if (stripeError.type === "StripeCardError") {
          return new Response(
            JSON.stringify({
              success: false,
              card_error: true,
              error: stripeError.message || "Card declined",
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        throw stripeError;
      }
    } else {
      // No saved method — create a Checkout session for the tip
      // SECURITY: Never trust client-supplied origin (open redirect risk).
      const origin = Deno.env.get("PUBLIC_SITE_URL") ?? "https://exhiby.lovable.app";

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: "Tip to Creator",
                description: `$${amount} tip`,
              },
              unit_amount: amountCents,
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        metadata: {
          type: "tip",
          event_id: event_id || "",
          user_id: user.id,
          tip_amount_cents: String(tipCents),
        },
        payment_intent_data: {
          setup_future_usage: "off_session",
          metadata: {
            type: "tip",
            event_id: event_id || "",
            user_id: user.id,
            tip_amount_cents: String(tipCents),
          },
        },
        success_url: `${origin}/live/${event_id || ""}?tip=success`,
        cancel_url: `${origin}/live/${event_id || ""}?tip=canceled`,
      });

      return new Response(
        JSON.stringify({ url: session.url }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("[create-tip-payment] Error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
