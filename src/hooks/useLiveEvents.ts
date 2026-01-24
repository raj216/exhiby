import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const ENDED_GRACE_PERIOD_MINUTES = 30;

export interface LiveEvent {
  id: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  price: number | null;
  is_free: boolean;
  viewer_count: number;
  category: string | null;
  creator_id: string;
  live_started_at: string | null;
  live_ended_at: string | null;
  creator?: { name: string; avatar_url: string | null };
}

export function useLiveEvents() {
  const queryClient = useQueryClient();

  const { data: liveEvents = [], isLoading: loading, error, refetch } = useQuery({
    queryKey: ["live-events"],
    queryFn: async (): Promise<LiveEvent[]> => {
      const now = new Date();
      const gracePeriodCutoff = new Date(now.getTime() - ENDED_GRACE_PERIOD_MINUTES * 60 * 1000);

      // Fetch active and recently ended events in parallel
      const [activeResult, endedResult] = await Promise.all([
        supabase
          .from("events")
          .select("id, title, cover_url, price, is_free, creator_id, live_started_at, live_ended_at, description, category")
          .eq("is_live", true)
          .is("live_ended_at", null)
          .order("live_started_at", { ascending: false }),
        supabase
          .from("events")
          .select("id, title, cover_url, price, is_free, creator_id, live_started_at, live_ended_at, description, category")
          .not("live_ended_at", "is", null)
          .gte("live_ended_at", gracePeriodCutoff.toISOString())
          .order("live_ended_at", { ascending: false }),
      ]);

      const combinedData = [...(activeResult.data || []), ...(endedResult.data || [])];
      if (!combinedData.length) return [];

      // Fetch all data in parallel: profiles and viewer counts
      const creatorIds = [...new Set(combinedData.map((e) => e.creator_id))];
      const activeEventIds = combinedData.filter((e) => !e.live_ended_at).map((e) => e.id);

      const [profilesResult, ...viewerCountResults] = await Promise.all([
        supabase.rpc("get_creator_profiles", { user_ids: creatorIds }),
        ...activeEventIds.map((id) => supabase.rpc("get_active_viewer_count", { event_uuid: id })),
      ]);

      const profileMap = new Map(
        (profilesResult.data || []).map((p) => [p.user_id, { name: p.name, avatar_url: p.avatar_url }])
      );

      const viewerCountMap = new Map(
        activeEventIds.map((id, i) => [id, viewerCountResults[i]?.data || 0])
      );

      return combinedData.map((event) => ({
        ...event,
        viewer_count: viewerCountMap.get(event.id) || 0,
        creator: profileMap.get(event.creator_id) || { name: "Unknown", avatar_url: null },
      }));
    },
    staleTime: 15 * 1000, // 15 seconds for live data
    gcTime: 60 * 1000, // 1 minute
    refetchOnWindowFocus: true,
  });

  // Realtime subscription for live updates
  useEffect(() => {
    const eventsChannel = supabase
      .channel("live_events_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, () => {
        queryClient.invalidateQueries({ queryKey: ["live-events"] });
      })
      .subscribe();

    const viewersChannel = supabase
      .channel("live_viewers_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "live_viewers" }, () => {
        queryClient.invalidateQueries({ queryKey: ["live-events"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(eventsChannel);
      supabase.removeChannel(viewersChannel);
    };
  }, [queryClient]);

  return { liveEvents, loading, error: error?.message || null, refetch };
}
