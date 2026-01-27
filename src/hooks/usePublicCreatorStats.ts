import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PublicCreatorStats {
  sessionsHosted: number;
  averageRating: number;
  totalGuests: number;
  isCreator: boolean;
}

const DEBUG_STATS = import.meta.env.DEV && localStorage.getItem("debug_creator_stats") === "1";

export function usePublicCreatorStats(userId: string | undefined) {
  const { data: stats = { sessionsHosted: 0, averageRating: 0, totalGuests: 0, isCreator: false }, isLoading: loading, refetch } = useQuery({
    queryKey: ["public-creator-stats", userId],
    queryFn: async (): Promise<PublicCreatorStats> => {
      if (!userId) return { sessionsHosted: 0, averageRating: 0, totalGuests: 0, isCreator: false };

      // Check if user has creator role
      const { data: hasCreatorRole } = await supabase.rpc("has_role", {
        _user_id: userId,
        _role: "creator",
      });

      if (!hasCreatorRole) {
        return { sessionsHosted: 0, averageRating: 0, totalGuests: 0, isCreator: false };
      }

      // Fetch all data in parallel
      const [sessionStatsResult, ratingResult] = await Promise.all([
        // Use new RPC for accurate session stats (completed sessions + unique guests from live_viewers)
        supabase.rpc("get_creator_session_stats", { target_creator_id: userId }),
        // Get rating stats (averageRating and totalRatings)
        supabase.rpc("get_creator_rating_stats", { target_creator_id: userId }),
      ]);

      let sessionsHosted = 0;
      let totalGuests = 0;
      let averageRating = 0;

      // Extract session stats from new RPC
      if (sessionStatsResult.data && sessionStatsResult.data.length > 0) {
        sessionsHosted = sessionStatsResult.data[0].sessions_hosted || 0;
        totalGuests = sessionStatsResult.data[0].unique_guests || 0;
      }

      // Extract rating from existing RPC
      if (ratingResult.data && ratingResult.data.length > 0) {
        averageRating = Number(ratingResult.data[0].average_rating) || 0;
      }

      if (DEBUG_STATS) {
        console.log("[PublicCreatorStats] userId:", userId);
        console.log("[PublicCreatorStats] sessionsHosted:", sessionsHosted, "(from get_creator_session_stats RPC - counts events with live_ended_at IS NOT NULL)");
        console.log("[PublicCreatorStats] totalGuests:", totalGuests, "(from get_creator_session_stats RPC - counts DISTINCT user_id from live_viewers)");
        console.log("[PublicCreatorStats] averageRating:", averageRating, "(from get_creator_rating_stats RPC)");
        if (sessionStatsResult.error) {
          console.error("[PublicCreatorStats] sessionStatsResult error:", sessionStatsResult.error);
        }
        if (ratingResult.error) {
          console.error("[PublicCreatorStats] ratingResult error:", ratingResult.error);
        }
      }

      return {
        sessionsHosted,
        averageRating,
        totalGuests,
        isCreator: true,
      };
    },
    enabled: !!userId,
    staleTime: 30 * 1000, // 30 seconds - more responsive updates
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

  return { stats, loading, refetch };
}
