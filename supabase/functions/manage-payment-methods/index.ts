// supabase/functions/manage-payment-methods/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@13.11.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");

    const { action, paymentMethodId } = await req.json();

    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    let customerId = (profile as { stripe_customer_id?: string | null } | null)?.stripe_customer_id ?? null;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
      const { error: updErr } = await supabase
        .from("profiles")
        .update({ stripe_customer_id: customerId } as never)
        .eq("user_id", user.id);
      if (updErr) console.error("[manage-payment-methods] failed to persist stripe_customer_id", updErr);
    }

    const respond = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    switch (action) {
      case "list": {
        const [pms, customer] = await Promise.all([
          stripe.paymentMethods.list({ customer: customerId, type: "card" }),
          stripe.customers.retrieve(customerId) as Promise<Stripe.Customer>,
        ]);
        const defaultId = customer.invoice_settings?.default_payment_method as string | null;
        return respond({
          paymentMethods: pms.data.map((pm) => ({
            id: pm.id,
            brand: pm.card?.brand ?? "card",
            last4: pm.card?.last4 ?? "••••",
            exp_month: pm.card?.exp_month,
            exp_year: pm.card?.exp_year,
            isDefault: pm.id === defaultId,
          })),
        });
      }

      case "set_default": {
        if (!paymentMethodId) throw new Error("paymentMethodId required");
        const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
        if (pm.customer !== customerId) {
          return respond({ error: "Forbidden" }, 403);
        }
        await stripe.customers.update(customerId, {
          invoice_settings: { default_payment_method: paymentMethodId },
        });
        return respond({ success: true });
      }

      case "remove": {
        if (!paymentMethodId) throw new Error("paymentMethodId required");
        const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
        if (pm.customer !== customerId) {
          return respond({ error: "Forbidden" }, 403);
        }
        await stripe.paymentMethods.detach(paymentMethodId);
        return respond({ success: true });
      }

      case "create_portal_session": {
        const siteUrl = Deno.env.get("SITE_URL") ?? "https://joinexhiby.com";
        const session = await stripe.billingPortal.sessions.create({
          customer: customerId,
          return_url: `${siteUrl}/settings`,
        });
        return respond({ url: session.url });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (err) {
    console.error("[manage-payment-methods]", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
