import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "npm:stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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

    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2025-08-27.basil" });

    const { action, payment_method_id, return_url } = await req.json().catch(() => ({}));

    // Helper: find or create Stripe customer by email
    async function getOrCreateCustomer(): Promise<Stripe.Customer> {
      if (!user.email) throw new Error("User has no email");
      const existing = await stripe.customers.list({ email: user.email, limit: 1 });
      if (existing.data.length > 0) return existing.data[0];
      return stripe.customers.create({ email: user.email, metadata: { supabase_user_id: user.id } });
    }

    // ── LIST all saved cards ──────────────────────────────────────────────
    if (action === "list") {
      const customer = await getOrCreateCustomer();

      const paymentMethods = await stripe.paymentMethods.list({
        customer: customer.id,
        type: "card",
        limit: 20,
      });

      // Determine default payment method
      const customerData = await stripe.customers.retrieve(customer.id) as Stripe.Customer;
      const defaultPmId =
        (customerData.invoice_settings?.default_payment_method as string | null) ||
        null;

      const cards = paymentMethods.data.map((pm) => ({
        id: pm.id,
        brand: pm.card?.brand || "card",
        last4: pm.card?.last4 || "****",
        exp_month: pm.card?.exp_month,
        exp_year: pm.card?.exp_year,
        is_default: pm.id === defaultPmId,
      }));

      return new Response(
        JSON.stringify({ cards, customer_id: customer.id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── SET DEFAULT payment method ────────────────────────────────────────
    if (action === "set_default") {
      if (!payment_method_id) {
        return new Response(JSON.stringify({ error: "payment_method_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const customer = await getOrCreateCustomer();
      await stripe.customers.update(customer.id, {
        invoice_settings: { default_payment_method: payment_method_id },
      });
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── REMOVE a payment method ───────────────────────────────────────────
    if (action === "remove") {
      if (!payment_method_id) {
        return new Response(JSON.stringify({ error: "payment_method_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Verify ownership: make sure the PM belongs to this customer
      const customer = await getOrCreateCustomer();
      const pm = await stripe.paymentMethods.retrieve(payment_method_id);
      if (pm.customer !== customer.id) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await stripe.paymentMethods.detach(payment_method_id);
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── CREATE Billing Portal session ─────────────────────────────────────
    if (action === "billing_portal") {
      const customer = await getOrCreateCustomer();
      const origin = return_url || "https://joinexhiby.com/settings";
      const session = await stripe.billingPortal.sessions.create({
        customer: customer.id,
        return_url: origin,
      });
      return new Response(
        JSON.stringify({ url: session.url }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[manage-payment-methods] Error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
