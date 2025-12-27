import { useState, useEffect } from "react";
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

  const fetchLiveEvents = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from("events")
        .select(`
          id,
          title,
          cover_url,
          price,
          is_free,
          viewer_count,
          creator_id,
          live_started_at,
          description
        `)
        .eq("is_live", true)
        .order("live_started_at", { ascending: false });

      if (fetchError) {
        console.error("Error fetching live events:", fetchError);
        setError(fetchError.message);
        return;
      }

      // Fetch creator profiles separately
      if (data && data.length > 0) {
        const creatorIds = [...new Set(data.map((e) => e.creator_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, name, avatar_url")
          .in("user_id", creatorIds);

        const profileMap = new Map(
          profiles?.map((p) => [p.user_id, { name: p.name, avatar_url: p.avatar_url }])
        );

        const eventsWithCreators = data.map((event) => ({
          ...event,
          category: event.description, // Using description as category for now
          creator: profileMap.get(event.creator_id) || { name: "Unknown", avatar_url: null },
        }));

        setLiveEvents(eventsWithCreators);
      } else {
        setLiveEvents([]);
      }
    } catch (err) {
      console.error("Error in fetchLiveEvents:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveEvents();

    // Subscribe to realtime changes
    const channel = supabase
      .channel("live_events_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "events",
        },
        (payload) => {
          console.log("Event change detected:", payload);
          fetchLiveEvents();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { liveEvents, loading, error, refetch: fetchLiveEvents };
}
