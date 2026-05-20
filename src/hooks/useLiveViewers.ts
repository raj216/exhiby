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

  // Poll viewer count instead of subscribing to realtime row changes
  // (live_viewers is no longer in the realtime publication to avoid leaking
  // viewer user_ids to other subscribers in the room).
  useEffect(() => {
    if (!eventId) return;

    console.log(`[LiveViewers] Setting up polling for event: ${eventId}`);
    fetchViewerCount();

    const pollInterval = setInterval(fetchViewerCount, 10000); // 10s

    return () => {
      console.log(`[LiveViewers] Cleaning up polling for ${eventId}`);
      clearInterval(pollInterval);
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
      console.log("[LiveViewers] Checking session capacity...");

      // Plan gate: check if the session has capacity before joining
      const { data: gateResult, error: gateError } = await (supabase.rpc as any)(
        "can_viewer_join_session",
        { p_event_id: eventId }
      );

      if (!gateError && gateResult) {
        const gate = gateResult as unknown as { can_join: boolean; reason?: string; max_viewers?: number };
        if (!gate.can_join) {
          console.warn(`[LiveViewers] Session full (max ${gate.max_viewers} viewers)`);
          // Dispatch a custom event so the live room UI can show a "Session Full" message
          window.dispatchEvent(
            new CustomEvent("exhiby:session-full", {
              detail: { eventId, maxViewers: gate.max_viewers },
            })
          );
          return;
        }
      }

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
