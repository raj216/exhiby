import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  event_id: string;
  email_type: "studio_scheduled" | "studio_live" | "studio_starting_soon";
}

interface FollowerWithPrefs {
  user_id: string;
  email: string;
  name: string;
  email_live: boolean;
  email_scheduled: boolean;
  email_reminders: boolean;
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

    const creatorName = creatorProfile?.name || "A creator";

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
    const studioLink = `${domain}/studio/${event_id}`;
    const settingsLink = `${domain}/settings/notifications`;
    const scheduledDate = new Date(event.scheduled_at).toLocaleString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    let subject = "";
    let htmlContent = "";

    switch (email_type) {
      case "studio_scheduled":
        subject = `🎨 ${creatorName} scheduled a new studio session`;
        htmlContent = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #1a1a1a;">${creatorName} has a new session!</h1>
            <h2 style="color: #333;">${event.title}</h2>
            <p style="color: #666; font-size: 16px;">📅 ${scheduledDate}</p>
            ${event.cover_url ? `<img src="${event.cover_url}" alt="${event.title}" style="width: 100%; max-width: 500px; border-radius: 8px; margin: 16px 0;" />` : ""}
            <p style="margin: 24px 0;">
              <a href="${studioLink}" style="background: #18181b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">View Studio</a>
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;" />
            <p style="color: #999; font-size: 12px;">
              <a href="${settingsLink}" style="color: #999;">Manage notification preferences</a>
            </p>
          </div>
        `;
        break;

      case "studio_live":
        subject = `🔴 ${creatorName} is LIVE now!`;
        htmlContent = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #dc2626;">🔴 ${creatorName} is LIVE!</h1>
            <h2 style="color: #333;">${event.title}</h2>
            ${event.cover_url ? `<img src="${event.cover_url}" alt="${event.title}" style="width: 100%; max-width: 500px; border-radius: 8px; margin: 16px 0;" />` : ""}
            <p style="color: #666; font-size: 16px;">Join now to catch the session!</p>
            <p style="margin: 24px 0;">
              <a href="${studioLink}" style="background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">Join Live Session</a>
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;" />
            <p style="color: #999; font-size: 12px;">
              <a href="${settingsLink}" style="color: #999;">Manage notification preferences</a>
            </p>
          </div>
        `;
        break;

      case "studio_starting_soon":
        subject = `⏰ ${creatorName}'s session starts in 15 minutes!`;
        htmlContent = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #f59e0b;">⏰ Starting in 15 minutes!</h1>
            <h2 style="color: #333;">${event.title}</h2>
            <p style="color: #666; font-size: 16px;">by ${creatorName}</p>
            ${event.cover_url ? `<img src="${event.cover_url}" alt="${event.title}" style="width: 100%; max-width: 500px; border-radius: 8px; margin: 16px 0;" />` : ""}
            <p style="margin: 24px 0;">
              <a href="${studioLink}" style="background: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">Set a Reminder</a>
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;" />
            <p style="color: #999; font-size: 12px;">
              <a href="${settingsLink}" style="color: #999;">Manage notification preferences</a>
            </p>
          </div>
        `;
        break;
    }

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
            sender: { name: "EXHIBY", email: "noreply@exhiby.lovable.app" },
            to: [{ email: follower.email, name: follower.name }],
            subject: subject,
            htmlContent: htmlContent.replace("there", follower.name),
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
