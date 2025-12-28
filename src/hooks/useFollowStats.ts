import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface FollowStats {
  followersCount: number;
  followingCount: number;
}

export function useFollowStats(userId: string | undefined) {
  const [stats, setStats] = useState<FollowStats>({
    followersCount: 0,
    followingCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    try {
      const [followersResult, followingResult] = await Promise.all([
        supabase.rpc("get_follower_count", { target_user_id: userId }),
        supabase.rpc("get_following_count", { target_user_id: userId }),
      ]);

      setStats({
        followersCount: followersResult.data ?? 0,
        followingCount: followingResult.data ?? 0,
      });
    } catch (error) {
      console.error("Error fetching follow stats:", error);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, isLoading, refetch: fetchStats };
}
