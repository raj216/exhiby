import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

// Grace period in minutes - ended streams stay visible for this long
const ENDED_GRACE_PERIOD_MINUTES = 30;

export interface LiveEvent {
  id: string;
  title: string;
  cover_url: string | null;
  price: number | null;
  is_free: boolean;
  viewer_count: number;
  category: string | null;
  creator_id: string;
  live_started_at: string | null;
  live_ended_at: string | null;
  room_url: string | null;
  creator?: {
    name: string;
    avatar_url: string | null;
  };
}

export function useLiveEvents() {
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLiveEvents = useCallback(async () => {
    try {
      console.log("[LiveEvents] Fetching live events...");
      
      const now = new Date();
      const gracePeriodCutoff = new Date(now.getTime() - ENDED_GRACE_PERIOD_MINUTES * 60 * 1000);
      
      // Fetch active live events
      const { data: activeData, error: activeError } = await supabase
        .from("events")
        .select(`
          id,
          title,
          cover_url,
          price,
          is_free,
          creator_id,
          live_started_at,
          live_ended_at,
          room_url,
          description
        `)
        .eq("is_live", true)
        .not("room_url", "is", null)
        .is("live_ended_at", null)
        .or(`end_time.is.null,end_time.gt.${now.toISOString()}`)
        .order("live_started_at", { ascending: false });

      // Fetch recently ended events (within grace period)
      const { data: endedData, error: endedError } = await supabase
        .from("events")
        .select(`
          id,
          title,
          cover_url,
          price,
          is_free,
          creator_id,
          live_started_at,
          live_ended_at,
          room_url,
          description
        `)
        .not("room_url", "is", null)
        .not("live_ended_at", "is", null)
        .gte("live_ended_at", gracePeriodCutoff.toISOString())
        .order("live_ended_at", { ascending: false });

      if (activeError) {
        console.error("[LiveEvents] Error fetching active live events:", activeError);
        setError(activeError.message);
        return;
      }

      if (endedError) {
        console.error("[LiveEvents] Error fetching ended live events:", endedError);
      }

      // Combine active and recently ended events
      const combinedData = [
        ...(activeData || []),
        ...(endedData || []),
      ];

      console.log(`[LiveEvents] Found ${activeData?.length || 0} active, ${endedData?.length || 0} recently ended`);

      if (combinedData.length > 0) {
        // Fetch creator profiles using secure RPC function
        const creatorIds = [...new Set(combinedData.map((e) => e.creator_id))];
        
        const { data: allProfiles } = await supabase.rpc("get_all_public_profiles");
        
        const profiles = allProfiles?.filter((p: { user_id: string }) => 
          creatorIds.includes(p.user_id)
        );

        const profileMap = new Map(
          profiles?.map((p: { user_id: string; name: string; avatar_url: string | null }) => 
            [p.user_id, { name: p.name, avatar_url: p.avatar_url }]
          )
        );

        // Fetch real-time viewer counts for each event
        const eventsWithCounts = await Promise.all(
          combinedData.map(async (event) => {
            // Only fetch viewer count for active streams
            let viewerCount = 0;
            if (!event.live_ended_at) {
              const { data: count } = await supabase.rpc("get_active_viewer_count", {
                event_uuid: event.id,
              });
              viewerCount = count || 0;
            }

            return {
              ...event,
              viewer_count: viewerCount,
              category: event.description,
              creator: profileMap.get(event.creator_id) || { name: "Unknown", avatar_url: null },
            };
          })
        );

        setLiveEvents(eventsWithCounts);
      } else {
        setLiveEvents([]);
      }
    } catch (err) {
      console.error("[LiveEvents] Error in fetchLiveEvents:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLiveEvents();

    // Subscribe to realtime changes on events table
    const eventsChannel = supabase
      .channel("live_events_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "events",
        },
        (payload) => {
          console.log("[LiveEvents] Event change detected:", payload.eventType);
          fetchLiveEvents();
        }
      )
      .subscribe((status) => {
        console.log(`[LiveEvents] Events subscription status: ${status}`);
      });

    // Subscribe to realtime changes on live_viewers table for count updates
    const viewersChannel = supabase
      .channel("live_viewers_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "live_viewers",
        },
        (payload) => {
          console.log("[LiveEvents] Viewer change detected:", payload.eventType);
          // Refetch to update viewer counts
          fetchLiveEvents();
        }
      )
      .subscribe((status) => {
        console.log(`[LiveEvents] Viewers subscription status: ${status}`);
      });

    return () => {
      supabase.removeChannel(eventsChannel);
      supabase.removeChannel(viewersChannel);
    };
  }, [fetchLiveEvents]);

  return { liveEvents, loading, error, refetch: fetchLiveEvents };
}
