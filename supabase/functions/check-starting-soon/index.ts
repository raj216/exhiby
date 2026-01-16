import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// This function is designed to be called by a cron job every minute
// It finds sessions starting in ~15 minutes and sends reminder notifications

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Checking for sessions starting soon...");

    // Find events scheduled to start between 14-16 minutes from now
    // This gives a 2-minute window to account for cron timing variations
    const now = new Date();
    const fourteenMinsFromNow = new Date(now.getTime() + 14 * 60 * 1000);
    const sixteenMinsFromNow = new Date(now.getTime() + 16 * 60 * 1000);

    const { data: upcomingEvents, error: eventsError } = await supabase
      .from("events")
      .select("id, title, creator_id, scheduled_at")
      .gte("scheduled_at", fourteenMinsFromNow.toISOString())
      .lte("scheduled_at", sixteenMinsFromNow.toISOString())
      .eq("is_live", false);

    if (eventsError) {
      console.error("Error fetching upcoming events:", eventsError);
      throw eventsError;
    }

    if (!upcomingEvents || upcomingEvents.length === 0) {
      console.log("No sessions starting soon");
      return new Response(JSON.stringify({ processed: 0, message: "No sessions starting soon" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${upcomingEvents.length} sessions starting soon`);

    let processedCount = 0;
    const errors: string[] = [];

    for (const event of upcomingEvents) {
      try {
        // Check if we already sent starting_soon notifications for this event
        const { data: existingSent } = await supabase
          .from("sent_emails")
          .select("id")
          .eq("event_id", event.id)
          .eq("email_type", "studio_starting_soon")
          .limit(1);

        if (existingSent && existingSent.length > 0) {
          console.log(`Already sent starting_soon for event ${event.id}, skipping`);
          continue;
        }

        // Get creator profile for notification text
        const { data: creatorProfile } = await supabase
          .from("profiles")
          .select("name")
          .eq("user_id", event.creator_id)
          .single();

        const creatorName = creatorProfile?.name || "A creator";

        // Get followers
        const { data: followers } = await supabase
          .from("follows")
          .select("follower_id")
          .eq("following_id", event.creator_id);

        if (!followers || followers.length === 0) {
          console.log(`No followers for event ${event.id}`);
          continue;
        }

        const followerIds = followers.map((f) => f.follower_id);

        // Get notification preferences
        const { data: preferences } = await supabase
          .from("notification_preferences")
          .select("user_id, inapp_scheduled, email_reminders")
          .in("user_id", followerIds);

        const prefsMap = new Map<string, any>();
        (preferences || []).forEach((p) => prefsMap.set(p.user_id, p));

        // Create in-app notifications with clear, human-readable copy
        const title = `${creatorName}'s studio starts in 15 minutes`;
        const message = "Get ready to enter";
        const link = `/live/${event.id}`;

        for (const followerId of followerIds) {
          const prefs = prefsMap.get(followerId) || { inapp_scheduled: true };

          if (prefs.inapp_scheduled) {
            await supabase.rpc("create_notification", {
              p_user_id: followerId,
              p_type: "studio_starting_soon",
              p_title: title,
              p_message: message,
              p_link: link,
            });
          }
        }

        // Trigger email sending
        const functionUrl = `${supabaseUrl}/functions/v1/send-notification-email`;
        await fetch(functionUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            event_id: event.id,
            email_type: "studio_starting_soon",
          }),
        });

        processedCount++;
        console.log(`Processed starting_soon for event: ${event.id}`);
      } catch (err: any) {
        console.error(`Error processing event ${event.id}:`, err);
        errors.push(`${event.id}: ${err.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        processed: processedCount,
        total: upcomingEvents.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in check-starting-soon:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
