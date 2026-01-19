import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface SavedSession {
  id: string;
  event_id: string;
  creator_id: string;
  reminder_enabled: boolean;
  created_at: string;
}

export function useSavedSessions() {
  const { user } = useAuth();
  const [savedSessions, setSavedSessions] = useState<SavedSession[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch saved sessions
  const fetchSavedSessions = useCallback(async () => {
    if (!user) {
      setSavedSessions([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("saved_sessions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching saved sessions:", error);
      } else {
        setSavedSessions(data || []);
      }
    } catch (err) {
      console.error("Error in useSavedSessions:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Check if an event is saved
  const isEventSaved = useCallback((eventId: string) => {
    return savedSessions.some((s) => s.event_id === eventId);
  }, [savedSessions]);

  // Save a session
  const saveSession = useCallback(async (eventId: string, creatorId: string) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from("saved_sessions")
        .insert({
          user_id: user.id,
          event_id: eventId,
          creator_id: creatorId,
          reminder_enabled: true,
        });

      if (error) {
        if (error.code === "23505") {
          // Already saved - unique constraint violation
          return true;
        }
        console.error("Error saving session:", error);
        return false;
      }

      // Optimistically update local state
      setSavedSessions((prev) => [
        {
          id: crypto.randomUUID(),
          event_id: eventId,
          creator_id: creatorId,
          reminder_enabled: true,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);

      return true;
    } catch (err) {
      console.error("Error saving session:", err);
      return false;
    }
  }, [user]);

  // Remove a saved session
  const removeSession = useCallback(async (eventId: string) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from("saved_sessions")
        .delete()
        .eq("user_id", user.id)
        .eq("event_id", eventId);

      if (error) {
        console.error("Error removing session:", error);
        return false;
      }

      // Optimistically update local state
      setSavedSessions((prev) => prev.filter((s) => s.event_id !== eventId));

      return true;
    } catch (err) {
      console.error("Error removing session:", err);
      return false;
    }
  }, [user]);

  // Toggle reminder
  const toggleReminder = useCallback(async (eventId: string, enabled: boolean) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from("saved_sessions")
        .update({ reminder_enabled: enabled })
        .eq("user_id", user.id)
        .eq("event_id", eventId);

      if (error) {
        console.error("Error toggling reminder:", error);
        return false;
      }

      setSavedSessions((prev) =>
        prev.map((s) =>
          s.event_id === eventId ? { ...s, reminder_enabled: enabled } : s
        )
      );

      return true;
    } catch (err) {
      console.error("Error toggling reminder:", err);
      return false;
    }
  }, [user]);

  // Initial fetch
  useEffect(() => {
    fetchSavedSessions();
  }, [fetchSavedSessions]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("saved-sessions-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "saved_sessions",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // Refetch on any change
          fetchSavedSessions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchSavedSessions]);

  return {
    savedSessions,
    loading,
    isEventSaved,
    saveSession,
    removeSession,
    toggleReminder,
    refetch: fetchSavedSessions,
  };
}
