import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface SavedSession {
  id: string;
  event_id: string;
  creator_id: string;
  reminder_enabled: boolean;
  created_at: string;
}

// Cache key for saved sessions
const SAVED_SESSIONS_KEY = "saved-sessions";

export function useSavedSessions() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // React Query for fetching saved sessions with caching
  const {
    data: savedSessions = [],
    isLoading: loading,
    refetch,
  } = useQuery({
    queryKey: [SAVED_SESSIONS_KEY, user?.id],
    queryFn: async (): Promise<SavedSession[]> => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("saved_sessions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching saved sessions:", error);
        return [];
      }

      return data || [];
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000, // 2 minutes - stable data
    gcTime: 10 * 60 * 1000, // 10 minutes cache
  });

  // Check if an event is saved (memoized)
  const isEventSaved = useCallback(
    (eventId: string) => {
      return savedSessions.some((s) => s.event_id === eventId);
    },
    [savedSessions]
  );

  // Save session mutation with optimistic update
  const saveMutation = useMutation({
    mutationFn: async ({
      eventId,
      creatorId,
    }: {
      eventId: string;
      creatorId: string;
    }) => {
      if (!user) throw new Error("User not authenticated");

      const { error } = await supabase.from("saved_sessions").insert({
        user_id: user.id,
        event_id: eventId,
        creator_id: creatorId,
        reminder_enabled: true,
      });

      if (error && error.code !== "23505") {
        throw error;
      }

      return { eventId, creatorId };
    },
    onMutate: async ({ eventId, creatorId }) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({
        queryKey: [SAVED_SESSIONS_KEY, user?.id],
      });

      // Snapshot previous value
      const previousSessions = queryClient.getQueryData<SavedSession[]>([
        SAVED_SESSIONS_KEY,
        user?.id,
      ]);

      // Optimistically add new session
      queryClient.setQueryData<SavedSession[]>(
        [SAVED_SESSIONS_KEY, user?.id],
        (old = []) => [
          {
            id: crypto.randomUUID(),
            event_id: eventId,
            creator_id: creatorId,
            reminder_enabled: true,
            created_at: new Date().toISOString(),
          },
          ...old,
        ]
      );

      return { previousSessions };
    },
    onError: (_err, _vars, context) => {
      // Rollback on error
      if (context?.previousSessions) {
        queryClient.setQueryData(
          [SAVED_SESSIONS_KEY, user?.id],
          context.previousSessions
        );
      }
    },
  });

  // Remove session mutation with optimistic update
  const removeMutation = useMutation({
    mutationFn: async (eventId: string) => {
      if (!user) throw new Error("User not authenticated");

      const { error } = await supabase
        .from("saved_sessions")
        .delete()
        .eq("user_id", user.id)
        .eq("event_id", eventId);

      if (error) throw error;
      return eventId;
    },
    onMutate: async (eventId) => {
      await queryClient.cancelQueries({
        queryKey: [SAVED_SESSIONS_KEY, user?.id],
      });

      const previousSessions = queryClient.getQueryData<SavedSession[]>([
        SAVED_SESSIONS_KEY,
        user?.id,
      ]);

      queryClient.setQueryData<SavedSession[]>(
        [SAVED_SESSIONS_KEY, user?.id],
        (old = []) => old.filter((s) => s.event_id !== eventId)
      );

      return { previousSessions };
    },
    onError: (_err, _eventId, context) => {
      if (context?.previousSessions) {
        queryClient.setQueryData(
          [SAVED_SESSIONS_KEY, user?.id],
          context.previousSessions
        );
      }
    },
  });

  // Toggle reminder mutation
  const toggleReminderMutation = useMutation({
    mutationFn: async ({
      eventId,
      enabled,
    }: {
      eventId: string;
      enabled: boolean;
    }) => {
      if (!user) throw new Error("User not authenticated");

      const { error } = await supabase
        .from("saved_sessions")
        .update({ reminder_enabled: enabled })
        .eq("user_id", user.id)
        .eq("event_id", eventId);

      if (error) throw error;
      return { eventId, enabled };
    },
    onMutate: async ({ eventId, enabled }) => {
      await queryClient.cancelQueries({
        queryKey: [SAVED_SESSIONS_KEY, user?.id],
      });

      const previousSessions = queryClient.getQueryData<SavedSession[]>([
        SAVED_SESSIONS_KEY,
        user?.id,
      ]);

      queryClient.setQueryData<SavedSession[]>(
        [SAVED_SESSIONS_KEY, user?.id],
        (old = []) =>
          old.map((s) =>
            s.event_id === eventId ? { ...s, reminder_enabled: enabled } : s
          )
      );

      return { previousSessions };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousSessions) {
        queryClient.setQueryData(
          [SAVED_SESSIONS_KEY, user?.id],
          context.previousSessions
        );
      }
    },
  });

  // Wrapper functions for backwards compatibility
  const saveSession = useCallback(
    async (eventId: string, creatorId: string) => {
      try {
        await saveMutation.mutateAsync({ eventId, creatorId });
        return true;
      } catch {
        return false;
      }
    },
    [saveMutation]
  );

  const removeSession = useCallback(
    async (eventId: string) => {
      try {
        await removeMutation.mutateAsync(eventId);
        return true;
      } catch {
        return false;
      }
    },
    [removeMutation]
  );

  const toggleReminder = useCallback(
    async (eventId: string, enabled: boolean) => {
      try {
        await toggleReminderMutation.mutateAsync({ eventId, enabled });
        return true;
      } catch {
        return false;
      }
    },
    [toggleReminderMutation]
  );

  return {
    savedSessions,
    loading,
    isEventSaved,
    saveSession,
    removeSession,
    toggleReminder,
    refetch,
  };
}
