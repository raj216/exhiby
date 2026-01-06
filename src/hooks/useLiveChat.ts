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

export function useLiveChat({ eventId, creatorId }: UseLiveChatOptions) {
  const { user } = useAuth();
  const { profile } = useProfile();
  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const [status, setStatus] = useState<RealtimeStatus>("disconnected");
  const [isLoading, setIsLoading] = useState(false);
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

      setMessages((data as LiveMessage[]) || []);
    } catch (err) {
      console.error("[useLiveChat] Unexpected error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [eventId]);

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
          setMessages((prev) => {
            // Avoid duplicates
            if (prev.some((m) => m.id === newMessage.id)) {
              return prev;
            }
            return [...prev, newMessage];
          });
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
  }, [eventId, loadMessages]);

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
  };
}
