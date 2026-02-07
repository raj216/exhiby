import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  event_id: string;
  email_type: "studio_scheduled" | "studio_live" | "studio_starting_soon" | "studio_starting_now";
}

interface FollowerWithPrefs {
  user_id: string;
  email: string;
  name: string;
  email_live: boolean;
  email_scheduled: boolean;
  email_reminders: boolean;
}

// Default timezone for creators (New York / Eastern Time)
const DEFAULT_CREATOR_TIMEZONE = "America/New_York";

/**
 * Escape HTML special characters to prevent XSS attacks.
 * Used for all user-generated content inserted into email HTML.
 */
function escapeHtml(unsafe: string): string {
  if (!unsafe) return "";
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

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

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const brevoApiKey = Deno.env.get("BREVO_API_KEY");
    if (!brevoApiKey) {
      throw new Error("BREVO_API_KEY not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { event_id, email_type }: EmailRequest = await req.json();
    console.log(`Processing ${email_type} notification for event: ${event_id}`);

    // Fetch event details with creator profile
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, title, scheduled_at, cover_url, creator_id")
      .eq("id", event_id)
      .single();

    if (eventError || !event) {
      console.error("Event not found:", eventError);
      return new Response(JSON.stringify({ error: "Event not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get creator profile
    const { data: creatorProfile } = await supabase
      .from("profiles")
      .select("name, handle")
      .eq("user_id", event.creator_id)
      .single();

    // Escape user-generated content to prevent XSS in email HTML
    const creatorName = escapeHtml(creatorProfile?.name || "A creator");
    const eventTitle = escapeHtml(event.title);

    // Get all followers of this creator with their notification preferences and emails
    const { data: followers, error: followersError } = await supabase
      .from("follows")
      .select("follower_id")
      .eq("following_id", event.creator_id);

    if (followersError || !followers || followers.length === 0) {
      console.log("No followers to notify");
      return new Response(JSON.stringify({ sent: 0, message: "No followers to notify" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const followerIds = followers.map((f) => f.follower_id);

    // Get user emails from auth.users
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    if (authError) {
      console.error("Error fetching auth users:", authError);
      throw authError;
    }

    const userEmailMap = new Map<string, string>();
    authUsers.users.forEach((user) => {
      if (user.email) {
        userEmailMap.set(user.id, user.email);
      }
    });

    // Get notification preferences for followers
    const { data: preferences, error: prefsError } = await supabase
      .from("notification_preferences")
      .select("user_id, email_live, email_scheduled, email_reminders")
      .in("user_id", followerIds);

    if (prefsError) {
      console.error("Error fetching preferences:", prefsError);
    }

    const prefsMap = new Map<string, any>();
    (preferences || []).forEach((p) => prefsMap.set(p.user_id, p));

    // Get profiles for display names
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, name")
      .in("user_id", followerIds);

    const profileMap = new Map<string, string>();
    (profiles || []).forEach((p) => profileMap.set(p.user_id, p.name));

    // Filter followers based on preferences
    const eligibleFollowers: FollowerWithPrefs[] = [];
    for (const followerId of followerIds) {
      const email = userEmailMap.get(followerId);
      if (!email) continue;

      const prefs = prefsMap.get(followerId) || {
        email_live: true,
        email_scheduled: true,
        email_reminders: true,
      };

      let shouldSend = false;
      if (email_type === "studio_scheduled" && prefs.email_scheduled) shouldSend = true;
      if (email_type === "studio_live" && prefs.email_live) shouldSend = true;
      if (email_type === "studio_starting_soon" && prefs.email_reminders) shouldSend = true;

      if (shouldSend) {
        eligibleFollowers.push({
          user_id: followerId,
          email,
          name: profileMap.get(followerId) || "there",
          email_live: prefs.email_live,
          email_scheduled: prefs.email_scheduled,
          email_reminders: prefs.email_reminders,
        });
      }
    }

    console.log(`Found ${eligibleFollowers.length} eligible followers to email`);

    // Check for already sent emails to avoid duplicates
    const { data: sentEmails } = await supabase
      .from("sent_emails")
      .select("user_id")
      .eq("event_id", event_id)
      .eq("email_type", email_type);

    const alreadySentSet = new Set((sentEmails || []).map((s) => s.user_id));

    // Filter out already sent
    const toSend = eligibleFollowers.filter((f) => !alreadySentSet.has(f.user_id));
    console.log(`After filtering duplicates: ${toSend.length} emails to send`);

    if (toSend.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, message: "All eligible users already notified" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prepare email content based on type
    const domain = "https://exhiby.lovable.app";
    const studioLink = `${domain}/live/${event_id}`;
    const settingsLink = `${domain}/?view=settings`;
    
    // Format date/time for display in creator's timezone (America/New_York)
    // This ensures email recipients see the time in the creator's local timezone
    const scheduledDate = formatDateInTimezone(event.scheduled_at, DEFAULT_CREATOR_TIMEZONE);

    let subject = "";
    let bodyText = "";
    let ctaText = "";
    let ctaColor = "#18181b";

    // Use escaped eventTitle in HTML bodyText (already HTML-safe)
    switch (email_type) {
      case "studio_scheduled":
        subject = `Upcoming Studio: ${creatorName} — ${eventTitle}`;
        bodyText = `${creatorName} scheduled a live studio session for ${escapeHtml(scheduledDate)}. Enter the studio live and ask questions in real time.`;
        ctaText = "View Studio";
        ctaColor = "#18181b";
        break;

      case "studio_live":
        subject = `${creatorName} is live now — Enter the Studio`;
        bodyText = `${creatorName} is live right now. Watch the process and interact live.`;
        ctaText = "Enter Now";
        ctaColor = "#dc2626";
        break;

      case "studio_starting_soon":
        subject = `Starting soon: ${creatorName}'s Studio`;
        bodyText = `Reminder — ${eventTitle} starts in 15 minutes.`;
        ctaText = "Enter Studio";
        ctaColor = "#f59e0b";
        break;

      case "studio_starting_now":
        subject = `${creatorName}'s Studio is starting now!`;
        bodyText = `${eventTitle} is starting — join now to catch it from the beginning!`;
        ctaText = "Join Now";
        ctaColor = "#dc2626";
        break;
    }

    // Build HTML email template
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
          
          ${event.cover_url ? `
          <!-- Cover Image -->
          <tr>
            <td style="padding: 0 32px;">
              <img src="${escapeHtml(event.cover_url)}" alt="${eventTitle}" style="width: 100%; height: auto; border-radius: 8px; display: block;" />
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
                  <td style="border-radius: 8px; background-color: ${ctaColor};">
                    <a href="${studioLink}" target="_blank" style="display: inline-block; padding: 14px 32px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 8px;">${ctaText}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; border-top: 1px solid #e5e5e5;">
              <p style="margin: 0; font-size: 13px; color: #a1a1aa; text-align: center;">
                You're receiving this email because you follow ${creatorName} on Exhiby.
                <br />
                <a href="${settingsLink}" style="color: #71717a; text-decoration: underline;">Manage notification preferences</a>
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

    // Send emails via Brevo
    let sentCount = 0;
    const errors: string[] = [];

    for (const follower of toSend) {
      try {
        const response = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "api-key": brevoApiKey,
          },
          body: JSON.stringify({
            sender: { name: "Exhiby Studio", email: "studio@joinexhiby.com" },
            to: [{ email: follower.email, name: follower.name }],
            subject: subject,
            htmlContent: htmlContent,
          }),
        });

        if (response.ok) {
          // Record sent email
          await supabase.from("sent_emails").insert({
            event_id: event_id,
            user_id: follower.user_id,
            email_type: email_type,
          });
          sentCount++;
          console.log(`Email sent to ${follower.email}`);
        } else {
          const errorText = await response.text();
          console.error(`Failed to send to ${follower.email}:`, errorText);
          errors.push(`${follower.email}: ${errorText}`);
        }
      } catch (err) {
        console.error(`Error sending to ${follower.email}:`, err);
        errors.push(`${follower.email}: ${err}`);
      }
    }

    console.log(`Completed: ${sentCount}/${toSend.length} emails sent`);

    return new Response(
      JSON.stringify({
        sent: sentCount,
        total: toSend.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-notification-email:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
