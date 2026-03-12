import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
  // Client-side optimistic tracking
  _clientId?: string;
  _status?: "sending" | "sent" | "failed";
}

interface UseMessagesOptions {
  conversationId: string | null;
  onMessagesMarkedRead?: () => void;
}

function generateClientId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function useMessages({ conversationId, onMessagesMarkedRead }: UseMessagesOptions) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processedIds = useRef<Set<string>>(new Set());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Load messages for conversation
  const loadMessages = useCallback(async () => {
    if (!conversationId || !user) {
      setMessages([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: queryError } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(100);

      if (queryError) {
        console.error("[useMessages] Error loading:", queryError);
        setError(queryError.message);
        return;
      }

      const loadedMessages = (data as Message[]) || [];
      
      // Mark as processed
      loadedMessages.forEach((msg) => {
        processedIds.current.add(msg.id);
      });

      setMessages(
        loadedMessages.map((m) => ({ ...m, _status: "sent" as const }))
      );
    } catch (err) {
      console.error("[useMessages] Unexpected error:", err);
      setError("Failed to load messages");
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, user]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!conversationId || !user) {
      setMessages([]);
      return;
    }

    loadMessages();

    // Clean up existing channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          const newMessage = payload.new as Message;

          // Skip if already processed
          if (processedIds.current.has(newMessage.id)) {
            return;
          }

          processedIds.current.add(newMessage.id);

          setMessages((prev) => {
            // Check if this is our optimistic message
            const optimisticIndex = prev.findIndex(
              (m) =>
                m._status === "sending" &&
                m.sender_id === newMessage.sender_id &&
                m.content === newMessage.content
            );

            if (optimisticIndex !== -1) {
              // Replace optimistic with confirmed
              const updated = [...prev];
              updated[optimisticIndex] = { ...newMessage, _status: "sent" };
              return updated;
            }

            // Avoid duplicates
            if (prev.some((m) => m.id === newMessage.id)) {
              return prev;
            }

            return [...prev, { ...newMessage, _status: "sent" }];
          });

          // Auto-mark incoming messages as read since user is viewing this conversation
          // Only mark if it's from someone else (not our own message)
          if (newMessage.sender_id !== user.id && !newMessage.read_at) {
            console.log("[useMessages] Auto-marking new incoming message as read");
            try {
              await supabase
                .from("messages")
                .update({ read_at: new Date().toISOString() })
                .eq("id", newMessage.id);
              
              // Update local state
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === newMessage.id
                    ? { ...m, read_at: new Date().toISOString() }
                    : m
                )
              );
            } catch (err) {
              console.error("[useMessages] Failed to auto-mark as read:", err);
            }
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const updatedMessage = payload.new as Message;

          // Update the message in state (for read receipts)
          setMessages((prev) =>
            prev.map((m) =>
              m.id === updatedMessage.id
                ? { ...m, read_at: updatedMessage.read_at }
                : m
            )
          );
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
  }, [conversationId, user, loadMessages]);

  // Send a message with optimistic update
  const sendMessage = useCallback(
    async (content: string): Promise<boolean> => {
      if (!conversationId || !user) {
        return false;
      }

      const trimmed = content.trim();
      if (!trimmed) return false;

      if (trimmed.length > 1000) {
        setError("Message too long (max 1000 characters)");
        return false;
      }

      if (isSending) return false;

      const clientId = generateClientId();

      // Optimistic message
      const optimisticMessage: Message = {
        id: `optimistic-${clientId}`,
        conversation_id: conversationId,
        sender_id: user.id,
        content: trimmed,
        created_at: new Date().toISOString(),
        read_at: null,
        _clientId: clientId,
        _status: "sending",
      };

      setMessages((prev) => [...prev, optimisticMessage]);
      setIsSending(true);

      try {
        const { data, error: insertError } = await supabase
          .from("messages")
          .insert({
            conversation_id: conversationId,
            sender_id: user.id,
            content: trimmed,
          })
          .select()
          .single();

        if (insertError) {
          console.error("[useMessages] Send error:", insertError);
          setMessages((prev) =>
            prev.map((m) =>
              m._clientId === clientId ? { ...m, _status: "failed" as const } : m
            )
          );
          return false;
        }

        // Update optimistic with real data
        if (data) {
          processedIds.current.add(data.id);
          setMessages((prev) =>
            prev.map((m) =>
              m._clientId === clientId
                ? { ...data, _clientId: clientId, _status: "sent" as const }
                : m
            )
          );

          // Trigger push notification for recipient (fire-and-forget)
          supabase.functions.invoke("send-dm-push", {
            body: { message_id: data.id },
          }).catch((err) => {
            console.log("[useMessages] Push notification failed (non-critical):", err);
          });
        }

        return true;
      } catch (err) {
        console.error("[useMessages] Unexpected send error:", err);
        setMessages((prev) =>
          prev.map((m) =>
            m._clientId === clientId ? { ...m, _status: "failed" as const } : m
          )
        );
        return false;
      } finally {
        setIsSending(false);
      }
    },
    [conversationId, user, isSending]
  );

  // Mark messages as read
  const markAsRead = useCallback(async () => {
    if (!conversationId || !user) return;

    try {
      const { data, error } = await supabase
        .from("messages")
        .update({ read_at: new Date().toISOString() })
        .eq("conversation_id", conversationId)
        .neq("sender_id", user.id)
        .is("read_at", null)
        .select("id");

      if (error) {
        console.error("[useMessages] Mark as read error:", error);
        return;
      }

      // If we marked any messages as read, notify parent to refresh unread counts
      if (data && data.length > 0) {
        console.log(`[useMessages] Marked ${data.length} messages as read`);
        
        // Update local state optimistically
        setMessages((prev) =>
          prev.map((m) =>
            m.sender_id !== user.id && !m.read_at
              ? { ...m, read_at: new Date().toISOString() }
              : m
          )
        );

        // Notify parent hook to refresh conversation list unread counts
        onMessagesMarkedRead?.();
      }
    } catch (err) {
      console.error("[useMessages] Mark as read error:", err);
    }
  }, [conversationId, user, onMessagesMarkedRead]);

  return {
    messages,
    isLoading,
    isSending,
    error,
    sendMessage,
    markAsRead,
    refetch: loadMessages,
  };
}
