import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Default timezone for creators (New York / Eastern Time)
const DEFAULT_CREATOR_TIMEZONE = "America/New_York";

/**
 * Format a date in the specified timezone with a human-friendly format.
 * Uses Intl.DateTimeFormat for proper timezone handling.
 * 
 * @param isoDateString - ISO 8601 date string (with Z or offset)
 * @param timezone - IANA timezone string (default: America/New_York)
 * @returns Formatted string like "Sun, Jan 25, 2026 • 10:26 AM ET"
 */
function formatDateInTimezone(isoDateString: string, timezone: string = DEFAULT_CREATOR_TIMEZONE): string {
  try {
    const date = new Date(isoDateString);
    
    // Validate date
    if (isNaN(date.getTime())) {
      console.error(`[formatDateInTimezone] Invalid date: ${isoDateString}`);
      return isoDateString; // Fallback to raw string
    }
    
    // Format the date in the specified timezone
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZoneName: "short",
    });
    
    const formatted = formatter.format(date);
    
    // Log for debugging
    console.log(`[formatDateInTimezone] Input: ${isoDateString}, Timezone: ${timezone}, Output: ${formatted}`);
    
    return formatted;
  } catch (err) {
    console.error(`[formatDateInTimezone] Error formatting date:`, err);
    // Fallback: try without timezone
    return new Date(isoDateString).toLocaleString("en-US");
  }
}

// This function handles:
// 1. Sessions starting in ~15 minutes - send reminder to followers
// 2. Sessions at start_time - send "Go Live Now" email + in-app to creator
// 3. Sessions 30 minutes past start_time - send follow-up reminder email to creator
// 4. Sessions 60+ minutes past start_time - mark as missed and notify creator

// Helper function to send email to creator
async function sendCreatorEmail(
  brevoApiKey: string,
  email: string,
  name: string,
  subject: string,
  bodyText: string,
  ctaText: string,
  ctaLink: string,
  eventTitle: string,
  coverUrl: string | null
): Promise<boolean> {
  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f5f5f5;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 24px 32px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #18181b; letter-spacing: -0.5px;">EXHIBY</h1>
            </td>
          </tr>
          
          ${coverUrl ? `
          <!-- Cover Image -->
          <tr>
            <td style="padding: 0 32px;">
              <img src="${coverUrl}" alt="${eventTitle}" style="width: 100%; height: auto; border-radius: 8px; display: block;" />
            </td>
          </tr>
          ` : ""}
          
          <!-- Content -->
          <tr>
            <td style="padding: 24px 32px;">
              <h2 style="margin: 0 0 8px 0; font-size: 20px; font-weight: 600; color: #18181b;">${eventTitle}</h2>
              <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.6; color: #52525b;">
                ${bodyText}
              </p>
              
              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
                <tr>
                  <td style="border-radius: 8px; background-color: #dc2626;">
                    <a href="${ctaLink}" target="_blank" style="display: inline-block; padding: 14px 32px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 8px;">${ctaText}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; border-top: 1px solid #e5e5e5;">
              <p style="margin: 0; font-size: 13px; color: #a1a1aa; text-align: center;">
                You're receiving this because you have a scheduled studio on Exhiby.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "api-key": brevoApiKey,
      },
      body: JSON.stringify({
        sender: { name: "Exhiby Studio", email: "studio@joinexhiby.com" },
        to: [{ email, name }],
        subject,
        htmlContent,
      }),
    });

    return response.ok;
  } catch (err) {
    console.error(`Error sending email to ${email}:`, err);
    return false;
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Validate cron secret — refuse to run if not configured
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret) {
    console.error("CRON_SECRET not configured — refusing to execute");
    return new Response(
      JSON.stringify({ error: "Service not configured" }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const authHeader = req.headers.get("x-cron-secret");
  if (!authHeader || authHeader !== cronSecret) {
    console.error("Unauthorized: Invalid or missing x-cron-secret header");
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const brevoApiKey = Deno.env.get("BREVO_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Running session lifecycle checks...");

    const now = new Date();
    const results = {
      startingSoon: 0,
      atStartTime: 0,
      followUpReminder: 0,
      missed: 0,
      errors: [] as string[],
    };

    const domain = "https://exhiby.lovable.app";

    // ========================================
    // 1. Check for sessions starting in ~15 minutes (14-16 min window)
    // ========================================
    const fourteenMinsFromNow = new Date(now.getTime() + 14 * 60 * 1000);
    const sixteenMinsFromNow = new Date(now.getTime() + 16 * 60 * 1000);

    const { data: startingSoonEvents, error: startingSoonError } = await supabase
      .from("events")
      .select("id, title, creator_id, scheduled_at, cover_url")
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

          // Get saved sessions (audiences who added this event)
          const { data: savedSessions } = await supabase
            .from("saved_sessions")
            .select("user_id, reminder_enabled")
            .eq("event_id", event.id)
            .eq("reminder_enabled", true);

          // Get followers
          const { data: followers } = await supabase
            .from("follows")
            .select("follower_id")
            .eq("following_id", event.creator_id);

          // Combine saved session users + followers (unique)
          const allAudienceIds = new Set<string>();
          (savedSessions || []).forEach((s) => allAudienceIds.add(s.user_id));
          (followers || []).forEach((f) => allAudienceIds.add(f.follower_id));
          
          const audienceIds = Array.from(allAudienceIds);

          if (audienceIds.length > 0) {
            // Get notification preferences
            const { data: preferences } = await supabase
              .from("notification_preferences")
              .select("user_id, inapp_scheduled")
              .in("user_id", audienceIds);

            const prefsMap = new Map<string, any>();
            (preferences || []).forEach((p) => prefsMap.set(p.user_id, p));

            const title = `${creatorName}'s studio starts in 15 minutes`;
            const link = `/live/${event.id}`;

            for (const audienceId of audienceIds) {
              const prefs = prefsMap.get(audienceId) || { inapp_scheduled: true };
              if (prefs.inapp_scheduled) {
                await supabase.rpc("create_notification", {
                  p_user_id: audienceId,
                  p_type: "studio_starting_soon",
                  p_title: title,
                  p_message: `"${event.title}" is about to start`,
                  p_link: link,
                });
              }
            }

            // Trigger email sending to audiences
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
    // 2. Check for sessions at start_time (0-2 min window) - send "Go Live Now" email to creator
    //    AND send "Starting Now" notifications to saved sessions users
    // ========================================
    const twoMinsFromNow = new Date(now.getTime() + 2 * 60 * 1000);

    const { data: atStartTimeEvents, error: atStartTimeError } = await supabase
      .from("events")
      .select("id, title, creator_id, scheduled_at, cover_url")
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
            .eq("email_type", "creator_go_live_now")
            .limit(1);

          if (existingSent && existingSent.length > 0) {
            console.log(`Already sent creator_go_live_now for event ${event.id}, skipping`);
            continue;
          }

          // Get creator profile and email
          const { data: creatorProfile } = await supabase
            .from("profiles")
            .select("name")
            .eq("user_id", event.creator_id)
            .single();

          const creatorName = creatorProfile?.name || "Creator";

          // Get creator email
          const { data: { users } } = await supabase.auth.admin.listUsers();
          const creatorUser = users.find((u) => u.id === event.creator_id);
          const creatorEmail = creatorUser?.email;

          // Send in-app notification to creator
          await supabase.rpc("create_notification", {
            p_user_id: event.creator_id,
            p_type: "studio_start_time_creator",
            p_title: "It's time — Go Live now!",
            p_message: `"${event.title}" is scheduled to start now`,
            p_link: `/live/${event.id}`,
          });

          // Send email to creator if Brevo is configured
          if (brevoApiKey && creatorEmail) {
            const emailSent = await sendCreatorEmail(
              brevoApiKey,
              creatorEmail,
              creatorName,
              "It's time — Open your Studio now",
              `Your studio "${event.title}" is scheduled for now. Open the studio when you're ready.`,
              "Go Live Now",
              `${domain}/live/${event.id}`,
              event.title,
              event.cover_url
            );

            if (emailSent) {
              console.log(`Sent go_live_now email to creator ${creatorEmail}`);
            }
          }

          // Record that we sent this notification
          await supabase.from("sent_emails").insert({
            event_id: event.id,
            user_id: event.creator_id,
            email_type: "creator_go_live_now",
          });

          // ========================================
          // ALSO: Send "Starting Now" notifications to saved sessions users
          // ========================================
          const { data: savedSessions } = await supabase
            .from("saved_sessions")
            .select("user_id, reminder_enabled")
            .eq("event_id", event.id)
            .eq("reminder_enabled", true);

          // Get followers too
          const { data: followers } = await supabase
            .from("follows")
            .select("follower_id")
            .eq("following_id", event.creator_id);

          // Combine saved session users + followers (unique)
          const allAudienceIds = new Set<string>();
          (savedSessions || []).forEach((s) => allAudienceIds.add(s.user_id));
          (followers || []).forEach((f) => allAudienceIds.add(f.follower_id));
          
          const audienceIds = Array.from(allAudienceIds);

          if (audienceIds.length > 0) {
            // Get notification preferences
            const { data: preferences } = await supabase
              .from("notification_preferences")
              .select("user_id, inapp_scheduled")
              .in("user_id", audienceIds);

            const prefsMap = new Map<string, any>();
            (preferences || []).forEach((p) => prefsMap.set(p.user_id, p));

            const title = `${creatorName}'s studio is starting now`;
            const link = `/live/${event.id}`;

            for (const audienceId of audienceIds) {
              const prefs = prefsMap.get(audienceId) || { inapp_scheduled: true };
              if (prefs.inapp_scheduled) {
                await supabase.rpc("create_notification", {
                  p_user_id: audienceId,
                  p_type: "studio_starting_now",
                  p_title: title,
                  p_message: `"${event.title}" is starting — join now!`,
                  p_link: link,
                });
              }
            }

            // Trigger email sending to audiences for "starting now"
            const functionUrl = `${supabaseUrl}/functions/v1/send-notification-email`;
            await fetch(functionUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({
                event_id: event.id,
                email_type: "studio_starting_now",
              }),
            });

            console.log(`Sent starting_now notifications to ${audienceIds.length} audience members`);
          }

          results.atStartTime++;
          console.log(`Processed start_time_creator for event: ${event.id}`);
        } catch (err: any) {
          console.error(`Error processing start_time event ${event.id}:`, err);
          results.errors.push(`start_time ${event.id}: ${err.message}`);
        }
      }
    }

    // ========================================
    // 3. Check for sessions 30 minutes past start_time - send follow-up reminder to creator
    // ========================================
    const twentyEightMinsAgo = new Date(now.getTime() - 28 * 60 * 1000);
    const thirtyTwoMinsAgo = new Date(now.getTime() - 32 * 60 * 1000);

    const { data: followUpEvents, error: followUpError } = await supabase
      .from("events")
      .select("id, title, creator_id, scheduled_at, cover_url")
      .gte("scheduled_at", thirtyTwoMinsAgo.toISOString())
      .lte("scheduled_at", twentyEightMinsAgo.toISOString())
      .is("is_live", null)
      .is("live_ended_at", null);

    if (followUpError) {
      console.error("Error fetching follow-up events:", followUpError);
    } else if (followUpEvents && followUpEvents.length > 0) {
      console.log(`Found ${followUpEvents.length} sessions needing follow-up reminder`);

      for (const event of followUpEvents) {
        try {
          // Check if we already sent follow-up reminder
          const { data: existingSent } = await supabase
            .from("sent_emails")
            .select("id")
            .eq("event_id", event.id)
            .eq("email_type", "creator_go_live_followup")
            .limit(1);

          if (existingSent && existingSent.length > 0) {
            console.log(`Already sent follow-up for event ${event.id}, skipping`);
            continue;
          }

          // Get creator profile and email
          const { data: creatorProfile } = await supabase
            .from("profiles")
            .select("name")
            .eq("user_id", event.creator_id)
            .single();

          const creatorName = creatorProfile?.name || "Creator";

          // Get creator email
          const { data: { users } } = await supabase.auth.admin.listUsers();
          const creatorUser = users.find((u) => u.id === event.creator_id);
          const creatorEmail = creatorUser?.email;

          // Send in-app notification
          await supabase.rpc("create_notification", {
            p_user_id: event.creator_id,
            p_type: "studio_followup_reminder",
            p_title: "Reminder — your studio is waiting",
            p_message: `"${event.title}" was scheduled 30 minutes ago`,
            p_link: `/live/${event.id}`,
          });

          // Send follow-up email to creator if Brevo is configured
          if (brevoApiKey && creatorEmail) {
            const emailSent = await sendCreatorEmail(
              brevoApiKey,
              creatorEmail,
              creatorName,
              "Reminder — your studio is waiting",
              `Your studio "${event.title}" was scheduled 30 minutes ago and is still waiting for you. Your audience is eager to see you!`,
              "Go Live Now",
              `${domain}/live/${event.id}`,
              event.title,
              event.cover_url
            );

            if (emailSent) {
              console.log(`Sent follow-up email to creator ${creatorEmail}`);
            }
          }

          // Record that we sent this
          await supabase.from("sent_emails").insert({
            event_id: event.id,
            user_id: event.creator_id,
            email_type: "creator_go_live_followup",
          });

          results.followUpReminder++;
          console.log(`Processed follow-up reminder for event: ${event.id}`);
        } catch (err: any) {
          console.error(`Error processing follow-up event ${event.id}:`, err);
          results.errors.push(`followup ${event.id}: ${err.message}`);
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
