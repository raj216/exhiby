import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Conversation {
  conversation_id: string;
  other_user_id: string;
  other_user_name: string | null;
  other_user_handle: string | null;
  other_user_avatar: string | null;
  other_user_verified: boolean;
  last_message_content: string | null;
  last_message_at: string | null;
  last_message_sender_id: string | null;
  unread_count: number;
}

export function useConversations() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConversations = useCallback(async () => {
    if (!user) {
      setConversations([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: rpcError } = await supabase.rpc("get_user_conversations");

      if (rpcError) {
        console.error("[useConversations] Error:", rpcError);
        setError(rpcError.message);
        return;
      }

      setConversations((data as Conversation[]) || []);
    } catch (err) {
      console.error("[useConversations] Unexpected error:", err);
      setError("Failed to load conversations");
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Initial fetch
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Real-time subscription for message changes (instant unread badge updates)
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("conversations-updates")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          // Refetch conversations immediately when new message arrives
          // This updates unread counts and latest message preview
          const newMsg = payload.new as { sender_id: string; conversation_id: string };
          if (newMsg.sender_id === user?.id) return;
          console.log("[useConversations] New message INSERT - refetching for unread badge update");
          fetchConversations();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          // Refetch immediately when messages are marked as read
          // This ensures unread badge clears right away
          const updated = payload.new as { read_at: string | null };
          if (updated.read_at) {
            console.log("[useConversations] Message marked read UPDATE - refetching for badge clear");
            fetchConversations();
          }
        }
      )
      .subscribe((status) => {
        console.log("[useConversations] Realtime subscription status:", status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchConversations]);

  // Get or create a conversation with another user
  const getOrCreateConversation = useCallback(
    async (otherUserId: string): Promise<string | null> => {
      if (!user) {
        console.error("[useConversations] No user logged in");
        return null;
      }

      try {
        const { data, error } = await supabase.rpc("get_or_create_conversation", {
          other_user_id: otherUserId,
        });

        if (error) {
          console.error("[useConversations] Error creating conversation:", error);
          return null;
        }

        // Refetch to update list
        await fetchConversations();

        return data as string;
      } catch (err) {
        console.error("[useConversations] Unexpected error:", err);
        return null;
      }
    },
    [user, fetchConversations]
  );

  return {
    conversations,
    isLoading,
    error,
    refetch: fetchConversations,
    getOrCreateConversation,
  };
}
