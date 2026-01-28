import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface TypingState {
  isOtherTyping: boolean;
  typingUserName: string | null;
}

interface PresenceState {
  user_id: string;
  user_name: string;
  is_typing: boolean;
  last_typed_at: string;
}

export function useTypingIndicator(conversationId: string | null, otherUserName?: string) {
  const { user } = useAuth();
  const [state, setState] = useState<TypingState>({
    isOtherTyping: false,
    typingUserName: null,
  });
  
  const channelRef = useRef<RealtimeChannel | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingRef = useRef<number>(0);

  // Track my typing state on the channel
  const setTyping = useCallback((isTyping: boolean) => {
    if (!channelRef.current || !user) return;

    const now = Date.now();
    
    // Debounce: only send if 1s since last send or if stopping
    if (!isTyping || now - lastTypingRef.current > 1000) {
      lastTypingRef.current = now;
      
      channelRef.current.track({
        user_id: user.id,
        user_name: user.user_metadata?.name || "Someone",
        is_typing: isTyping,
        last_typed_at: new Date().toISOString(),
      });
    }

    // Auto-clear typing after 3 seconds of inactivity
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    if (isTyping) {
      typingTimeoutRef.current = setTimeout(() => {
        if (channelRef.current && user) {
          channelRef.current.track({
            user_id: user.id,
            user_name: user.user_metadata?.name || "Someone",
            is_typing: false,
            last_typed_at: new Date().toISOString(),
          });
        }
      }, 3000);
    }
  }, [user]);

  // Subscribe to presence channel
  useEffect(() => {
    if (!conversationId || !user) return;

    const channel = supabase.channel(`typing:${conversationId}`, {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const presenceState = channel.presenceState();
        
        // Find other users who are typing
        let isOtherTyping = false;
        let typingUserName: string | null = null;

        Object.entries(presenceState).forEach(([key, presences]) => {
          if (key !== user.id && Array.isArray(presences)) {
            const latestPresence = presences[presences.length - 1] as unknown as PresenceState;
            if (latestPresence?.is_typing) {
              isOtherTyping = true;
              typingUserName = latestPresence.user_name || otherUserName || "Someone";
            }
          }
        });

        setState({ isOtherTyping, typingUserName });
      })
      .on("presence", { event: "join" }, ({ key, newPresences }) => {
        if (key !== user.id && newPresences.length > 0) {
          const presence = newPresences[newPresences.length - 1] as unknown as PresenceState;
          if (presence?.is_typing) {
            setState({
              isOtherTyping: true,
              typingUserName: presence.user_name || otherUserName || "Someone",
            });
          }
        }
      })
      .on("presence", { event: "leave" }, ({ key }) => {
        if (key !== user.id) {
          setState({ isOtherTyping: false, typingUserName: null });
        }
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          // Track initial presence (not typing)
          await channel.track({
            user_id: user.id,
            user_name: user.user_metadata?.name || "Someone",
            is_typing: false,
            last_typed_at: new Date().toISOString(),
          });
        }
      });

    channelRef.current = channel;

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [conversationId, user, otherUserName]);

  return {
    isOtherTyping: state.isOtherTyping,
    typingUserName: state.typingUserName,
    setTyping,
  };
}
