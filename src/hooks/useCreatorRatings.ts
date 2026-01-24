import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CreatorRatings {
  averageRating: number;
  totalRatings: number;
  totalGuests: number;
}

export function useCreatorRatings(creatorId: string | undefined) {
  const { data: ratings = { averageRating: 0, totalRatings: 0, totalGuests: 0 }, isLoading, refetch } = useQuery({
    queryKey: ["creator-ratings", creatorId],
    queryFn: async (): Promise<CreatorRatings> => {
      if (!creatorId) return { averageRating: 0, totalRatings: 0, totalGuests: 0 };

      const { data, error } = await supabase.rpc("get_creator_rating_stats", {
        target_creator_id: creatorId,
      });

      if (error) {
        console.error("Error fetching creator ratings:", error);
        return { averageRating: 0, totalRatings: 0, totalGuests: 0 };
      }

      if (data && data.length > 0) {
        return {
          averageRating: Number(data[0].average_rating) || 0,
          totalRatings: data[0].total_ratings || 0,
          totalGuests: data[0].total_guests || 0,
        };
      }

      return { averageRating: 0, totalRatings: 0, totalGuests: 0 };
    },
    enabled: !!creatorId,
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

  return { ratings, loading: isLoading, refetch };
}
