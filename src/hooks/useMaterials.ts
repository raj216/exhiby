import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Material {
  id: string;
  name: string;
  brand?: string | null;
  spec?: string | null;
  event_id: string;
}

export function useMaterials(eventId: string | null) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch materials for event
  useEffect(() => {
    if (!eventId) {
      console.log("[useMaterials] No eventId, skipping fetch");
      setMaterials([]);
      setLoading(false);
      return;
    }

    console.log("[useMaterials] Fetching materials for event:", eventId);

    const fetchMaterials = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("live_materials")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("[useMaterials] Error fetching:", error);
        console.error("[useMaterials] Fetch error details:", error.message, error.code);
      } else {
        console.log("[useMaterials] Fetched materials:", data?.length || 0, "items");
        setMaterials(data || []);
      }
      setLoading(false);
    };

    fetchMaterials();

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`materials-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "live_materials",
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setMaterials((prev) => [...prev, payload.new as Material]);
          } else if (payload.eventType === "DELETE") {
            setMaterials((prev) => prev.filter((m) => m.id !== payload.old.id));
          } else if (payload.eventType === "UPDATE") {
            setMaterials((prev) =>
              prev.map((m) => (m.id === payload.new.id ? (payload.new as Material) : m))
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId]);

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
        toast.error(`Failed to update material: ${error.message}`);
        return false;
      }

      console.log("[useMaterials] Material updated successfully");
      toast.success("Material updated");
      return true;
    },
    []
  );

  const deleteMaterial = useCallback(async (id: string) => {
    console.log("[useMaterials] Deleting material:", id);
    
    const { error } = await supabase.from("live_materials").delete().eq("id", id);

    if (error) {
      console.error("[useMaterials] Error deleting:", error);
      toast.error(`Failed to delete material: ${error.message}`);
      return false;
    }

    console.log("[useMaterials] Material deleted successfully");
    toast.success("Material removed");
    return true;
  }, []);

  return {
    materials,
    loading,
    addMaterial,
    updateMaterial,
    deleteMaterial,
  };
}
