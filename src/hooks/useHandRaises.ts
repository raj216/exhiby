import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface HandRaise {
  id: string;
  event_id: string;
  user_id: string;
  display_name?: string;
  created_at: string;
  cleared_at: string | null;
}

interface UseHandRaisesOptions {
  eventId: string | null;
  isCreator: boolean;
}

export function useHandRaises({ eventId, isCreator }: UseHandRaisesOptions) {
  const { user } = useAuth();
  const [handRaises, setHandRaises] = useState<HandRaise[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [myHandRaised, setMyHandRaised] = useState(false);
  const lastRaiseTimeRef = useRef<number>(0);
  const COOLDOWN_MS = 10000; // 10 second cooldown

  // Debug logging
  useEffect(() => {
    console.log("[useHandRaises] Init:", {
      eventId,
      isCreator,
      userId: user?.id,
    });
  }, [eventId, isCreator, user?.id]);

  // Fetch initial hand raises
  const fetchHandRaises = useCallback(async () => {
    if (!eventId) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("live_hand_raises")
        .select("*")
        .eq("event_id", eventId)
        .is("cleared_at", null)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("[useHandRaises] Fetch error:", error);
        return;
      }

      console.log("[useHandRaises] Fetched hand raises:", data?.length || 0);
      setHandRaises(data || []);

      // Check if current user has hand raised
      if (user?.id && data) {
        const myRaise = data.find((r) => r.user_id === user.id);
        setMyHandRaised(!!myRaise);
      }
    } catch (err) {
      console.error("[useHandRaises] Fetch exception:", err);
    } finally {
      setIsLoading(false);
    }
  }, [eventId, user?.id]);

  // Initial fetch
  useEffect(() => {
    if (eventId) {
      fetchHandRaises();
    }
  }, [eventId, fetchHandRaises]);

  // Subscribe to realtime updates (creator only needs to see all, audience just their own)
  useEffect(() => {
    if (!eventId) return;

    const channelName = `hand_raises_${eventId}`;
    console.log("[useHandRaises] Setting up realtime subscription:", channelName);

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "live_hand_raises",
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          console.log("[useHandRaises] Realtime event:", payload.eventType);
          
          if (payload.eventType === "INSERT") {
            const newRaise = payload.new as HandRaise;
            // Only add if not cleared
            if (!newRaise.cleared_at) {
              setHandRaises((prev) => {
                // Prevent duplicates
                if (prev.some((r) => r.id === newRaise.id)) return prev;
                return [...prev, newRaise];
              });
              // Update my hand raised status
              if (user?.id && newRaise.user_id === user.id) {
                setMyHandRaised(true);
              }
            }
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as HandRaise;
            if (updated.cleared_at) {
              // Hand was cleared - remove from list
              setHandRaises((prev) => prev.filter((r) => r.id !== updated.id));
              if (user?.id && updated.user_id === user.id) {
                setMyHandRaised(false);
              }
            }
          } else if (payload.eventType === "DELETE") {
            const deleted = payload.old as HandRaise;
            setHandRaises((prev) => prev.filter((r) => r.id !== deleted.id));
            if (user?.id && deleted.user_id === user.id) {
              setMyHandRaised(false);
            }
          }
        }
      )
      .subscribe((status) => {
        console.log("[useHandRaises] Subscription status:", status);
      });

    return () => {
      console.log("[useHandRaises] Cleaning up subscription");
      supabase.removeChannel(channel);
    };
  }, [eventId, user?.id]);

  // Raise hand (audience)
  const raiseHand = useCallback(async () => {
    if (!eventId || !user?.id) {
      console.warn("[useHandRaises] Cannot raise hand - missing eventId or user");
      return { success: false, error: "Not authenticated" };
    }

    // Cooldown check
    const now = Date.now();
    if (now - lastRaiseTimeRef.current < COOLDOWN_MS) {
      console.log("[useHandRaises] Cooldown active, ignoring raise");
      return { success: false, error: "Please wait before raising again" };
    }

    try {
      const { error } = await supabase
        .from("live_hand_raises")
        .insert({
          event_id: eventId,
          user_id: user.id,
        });

      if (error) {
        // Handle unique constraint violation (already raised)
        if (error.code === "23505") {
          console.log("[useHandRaises] Hand already raised");
          return { success: false, error: "Hand already raised" };
        }
        console.error("[useHandRaises] Raise hand error:", error);
        return { success: false, error: error.message };
      }

      lastRaiseTimeRef.current = now;
      console.log("[useHandRaises] ✅ Hand raised successfully");
      return { success: true };
    } catch (err) {
      console.error("[useHandRaises] Raise hand exception:", err);
      return { success: false, error: "Failed to raise hand" };
    }
  }, [eventId, user?.id]);

  // Lower hand (audience - delete their own)
  const lowerHand = useCallback(async () => {
    if (!eventId || !user?.id) return { success: false };

    try {
      const { error } = await supabase
        .from("live_hand_raises")
        .delete()
        .eq("event_id", eventId)
        .eq("user_id", user.id);

      if (error) {
        console.error("[useHandRaises] Lower hand error:", error);
        return { success: false, error: error.message };
      }

      console.log("[useHandRaises] ✅ Hand lowered successfully");
      setMyHandRaised(false);
      return { success: true };
    } catch (err) {
      console.error("[useHandRaises] Lower hand exception:", err);
      return { success: false, error: "Failed to lower hand" };
    }
  }, [eventId, user?.id]);

  // Clear single hand raise (creator)
  const clearHandRaise = useCallback(async (handRaiseId: string) => {
    if (!isCreator) {
      console.warn("[useHandRaises] Only creator can clear hand raises");
      return { success: false };
    }

    try {
      const { error } = await supabase
        .from("live_hand_raises")
        .update({ cleared_at: new Date().toISOString() })
        .eq("id", handRaiseId);

      if (error) {
        console.error("[useHandRaises] Clear hand raise error:", error);
        return { success: false, error: error.message };
      }

      console.log("[useHandRaises] ✅ Hand raise cleared:", handRaiseId);
      return { success: true };
    } catch (err) {
      console.error("[useHandRaises] Clear hand raise exception:", err);
      return { success: false, error: "Failed to clear hand raise" };
    }
  }, [isCreator]);

  // Clear all hand raises (creator)
  const clearAllHandRaises = useCallback(async () => {
    if (!eventId || !isCreator) {
      console.warn("[useHandRaises] Only creator can clear all hand raises");
      return { success: false };
    }

    try {
      const { error } = await supabase
        .from("live_hand_raises")
        .update({ cleared_at: new Date().toISOString() })
        .eq("event_id", eventId)
        .is("cleared_at", null);

      if (error) {
        console.error("[useHandRaises] Clear all error:", error);
        return { success: false, error: error.message };
      }

      console.log("[useHandRaises] ✅ All hand raises cleared");
      setHandRaises([]);
      return { success: true };
    } catch (err) {
      console.error("[useHandRaises] Clear all exception:", err);
      return { success: false, error: "Failed to clear all hand raises" };
    }
  }, [eventId, isCreator]);

  return {
    handRaises,
    handRaiseCount: handRaises.length,
    myHandRaised,
    isLoading,
    raiseHand,
    lowerHand,
    clearHandRaise,
    clearAllHandRaises,
    refetch: fetchHandRaises,
  };
}
