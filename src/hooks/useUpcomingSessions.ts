import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface SavedUpcomingSession {
  id: string;
  eventId: string;
  title: string;
  artistName: string;
  artistAvatar: string | null;
  scheduledAt: Date;
  category: string | null;
  isLive: boolean;
  coverUrl: string | null;
  price: number;
  isFree: boolean;
  creatorId: string;
  // Status derived from time
  status: "upcoming" | "starting_soon" | "waiting" | "live" | "missed";
}

export function useUpcomingSessions(userId: string | undefined) {
  const [sessions, setSessions] = useState<SavedUpcomingSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSessions = useCallback(async () => {
    if (!userId) {
      setSessions([]);
      setIsLoading(false);
      return;
    }

    try {
      // Fetch saved sessions with event details
      const { data: savedSessions, error: savedError } = await supabase
        .from("saved_sessions")
        .select("id, event_id, creator_id, reminder_enabled")
        .eq("user_id", userId);

      if (savedError) {
        console.error("Error fetching saved sessions:", savedError);
        setIsLoading(false);
        return;
      }

      if (!savedSessions || savedSessions.length === 0) {
        setSessions([]);
        setIsLoading(false);
        return;
      }

      // Fetch events for these saved sessions
      const eventIds = savedSessions.map((s) => s.event_id);
      const { data: events, error: eventsError } = await supabase
        .from("events")
        .select(
          "id, title, scheduled_at, category, creator_id, is_live, live_ended_at, cover_url, price, is_free"
        )
        .in("id", eventIds);

      if (eventsError) {
        console.error("Error fetching events:", eventsError);
        setIsLoading(false);
        return;
      }

      // Get unique creator IDs
      const creatorIds = [...new Set(events?.map((e) => e.creator_id) || [])];

      // Fetch creator profiles
      const { data: profiles, error: profilesError } = await supabase.rpc(
        "get_creator_profiles",
        { user_ids: creatorIds }
      );

      if (profilesError) {
        console.error("Error fetching profiles:", profilesError);
      }

      // Create maps for quick lookup
      const eventMap = new Map(events?.map((e) => [e.id, e]) || []);
      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);

      const now = new Date();
      const result: SavedUpcomingSession[] = [];

      for (const saved of savedSessions) {
        const event = eventMap.get(saved.event_id);
        if (!event) continue;

        const creator = profileMap.get(event.creator_id);
        const scheduledAt = new Date(event.scheduled_at);
        const hasEnded = event.live_ended_at !== null;

        // Skip ended events (they should auto-remove after 24h but still skip for display)
        if (hasEnded) continue;

        // Determine status
        let status: SavedUpcomingSession["status"] = "upcoming";
        const msUntilStart = scheduledAt.getTime() - now.getTime();
        const minutesUntilStart = msUntilStart / (1000 * 60);
        const minutesSinceStart = -minutesUntilStart;

        if (event.is_live) {
          status = "live";
        } else if (minutesUntilStart <= 15 && minutesUntilStart > 0) {
          status = "starting_soon";
        } else if (minutesSinceStart > 0 && minutesSinceStart <= 60) {
          status = "waiting"; // Waiting for creator to go live
        } else if (minutesSinceStart > 60) {
          status = "missed"; // Creator missed the session
        }

        result.push({
          id: saved.id,
          eventId: event.id,
          title: event.title,
          artistName: creator?.name || "Unknown Artist",
          artistAvatar: creator?.avatar_url || null,
          scheduledAt,
          category: event.category,
          isLive: event.is_live || false,
          coverUrl: event.cover_url,
          price: event.price || 0,
          isFree: event.is_free,
          creatorId: event.creator_id,
          status,
        });
      }

      // Sort: live first, then by scheduled time
      result.sort((a, b) => {
        if (a.status === "live" && b.status !== "live") return -1;
        if (b.status === "live" && a.status !== "live") return 1;
        return a.scheduledAt.getTime() - b.scheduledAt.getTime();
      });

      setSessions(result);
    } catch (err) {
      console.error("Error in useUpcomingSessions:", err);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchSessions();

    // Refetch every minute to update statuses
    const interval = setInterval(fetchSessions, 60000);
    return () => clearInterval(interval);
  }, [fetchSessions]);

  return { sessions, isLoading, refetch: fetchSessions };
}
