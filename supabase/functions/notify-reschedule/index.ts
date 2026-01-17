import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RescheduleRequest {
  event_id: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const brevoApiKey = Deno.env.get("BREVO_API_KEY");
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

    const { event_id }: RescheduleRequest = await req.json();
    console.log(`Processing reschedule notification for event: ${event_id}`);

    // Fetch event details
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

    // Authorization: Verify the caller is the event creator
    if (event.creator_id !== user.id) {
      console.error(`User ${user.id} is not the creator of event ${event_id}`);
      return new Response(JSON.stringify({ error: "Not authorized" }), {
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
      return new Response(JSON.stringify({ created: 0, sent: 0, message: "No followers" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const followerIds = followers.map((f) => f.follower_id);

    // Get notification preferences
    const { data: preferences } = await supabase
      .from("notification_preferences")
      .select("user_id, inapp_scheduled, email_scheduled")
      .in("user_id", followerIds);

    const prefsMap = new Map<string, any>();
    (preferences || []).forEach((p) => prefsMap.set(p.user_id, p));

    // Format new scheduled date for display
    const scheduledDate = new Date(event.scheduled_at).toLocaleString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    });

    // Create in-app notifications for eligible followers
    let createdCount = 0;
    for (const followerId of followerIds) {
      const prefs = prefsMap.get(followerId) || { inapp_scheduled: true };

      if (prefs.inapp_scheduled) {
        const { error: notifError } = await supabase.rpc("create_notification", {
          p_user_id: followerId,
          p_type: "studio_rescheduled",
          p_title: `Schedule updated: ${creatorName}`,
          p_message: `"${event.title}" has been rescheduled`,
          p_link: `/live/${event_id}`,
        });

        if (notifError) {
          console.error(`Failed to create notification for ${followerId}:`, notifError);
        } else {
          createdCount++;
        }
      }
    }

    console.log(`Created ${createdCount} in-app notifications`);

    // Send emails if Brevo is configured
    let sentCount = 0;
    if (brevoApiKey) {
      // Get user emails from auth.users
      const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
      if (authError) {
        console.error("Error fetching auth users:", authError);
      } else {
        const userEmailMap = new Map<string, string>();
        authUsers.users.forEach((u) => {
          if (u.email) {
            userEmailMap.set(u.id, u.email);
          }
        });

        // Get profiles for display names
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, name")
          .in("user_id", followerIds);

        const profileMap = new Map<string, string>();
        (profiles || []).forEach((p) => profileMap.set(p.user_id, p.name));

        // Check for already sent reschedule emails to avoid duplicates
        // Use a unique email type per reschedule by including a timestamp marker
        const emailType = `studio_rescheduled_${event.scheduled_at}`;
        
        const { data: sentEmails } = await supabase
          .from("sent_emails")
          .select("user_id")
          .eq("event_id", event_id)
          .eq("email_type", emailType);

        const alreadySentSet = new Set((sentEmails || []).map((s) => s.user_id));

        const domain = "https://exhiby.lovable.app";
        const studioLink = `${domain}/live/${event_id}`;
        const settingsLink = `${domain}/?view=settings`;

        const subject = `Schedule updated: ${creatorName} — ${event.title}`;
        const bodyText = `The scheduled time has been updated to ${scheduledDate}. You can join from the same link.`;

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
              <img src="${event.cover_url}" alt="${event.title}" style="width: 100%; height: auto; border-radius: 8px; display: block;" />
            </td>
          </tr>
          ` : ""}
          
          <!-- Content -->
          <tr>
            <td style="padding: 24px 32px;">
              <h2 style="margin: 0 0 8px 0; font-size: 20px; font-weight: 600; color: #18181b;">${event.title}</h2>
              <p style="margin: 0 0 8px 0; font-size: 14px; color: #f59e0b; font-weight: 600;">Schedule Updated</p>
              <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.6; color: #52525b;">
                ${bodyText}
              </p>
              
              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
                <tr>
                  <td style="border-radius: 8px; background-color: #18181b;">
                    <a href="${studioLink}" target="_blank" style="display: inline-block; padding: 14px 32px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 8px;">View Updated Studio</a>
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

        for (const followerId of followerIds) {
          const email = userEmailMap.get(followerId);
          if (!email) continue;

          const prefs = prefsMap.get(followerId) || { email_scheduled: true };
          if (!prefs.email_scheduled) continue;

          if (alreadySentSet.has(followerId)) continue;

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
                to: [{ email, name: profileMap.get(followerId) || "there" }],
                subject,
                htmlContent,
              }),
            });

            if (response.ok) {
              await supabase.from("sent_emails").insert({
                event_id,
                user_id: followerId,
                email_type: emailType,
              });
              sentCount++;
              console.log(`Reschedule email sent to ${email}`);
            } else {
              const errorText = await response.text();
              console.error(`Failed to send to ${email}:`, errorText);
            }
          } catch (err) {
            console.error(`Error sending to ${email}:`, err);
          }
        }
      }
    }

    console.log(`Completed: ${createdCount} notifications, ${sentCount} emails sent`);

    return new Response(
      JSON.stringify({ created: createdCount, sent: sentCount }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in notify-reschedule:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
