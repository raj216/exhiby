import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CreatorStats {
  sessionsHosted: number;
  followersCount: number;
  earnings: number;
  ticketsSold: number;
}

export function useCreatorStats(userId: string | undefined) {
  const [stats, setStats] = useState<CreatorStats>({
    sessionsHosted: 0,
    followersCount: 0,
    earnings: 0,
    ticketsSold: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Count events hosted by this creator
      const { count: eventsCount, error: eventsError } = await supabase
        .from("events")
        .select("*", { count: "exact", head: true })
        .eq("creator_id", userId);

      if (eventsError) {
        console.error("Error fetching events count:", eventsError);
      }

      // Followers count - will be 0 until follows table exists
      // For now, we don't have a follows table, so we return 0
      const followersCount = 0;

      // Earnings and tickets sold - will be 0 until purchases/tickets tables exist
      const earnings = 0;
      const ticketsSold = 0;

      setStats({
        sessionsHosted: eventsCount || 0,
        followersCount,
        earnings,
        ticketsSold,
      });
    } catch (err) {
      console.error("Error fetching creator stats:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, refetch: fetchStats };
}
