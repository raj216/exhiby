import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CreatorRatings {
  averageRating: number;
  totalRatings: number;
  totalGuests: number;
}

export function useCreatorRatings(creatorId: string | undefined) {
  const [ratings, setRatings] = useState<CreatorRatings>({
    averageRating: 0,
    totalRatings: 0,
    totalGuests: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchRatings = useCallback(async () => {
    if (!creatorId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_creator_rating_stats", {
        target_creator_id: creatorId,
      });

      if (error) {
        console.error("Error fetching creator ratings:", error);
        return;
      }

      if (data && data.length > 0) {
        const stats = data[0];
        setRatings({
          averageRating: Number(stats.average_rating) || 0,
          totalRatings: stats.total_ratings || 0,
          totalGuests: stats.total_guests || 0,
        });
      }
    } catch (err) {
      console.error("Error fetching creator ratings:", err);
    } finally {
      setLoading(false);
    }
  }, [creatorId]);

  useEffect(() => {
    fetchRatings();
  }, [fetchRatings]);

  return { ratings, loading, refetch: fetchRatings };
}
