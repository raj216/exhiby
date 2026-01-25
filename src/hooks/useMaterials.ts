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

// Polling interval for fallback sync (when realtime fails or for redundancy)
const POLL_INTERVAL_MS = 5000;
const MAX_SUBSCRIPTION_RETRIES = 3;

export function useMaterials(eventId: string | null) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const retryCountRef = useRef(0);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch materials for event
  const fetchMaterials = useCallback(async (showLoading = false) => {
    if (!eventId) return;
    
    if (showLoading) setLoading(true);
    
    const { data, error } = await supabase
      .from("live_materials")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[useMaterials] Error fetching:", error.message, error.code);
    } else {
      console.log("[useMaterials] Fetched materials:", data?.length || 0, "items");
      setMaterials(data || []);
    }
    
    if (showLoading) setLoading(false);
  }, [eventId]);

  // Setup realtime subscription with retry logic
  const setupSubscription = useCallback(() => {
    if (!eventId) return;

    // Clean up existing channel
    if (channelRef.current) {
      console.log("[useMaterials] Removing existing channel before retry");
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    console.log("[useMaterials] Setting up subscription for event:", eventId, `(attempt ${retryCountRef.current + 1})`);

    const channel = supabase
      .channel(`materials-${eventId}-${Date.now()}`) // Unique channel name to avoid conflicts
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "live_materials",
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          console.log("[useMaterials] Realtime event received:", payload.eventType);
          
          if (payload.eventType === "INSERT") {
            setMaterials((prev) => {
              // Check if material already exists (optimistic update or duplicate)
              if (prev.some(m => m.id === payload.new.id)) {
                console.log("[useMaterials] Material already exists, skipping duplicate");
                return prev;
              }
              console.log("[useMaterials] ✅ Adding new material from realtime:", payload.new.name);
              return [...prev, payload.new as Material];
            });
          } else if (payload.eventType === "DELETE") {
            console.log("[useMaterials] ✅ Removing material from realtime:", payload.old.id);
            setMaterials((prev) => prev.filter((m) => m.id !== payload.old.id));
          } else if (payload.eventType === "UPDATE") {
            console.log("[useMaterials] ✅ Updating material from realtime:", payload.new.name);
            setMaterials((prev) =>
              prev.map((m) => (m.id === payload.new.id ? (payload.new as Material) : m))
            );
          }
        }
      )
      .subscribe((status, err) => {
        console.log("[useMaterials] Subscription status:", status, err ? `Error: ${err}` : "");
        
        if (status === "SUBSCRIBED") {
          console.log("[useMaterials] ✅ Successfully subscribed to materials channel");
          setIsSubscribed(true);
          retryCountRef.current = 0;
          
          // Stop polling once realtime is connected
          if (pollIntervalRef.current) {
            console.log("[useMaterials] Stopping fallback polling (realtime connected)");
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error("[useMaterials] ❌ Subscription failed:", status, err);
          setIsSubscribed(false);
          
          // Retry subscription
          if (retryCountRef.current < MAX_SUBSCRIPTION_RETRIES) {
            retryCountRef.current++;
            console.log(`[useMaterials] Retrying subscription in 2s (attempt ${retryCountRef.current}/${MAX_SUBSCRIPTION_RETRIES})`);
            setTimeout(() => setupSubscription(), 2000);
          } else {
            console.warn("[useMaterials] Max retries reached, falling back to polling");
            // Start polling as fallback
            if (!pollIntervalRef.current) {
              pollIntervalRef.current = setInterval(() => {
                console.log("[useMaterials] Polling for updates (fallback mode)");
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

  // Use ref for isSubscribed in interval to avoid stale closure
  const isSubscribedRef = useRef(false);
  useEffect(() => {
    isSubscribedRef.current = isSubscribed;
  }, [isSubscribed]);

  // Main effect for fetching and subscription
  useEffect(() => {
    if (!eventId) {
      console.log("[useMaterials] No eventId, clearing state");
      setMaterials([]);
      setLoading(false);
      setIsSubscribed(false);
      return;
    }

    console.log("[useMaterials] Initializing for event:", eventId);
    retryCountRef.current = 0;

    // Initial fetch
    fetchMaterials(true);

    // Small delay before subscription to ensure any viewer records are propagated
    const subscribeTimer = setTimeout(() => {
      setupSubscription();
    }, 150);

    // Also start a short-lived polling period for redundancy (catches any missed events)
    // This runs for 30 seconds after load, then stops if realtime is working
    const initialPollTimer = setInterval(() => {
      // Use ref to avoid stale closure
      if (!isSubscribedRef.current) {
        console.log("[useMaterials] Initial redundancy poll");
        fetchMaterials(false);
      }
    }, POLL_INTERVAL_MS);

    const stopInitialPollTimer = setTimeout(() => {
      clearInterval(initialPollTimer);
    }, 30000);

    return () => {
      console.log("[useMaterials] Cleaning up for event:", eventId);
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

  const addMaterial = useCallback(
    async (name: string, brand?: string, spec?: string): Promise<Material | null> => {
      if (!eventId) {
        console.error("[useMaterials] No eventId provided");
        toast.error("Cannot add material: no event ID");
        return null;
      }

      console.log("[useMaterials] Adding material:", { eventId, name, brand, spec });

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
        console.error("[useMaterials] Error adding:", error);
        console.error("[useMaterials] Error details:", error.message, error.code, error.details);
        toast.error(`Failed to add material: ${error.message}`);
        return null;
      }

      console.log("[useMaterials] Material added successfully:", data);
      
      // Optimistic update: immediately add to local state
      setMaterials((prev) => [...prev, data as Material]);
      
      toast.success("Material added");
      return data as Material;
    },
    [eventId]
  );

  const updateMaterial = useCallback(
    async (id: string, name: string, brand?: string, spec?: string) => {
      console.log("[useMaterials] Updating material:", { id, name, brand, spec });
      
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
        console.error("[useMaterials] Error updating:", error);
        // Rollback on error
        setMaterials(previousMaterials);
        toast.error(`Failed to update material: ${error.message}`);
        return false;
      }

      console.log("[useMaterials] Material updated successfully");
      toast.success("Material updated");
      return true;
    },
    [materials]
  );

  const deleteMaterial = useCallback(async (id: string) => {
    console.log("[useMaterials] Deleting material:", id);
    
    // Store previous state for rollback
    const previousMaterials = [...materials];
    
    // Optimistic update: immediately remove from UI
    setMaterials((prev) => prev.filter((m) => m.id !== id));
    
    const { error } = await supabase.from("live_materials").delete().eq("id", id);

    if (error) {
      console.error("[useMaterials] Error deleting:", error);
      // Rollback on error
      setMaterials(previousMaterials);
      toast.error(`Failed to delete material: ${error.message}`);
      return false;
    }

    console.log("[useMaterials] Material deleted successfully");
    toast.success("Material removed");
    return true;
  }, [materials]);

  return {
    materials,
    loading,
    addMaterial,
    updateMaterial,
    deleteMaterial,
  };
}
