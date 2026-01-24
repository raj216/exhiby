import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CreatorStats {
  sessionsHosted: number;
  followersCount: number;
  earnings: number;
  ticketsSold: number;
}

export function useCreatorStats(userId: string | undefined) {
  const { data: stats = { sessionsHosted: 0, followersCount: 0, earnings: 0, ticketsSold: 0 }, isLoading: loading, refetch } = useQuery({
    queryKey: ["creator-stats", userId],
    queryFn: async (): Promise<CreatorStats> => {
      if (!userId) return { sessionsHosted: 0, followersCount: 0, earnings: 0, ticketsSold: 0 };

      // Parallel fetch
      const [eventsResult, followersResult] = await Promise.all([
        supabase
          .from("events")
          .select("*", { count: "exact", head: true })
          .eq("creator_id", userId),
        supabase.rpc("get_follower_count", { target_user_id: userId }),
      ]);

      return {
        sessionsHosted: eventsResult.count || 0,
        followersCount: followersResult.data ?? 0,
        earnings: 0, // To be implemented
        ticketsSold: 0, // To be implemented
      };
    },
    enabled: !!userId,
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

  return { stats, loading, refetch };
}
