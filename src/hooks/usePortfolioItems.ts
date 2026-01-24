import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface PortfolioItem {
  id: string;
  image_url: string;
  title: string | null;
  description: string | null;
  created_at: string;
}

export function usePortfolioItems(userId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [uploadingItem, setUploadingItem] = useState<PortfolioItem | null>(null);

  const isOwner = useMemo(() => user?.id === userId, [user?.id, userId]);

  const { data: items = [], isLoading, refetch } = useQuery({
    queryKey: ["portfolio-items", userId],
    queryFn: async (): Promise<PortfolioItem[]> => {
      if (!userId) return [];

      const { data, error } = await supabase.rpc("get_portfolio_items", {
        target_user_id: userId,
      });

      if (error) {
        console.error("Error fetching portfolio items:", error);
        return [];
      }

      return (data || []).map((item) => ({
        id: item.id,
        image_url: item.image_url,
        title: item.title,
        description: item.description,
        created_at: item.created_at,
      }));
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  const deleteMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const itemToDelete = items.find((item) => item.id === itemId);

      const { error } = await supabase.from("portfolio_items").delete().eq("id", itemId);
      if (error) throw error;

      // Clean up storage
      if (itemToDelete?.image_url) {
        try {
          const url = new URL(itemToDelete.image_url);
          const pathMatch = url.pathname.match(/\/portfolio\/(.+)$/);
          if (pathMatch) {
            await supabase.storage.from("portfolio").remove([pathMatch[1]]);
          }
        } catch {
          // Ignore storage cleanup errors
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolio-items", userId] });
    },
  });

  const addItem = useCallback(
    async (file: File, title?: string, description?: string) => {
      if (!user) throw new Error("No authenticated user");

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (profileError || !profileData) throw new Error("Could not find profile");

      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage.from("portfolio").upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("portfolio").getPublicUrl(fileName);

      const tempId = `temp-${Date.now()}`;
      const optimisticItem: PortfolioItem = {
        id: tempId,
        image_url: urlData.publicUrl,
        title: title || null,
        description: description || null,
        created_at: new Date().toISOString(),
      };

      setUploadingItem(optimisticItem);

      const { data: insertedItem, error: insertError } = await supabase
        .from("portfolio_items")
        .insert({
          profile_id: profileData.id,
          image_url: urlData.publicUrl,
          title: title || null,
          description: description || null,
        })
        .select()
        .single();

      if (insertError) {
        setUploadingItem(null);
        throw insertError;
      }

      setUploadingItem(null);
      queryClient.invalidateQueries({ queryKey: ["portfolio-items", userId] });

      return insertedItem;
    },
    [user, userId, queryClient]
  );

  const deleteItem = useCallback(
    (itemId: string) => deleteMutation.mutateAsync(itemId),
    [deleteMutation]
  );

  const allItems = useMemo(() => {
    if (uploadingItem) return [uploadingItem, ...items];
    return items;
  }, [items, uploadingItem]);

  return {
    items: allItems,
    isLoading,
    isOwner,
    addItem,
    deleteItem,
    refetch,
    isDeleting: deleteMutation.isPending,
  };
}
