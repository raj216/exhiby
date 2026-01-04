import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

// Allowed origins for CORS - restrict to application domains only
const ALLOWED_ORIGINS = [
  "https://owvwwslbwbarvmjjtlkz.lovableproject.com",
  "https://owvwwslbwbarvmjjtlkz.lovable.app",
  Deno.env.get("ALLOWED_ORIGIN") || "http://localhost:5173",
];

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) 
    ? origin 
    : ALLOWED_ORIGINS[0];
  
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Credentials": "true",
  };
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[create-live-room] Starting...");

    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("[create-live-room] No authorization header");
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from JWT
    const jwt = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);
    
    if (userError || !user) {
      console.error("[create-live-room] User auth error:", userError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[create-live-room] Authenticated user:", user.id);

    // Parse request body
    const { event_id } = await req.json();
    console.log("[create-live-room] Event ID:", event_id);

    if (!event_id) {
      return new Response(JSON.stringify({ error: "event_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate event_id format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (typeof event_id !== "string" || !uuidRegex.test(event_id)) {
      console.error("[create-live-room] Invalid event_id format:", event_id);
      return new Response(JSON.stringify({ error: "Invalid event_id format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user is the event creator
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("creator_id, room_url")
      .eq("id", event_id)
      .single();

    if (eventError || !event) {
      console.error("[create-live-room] Event fetch error:", eventError);
      return new Response(JSON.stringify({ error: "Event not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (event.creator_id !== user.id) {
      console.error("[create-live-room] User is not event creator");
      return new Response(JSON.stringify({ error: "Not authorized to go live on this event" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If room already exists, return it
    if (event.room_url) {
      console.log("[create-live-room] Room already exists:", event.room_url);
      return new Response(JSON.stringify({ room_url: event.room_url, event_id }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create Daily.co room
    const dailyApiKey = Deno.env.get("DAILY_API_KEY");
    if (!dailyApiKey) {
      console.error("[create-live-room] DAILY_API_KEY not configured");
      return new Response(JSON.stringify({ error: "Live streaming is not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const roomName = `exhiby-${event_id.slice(0, 8)}-${Date.now()}`;
    console.log("[create-live-room] Creating Daily room:", roomName);

    const dailyResponse = await fetch("https://api.daily.co/v1/rooms", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${dailyApiKey}`,
      },
      body: JSON.stringify({
        name: roomName,
        properties: {
          enable_screenshare: true,
          enable_chat: true,
          start_video_off: false,
          start_audio_off: false,
          exp: Math.floor(Date.now() / 1000) + 86400, // 24 hour expiry
          eject_at_room_exp: true,
        },
      }),
    });

    if (!dailyResponse.ok) {
      const dailyError = await dailyResponse.text();
      console.error("[create-live-room] Daily API error:", dailyError);
      return new Response(JSON.stringify({ error: "Failed to create live room" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dailyRoom = await dailyResponse.json();
    const roomUrl = dailyRoom.url;
    console.log("[create-live-room] Daily room created:", roomUrl);

    // Update event with room_url and set live
    const { error: updateError } = await supabase
      .from("events")
      .update({
        room_url: roomUrl,
        is_live: true,
        live_started_at: new Date().toISOString(),
        viewer_count: 0,
      })
      .eq("id", event_id);

    if (updateError) {
      console.error("[create-live-room] Event update error:", updateError);
      return new Response(JSON.stringify({ error: "Failed to update event" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[create-live-room] Event updated successfully");

    return new Response(JSON.stringify({ room_url: roomUrl, event_id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[create-live-room] Unexpected error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...getCorsHeaders(null), "Content-Type": "application/json" },
    });
  }
});
