import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface UseLiveViewersResult {
  viewerCount: number;
  isJoined: boolean;
  joinAsViewer: () => Promise<void>;
  leaveAsViewer: () => Promise<void>;
}

const HEARTBEAT_INTERVAL = 15000; // 15 seconds

export function useLiveViewers(eventId: string | null): UseLiveViewersResult {
  const { user } = useAuth();
  const [viewerCount, setViewerCount] = useState(0);
  const [isJoined, setIsJoined] = useState(false);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch active viewer count using the secure RPC function (30 second threshold)
  const fetchViewerCount = useCallback(async () => {
    if (!eventId) return;
    
    try {
      const { data, error } = await supabase.rpc("get_active_viewer_count", {
        event_uuid: eventId,
      });

      if (!error && data !== null) {
        console.log(`[LiveViewers] Active viewer count for ${eventId}: ${data}`);
        setViewerCount(data);
      } else if (error) {
        console.error("[LiveViewers] Error fetching viewer count:", error);
      }
    } catch (err) {
      console.error("[LiveViewers] Exception fetching viewer count:", err);
    }
  }, [eventId]);

  // Subscribe to realtime changes and fetch initial count
  useEffect(() => {
    if (!eventId) return;

    console.log(`[LiveViewers] Setting up for event: ${eventId}`);
    fetchViewerCount();

    // Subscribe to realtime changes on live_viewers table
    const channel = supabase
      .channel(`live_viewers_${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "live_viewers",
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          console.log("[LiveViewers] Realtime change detected:", payload.eventType);
          // Refetch count on any change
          fetchViewerCount();
        }
      )
      .subscribe((status) => {
        console.log(`[LiveViewers] Subscription status: ${status}`);
      });

    return () => {
      console.log(`[LiveViewers] Cleaning up subscription for ${eventId}`);
      supabase.removeChannel(channel);
    };
  }, [eventId, fetchViewerCount]);

  // Heartbeat to update last_seen
  const startHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
    }

    heartbeatRef.current = setInterval(async () => {
      if (!eventId || !user) return;

      try {
        console.log("[LiveViewers] Sending heartbeat...");
        const { error } = await supabase.rpc("upsert_live_viewer", {
          p_event_id: eventId,
          p_user_id: user.id,
        });

        if (error) {
          console.error("[LiveViewers] Heartbeat error:", error);
        }
      } catch (err) {
        console.error("[LiveViewers] Heartbeat exception:", err);
      }
    }, HEARTBEAT_INTERVAL);
  }, [eventId, user]);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      console.log("[LiveViewers] Stopping heartbeat");
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }, []);

  const joinAsViewer = useCallback(async () => {
    if (!eventId || !user || isJoined) return;

    try {
      console.log("[LiveViewers] Joining as viewer...");
      const { error } = await supabase.rpc("upsert_live_viewer", {
        p_event_id: eventId,
        p_user_id: user.id,
      });

      if (!error) {
        setIsJoined(true);
        startHeartbeat();
        console.log("[LiveViewers] Successfully joined as viewer");
      } else {
        console.error("[LiveViewers] Error joining as viewer:", error);
      }
    } catch (err) {
      console.error("[LiveViewers] Exception joining as viewer:", err);
    }
  }, [eventId, user, isJoined, startHeartbeat]);

  const leaveAsViewer = useCallback(async () => {
    if (!eventId || !user) return;

    try {
      console.log("[LiveViewers] Leaving as viewer...");
      stopHeartbeat();
      
      const { error } = await supabase.rpc("remove_live_viewer", {
        p_event_id: eventId,
        p_user_id: user.id,
      });

      if (!error) {
        setIsJoined(false);
        console.log("[LiveViewers] Successfully left as viewer");
      } else {
        console.error("[LiveViewers] Error leaving as viewer:", error);
      }
    } catch (err) {
      console.error("[LiveViewers] Exception leaving as viewer:", err);
    }
  }, [eventId, user, stopHeartbeat]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopHeartbeat();
      
      // Attempt to clean up viewer record on unmount
      if (isJoined && eventId && user) {
        console.log("[LiveViewers] Cleaning up viewer on unmount");
        supabase
          .rpc("remove_live_viewer", {
            p_event_id: eventId,
            p_user_id: user.id,
          })
          .then(({ error }) => {
            if (error) {
              console.error("[LiveViewers] Cleanup error:", error);
            }
          });
      }
    };
  }, [isJoined, eventId, user, stopHeartbeat]);

  // Handle page visibility change and beforeunload
  useEffect(() => {
    if (!isJoined || !eventId || !user) return;

    const handleBeforeUnload = () => {
      console.log("[LiveViewers] beforeunload - cleaning up viewer");
      // Use sendBeacon for reliable cleanup on page unload
      const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/remove_live_viewer`;
      const data = JSON.stringify({
        p_event_id: eventId,
        p_user_id: user.id,
      });
      
      navigator.sendBeacon(url, data);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        // Update last_seen when tab becomes hidden
        supabase.rpc("upsert_live_viewer", {
          p_event_id: eventId,
          p_user_id: user.id,
        });
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isJoined, eventId, user]);

  return {
    viewerCount,
    isJoined,
    joinAsViewer,
    leaveAsViewer,
  };
}
