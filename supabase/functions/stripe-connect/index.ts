// Stripe Connect Edge Function v2 - uses service role for profile queries
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

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY")!;

  if (!stripeSecretKey) {
    return new Response(JSON.stringify({ error: "Stripe not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
  if (claimsError || !claimsData?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userId = claimsData.user.id;
  const userEmail = claimsData.user.email;

  try {
    const { action } = await req.json();
    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2025-08-27.basil" });

    // Use service role to read stripe_connected_account_id (bypasses RLS)
    const supabaseAdmin = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: connectAccount } = await supabaseAdmin
      .from("stripe_connect_accounts")
      .select("stripe_connected_account_id")
      .eq("user_id", userId)
      .maybeSingle();

    const connectedAccountId = connectAccount?.stripe_connected_account_id;

    switch (action) {
      case "get_status": {
        // Return onboarding status
        if (!connectedAccountId) {
          return new Response(
            JSON.stringify({ status: "not_connected", account_id: null }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const account = await stripe.accounts.retrieve(connectedAccountId);
        const chargesEnabled = account.charges_enabled;
        const payoutsEnabled = account.payouts_enabled;
        const detailsSubmitted = account.details_submitted;

        return new Response(
          JSON.stringify({
            status: chargesEnabled && payoutsEnabled ? "active" : detailsSubmitted ? "pending_verification" : "onboarding_incomplete",
            account_id: connectedAccountId,
            charges_enabled: chargesEnabled,
            payouts_enabled: payoutsEnabled,
            details_submitted: detailsSubmitted,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "create_account": {
        // US-only enforcement — server-side country check
        const { data: profileData } = await supabaseAdmin
          .from("profiles")
          .select("country_code")
          .eq("user_id", userId)
          .maybeSingle();

        if (profileData?.country_code && profileData.country_code !== "US") {
          return new Response(
            JSON.stringify({
              error: "us_only",
              message: "Studio hosting is currently available in the US only. Stay tuned for your region.",
            }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Create a new Express connected account
        if (connectedAccountId) {
          return new Response(
            JSON.stringify({ error: "Account already exists", account_id: connectedAccountId }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const account = await stripe.accounts.create({
          type: "express",
          country: "US",
          email: userEmail,
          metadata: { user_id: userId },
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
          },
        });

        // Store connected account ID in private table
        await supabaseAdmin
          .from("stripe_connect_accounts")
          .upsert({
            user_id: userId,
            stripe_connected_account_id: account.id,
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id" });

        return new Response(
          JSON.stringify({ account_id: account.id }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "create_onboarding_link": {
        // Generate an account link for onboarding
        const accountId = connectedAccountId;
        if (!accountId) {
          return new Response(
            JSON.stringify({ error: "No connected account. Create one first." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // SECURITY: Never trust client-supplied origin (open redirect risk).
        const origin = Deno.env.get("PUBLIC_SITE_URL") ?? "https://exhiby.lovable.app";
        const accountLink = await stripe.accountLinks.create({
          account: accountId,
          refresh_url: `${origin}/earnings-history?stripe_onboarding=refresh`,
          return_url: `${origin}/earnings-history?stripe_onboarding=complete`,
          type: "account_onboarding",
        });

        return new Response(
          JSON.stringify({ url: accountLink.url }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "create_dashboard_link": {
        // Generate a login link to the Express dashboard
        const accountId = connectedAccountId;
        if (!accountId) {
          return new Response(
            JSON.stringify({ error: "No connected account" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const loginLink = await stripe.accounts.createLoginLink(accountId);

        return new Response(
          JSON.stringify({ url: loginLink.url }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "request_payout": {
        // Create a transfer to the connected account (simplified payout)
        const accountId = connectedAccountId;
        if (!accountId) {
          return new Response(
            JSON.stringify({ error: "No connected account" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Verify the account can receive payouts
        const account = await stripe.accounts.retrieve(accountId);
        if (!account.payouts_enabled) {
          return new Response(
            JSON.stringify({ error: "Payouts not enabled. Complete onboarding first." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Calculate available balance from creator_earnings
        const { data: earnings } = await supabaseAdmin
          .from("creator_earnings")
          .select("amount_net")
          .eq("creator_id", userId)
          .eq("status", "succeeded");

        const { data: previousPayouts } = await supabaseAdmin
          .from("creator_payouts")
          .select("amount")
          .eq("creator_id", userId)
          .in("status", ["pending", "paid"]);

        const totalEarned = (earnings || []).reduce((sum, e) => sum + (e.amount_net || 0), 0);
        const totalPaidOut = (previousPayouts || []).reduce((sum, p) => sum + (p.amount || 0), 0);
        const available = totalEarned - totalPaidOut;

        if (available <= 0) {
          return new Response(
            JSON.stringify({ error: "No available balance to payout" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // CRITICAL: Insert pending payout row FIRST. The unique partial index
        // (creator_id where status='pending') guarantees only one concurrent
        // payout per creator — concurrent calls fail here with 23505.
        const { data: pendingPayout, error: pendingErr } = await supabaseAdmin
          .from("creator_payouts")
          .insert({
            creator_id: userId,
            amount: available,
            currency: "usd",
            status: "pending",
          })
          .select("id")
          .single();

        if (pendingErr || !pendingPayout) {
          const isDuplicate = (pendingErr as { code?: string } | null)?.code === "23505";
          return new Response(
            JSON.stringify({
              error: isDuplicate
                ? "A payout is already being processed. Please wait."
                : "Failed to initiate payout",
            }),
            { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Use Stripe idempotency key tied to our payout row id so any retry
        // hits the same Stripe transfer instead of creating a duplicate.
        let transfer;
        try {
          transfer = await stripe.transfers.create(
            {
              amount: available,
              currency: "usd",
              destination: accountId,
              metadata: { creator_id: userId, payout_id: pendingPayout.id },
            },
            { idempotencyKey: `payout_${pendingPayout.id}` }
          );
        } catch (transferErr) {
          // Roll back pending row so the creator can retry
          await supabaseAdmin.from("creator_payouts").delete().eq("id", pendingPayout.id);
          throw transferErr;
        }

        await supabaseAdmin
          .from("creator_payouts")
          .update({ stripe_transfer_id: transfer.id, status: "paid" })
          .eq("id", pendingPayout.id);

        return new Response(
          JSON.stringify({
            success: true,
            transfer_id: transfer.id,
            amount: available,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Invalid action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error) {
    console.error("[stripe-connect] Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
