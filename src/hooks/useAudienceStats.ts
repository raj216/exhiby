import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AudienceStats {
  eventsAttended: number;
  itemsCollected: number;
}

export function useAudienceStats(userId: string | undefined) {
  const [stats, setStats] = useState<AudienceStats>({
    eventsAttended: 0,
    itemsCollected: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Events attended - check live_viewers table for past participation
      // For now, we'll count distinct events the user joined
      const { count: viewerCount, error: viewerError } = await supabase
        .from("live_viewers")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);

      if (viewerError) {
        console.error("Error fetching viewer count:", viewerError);
      }

      // Items collected - will be 0 until purchases/collections table exists
      const itemsCollected = 0;

      setStats({
        eventsAttended: viewerCount || 0,
        itemsCollected,
      });
    } catch (err) {
      console.error("Error fetching audience stats:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, refetch: fetchStats };
}
