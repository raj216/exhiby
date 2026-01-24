import { useQuery } from "@tanstack/react-query";
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

  if (isLive && !liveEndedAt) return "live";
  if (liveEndedAt || currentTime > endTimeMs) return attended ? "ended" : "missed";
  if (currentTime < startTime) {
    const minutesUntilStart = (startTime - currentTime) / (1000 * 60);
    return minutesUntilStart <= 15 ? "starting_soon" : "upcoming";
  }
  return "starting_soon";
}

export function useUpcomingSessions(userId: string | undefined) {
  const { data: sessions = [], isLoading, refetch } = useQuery({
    queryKey: ["upcoming-sessions", userId],
    queryFn: async (): Promise<SavedUpcomingSession[]> => {
      if (!userId) return [];

      // Fetch saved sessions
      const { data: savedSessions, error: savedError } = await supabase
        .from("saved_sessions")
        .select("id, event_id, creator_id")
        .eq("user_id", userId);

      if (savedError || !savedSessions?.length) return [];

      const eventIds = savedSessions.map((s) => s.event_id);

      // Parallel fetch: events, profiles, attendance
      const [eventsResult, viewerResult, feedbackResult] = await Promise.all([
        supabase
          .from("events")
          .select("id, title, scheduled_at, end_time, duration_minutes, category, creator_id, is_live, live_ended_at, cover_url, price, is_free")
          .in("id", eventIds),
        supabase
          .from("live_viewers")
          .select("event_id")
          .eq("user_id", userId)
          .in("event_id", eventIds),
        supabase
          .from("session_feedback")
          .select("event_id")
          .eq("audience_user_id", userId)
          .in("event_id", eventIds),
      ]);

      const events = eventsResult.data || [];
      if (!events.length) return [];

      // Fetch creator profiles
      const creatorIds = [...new Set(events.map((e) => e.creator_id))];
      const { data: profiles } = await supabase.rpc("get_creator_profiles", { user_ids: creatorIds });

      // Build lookup maps
      const eventMap = new Map(events.map((e) => [e.id, e]));
      const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));
      const attendedEventIds = new Set([
        ...(viewerResult.data || []).map((r) => r.event_id),
        ...(feedbackResult.data || []).map((r) => r.event_id),
      ]);

      const now = new Date();
      const result: SavedUpcomingSession[] = [];

      for (const saved of savedSessions) {
        const event = eventMap.get(saved.event_id);
        if (!event) continue;

        const creator = profileMap.get(event.creator_id);
        const scheduledAt = new Date(event.scheduled_at);
        const endTime = event.end_time
          ? new Date(event.end_time)
          : new Date(scheduledAt.getTime() + (event.duration_minutes || 60) * 60 * 1000);

        result.push({
          id: saved.id,
          eventId: event.id,
          title: event.title,
          artistName: creator?.name || "Unknown Artist",
          artistAvatar: creator?.avatar_url || null,
          scheduledAt,
          endTime,
          category: event.category,
          isLive: event.is_live || false,
          coverUrl: event.cover_url,
          price: event.price || 0,
          isFree: event.is_free,
          creatorId: event.creator_id,
          status: computeSessionStatus(scheduledAt, endTime, event.is_live || false, event.live_ended_at, attendedEventIds.has(event.id), now),
          attended: attendedEventIds.has(event.id),
        });
      }

      // Sort: live first, then starting_soon, then upcoming, then ended/missed
      const statusOrder: Record<SessionStatus, number> = { live: 0, starting_soon: 1, upcoming: 2, ended: 3, missed: 4 };
      result.sort((a, b) => {
        if (statusOrder[a.status] !== statusOrder[b.status]) return statusOrder[a.status] - statusOrder[b.status];
        return a.scheduledAt.getTime() - b.scheduledAt.getTime();
      });

      return result;
    },
    enabled: !!userId,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 60000, // Refetch every minute for status updates
  });

  return { sessions, isLoading, refetch };
}
