/**
 * update-profile-links
 * ─────────────────────────────────────────────────────────────────────────────
 * Saves a user's profile_links array to the database.
 *
 * Strategy:
 *  1. Verify the user JWT.
 *  2. Ensure the `profile_links` column exists via a direct Postgres connection
 *     (self-healing DDL — uses SUPABASE_DB_URL which is auto-set by Supabase).
 *  3. Upsert the user's profile_links using the service-role client.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";

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

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase    = createClient(supabaseUrl, serviceKey);

  // Verify user JWT
  const jwt = authHeader.replace("Bearer ", "");
  const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);
  if (userError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const body  = await req.json().catch(() => ({}));
  const links = Array.isArray(body?.links) ? body.links : [];

  // ── Step 1: Ensure profile_links column exists (self-healing migration) ──
  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  if (dbUrl) {
    let sql: ReturnType<typeof postgres> | null = null;
    try {
      sql = postgres(dbUrl, { ssl: "require", max: 1 });
      await sql`
        ALTER TABLE public.profiles
        ADD COLUMN IF NOT EXISTS profile_links jsonb NOT NULL DEFAULT '[]'::jsonb
      `;
      console.log("[update-profile-links] profile_links column ensured via DDL");
    } catch (ddlErr) {
      // Column might already exist or DDL failed — log and continue.
      console.warn("[update-profile-links] DDL warn (non-fatal):", String(ddlErr));
    } finally {
      if (sql) await sql.end({ timeout: 3 });
    }
  } else {
    console.warn("[update-profile-links] SUPABASE_DB_URL not available — DDL skipped");
  }

  // ── Step 2: Save links (service-role bypasses RLS) ──────────────────────
  // Cast to `any` so TypeScript doesn't complain about the column missing
  // from the generated types (which are regenerated after migration applies).
  const updatePayload: Record<string, unknown> = {
    profile_links: links,
    updated_at: new Date().toISOString(),
  };

  const { error: updateError } = await supabase
    .from("profiles")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(updatePayload as any)
    .eq("user_id", user.id);

  if (updateError) {
    console.error("[update-profile-links] update error:", updateError);
    return new Response(JSON.stringify({ error: updateError.message, code: updateError.code }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ success: true, count: links.length }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
