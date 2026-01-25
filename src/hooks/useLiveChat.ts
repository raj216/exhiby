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
  // Client-side tracking
  _clientId?: string;
  _status?: "sending" | "sent" | "failed";
}

interface UseLiveChatOptions {
  eventId: string | null;
  creatorId: string | null;
  /** For audience: pass true once they have joined as a viewer (live_viewers record exists) */
  isViewerReady?: boolean;
}

type RealtimeStatus = "disconnected" | "connecting" | "connected";

export interface UnreadMessageInfo {
  id: string;
  display_name: string | null;
  message: string;
}

// Generate unique client message ID for deduplication
function generateClientId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// DEV logging helper
const devLog = (...args: unknown[]) => {
  if (process.env.NODE_ENV === "development") {
    console.log("[useLiveChat]", ...args);
  }
};

export function useLiveChat({ eventId, creatorId, isViewerReady = false }: UseLiveChatOptions) {
  const { user } = useAuth();
  const { profile } = useProfile();
  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const [status, setStatus] = useState<RealtimeStatus>("disconnected");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  
  // Unread tracking state
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastSeenMessageId, setLastSeenMessageId] = useState<string | null>(null);
  const [latestUnreadMessage, setLatestUnreadMessage] = useState<UnreadMessageInfo | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  
  // Track which messages we've already processed (by server ID and client ID)
  const processedServerIds = useRef<Set<string>>(new Set());
  const processedClientIds = useRef<Set<string>>(new Set());
  const pendingClientIds = useRef<Map<string, string>>(new Map()); // clientId -> temporary state
  const lastToastMessageId = useRef<string | null>(null);
  // Ref to track chat open state in realtime callback (avoids stale closure)
  const isChatOpenRef = useRef(false);
  
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const subscriptionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);

  const isCreator = user?.id === creatorId;
  
  // Determine if subscription should be active:
  // - Creators can always subscribe (they own the event)
  // - Viewers must have their live_viewers record ready (for RLS)
  const canSubscribe = Boolean(eventId && user && (isCreator || isViewerReady));

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
      
      // Mark all existing messages as processed
      loadedMessages.forEach(msg => {
        processedServerIds.current.add(msg.id);
      });
      
      // Merge with any pending messages (optimistic updates still in flight)
      setMessages(prev => {
        const pendingMessages = prev.filter(m => m._status === "sending");
        // Filter out any pending messages that now exist in server data
        const stillPendingMessages = pendingMessages.filter(
          pm => !loadedMessages.some(lm => 
            pm._clientId && processedClientIds.current.has(pm._clientId)
          )
        );
        return [...loadedMessages.map(m => ({ ...m, _status: "sent" as const })), ...stillPendingMessages];
      });
      
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

  // Setup realtime subscription with reconnection logic
  const setupSubscription = useCallback(() => {
    // CRITICAL: Check canSubscribe - for viewers, this ensures their live_viewers record exists
    // Without this, RLS will block the realtime subscription from receiving messages
    if (!eventId || !canSubscribe) {
      devLog("Skipping subscription setup:", { eventId, canSubscribe, isCreator, isViewerReady });
      if (!canSubscribe && eventId) {
        setStatus("connecting"); // Show connecting while waiting for viewer record
      } else {
        setStatus("disconnected");
      }
      return;
    }

    // Clear any pending subscription timeout
    if (subscriptionTimeoutRef.current) {
      clearTimeout(subscriptionTimeoutRef.current);
      subscriptionTimeoutRef.current = null;
    }

    // Clean up existing channel
    if (channelRef.current) {
      devLog("Removing existing channel before re-subscribing");
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    setStatus("connecting");
    const channelName = `live_messages:${eventId}`;
    devLog("Setting up subscription:", {
      channelName,
      eventId,
      userId: user?.id,
      isCreator,
      isViewerReady,
    });

    const channel = supabase
      .channel(channelName, {
        config: {
          broadcast: { self: false }, // Don't receive own broadcasts
          presence: { key: user?.id || "anonymous" },
        },
      })
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "live_messages",
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          const newMessage = payload.new as LiveMessage;
          
          devLog("New message received:", newMessage.id, "from:", newMessage.display_name, "role:", newMessage.role);
          
          // Prevent duplicate processing by server ID
          if (processedServerIds.current.has(newMessage.id)) {
            devLog("Skipping duplicate (server ID):", newMessage.id);
            return;
          }
          
          processedServerIds.current.add(newMessage.id);
          
          setMessages((prev) => {
            // Check if this is our own optimistic message coming back
            // Match by user_id and message content within a reasonable time window
            const optimisticIndex = prev.findIndex(
              m => m._status === "sending" && 
                   m.user_id === newMessage.user_id && 
                   m.message === newMessage.message
            );
            
            if (optimisticIndex !== -1) {
              // Replace optimistic message with server-confirmed one
              devLog("Confirming optimistic message:", newMessage.id);
              const updated = [...prev];
              const optimisticMsg = updated[optimisticIndex];
              if (optimisticMsg._clientId) {
                processedClientIds.current.add(optimisticMsg._clientId);
                pendingClientIds.current.delete(optimisticMsg._clientId);
              }
              updated[optimisticIndex] = { ...newMessage, _status: "sent" };
              return updated;
            }
            
            // Avoid duplicates in state by server ID
            if (prev.some((m) => m.id === newMessage.id)) {
              return prev;
            }
            
            // Insert in correct position based on created_at (server timestamp)
            const newMsgTime = new Date(newMessage.created_at).getTime();
            const insertIndex = prev.findIndex(
              m => new Date(m.created_at).getTime() > newMsgTime
            );
            
            const confirmedMessage = { ...newMessage, _status: "sent" as const };
            
            if (insertIndex === -1) {
              return [...prev, confirmedMessage];
            }
            
            const updated = [...prev];
            updated.splice(insertIndex, 0, confirmedMessage);
            return updated;
          });
          
          // Handle unread tracking and toast notification
          // Show toast for ANY message not from current user (creator or audience)
          // Works on ALL platforms (mobile, tablet, desktop)
          const isOwnMessage = newMessage.user_id === user?.id;
          
          devLog("Toast eligibility check:", {
            isOwnMessage,
            isChatOpen: isChatOpenRef.current,
            messageFrom: newMessage.display_name,
            messageRole: newMessage.role,
          });
          
          if (!isOwnMessage && !isChatOpenRef.current) {
            setUnreadCount(prev => prev + 1);
            
            // Set latest unread for toast - this triggers the toast on ALL platforms
            // No isMobile check - works on desktop, tablet, and mobile
            if (lastToastMessageId.current !== newMessage.id) {
              devLog("Setting toast for message:", newMessage.id);
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
      .subscribe((subscriptionStatus, err) => {
        devLog("Subscription callback:", subscriptionStatus, err ? `Error: ${err}` : "");
        
        if (subscriptionStatus === "SUBSCRIBED") {
          devLog("✅ SUBSCRIBED successfully to channel:", channelName);
          setStatus("connected");
          reconnectAttempts.current = 0;
          retryCountRef.current = 0;
          
          // Clear any pending timeout since we connected
          if (subscriptionTimeoutRef.current) {
            clearTimeout(subscriptionTimeoutRef.current);
            subscriptionTimeoutRef.current = null;
          }
        } else if (subscriptionStatus === "CLOSED" || subscriptionStatus === "CHANNEL_ERROR") {
          devLog("❌ Channel error/closed:", subscriptionStatus, err);
          setStatus("disconnected");
          
          // Attempt reconnection with exponential backoff
          if (reconnectAttempts.current < maxReconnectAttempts) {
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
            devLog(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current + 1}/${maxReconnectAttempts})`);
            
            reconnectTimeoutRef.current = setTimeout(() => {
              reconnectAttempts.current++;
              setupSubscription();
            }, delay);
          } else {
            console.error("[useLiveChat] Max reconnection attempts reached");
            toast.error("Chat connection lost. Please refresh the page.");
          }
        } else if (subscriptionStatus === "TIMED_OUT") {
          devLog("⏱️ Subscription TIMED_OUT - will retry");
          setStatus("disconnected");
          
          // Retry once on timeout
          if (retryCountRef.current < 1) {
            retryCountRef.current++;
            devLog("Retrying subscription after timeout...");
            setTimeout(() => setupSubscription(), 1000);
          } else {
            toast.error("Chat connection timed out. Please refresh.");
          }
        }
      });

    channelRef.current = channel;

    // Set a timeout: if still "connecting" after 6 seconds, retry once
    subscriptionTimeoutRef.current = setTimeout(() => {
      if (status === "connecting" && retryCountRef.current < 1) {
        devLog("⏱️ Subscription timeout (6s) - retrying once...");
        retryCountRef.current++;
        toast.info("Chat reconnecting...");
        setupSubscription();
      }
    }, 6000);
  }, [eventId, user?.id, canSubscribe, isCreator, isViewerReady, status]);

  // Subscribe to realtime updates - waits for canSubscribe to be true
  useEffect(() => {
    if (!eventId) {
      setStatus("disconnected");
      return;
    }

    devLog("Effect triggered:", { eventId, canSubscribe, isCreator, isViewerReady });

    // Load initial messages (always attempt - RLS will filter appropriately)
    loadMessages();

    // Only set up realtime subscription when canSubscribe is true
    // For viewers, this waits until their live_viewers record is created
    if (canSubscribe) {
      devLog("canSubscribe is true - setting up subscription");
      setupSubscription();
    } else {
      devLog("canSubscribe is false - waiting for viewer record...");
      setStatus("connecting"); // Show "connecting" while waiting
    }

    return () => {
      devLog("Cleaning up channel and timeouts");
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (subscriptionTimeoutRef.current) {
        clearTimeout(subscriptionTimeoutRef.current);
        subscriptionTimeoutRef.current = null;
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setStatus("disconnected");
    };
  }, [eventId, loadMessages, setupSubscription, canSubscribe]);

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

  // Send a message with optimistic update
  const sendMessage = useCallback(
    async (messageText: string): Promise<boolean> => {
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

      // Generate unique client ID for deduplication
      const clientId = generateClientId();
      
      // Check if we're already sending this exact message (prevent double-tap)
      if (isSending) {
        console.log("[useLiveChat] Already sending a message, ignoring");
        return false;
      }

      // Determine display name and role
      const displayName = profile?.name || profile?.handle || "Viewer";
      const role = isCreator ? "creator" : "viewer";

      // Create optimistic message
      const optimisticMessage: LiveMessage = {
        id: `optimistic-${clientId}`,
        event_id: eventId,
        user_id: user.id,
        display_name: displayName,
        role,
        message: trimmed,
        created_at: new Date().toISOString(),
        _clientId: clientId,
        _status: "sending",
      };

      // Add optimistic message immediately
      setMessages(prev => [...prev, optimisticMessage]);
      pendingClientIds.current.set(clientId, "sending");
      setIsSending(true);

      try {
        const { data, error } = await supabase
          .from("live_messages")
          .insert({
            event_id: eventId,
            user_id: user.id,
            display_name: displayName,
            role,
            message: trimmed,
          })
          .select()
          .single();

        if (error) {
          console.error("[useLiveChat] Error sending message:", error);
          
          // Mark message as failed
          setMessages(prev => 
            prev.map(m => 
              m._clientId === clientId 
                ? { ...m, _status: "failed" as const }
                : m
            )
          );
          pendingClientIds.current.set(clientId, "failed");
          toast.error("Failed to send message");
          return false;
        }

        // Server insert succeeded - the realtime subscription will confirm it
        // But if realtime is slow, we can update now
        if (data) {
          processedServerIds.current.add(data.id);
          processedClientIds.current.add(clientId);
          
          setMessages(prev => 
            prev.map(m => 
              m._clientId === clientId 
                ? { 
                    ...data, 
                    role: data.role as "creator" | "viewer",
                    _clientId: clientId, 
                    _status: "sent" as const 
                  }
                : m
            )
          );
          pendingClientIds.current.delete(clientId);
        }

        return true;
      } catch (err) {
        console.error("[useLiveChat] Unexpected error:", err);
        
        // Mark message as failed
        setMessages(prev => 
          prev.map(m => 
            m._clientId === clientId 
              ? { ...m, _status: "failed" as const }
              : m
          )
        );
        pendingClientIds.current.set(clientId, "failed");
        toast.error("Failed to send message");
        return false;
      } finally {
        setIsSending(false);
      }
    },
    [eventId, user, profile, isCreator, isSending]
  );

  // Retry failed message
  const retryMessage = useCallback(
    async (clientId: string): Promise<boolean> => {
      const failedMessage = messages.find(m => m._clientId === clientId && m._status === "failed");
      if (!failedMessage) return false;

      // Remove failed message and resend
      setMessages(prev => prev.filter(m => m._clientId !== clientId));
      pendingClientIds.current.delete(clientId);
      
      return sendMessage(failedMessage.message);
    },
    [messages, sendMessage]
  );

  // Remove failed message
  const removeFailedMessage = useCallback(
    (clientId: string) => {
      setMessages(prev => prev.filter(m => m._clientId !== clientId));
      pendingClientIds.current.delete(clientId);
    },
    []
  );

  // Reload messages (for manual refresh)
  const reloadMessages = useCallback(() => {
    loadMessages();
  }, [loadMessages]);

  return {
    messages,
    status,
    isLoading,
    isSending,
    messageCount: messages.length,
    sendMessage,
    retryMessage,
    removeFailedMessage,
    reloadMessages,
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
