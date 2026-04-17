import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "npm:stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

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

    if (!amount || typeof amount !== "number" || amount < 1) {
      return new Response(JSON.stringify({ error: "Invalid tip amount (minimum $1)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2025-08-27.basil" });
    const tipCents = Math.round(amount * 100);
    // Buyer-paid processing fee: ceil(price * 2.9% + 30¢)
    const processingFeeCents = Math.ceil((tipCents * 29) / 1000 + 30);
    const amountCents = tipCents + processingFeeCents;

    // Find or create customer
    let customerId: string;
    if (user.email) {
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
      } else {
        const customer = await stripe.customers.create({ email: user.email });
        customerId = customer.id;
      }
    } else {
      return new Response(JSON.stringify({ error: "User email required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
            const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
            const { data: eventData } = await serviceClient
              .from("events")
              .select("creator_id")
              .eq("id", event_id)
              .maybeSingle();

            if (eventData && eventData.creator_id !== user.id) {
              const PLATFORM_FEE_PERCENT = 10;
              const platformFee = Math.round(tipCents * PLATFORM_FEE_PERCENT / 100);
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
                stripe_event_id: `tip_saved_${paymentIntent.id}`,
              });

              if (earningsError) {
                if (earningsError.code === "23505") {
                  console.log("[create-tip-payment] Tip earning already recorded (idempotent)");
                } else {
                  console.error("[create-tip-payment] Error recording tip earning:", earningsError);
                }
              } else {
                console.log(`[create-tip-payment] ✅ Recorded tip earning: $${(tipCents / 100).toFixed(2)} gross, $${(amountNet / 100).toFixed(2)} net`);
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
      const origin = body?.origin || req.headers.get("origin") || "https://exhiby.lovable.app";

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
