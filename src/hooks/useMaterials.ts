import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface Material {
  id: string;
  name: string;
  brand?: string | null;
  spec?: string | null;
  event_id: string;
}

// Polling interval for fallback sync
const POLL_INTERVAL_MS = 5000;
const MAX_SUBSCRIPTION_RETRIES = 3;
const SUBSCRIPTION_DELAY_MS = 150;

// Dev-only logging
const devLog = (...args: unknown[]) => {
  if (import.meta.env.DEV) {
    console.log("[useMaterials]", new Date().toISOString().slice(11, 23), ...args);
  }
};

interface UseMaterialsOptions {
  eventId: string | null;
  /** Whether the unified realtime connection just reconnected */
  justReconnected?: boolean;
  /** Callback to clear the reconnected flag */
  onReconnectHandled?: () => void;
}

export function useMaterials({ 
  eventId, 
  justReconnected = false,
  onReconnectHandled 
}: UseMaterialsOptions) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubscribed, setIsSubscribed] = useState(false);
  
  const channelRef = useRef<RealtimeChannel | null>(null);
  const retryCountRef = useRef(0);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isSubscribedRef = useRef(false);

  // Keep ref in sync
  useEffect(() => {
    isSubscribedRef.current = isSubscribed;
  }, [isSubscribed]);

  // Fetch materials for event - always fetch from REST first
  const fetchMaterials = useCallback(async (showLoading = false) => {
    if (!eventId) return;
    
    if (showLoading) setLoading(true);
    
    devLog("📥 Fetching materials for event:", eventId);
    
    const { data, error } = await supabase
      .from("live_materials")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: true });

    if (error) {
      devLog("❌ Error fetching:", error.message, error.code);
    } else {
      devLog("✅ Fetched materials:", data?.length || 0, "items");
      setMaterials(data || []);
    }
    
    if (showLoading) setLoading(false);
  }, [eventId]);

  // Setup realtime subscription
  const setupSubscription = useCallback(() => {
    if (!eventId) return;

    // Clean up existing channel
    if (channelRef.current) {
      devLog("🔄 Removing existing channel before retry");
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // FIXED: Use stable channel name without timestamp
    const channelName = `materials:${eventId}`;
    devLog("📡 Setting up subscription:", channelName, `(attempt ${retryCountRef.current + 1})`);

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "live_materials",
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          devLog("📨 Realtime event:", payload.eventType);
          
          if (payload.eventType === "INSERT") {
            setMaterials((prev) => {
              // Check if material already exists (optimistic update or duplicate)
              if (prev.some(m => m.id === payload.new.id)) {
                devLog("⏭️ Material already exists, skipping duplicate");
                return prev;
              }
              devLog("✅ Adding new material:", payload.new.name);
              return [...prev, payload.new as Material];
            });
          } else if (payload.eventType === "DELETE") {
            devLog("✅ Removing material:", payload.old.id);
            setMaterials((prev) => prev.filter((m) => m.id !== payload.old.id));
          } else if (payload.eventType === "UPDATE") {
            devLog("✅ Updating material:", payload.new.name);
            setMaterials((prev) =>
              prev.map((m) => (m.id === payload.new.id ? (payload.new as Material) : m))
            );
          }
        }
      )
      .subscribe((status, err) => {
        devLog("📶 Subscription status:", status, err ? `Error: ${err}` : "");
        
        if (status === "SUBSCRIBED") {
          devLog("✅ Successfully subscribed to materials channel");
          setIsSubscribed(true);
          retryCountRef.current = 0;
          
          // Stop polling once realtime is connected
          if (pollIntervalRef.current) {
            devLog("🛑 Stopping fallback polling (realtime connected)");
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          devLog("❌ Subscription failed:", status, err);
          setIsSubscribed(false);
          
          // Retry subscription with backoff
          if (retryCountRef.current < MAX_SUBSCRIPTION_RETRIES) {
            retryCountRef.current++;
            const backoff = Math.min(1000 * Math.pow(2, retryCountRef.current - 1), 8000);
            devLog(`⏱️ Retrying subscription in ${backoff}ms (attempt ${retryCountRef.current}/${MAX_SUBSCRIPTION_RETRIES})`);
            setTimeout(() => setupSubscription(), backoff);
          } else {
            devLog("⚠️ Max retries reached, falling back to polling");
            // Start polling as fallback
            if (!pollIntervalRef.current) {
              pollIntervalRef.current = setInterval(() => {
                devLog("🔄 Polling for updates (fallback mode)");
                fetchMaterials(false);
              }, POLL_INTERVAL_MS);
            }
          }
        } else if (status === "CLOSED") {
          setIsSubscribed(false);
        }
      });

    channelRef.current = channel;
  }, [eventId, fetchMaterials]);

  // Main effect for fetching and subscription
  useEffect(() => {
    if (!eventId) {
      devLog("⏸️ No eventId, clearing state");
      setMaterials([]);
      setLoading(false);
      setIsSubscribed(false);
      return;
    }

    devLog("🚀 Initializing for event:", eventId);
    retryCountRef.current = 0;

    // Always fetch from REST first (critical for reliability)
    fetchMaterials(true);

    // Small delay before subscription to ensure viewer records are propagated
    const subscribeTimer = setTimeout(() => {
      setupSubscription();
    }, SUBSCRIPTION_DELAY_MS);

    // Initial redundancy polling for 30 seconds
    const initialPollTimer = setInterval(() => {
      if (!isSubscribedRef.current) {
        devLog("🔄 Initial redundancy poll");
        fetchMaterials(false);
      }
    }, POLL_INTERVAL_MS);

    const stopInitialPollTimer = setTimeout(() => {
      clearInterval(initialPollTimer);
    }, 30000);

    return () => {
      devLog("🧹 Cleaning up for event:", eventId);
      clearTimeout(subscribeTimer);
      clearInterval(initialPollTimer);
      clearTimeout(stopInitialPollTimer);
      
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      
      setIsSubscribed(false);
    };
  }, [eventId, fetchMaterials, setupSubscription]);

  // CRITICAL: Refetch on reconnect to catch any missed updates
  useEffect(() => {
    if (justReconnected && eventId) {
      devLog("🔄 Reconnect detected - refetching materials");
      fetchMaterials(false);
      onReconnectHandled?.();
    }
  }, [justReconnected, eventId, fetchMaterials, onReconnectHandled]);

  const addMaterial = useCallback(
    async (name: string, brand?: string, spec?: string): Promise<Material | null> => {
      if (!eventId) {
        devLog("❌ No eventId provided");
        toast.error("Cannot add material: no event ID");
        return null;
      }

      devLog("➕ Adding material:", { eventId, name, brand, spec });

      const { data, error } = await supabase
        .from("live_materials")
        .insert({
          event_id: eventId,
          name,
          brand: brand || null,
          spec: spec || null,
        })
        .select()
        .single();

      if (error) {
        devLog("❌ Error adding:", error.message, error.code);
        toast.error(`Failed to add material: ${error.message}`);
        return null;
      }

      devLog("✅ Material added successfully:", data);
      
      // Optimistic update: immediately add to local state
      setMaterials((prev) => {
        if (prev.some(m => m.id === data.id)) return prev;
        return [...prev, data as Material];
      });
      
      toast.success("Material added");
      return data as Material;
    },
    [eventId]
  );

  const updateMaterial = useCallback(
    async (id: string, name: string, brand?: string, spec?: string) => {
      devLog("✏️ Updating material:", { id, name, brand, spec });
      
      // Store previous state for rollback
      const previousMaterials = [...materials];
      
      // Optimistic update: immediately update in UI
      setMaterials((prev) =>
        prev.map((m) => m.id === id ? { ...m, name, brand: brand || null, spec: spec || null } : m)
      );
      
      const { error } = await supabase
        .from("live_materials")
        .update({
          name,
          brand: brand || null,
          spec: spec || null,
        })
        .eq("id", id);

      if (error) {
        devLog("❌ Error updating:", error.message);
        // Rollback on error
        setMaterials(previousMaterials);
        toast.error(`Failed to update material: ${error.message}`);
        return false;
      }

      devLog("✅ Material updated successfully");
      toast.success("Material updated");
      return true;
    },
    [materials]
  );

  const deleteMaterial = useCallback(async (id: string) => {
    devLog("🗑️ Deleting material:", id);
    
    // Store previous state for rollback
    const previousMaterials = [...materials];
    
    // Optimistic update: immediately remove from UI
    setMaterials((prev) => prev.filter((m) => m.id !== id));
    
    const { error } = await supabase.from("live_materials").delete().eq("id", id);

    if (error) {
      devLog("❌ Error deleting:", error.message);
      // Rollback on error
      setMaterials(previousMaterials);
      toast.error(`Failed to delete material: ${error.message}`);
      return false;
    }

    devLog("✅ Material deleted successfully");
    toast.success("Material removed");
    return true;
  }, [materials]);

  return {
    materials,
    loading,
    isSubscribed,
    addMaterial,
    updateMaterial,
    deleteMaterial,
    refetch: () => fetchMaterials(false),
  };
}

// Backward compatible export for existing usages
export function useMaterialsLegacy(eventId: string | null) {
  return useMaterials({ eventId });
}
