import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";

export interface LiveMessage {
  id: string;
  event_id: string;
  user_id: string;
  display_name: string | null;
  role: "creator" | "viewer";
  message: string;
  created_at: string;
}

interface UseLiveChatOptions {
  eventId: string | null;
  creatorId: string | null;
}

type RealtimeStatus = "disconnected" | "connecting" | "connected";

export interface UnreadMessageInfo {
  id: string;
  display_name: string | null;
  message: string;
}

export function useLiveChat({ eventId, creatorId }: UseLiveChatOptions) {
  const { user } = useAuth();
  const { profile } = useProfile();
  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const [status, setStatus] = useState<RealtimeStatus>("disconnected");
  const [isLoading, setIsLoading] = useState(false);
  
  // Unread tracking state
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastSeenMessageId, setLastSeenMessageId] = useState<string | null>(null);
  const [latestUnreadMessage, setLatestUnreadMessage] = useState<UnreadMessageInfo | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  
  // Track which messages we've already processed (to avoid duplicates on reconnect)
  const processedMessageIds = useRef<Set<string>>(new Set());
  const lastToastMessageId = useRef<string | null>(null);
  // Ref to track chat open state in realtime callback (avoids stale closure)
  const isChatOpenRef = useRef(false);
  
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const isCreator = user?.id === creatorId;

  // Load initial messages
  const loadMessages = useCallback(async () => {
    if (!eventId) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("live_messages")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: true })
        .limit(50);

      if (error) {
        console.error("[useLiveChat] Error loading messages:", error);
        return;
      }

      const loadedMessages = (data as LiveMessage[]) || [];
      setMessages(loadedMessages);
      
      // Mark all existing messages as processed and seen
      loadedMessages.forEach(msg => processedMessageIds.current.add(msg.id));
      
      // Set lastSeenMessageId to newest message if chat is open or no messages yet
      if (loadedMessages.length > 0) {
        const newestId = loadedMessages[loadedMessages.length - 1].id;
        setLastSeenMessageId(newestId);
      }
    } catch (err) {
      console.error("[useLiveChat] Unexpected error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [eventId]);

  // Mark messages as seen when chat opens
  const markAsSeen = useCallback(() => {
    if (messages.length > 0) {
      const newestMessage = messages[messages.length - 1];
      setLastSeenMessageId(newestMessage.id);
    }
    setUnreadCount(0);
    setLatestUnreadMessage(null);
  }, [messages]);

  // Handle chat open/close
  const openChat = useCallback(() => {
    setIsChatOpen(true);
    isChatOpenRef.current = true;
    markAsSeen();
  }, [markAsSeen]);

  const closeChat = useCallback(() => {
    setIsChatOpen(false);
    isChatOpenRef.current = false;
    // Mark current messages as seen when closing
    markAsSeen();
  }, [markAsSeen]);

  // Clear the latest unread message (for toast dismissal)
  const clearLatestUnread = useCallback(() => {
    setLatestUnreadMessage(null);
  }, []);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!eventId) {
      setStatus("disconnected");
      return;
    }

    setStatus("connecting");

    // Load initial messages
    loadMessages();

    // Set up realtime subscription
    const channel = supabase
      .channel(`live_messages:${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "live_messages",
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          console.log("[useLiveChat] New message received:", payload);
          const newMessage = payload.new as LiveMessage;
          
          // Prevent duplicate processing (e.g. on reconnect)
          if (processedMessageIds.current.has(newMessage.id)) {
            console.log("[useLiveChat] Skipping duplicate message:", newMessage.id);
            return;
          }
          
          processedMessageIds.current.add(newMessage.id);
          
          setMessages((prev) => {
            // Avoid duplicates in state
            if (prev.some((m) => m.id === newMessage.id)) {
              return prev;
            }
            return [...prev, newMessage];
          });
          
          // Handle unread tracking (only if chat is closed and not own message)
          const isOwnMessage = newMessage.user_id === user?.id;
          
          if (!isOwnMessage && !isChatOpenRef.current) {
            // Only increment unread if chat is closed
            setUnreadCount(prev => prev + 1);
            
            // Set latest unread for toast (if not already toasted)
            if (lastToastMessageId.current !== newMessage.id) {
              lastToastMessageId.current = newMessage.id;
              setLatestUnreadMessage({
                id: newMessage.id,
                display_name: newMessage.display_name,
                message: newMessage.message,
              });
            }
          }
        }
      )
      .subscribe((subscriptionStatus) => {
        console.log("[useLiveChat] Subscription status:", subscriptionStatus);
        if (subscriptionStatus === "SUBSCRIBED") {
          setStatus("connected");
        } else if (subscriptionStatus === "CLOSED" || subscriptionStatus === "CHANNEL_ERROR") {
          setStatus("disconnected");
        }
      });

    channelRef.current = channel;

    return () => {
      console.log("[useLiveChat] Cleaning up channel");
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setStatus("disconnected");
    };
  }, [eventId, loadMessages, user?.id]);

  // When chat opens, reset unread count
  useEffect(() => {
    if (isChatOpen) {
      setUnreadCount(0);
      setLatestUnreadMessage(null);
      // Update last seen to newest message
      if (messages.length > 0) {
        setLastSeenMessageId(messages[messages.length - 1].id);
      }
    }
  }, [isChatOpen, messages]);

  // Send a message
  const sendMessage = useCallback(
    async (messageText: string) => {
      if (!eventId || !user) {
        toast.error("Please sign in to chat");
        return false;
      }

      const trimmed = messageText.trim();
      if (!trimmed) {
        return false;
      }

      if (trimmed.length > 200) {
        toast.error("Message too long (max 200 characters)");
        return false;
      }

      // Determine display name
      const displayName = profile?.name || profile?.handle || "Viewer";

      // Determine role
      const role = isCreator ? "creator" : "viewer";

      try {
        const { error } = await supabase.from("live_messages").insert({
          event_id: eventId,
          user_id: user.id,
          display_name: displayName,
          role,
          message: trimmed,
        });

        if (error) {
          console.error("[useLiveChat] Error sending message:", error);
          toast.error("Failed to send message");
          return false;
        }

        return true;
      } catch (err) {
        console.error("[useLiveChat] Unexpected error:", err);
        toast.error("Failed to send message");
        return false;
      }
    },
    [eventId, user, profile, isCreator]
  );

  return {
    messages,
    status,
    isLoading,
    messageCount: messages.length,
    sendMessage,
    isCreator,
    // Unread tracking
    unreadCount,
    latestUnreadMessage,
    isChatOpen,
    openChat,
    closeChat,
    clearLatestUnread,
    markAsSeen,
  };
}
