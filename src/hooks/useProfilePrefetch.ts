import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCallback } from "react";

/**
 * Hook for prefetching profile data on hover
 * Makes navigation feel instant by loading data before click
 */
export function useProfilePrefetch() {
  const queryClient = useQueryClient();

  const prefetchProfile = useCallback(
    (userId: string) => {
      if (!userId) return;

      // Prefetch public profile data
      queryClient.prefetchQuery({
        queryKey: ["public-profile", userId],
        queryFn: async () => {
          const { data, error } = await supabase.rpc("get_public_profile", {
            profile_user_id: userId,
          });
          if (error) throw error;
          return data?.[0] ?? null;
        },
        staleTime: 60 * 1000, // 1 minute
      });

      // Prefetch follow stats
      queryClient.prefetchQuery({
        queryKey: ["follow-stats", userId],
        queryFn: async () => {
          const [followersResult, followingResult] = await Promise.all([
            supabase.rpc("get_follower_count", { target_user_id: userId }),
            supabase.rpc("get_following_count", { target_user_id: userId }),
          ]);
          return {
            followersCount: followersResult.data ?? 0,
            followingCount: followingResult.data ?? 0,
          };
        },
        staleTime: 30 * 1000, // 30 seconds
      });

      // Prefetch portfolio items
      queryClient.prefetchQuery({
        queryKey: ["portfolio-items", userId],
        queryFn: async () => {
          const { data, error } = await supabase.rpc("get_portfolio_items", {
            target_user_id: userId,
          });
          if (error) throw error;
          return data ?? [];
        },
        staleTime: 60 * 1000,
      });
    },
    [queryClient]
  );

  return { prefetchProfile };
}
