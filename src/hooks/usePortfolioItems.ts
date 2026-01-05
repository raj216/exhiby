import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

export interface PortfolioItem {
  id: string;
  image_url: string;
  title: string | null;
  description: string | null;
  created_at: string;
}

export function usePortfolioItems(targetUserId?: string) {
  const { user } = useAuth();
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [profileId, setProfileId] = useState<string | null>(null);

  // Fetch the profile ID for the target user
  useEffect(() => {
    const fetchProfileId = async () => {
      const userId = targetUserId || user?.id;
      if (!userId) {
        setIsLoading(false);
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (data) {
        setProfileId(data.id);
      }
    };

    fetchProfileId();
  }, [targetUserId, user?.id]);

  const fetchItems = useCallback(async () => {
    const userId = targetUserId || user?.id;
    if (!userId) {
      setItems([]);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.rpc("get_portfolio_items", {
        target_user_id: userId,
      });

      if (error) {
        console.error("Error fetching portfolio items:", error);
        setItems([]);
      } else {
        setItems((data as PortfolioItem[]) || []);
      }
    } catch (err) {
      console.error("Portfolio fetch error:", err);
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [targetUserId, user?.id]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const addItem = async (imageBlob: Blob, title: string, description: string) => {
    if (!user || !profileId) {
      toast({ title: "Error", description: "You must be logged in", variant: "destructive" });
      return false;
    }

    try {
      // Upload to storage
      const fileExt = "jpg";
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("portfolio")
        .upload(fileName, imageBlob, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("portfolio")
        .getPublicUrl(fileName);

      // Insert into database
      const { error: insertError } = await supabase
        .from("portfolio_items")
        .insert({
          profile_id: profileId,
          image_url: publicUrl,
          title: title,
          description: description,
        });

      if (insertError) throw insertError;

      toast({ title: "Success", description: "Artwork added to portfolio!" });
      await fetchItems();
      return true;
    } catch (error) {
      console.error("Add portfolio item error:", error);
      toast({ title: "Upload failed", description: "Please try again", variant: "destructive" });
      return false;
    }
  };

  const deleteItem = async (itemId: string) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from("portfolio_items")
        .delete()
        .eq("id", itemId);

      if (error) throw error;

      toast({ title: "Deleted", description: "Artwork removed from portfolio" });
      await fetchItems();
      return true;
    } catch (error) {
      console.error("Delete portfolio item error:", error);
      toast({ title: "Delete failed", description: "Please try again", variant: "destructive" });
      return false;
    }
  };

  return {
    items,
    isLoading,
    profileId,
    addItem,
    deleteItem,
    refetch: fetchItems,
  };
}
