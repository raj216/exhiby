import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface FollowStats {
  followersCount: number;
  followingCount: number;
}

export function useFollowStats(userId: string | undefined) {
  const { data: stats = { followersCount: 0, followingCount: 0 }, isLoading, refetch } = useQuery({
    queryKey: ["follow-stats", userId],
    queryFn: async (): Promise<FollowStats> => {
      if (!userId) return { followersCount: 0, followingCount: 0 };

      // Parallel fetch for both counts
      const [followersResult, followingResult] = await Promise.all([
        supabase.rpc("get_follower_count", { target_user_id: userId }),
        supabase.rpc("get_following_count", { target_user_id: userId }),
      ]);

      return {
        followersCount: followersResult.data ?? 0,
        followingCount: followingResult.data ?? 0,
      };
    },
    enabled: !!userId,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

  return { stats, isLoading, refetch };
}
