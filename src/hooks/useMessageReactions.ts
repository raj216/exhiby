import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface MessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export interface ReactionCount {
  emoji: string;
  count: number;
  hasReacted: boolean;
}

interface UseMessageReactionsOptions {
  conversationId: string | null;
}

export function useMessageReactions({ conversationId }: UseMessageReactionsOptions) {
  const { user } = useAuth();
  const [reactions, setReactions] = useState<MessageReaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Load all reactions for messages in this conversation
  const loadReactions = useCallback(async () => {
    if (!conversationId || !user) {
      setReactions([]);
      setIsLoading(false);
      return;
    }

    try {
      // Get all message IDs in this conversation first
      const { data: messages } = await supabase
        .from("messages")
        .select("id")
        .eq("conversation_id", conversationId);

      if (!messages || messages.length === 0) {
        setReactions([]);
        setIsLoading(false);
        return;
      }

      const messageIds = messages.map((m) => m.id);

      // Get reactions for these messages
      const { data: reactionsData, error } = await supabase
        .from("message_reactions")
        .select("*")
        .in("message_id", messageIds);

      if (error) {
        console.error("[useMessageReactions] Error loading:", error);
        return;
      }

      setReactions(reactionsData || []);
    } catch (err) {
      console.error("[useMessageReactions] Unexpected error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, user]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!conversationId || !user) {
      setReactions([]);
      return;
    }

    loadReactions();

    // Clean up existing channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel(`reactions:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "message_reactions",
        },
        (payload) => {
          const newReaction = payload.new as MessageReaction;
          setReactions((prev) => {
            // Avoid duplicates
            if (prev.some((r) => r.id === newReaction.id)) {
              return prev;
            }
            return [...prev, newReaction];
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "message_reactions",
        },
        (payload) => {
          const deletedReaction = payload.old as MessageReaction;
          setReactions((prev) => prev.filter((r) => r.id !== deletedReaction.id));
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [conversationId, user, loadReactions]);

  // Get reactions for a specific message
  const getReactionsForMessage = useCallback(
    (messageId: string): ReactionCount[] => {
      const messageReactions = reactions.filter((r) => r.message_id === messageId);
      
      // Group by emoji
      const emojiMap = new Map<string, { count: number; hasReacted: boolean }>();
      
      messageReactions.forEach((r) => {
        const existing = emojiMap.get(r.emoji) || { count: 0, hasReacted: false };
        emojiMap.set(r.emoji, {
          count: existing.count + 1,
          hasReacted: existing.hasReacted || r.user_id === user?.id,
        });
      });

      return Array.from(emojiMap.entries()).map(([emoji, data]) => ({
        emoji,
        count: data.count,
        hasReacted: data.hasReacted,
      }));
    },
    [reactions, user]
  );

  // Toggle a reaction on a message
  const toggleReaction = useCallback(
    async (messageId: string, emoji: string): Promise<boolean> => {
      if (!user) return false;

      // Check if user already reacted with this emoji
      const existingReaction = reactions.find(
        (r) => r.message_id === messageId && r.user_id === user.id && r.emoji === emoji
      );

      try {
        if (existingReaction) {
          // Remove reaction
          const { error } = await supabase
            .from("message_reactions")
            .delete()
            .eq("id", existingReaction.id);

          if (error) {
            console.error("[useMessageReactions] Remove error:", error);
            return false;
          }

          // Optimistic update
          setReactions((prev) => prev.filter((r) => r.id !== existingReaction.id));
        } else {
          // Add reaction
          const { data, error } = await supabase
            .from("message_reactions")
            .insert({
              message_id: messageId,
              user_id: user.id,
              emoji,
            })
            .select()
            .single();

          if (error) {
            console.error("[useMessageReactions] Add error:", error);
            return false;
          }

          // Optimistic update
          if (data) {
            setReactions((prev) => [...prev, data]);
          }
        }

        return true;
      } catch (err) {
        console.error("[useMessageReactions] Toggle error:", err);
        return false;
      }
    },
    [user, reactions]
  );

  return {
    reactions,
    isLoading,
    getReactionsForMessage,
    toggleReaction,
    refetch: loadReactions,
  };
}

// Available reaction emojis
export const REACTION_EMOJIS = ["❤️", "😂", "😮", "😢", "🔥", "👍"];
