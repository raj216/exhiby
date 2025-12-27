import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface UseLiveViewersResult {
  viewerCount: number;
  isJoined: boolean;
  joinAsViewer: () => Promise<void>;
  leaveAsViewer: () => Promise<void>;
}

export function useLiveViewers(eventId: string | null): UseLiveViewersResult {
  const { user } = useAuth();
  const [viewerCount, setViewerCount] = useState(0);
  const [isJoined, setIsJoined] = useState(false);

  // Fetch initial viewer count
  useEffect(() => {
    if (!eventId) return;

    const fetchViewerCount = async () => {
      const { count, error } = await supabase
        .from("live_viewers")
        .select("*", { count: "exact", head: true })
        .eq("event_id", eventId);

      if (!error && count !== null) {
        setViewerCount(count);
      }
    };

    fetchViewerCount();

    // Subscribe to realtime changes
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
        async () => {
          // Refetch count on any change
          const { count } = await supabase
            .from("live_viewers")
            .select("*", { count: "exact", head: true })
            .eq("event_id", eventId);
          
          if (count !== null) {
            setViewerCount(count);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId]);

  const joinAsViewer = useCallback(async () => {
    if (!eventId || !user || isJoined) return;

    try {
      const { error } = await supabase.from("live_viewers").insert({
        event_id: eventId,
        user_id: user.id,
      });

      if (!error) {
        setIsJoined(true);
        console.log("Joined as viewer");
      } else if (error.code === "23505") {
        // Already joined (unique constraint violation)
        setIsJoined(true);
      } else {
        console.error("Error joining as viewer:", error);
      }
    } catch (err) {
      console.error("Error joining as viewer:", err);
    }
  }, [eventId, user, isJoined]);

  const leaveAsViewer = useCallback(async () => {
    if (!eventId || !user) return;

    try {
      const { error } = await supabase
        .from("live_viewers")
        .delete()
        .eq("event_id", eventId)
        .eq("user_id", user.id);

      if (!error) {
        setIsJoined(false);
        console.log("Left as viewer");
      }
    } catch (err) {
      console.error("Error leaving as viewer:", err);
    }
  }, [eventId, user]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isJoined && eventId && user) {
        supabase
          .from("live_viewers")
          .delete()
          .eq("event_id", eventId)
          .eq("user_id", user.id)
          .then(() => console.log("Cleaned up viewer on unmount"));
      }
    };
  }, [isJoined, eventId, user]);

  return {
    viewerCount,
    isJoined,
    joinAsViewer,
    leaveAsViewer,
  };
}
