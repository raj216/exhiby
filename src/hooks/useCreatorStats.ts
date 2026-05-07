import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CreatorStats {
  sessionsHosted: number;
  followersCount: number;
  uniqueGuests: number;
  earnings: number;
  ticketsSold: number;
}

const DEBUG_STATS = import.meta.env.DEV && localStorage.getItem("debug_creator_stats") === "1";

export function useCreatorStats(userId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: stats = { sessionsHosted: 0, followersCount: 0, uniqueGuests: 0, earnings: 0, ticketsSold: 0 }, isLoading: loading, refetch } = useQuery({
    queryKey: ["creator-stats", userId],
    queryFn: async (): Promise<CreatorStats> => {
      if (!userId) return { sessionsHosted: 0, followersCount: 0, uniqueGuests: 0, earnings: 0, ticketsSold: 0 };

      // Get all event IDs created by this creator
      const { data: creatorEvents } = await supabase.from("events").select("id").eq("creator_id", userId);
      const eventIds = (creatorEvents || []).map(e => e.id);

      // Parallel fetch all stats
      const [sessionStatsResult, followersResult, ticketsSoldResult] = await Promise.all([
        supabase.rpc("get_creator_session_stats", { target_creator_id: userId }),
        supabase.rpc("get_follower_count", { target_user_id: userId }),
        // Count ALL tickets (paid + free), excluding self-tickets (creator's own)
        eventIds.length > 0
          ? supabase
              .from("tickets")
              .select("id", { count: "exact", head: true })
              .in("payment_status", ["paid", "free"])
              .neq("user_id", userId)
              .in("event_id", eventIds)
          : Promise.resolve({ count: 0 } as any),
      ]);

      let sessionsHosted = 0;
      let uniqueGuests = 0;

      if (sessionStatsResult.data && sessionStatsResult.data.length > 0) {
        sessionsHosted = sessionStatsResult.data[0].sessions_hosted || 0;
        uniqueGuests = sessionStatsResult.data[0].unique_guests || 0;
      }

      if (DEBUG_STATS) {
        console.log("[CreatorStats] userId:", userId);
        console.log("[CreatorStats] sessionsHosted:", sessionsHosted, "(events with live_ended_at IS NOT NULL)");
        console.log("[CreatorStats] uniqueGuests:", uniqueGuests, "(DISTINCT user_id from live_viewers)");
        console.log("[CreatorStats] followersCount:", followersResult.data ?? 0);
        console.log("[CreatorStats] ticketsSold:", ticketsSoldResult.count ?? 0, "(all paid+free, excl. self)");
        if (sessionStatsResult.error) {
          console.error("[CreatorStats] sessionStatsResult error:", sessionStatsResult.error);
        }
      }

      return {
        sessionsHosted,
        followersCount: followersResult.data ?? 0,
        uniqueGuests,
        earnings: 0, // Sourced from useCreatorEarnings
        ticketsSold: ticketsSoldResult.count ?? 0,
      };
    },
    enabled: !!userId,
    staleTime: 15_000, // 15 seconds — more responsive
    gcTime: 5 * 60_000,
  });

  // ── Realtime: invalidate when new earnings or tickets land ────────────────
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`creator-stats-rt-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "creator_earnings",
          filter: `creator_id=eq.${userId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["creator-stats", userId] });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "creator_earnings",
          filter: `creator_id=eq.${userId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["creator-stats", userId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  return { stats, loading, refetch };
}
