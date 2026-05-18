import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Authenticate the caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the JWT to get the user
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub;
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Service-role client (bypasses RLS for the eligibility check + insert)
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // ── Server-side eligibility gate ──────────────────────────────────────
    // Creator role is ONLY granted to users whose creator_applications row
    // has been APPROVED by an admin. Without this check any authenticated
    // user could call this endpoint and bypass the entire verification /
    // review flow — making the application system meaningless.
    const { data: application, error: appError } = await adminClient
      .from("creator_applications")
      .select("status")
      .eq("user_id", userId)
      .maybeSingle();

    if (appError) {
      console.error("Eligibility check failed:", appError);
      return new Response(
        JSON.stringify({ error: "Eligibility check failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!application || application.status !== "approved") {
      return new Response(
        JSON.stringify({ error: "Not eligible: your creator application has not been approved" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Eligible — grant the creator role
    const { error: insertError } = await adminClient
      .from("user_roles")
      .insert({ user_id: userId, role: "creator" });

    if (insertError) {
      // Duplicate - already a creator
      if (insertError.code === "23505" || insertError.message?.includes("duplicate")) {
        return new Response(
          JSON.stringify({ success: true, already_creator: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.error("Failed to activate creator role:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to activate creator role" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error in activate-creator-role:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
