import { useQuery } from "@tanstack/react-query";
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
  const { data: stats = { sessionsHosted: 0, followersCount: 0, uniqueGuests: 0, earnings: 0, ticketsSold: 0 }, isLoading: loading, refetch } = useQuery({
    queryKey: ["creator-stats", userId],
    queryFn: async (): Promise<CreatorStats> => {
      if (!userId) return { sessionsHosted: 0, followersCount: 0, uniqueGuests: 0, earnings: 0, ticketsSold: 0 };

      // Parallel fetch all stats
      const [sessionStatsResult, followersResult] = await Promise.all([
        // Use new RPC for accurate session stats (completed sessions + unique guests from live_viewers)
        supabase.rpc("get_creator_session_stats", { target_creator_id: userId }),
        // Get follower count
        supabase.rpc("get_follower_count", { target_user_id: userId }),
      ]);

      let sessionsHosted = 0;
      let uniqueGuests = 0;

      if (sessionStatsResult.data && sessionStatsResult.data.length > 0) {
        sessionsHosted = sessionStatsResult.data[0].sessions_hosted || 0;
        uniqueGuests = sessionStatsResult.data[0].unique_guests || 0;
      }

      if (DEBUG_STATS) {
        console.log("[CreatorStats] userId:", userId);
        console.log("[CreatorStats] sessionsHosted:", sessionsHosted, "(from get_creator_session_stats RPC - counts events with live_ended_at IS NOT NULL)");
        console.log("[CreatorStats] uniqueGuests:", uniqueGuests, "(from get_creator_session_stats RPC - counts DISTINCT user_id from live_viewers)");
        console.log("[CreatorStats] followersCount:", followersResult.data ?? 0);
        if (sessionStatsResult.error) {
          console.error("[CreatorStats] sessionStatsResult error:", sessionStatsResult.error);
        }
      }

      return {
        sessionsHosted,
        followersCount: followersResult.data ?? 0,
        uniqueGuests,
        earnings: 0, // To be implemented with payments
        ticketsSold: 0, // To be implemented with payments
      };
    },
    enabled: !!userId,
    staleTime: 30 * 1000, // 30 seconds - more responsive updates
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

  return { stats, loading, refetch };
}
