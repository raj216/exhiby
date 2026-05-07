/**
 * update-profile-links
 * ─────────────────────────────────────────────────────────────────────────────
 * Saves a user's profile_links array.
 *
 * Strategy:
 *  1. Verify the user JWT.
 *  2. Ensure the `profile_links` column exists on the profiles table
 *     (self-healing migration via direct Postgres connection).
 *  3. Update the authenticated user's profile_links.
 *
 * Called by the frontend EditProfileModal when saving links.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (origin.endsWith(".lovableproject.com") || origin.endsWith(".lovable.app")) return true;
  if (origin.startsWith("http://localhost:")) return true;
  return false;
}

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = isAllowedOrigin(origin) ? origin! : "*";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Credentials": "true",
  };
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

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
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Verify user JWT
    const jwt = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const links = Array.isArray(body?.links) ? body.links : [];

    // ── Ensure profile_links column exists ──────────────────────────────────
    // Use direct Postgres connection via SUPABASE_DB_URL (available in all
    // Supabase edge functions since 2023).
    const dbUrl = Deno.env.get("SUPABASE_DB_URL");

    if (dbUrl) {
      try {
        // deno-lint-ignore no-explicit-any
        const { Client } = await import("https://deno.land/x/postgres@v0.17.0/mod.ts") as any;
        const client = new Client(dbUrl);
        await client.connect();
        try {
          // DDL: add column only if it doesn't exist (idempotent)
          await client.queryObject(`
            ALTER TABLE public.profiles
            ADD COLUMN IF NOT EXISTS profile_links jsonb NOT NULL DEFAULT '[]'::jsonb;
          `);
          console.log("[update-profile-links] profile_links column ensured");
        } finally {
          await client.end();
        }
      } catch (ddlErr) {
        // Non-fatal: column might already exist, or migration was applied separately.
        // Log and continue — the update below will reveal if there's still an issue.
        console.warn("[update-profile-links] DDL attempt:", ddlErr);
      }
    } else {
      console.warn("[update-profile-links] SUPABASE_DB_URL not available, skipping DDL");
    }

    // ── Update profile_links via service role (bypasses RLS) ────────────────
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ profile_links: links } as never)
      .eq("user_id", user.id);

    if (updateError) {
      console.error("[update-profile-links] update error:", updateError);
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, count: links.length }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[update-profile-links] unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...getCorsHeaders(null), "Content-Type": "application/json" },
    });
  }
});
