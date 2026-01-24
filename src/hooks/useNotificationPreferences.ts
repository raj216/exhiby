import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface NotificationPreferences {
  email_live: boolean;
  email_scheduled: boolean;
  email_reminders: boolean;
  inapp_live: boolean;
  inapp_scheduled: boolean;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  email_live: true,
  email_scheduled: true,
  email_reminders: true,
  inapp_live: true,
  inapp_scheduled: true,
};

export function useNotificationPreferences() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: preferences = DEFAULT_PREFERENCES, isLoading: loading, error, refetch } = useQuery({
    queryKey: ["notification-preferences", user?.id],
    queryFn: async () => {
      if (!user) return DEFAULT_PREFERENCES;
      
      console.log("[useNotificationPreferences] Fetching preferences for user:", user.id);
      const startTime = Date.now();

      const { data, error } = await supabase
        .from("notification_preferences")
        .select("email_live, email_scheduled, email_reminders, inapp_live, inapp_scheduled")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      console.log("[useNotificationPreferences] Fetch completed in", Date.now() - startTime, "ms");

      if (data) {
        return {
          email_live: data.email_live,
          email_scheduled: data.email_scheduled,
          email_reminders: data.email_reminders,
          inapp_live: data.inapp_live,
          inapp_scheduled: data.inapp_scheduled,
        };
      }

      // Create default preferences if none exist
      const { error: insertError } = await supabase
        .from("notification_preferences")
        .insert({ user_id: user.id });

      if (insertError) {
        console.error("Error creating notification preferences:", insertError);
      }
      return DEFAULT_PREFERENCES;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes - don't refetch if fresh
    gcTime: 10 * 60 * 1000, // 10 minutes cache
    retry: 2,
  });

  const { mutateAsync: updatePreferences, isPending: saving } = useMutation({
    mutationFn: async (updates: Partial<NotificationPreferences>) => {
      if (!user) throw new Error("No user");

      console.log("[useNotificationPreferences] Updating preferences:", updates);
      const { error } = await supabase
        .from("notification_preferences")
        .update(updates)
        .eq("user_id", user.id);

      if (error) throw error;
      return updates;
    },
    onSuccess: (updates) => {
      // Optimistically update cache
      queryClient.setQueryData(
        ["notification-preferences", user?.id],
        (old: NotificationPreferences) => ({ ...old, ...updates })
      );
    },
    onError: (err) => {
      console.error("Error updating notification preferences:", err);
    },
  });

  return {
    preferences,
    loading,
    saving,
    error,
    updatePreferences,
    refetch,
  };
}
