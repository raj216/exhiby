import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

// Status types for session state
export type SessionStatus = "upcoming" | "starting_soon" | "live" | "ended" | "missed";

export interface SavedUpcomingSession {
  id: string;
  eventId: string;
  title: string;
  artistName: string;
  artistAvatar: string | null;
  scheduledAt: Date;
  endTime: Date;
  category: string | null;
  isLive: boolean;
  coverUrl: string | null;
  price: number;
  isFree: boolean;
  creatorId: string;
  status: SessionStatus;
  attended: boolean;
}

/**
 * Compute session status based on time and attendance
 */
function computeSessionStatus(
  scheduledAt: Date,
  endTime: Date,
  isLive: boolean,
  liveEndedAt: string | null,
  attended: boolean,
  now: Date
): SessionStatus {
  const currentTime = now.getTime();
  const startTime = scheduledAt.getTime();
  const endTimeMs = endTime.getTime();

  // If currently live
  if (isLive && !liveEndedAt) {
    return "live";
  }

  // If ended (either by time or explicitly)
  if (liveEndedAt || currentTime > endTimeMs) {
    return attended ? "ended" : "missed";
  }

  // If upcoming
  if (currentTime < startTime) {
    const msUntilStart = startTime - currentTime;
    const minutesUntilStart = msUntilStart / (1000 * 60);
    
    // Starting soon (within 15 minutes)
    if (minutesUntilStart <= 15) {
      return "starting_soon";
    }
    return "upcoming";
  }

  // Between start and end time, not live yet
  return "starting_soon";
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
          "id, title, scheduled_at, end_time, duration_minutes, category, creator_id, is_live, live_ended_at, cover_url, price, is_free"
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

      // Check attendance: user exists in live_viewers OR session_feedback for these events
      const { data: viewerRecords } = await supabase
        .from("live_viewers")
        .select("event_id")
        .eq("user_id", userId)
        .in("event_id", eventIds);

      const { data: feedbackRecords } = await supabase
        .from("session_feedback")
        .select("event_id")
        .eq("audience_user_id", userId)
        .in("event_id", eventIds);

      // Build attendance set
      const attendedEventIds = new Set<string>();
      viewerRecords?.forEach((r) => attendedEventIds.add(r.event_id));
      feedbackRecords?.forEach((r) => attendedEventIds.add(r.event_id));

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
        
        // Compute end_time: use stored value, or calculate from duration, or default 60 min
        let endTime: Date;
        if (event.end_time) {
          endTime = new Date(event.end_time);
        } else {
          const durationMs = (event.duration_minutes || 60) * 60 * 1000;
          endTime = new Date(scheduledAt.getTime() + durationMs);
        }

        const isLive = event.is_live || false;
        const attended = attendedEventIds.has(event.id);
        
        const status = computeSessionStatus(
          scheduledAt,
          endTime,
          isLive,
          event.live_ended_at,
          attended,
          now
        );

        result.push({
          id: saved.id,
          eventId: event.id,
          title: event.title,
          artistName: creator?.name || "Unknown Artist",
          artistAvatar: creator?.avatar_url || null,
          scheduledAt,
          endTime,
          category: event.category,
          isLive,
          coverUrl: event.cover_url,
          price: event.price || 0,
          isFree: event.is_free,
          creatorId: event.creator_id,
          status,
          attended,
        });
      }

      // Sort: live first, then starting_soon, then upcoming by time, then ended/missed
      result.sort((a, b) => {
        const statusOrder: Record<SessionStatus, number> = {
          live: 0,
          starting_soon: 1,
          upcoming: 2,
          ended: 3,
          missed: 4,
        };
        
        if (statusOrder[a.status] !== statusOrder[b.status]) {
          return statusOrder[a.status] - statusOrder[b.status];
        }
        
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
