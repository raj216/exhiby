import { useState, useEffect, useCallback, useRef, createContext, useContext } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type RealtimeConnectionStatus = "connecting" | "connected" | "reconnecting" | "error";

interface LiveRoomRealtimeConfig {
  eventId: string | null;
  /** For audience: pass true once they have joined as a viewer */
  isViewerReady?: boolean;
  isCreator?: boolean;
}

export interface UseLiveRoomRealtimeReturn {
  status: RealtimeConnectionStatus;
  isConnected: boolean;
  /** Whether a reconnect just happened (for triggering refetches) */
  justReconnected: boolean;
  /** Clear the justReconnected flag after handling */
  clearReconnectedFlag: () => void;
  /** Force a manual reconnect */
  reconnect: () => void;
}

// Backoff sequence for reconnection
const BACKOFF_SEQUENCE = [1000, 2000, 4000, 8000, 16000];
const MAX_RECONNECT_ATTEMPTS = 5;
const SUBSCRIPTION_TIMEOUT_MS = 8000;

// Dev-only logging
const devLog = (...args: unknown[]) => {
  if (import.meta.env.DEV) {
    console.log("[useLiveRoomRealtime]", new Date().toISOString().slice(11, 23), ...args);
  }
};

// Context for sharing realtime state across components
interface LiveRoomRealtimeContextValue extends UseLiveRoomRealtimeReturn {
  eventId: string | null;
}

const LiveRoomRealtimeContext = createContext<LiveRoomRealtimeContextValue | null>(null);

export const useLiveRoomRealtimeContext = () => {
  const ctx = useContext(LiveRoomRealtimeContext);
  if (!ctx) {
    // Return a fallback for components used outside the context
    return {
      status: "connecting" as RealtimeConnectionStatus,
      isConnected: false,
      justReconnected: false,
      clearReconnectedFlag: () => {},
      reconnect: () => {},
      eventId: null,
    };
  }
  return ctx;
};

export { LiveRoomRealtimeContext };

/**
 * Unified realtime connection manager for Live Room.
 * Creates a SINGLE channel per eventId that subscribes to all needed tables.
 * Handles reconnection with exponential backoff.
 */
export function useLiveRoomRealtime({
  eventId,
  isViewerReady = false,
  isCreator = false,
}: LiveRoomRealtimeConfig): UseLiveRoomRealtimeReturn {
  const [status, setStatus] = useState<RealtimeConnectionStatus>("connecting");
  const [justReconnected, setJustReconnected] = useState(false);
  
  const channelRef = useRef<RealtimeChannel | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const subscriptionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCleaningUpRef = useRef(false);
  const wasConnectedRef = useRef(false);
  const statusRef = useRef<RealtimeConnectionStatus>("connecting");

  // Keep status ref in sync
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // Can subscribe: creators always, viewers only when their record exists
  const canSubscribe = Boolean(eventId && (isCreator || isViewerReady));

  const clearTimeouts = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (subscriptionTimeoutRef.current) {
      clearTimeout(subscriptionTimeoutRef.current);
      subscriptionTimeoutRef.current = null;
    }
  }, []);

  const cleanup = useCallback(() => {
    isCleaningUpRef.current = true;
    clearTimeouts();
    
    if (channelRef.current) {
      devLog("🧹 Removing channel");
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    
    wasConnectedRef.current = false;
    isCleaningUpRef.current = false;
  }, [clearTimeouts]);

  const setupChannel = useCallback(() => {
    if (!eventId || !canSubscribe) {
      devLog("⏳ Cannot subscribe yet:", { eventId, canSubscribe, isCreator, isViewerReady });
      setStatus("connecting");
      return;
    }

    // Prevent setup during cleanup
    if (isCleaningUpRef.current) {
      devLog("⚠️ Skipping setup during cleanup");
      return;
    }

    // Clean up existing channel
    if (channelRef.current) {
      devLog("🔄 Removing existing channel before re-setup");
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    clearTimeouts();
    setStatus("connecting");

    // Single channel name per room - no timestamp to avoid duplicates
    const channelName = `live_room:${eventId}`;
    devLog("📡 Creating unified channel:", channelName);

    // Create channel and subscribe
    const channel = supabase
      .channel(channelName, {
        config: {
          broadcast: { self: false },
        },
      })
      .subscribe((subscriptionStatus, err) => {
        devLog("📶 Status:", subscriptionStatus, err ? `Error: ${err}` : "");

        if (subscriptionStatus === "SUBSCRIBED") {
          clearTimeouts();
          setStatus("connected");
          
          // If we were previously connected, this is a reconnect
          if (wasConnectedRef.current) {
            devLog("✅ Reconnected! Triggering refetch flag.");
            setJustReconnected(true);
          }
          
          wasConnectedRef.current = true;
          reconnectAttemptRef.current = 0;
          devLog("✅ SUBSCRIBED to unified channel");
          
        } else if (subscriptionStatus === "CLOSED" || subscriptionStatus === "CHANNEL_ERROR") {
          devLog("❌ Channel error/closed:", subscriptionStatus, err);
          
          // Don't attempt reconnect if we're cleaning up
          if (isCleaningUpRef.current) return;
          
          // Show reconnecting if we were previously connected
          if (wasConnectedRef.current) {
            setStatus("reconnecting");
          }
          
          // Attempt reconnect with backoff
          if (reconnectAttemptRef.current < MAX_RECONNECT_ATTEMPTS) {
            const backoffMs = BACKOFF_SEQUENCE[Math.min(reconnectAttemptRef.current, BACKOFF_SEQUENCE.length - 1)];
            devLog(`⏱️ Reconnecting in ${backoffMs}ms (attempt ${reconnectAttemptRef.current + 1}/${MAX_RECONNECT_ATTEMPTS})`);
            
            reconnectTimeoutRef.current = setTimeout(() => {
              reconnectAttemptRef.current++;
              setupChannel();
            }, backoffMs);
          } else {
            devLog("❌ Max reconnect attempts reached");
            setStatus("error");
          }
          
        } else if (subscriptionStatus === "TIMED_OUT") {
          devLog("⏱️ Subscription timed out, retrying...");
          setStatus("reconnecting");
          
          // Retry once on timeout
          reconnectTimeoutRef.current = setTimeout(() => {
            setupChannel();
          }, 1000);
        }
      });

    channelRef.current = channel;

    // Subscription timeout fallback - use ref to check current status
    subscriptionTimeoutRef.current = setTimeout(() => {
      if (channelRef.current && statusRef.current === "connecting") {
        devLog("⏱️ Subscription timeout - forcing reconnect");
        setStatus("reconnecting");
        reconnectAttemptRef.current++;
        setupChannel();
      }
    }, SUBSCRIPTION_TIMEOUT_MS);

  }, [eventId, canSubscribe, isCreator, isViewerReady, clearTimeouts]);

  // Manual reconnect trigger
  const reconnect = useCallback(() => {
    devLog("🔄 Manual reconnect requested");
    reconnectAttemptRef.current = 0;
    setupChannel();
  }, [setupChannel]);

  // Clear the reconnected flag
  const clearReconnectedFlag = useCallback(() => {
    setJustReconnected(false);
  }, []);

  // Main effect: setup channel when conditions are met
  useEffect(() => {
    if (!eventId) {
      cleanup();
      setStatus("connecting");
      return;
    }

    devLog("🚀 Effect triggered:", { eventId, canSubscribe, isCreator, isViewerReady });

    if (canSubscribe) {
      // Small delay to ensure viewer record is propagated
      const setupTimer = setTimeout(() => {
        setupChannel();
      }, 150);

      return () => {
        clearTimeout(setupTimer);
        cleanup();
      };
    } else {
      // Not ready to subscribe yet
      setStatus("connecting");
      return () => cleanup();
    }
  }, [eventId, canSubscribe, setupChannel, cleanup, isCreator, isViewerReady]);

  // Debug logging effect
  useEffect(() => {
    if (import.meta.env.DEV) {
      devLog("📊 Status update:", status);
    }
  }, [status]);

  return {
    status,
    isConnected: status === "connected",
    reconnect,
    justReconnected,
    clearReconnectedFlag,
  };
}
