import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

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
      
      const { data, error: fetchError } = await supabase
        .from("events")
        .select(`
          id,
          title,
          cover_url,
          price,
          is_free,
          creator_id,
          live_started_at,
          description
        `)
        .eq("is_live", true)
        .order("live_started_at", { ascending: false });

      if (fetchError) {
        console.error("[LiveEvents] Error fetching live events:", fetchError);
        setError(fetchError.message);
        return;
      }

      console.log(`[LiveEvents] Found ${data?.length || 0} live events`);

      if (data && data.length > 0) {
        // Fetch creator profiles using secure RPC function
        const creatorIds = [...new Set(data.map((e) => e.creator_id))];
        
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
          data.map(async (event) => {
            const { data: viewerCount } = await supabase.rpc("get_active_viewer_count", {
              event_uuid: event.id,
            });

            return {
              ...event,
              viewer_count: viewerCount || 0,
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
