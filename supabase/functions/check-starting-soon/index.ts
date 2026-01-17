import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// This function handles:
// 1. Sessions starting in ~15 minutes - send reminder to followers
// 2. Sessions at start_time - send "Go Live Now" reminder to creator
// 3. Sessions 60+ minutes past start_time - mark as missed and notify creator

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Running session lifecycle checks...");

    const now = new Date();
    const results = {
      startingSoon: 0,
      atStartTime: 0,
      missed: 0,
      errors: [] as string[],
    };

    // ========================================
    // 1. Check for sessions starting in ~15 minutes (14-16 min window)
    // ========================================
    const fourteenMinsFromNow = new Date(now.getTime() + 14 * 60 * 1000);
    const sixteenMinsFromNow = new Date(now.getTime() + 16 * 60 * 1000);

    const { data: startingSoonEvents, error: startingSoonError } = await supabase
      .from("events")
      .select("id, title, creator_id, scheduled_at")
      .gte("scheduled_at", fourteenMinsFromNow.toISOString())
      .lte("scheduled_at", sixteenMinsFromNow.toISOString())
      .is("is_live", null)
      .is("live_ended_at", null);

    if (startingSoonError) {
      console.error("Error fetching starting soon events:", startingSoonError);
    } else if (startingSoonEvents && startingSoonEvents.length > 0) {
      console.log(`Found ${startingSoonEvents.length} sessions starting soon`);

      for (const event of startingSoonEvents) {
        try {
          // Check if we already sent starting_soon notifications
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

          // Get creator profile
          const { data: creatorProfile } = await supabase
            .from("profiles")
            .select("name")
            .eq("user_id", event.creator_id)
            .single();

          const creatorName = creatorProfile?.name || "A creator";

          // Send in-app notification to creator
          await supabase.rpc("create_notification", {
            p_user_id: event.creator_id,
            p_type: "studio_starting_soon_creator",
            p_title: "Your studio starts in 15 minutes",
            p_message: `Get ready for "${event.title}"`,
            p_link: `/live/${event.id}`,
          });

          // Get followers
          const { data: followers } = await supabase
            .from("follows")
            .select("follower_id")
            .eq("following_id", event.creator_id);

          if (followers && followers.length > 0) {
            const followerIds = followers.map((f) => f.follower_id);

            // Get notification preferences
            const { data: preferences } = await supabase
              .from("notification_preferences")
              .select("user_id, inapp_scheduled")
              .in("user_id", followerIds);

            const prefsMap = new Map<string, any>();
            (preferences || []).forEach((p) => prefsMap.set(p.user_id, p));

            const title = `${creatorName}'s studio starts in 15 minutes`;
            const link = `/live/${event.id}`;

            for (const followerId of followerIds) {
              const prefs = prefsMap.get(followerId) || { inapp_scheduled: true };
              if (prefs.inapp_scheduled) {
                await supabase.rpc("create_notification", {
                  p_user_id: followerId,
                  p_type: "studio_starting_soon",
                  p_title: title,
                  p_message: "Get ready to enter",
                  p_link: link,
                });
              }
            }

            // Trigger email sending to followers
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
          }

          results.startingSoon++;
          console.log(`Processed starting_soon for event: ${event.id}`);
        } catch (err: any) {
          console.error(`Error processing starting_soon event ${event.id}:`, err);
          results.errors.push(`starting_soon ${event.id}: ${err.message}`);
        }
      }
    }

    // ========================================
    // 2. Check for sessions at start_time (0-2 min window) - notify creator to go live
    // ========================================
    const twoMinsFromNow = new Date(now.getTime() + 2 * 60 * 1000);

    const { data: atStartTimeEvents, error: atStartTimeError } = await supabase
      .from("events")
      .select("id, title, creator_id, scheduled_at")
      .gte("scheduled_at", now.toISOString())
      .lte("scheduled_at", twoMinsFromNow.toISOString())
      .is("is_live", null)
      .is("live_ended_at", null);

    if (atStartTimeError) {
      console.error("Error fetching at-start-time events:", atStartTimeError);
    } else if (atStartTimeEvents && atStartTimeEvents.length > 0) {
      console.log(`Found ${atStartTimeEvents.length} sessions at start time`);

      for (const event of atStartTimeEvents) {
        try {
          // Check if we already sent start_time notification to creator
          const { data: existingSent } = await supabase
            .from("sent_emails")
            .select("id")
            .eq("event_id", event.id)
            .eq("email_type", "studio_start_time_creator")
            .limit(1);

          if (existingSent && existingSent.length > 0) {
            console.log(`Already sent start_time_creator for event ${event.id}, skipping`);
            continue;
          }

          // Send in-app notification to creator
          await supabase.rpc("create_notification", {
            p_user_id: event.creator_id,
            p_type: "studio_start_time_creator",
            p_title: "It's time — Go Live now!",
            p_message: `"${event.title}" is scheduled to start now`,
            p_link: `/live/${event.id}`,
          });

          // Record that we sent this notification
          await supabase.from("sent_emails").insert({
            event_id: event.id,
            user_id: event.creator_id,
            email_type: "studio_start_time_creator",
          });

          results.atStartTime++;
          console.log(`Processed start_time_creator for event: ${event.id}`);
        } catch (err: any) {
          console.error(`Error processing start_time event ${event.id}:`, err);
          results.errors.push(`start_time ${event.id}: ${err.message}`);
        }
      }
    }

    // ========================================
    // 3. Check for missed sessions (60+ minutes past start_time, never went live)
    // ========================================
    const sixtyMinsAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const seventyMinsAgo = new Date(now.getTime() - 70 * 60 * 1000); // 10 min window

    const { data: missedEvents, error: missedError } = await supabase
      .from("events")
      .select("id, title, creator_id, scheduled_at")
      .gte("scheduled_at", seventyMinsAgo.toISOString())
      .lte("scheduled_at", sixtyMinsAgo.toISOString())
      .is("is_live", null)
      .is("live_ended_at", null);

    if (missedError) {
      console.error("Error fetching missed events:", missedError);
    } else if (missedEvents && missedEvents.length > 0) {
      console.log(`Found ${missedEvents.length} missed sessions`);

      for (const event of missedEvents) {
        try {
          // Check if we already processed this as missed
          const { data: existingSent } = await supabase
            .from("sent_emails")
            .select("id")
            .eq("event_id", event.id)
            .eq("email_type", "studio_missed")
            .limit(1);

          if (existingSent && existingSent.length > 0) {
            console.log(`Already processed missed for event ${event.id}, skipping`);
            continue;
          }

          // Mark the event as ended (missed)
          await supabase
            .from("events")
            .update({ live_ended_at: now.toISOString() })
            .eq("id", event.id);

          // Send in-app notification to creator
          await supabase.rpc("create_notification", {
            p_user_id: event.creator_id,
            p_type: "studio_missed",
            p_title: "You missed your scheduled studio",
            p_message: `"${event.title}" was scheduled but never went live. You can reschedule anytime.`,
            p_link: "/",
          });

          // Record that we processed this
          await supabase.from("sent_emails").insert({
            event_id: event.id,
            user_id: event.creator_id,
            email_type: "studio_missed",
          });

          results.missed++;
          console.log(`Processed missed for event: ${event.id}`);
        } catch (err: any) {
          console.error(`Error processing missed event ${event.id}:`, err);
          results.errors.push(`missed ${event.id}: ${err.message}`);
        }
      }
    }

    console.log("Session lifecycle check complete:", results);

    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in check-starting-soon:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
