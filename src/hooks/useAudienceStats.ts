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
      // Events attended - use secure RPC function
      const { data: attendanceCount, error: attendanceError } = await supabase
        .rpc("get_user_attendance_count", { target_user_id: userId });

      if (attendanceError) {
        console.error("Error fetching attendance count:", attendanceError);
      }

      // Items collected - will be 0 until purchases/collections table exists
      const itemsCollected = 0;

      setStats({
        eventsAttended: attendanceCount || 0,
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
