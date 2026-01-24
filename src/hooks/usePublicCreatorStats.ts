import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PublicCreatorStats {
  sessionsHosted: number;
  averageRating: number;
  totalGuests: number;
  isCreator: boolean;
}

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

      // Fetch all data in parallel instead of waterfall
      const [sessionsResult, ratingResult] = await Promise.all([
        // Count completed sessions
        supabase
          .from("events")
          .select("*", { count: "exact", head: true })
          .eq("creator_id", userId)
          .not("live_ended_at", "is", null),
        // Get rating stats (includes total_guests)
        supabase.rpc("get_creator_rating_stats", { target_creator_id: userId }),
      ]);

      const sessionsCount = sessionsResult.count || 0;
      let averageRating = 0;
      let totalGuests = 0;

      if (ratingResult.data && ratingResult.data.length > 0) {
        averageRating = Number(ratingResult.data[0].average_rating) || 0;
        totalGuests = ratingResult.data[0].total_guests || 0;
      }

      return {
        sessionsHosted: sessionsCount,
        averageRating,
        totalGuests,
        isCreator: true,
      };
    },
    enabled: !!userId,
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

  return { stats, loading, refetch };
}
