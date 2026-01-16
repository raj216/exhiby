import { useState, useEffect, useCallback } from "react";
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
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchPreferences = useCallback(async () => {
    if (!user) {
      setPreferences(DEFAULT_PREFERENCES);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("notification_preferences")
        .select("email_live, email_scheduled, email_reminders, inapp_live, inapp_scheduled")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setPreferences({
          email_live: data.email_live,
          email_scheduled: data.email_scheduled,
          email_reminders: data.email_reminders,
          inapp_live: data.inapp_live,
          inapp_scheduled: data.inapp_scheduled,
        });
      } else {
        // Create default preferences if none exist
        const { error: insertError } = await supabase
          .from("notification_preferences")
          .insert({ user_id: user.id });

        if (insertError) {
          console.error("Error creating notification preferences:", insertError);
        }
        setPreferences(DEFAULT_PREFERENCES);
      }
    } catch (err) {
      console.error("Error fetching notification preferences:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const updatePreferences = useCallback(
    async (updates: Partial<NotificationPreferences>) => {
      if (!user) return;

      setSaving(true);
      try {
        const { error } = await supabase
          .from("notification_preferences")
          .update(updates)
          .eq("user_id", user.id);

        if (error) throw error;

        setPreferences((prev) => ({ ...prev, ...updates }));
      } catch (err) {
        console.error("Error updating notification preferences:", err);
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [user]
  );

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  return {
    preferences,
    loading,
    saving,
    updatePreferences,
    refetch: fetchPreferences,
  };
}
