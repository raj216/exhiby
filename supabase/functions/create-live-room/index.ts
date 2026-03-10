import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

// Check if origin is from Lovable domains
function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  
  // Allow all Lovable project domains (preview and production)
  if (origin.endsWith(".lovableproject.com") || origin.endsWith(".lovable.app")) {
    return true;
  }
  
  // Allow localhost for development
  if (origin.startsWith("http://localhost:")) {
    return true;
  }
  
  return false;
}

function getCorsHeaders(origin: string | null): Record<string, string> {
  // If origin is allowed, reflect it back; otherwise use wildcard for preflight
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
      .select("creator_id")
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

    // Check if room already exists in event_rooms table
    const { data: existingRoom } = await supabase
      .from("event_rooms")
      .select("room_url")
      .eq("event_id", event_id)
      .maybeSingle();

    if (existingRoom?.room_url) {
      console.log("[create-live-room] Room already exists:", existingRoom.room_url);
      return new Response(JSON.stringify({ room_url: existingRoom.room_url, event_id }), {
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

    // Insert room_url into protected event_rooms table (with retry for transient connection errors)
    let roomInsertError = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const { error } = await supabase
        .from("event_rooms")
        .upsert({
          event_id: event_id,
          room_url: roomUrl,
          updated_at: new Date().toISOString(),
        }, { onConflict: "event_id" });

      if (!error) {
        roomInsertError = null;
        console.log(`[create-live-room] Room URL stored successfully (attempt ${attempt})`);
        break;
      }

      roomInsertError = error;
      console.warn(`[create-live-room] Room insert attempt ${attempt}/3 failed:`, error.message);
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 500 * attempt));
      }
    }

    if (roomInsertError) {
      console.error("[create-live-room] Room insert failed after 3 attempts:", roomInsertError);
      return new Response(JSON.stringify({ error: "Failed to store room URL" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update event to set live status (room_url no longer stored here)
    const { error: updateError } = await supabase
      .from("events")
      .update({
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

    console.log("[create-live-room] Event updated successfully, is_live is now TRUE");

    // NOW trigger live notifications since is_live is confirmed true
    // Get creator profile for notification
    const { data: creatorProfile } = await supabase
      .from("profiles")
      .select("name")
      .eq("user_id", user.id)
      .single();

    const creatorName = creatorProfile?.name || "A creator";

    // Get all followers
    const { data: followers } = await supabase
      .from("follows")
      .select("follower_id")
      .eq("following_id", user.id);

    if (followers && followers.length > 0) {
      const followerIds = followers.map((f) => f.follower_id);

      // Get notification preferences
      const { data: preferences } = await supabase
        .from("notification_preferences")
        .select("user_id, inapp_live")
        .in("user_id", followerIds);

      const prefsMap = new Map<string, boolean>();
      (preferences || []).forEach((p) => prefsMap.set(p.user_id, p.inapp_live));

      const title = `${creatorName} is LIVE now`;
      const message = "Enter the Studio";
      const link = `/live/${event_id}`;

      let createdCount = 0;
      for (const followerId of followerIds) {
        const shouldNotify = prefsMap.get(followerId) ?? true; // Default to true

        if (shouldNotify) {
          const { error: notifError } = await supabase.rpc("create_notification", {
            p_user_id: followerId,
            p_type: "studio_live",
            p_title: title,
            p_message: message,
            p_link: link,
          });

          if (!notifError) createdCount++;
        }
      }
      console.log(`[create-live-room] Created ${createdCount} live notifications`);

      // Trigger email notifications (fire and forget)
      const functionUrl = `${supabaseUrl}/functions/v1/send-notification-email`;
      fetch(functionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          event_id: event_id,
          email_type: "studio_live",
        }),
      }).catch((err) => console.error("[create-live-room] Email trigger error:", err));
    }

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
