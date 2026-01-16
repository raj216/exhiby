import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotifyRequest {
  event_id: string;
  notification_type: "studio_scheduled" | "studio_live";
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authorization: Verify the caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header provided");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const jwt = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      console.error("Invalid user token:", userError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { event_id, notification_type }: NotifyRequest = await req.json();
    console.log(`Creating ${notification_type} notifications for event: ${event_id} by user: ${user.id}`);

    // Fetch event details
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, title, creator_id")
      .eq("id", event_id)
      .single();

    if (eventError || !event) {
      console.error("Event not found:", eventError);
      return new Response(JSON.stringify({ error: "Event not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authorization: Verify the caller is the event creator
    if (event.creator_id !== user.id) {
      console.error(`User ${user.id} is not the creator of event ${event_id}`);
      return new Response(JSON.stringify({ error: "Not authorized to send notifications for this event" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get creator profile
    const { data: creatorProfile } = await supabase
      .from("profiles")
      .select("name")
      .eq("user_id", event.creator_id)
      .single();

    const creatorName = creatorProfile?.name || "A creator";

    // Get all followers of this creator
    const { data: followers, error: followersError } = await supabase
      .from("follows")
      .select("follower_id")
      .eq("following_id", event.creator_id);

    if (followersError || !followers || followers.length === 0) {
      console.log("No followers to notify");
      return new Response(JSON.stringify({ created: 0, message: "No followers" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const followerIds = followers.map((f) => f.follower_id);

    // Get notification preferences
    const { data: preferences } = await supabase
      .from("notification_preferences")
      .select("user_id, inapp_live, inapp_scheduled")
      .in("user_id", followerIds);

    const prefsMap = new Map<string, any>();
    (preferences || []).forEach((p) => prefsMap.set(p.user_id, p));

    // Prepare notification content with clear, human-readable copy
    let title = "";
    let message = "";
    const link = `/live/${event_id}`;

    // Get scheduled time for scheduled notifications
    let scheduledTimeStr = "";
    if (notification_type === "studio_scheduled") {
      const { data: eventDetails } = await supabase
        .from("events")
        .select("scheduled_at")
        .eq("id", event_id)
        .single();
      
      if (eventDetails?.scheduled_at) {
        const scheduledDate = new Date(eventDetails.scheduled_at);
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const isToday = scheduledDate.toDateString() === now.toDateString();
        const isTomorrow = scheduledDate.toDateString() === tomorrow.toDateString();
        
        const timeStr = scheduledDate.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });
        
        if (isToday) {
          scheduledTimeStr = `Today at ${timeStr}`;
        } else if (isTomorrow) {
          scheduledTimeStr = `Tomorrow at ${timeStr}`;
        } else {
          const dateStr = scheduledDate.toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
          });
          scheduledTimeStr = `${dateStr} at ${timeStr}`;
        }
      }
    }

    switch (notification_type) {
      case "studio_scheduled":
        title = `${creatorName} scheduled a Live Studio`;
        message = scheduledTimeStr || event.title;
        break;
      case "studio_live":
        title = `${creatorName} is LIVE now`;
        message = "Enter the Studio";
        break;
    }

    // Create in-app notifications for eligible followers
    let createdCount = 0;
    for (const followerId of followerIds) {
      const prefs = prefsMap.get(followerId) || { inapp_live: true, inapp_scheduled: true };

      let shouldNotify = false;
      if (notification_type === "studio_scheduled" && prefs.inapp_scheduled) shouldNotify = true;
      if (notification_type === "studio_live" && prefs.inapp_live) shouldNotify = true;

      if (shouldNotify) {
        // Use the SECURITY DEFINER function to create notification
        const { error: notifError } = await supabase.rpc("create_notification", {
          p_user_id: followerId,
          p_type: notification_type,
          p_title: title,
          p_message: message,
          p_link: link,
        });

        if (notifError) {
          console.error(`Failed to create notification for ${followerId}:`, notifError);
        } else {
          createdCount++;
        }
      }
    }

    console.log(`Created ${createdCount} in-app notifications`);

    // Trigger email sending (fire and forget)
    const functionUrl = `${supabaseUrl}/functions/v1/send-notification-email`;
    fetch(functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        event_id: event_id,
        email_type: notification_type,
      }),
    })
      .then((res) => {
        if (!res.ok) {
          console.error("Failed to trigger email function:", res.status);
        } else {
          console.log("Email function triggered successfully");
        }
      })
      .catch((err) => console.error("Error triggering email function:", err));

    return new Response(
      JSON.stringify({ created: createdCount, message: "Notifications created, emails queued" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in notify-followers:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
