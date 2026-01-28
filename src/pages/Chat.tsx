import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Send, BadgeCheck, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMessages, Message } from "@/hooks/useMessages";
import { triggerHaptic } from "@/lib/haptics";
import { format, isToday, isYesterday, isSameDay } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

interface OtherUser {
  user_id: string;
  name: string;
  handle: string | null;
  avatar_url: string | null;
  is_verified: boolean;
}

function MessageBubble({ message, isOwn }: { message: Message; isOwn: boolean }) {
  const timeStr = format(new Date(message.created_at), "h:mm a");
  const isFailed = message._status === "failed";
  const isSending = message._status === "sending";

  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"} mb-2`}>
      <div
        className={`max-w-[75%] px-4 py-2 rounded-2xl ${
          isOwn
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "bg-obsidian text-foreground rounded-bl-md"
        } ${isFailed ? "opacity-60" : ""}`}
      >
        <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
        <div className={`flex items-center gap-1 mt-1 ${isOwn ? "justify-end" : "justify-start"}`}>
          <span className="text-[10px] opacity-60">{timeStr}</span>
          {isSending && <Loader2 className="w-3 h-3 animate-spin opacity-60" />}
          {isFailed && <span className="text-[10px] text-destructive">Failed</span>}
        </div>
      </div>
    </div>
  );
}

function DateDivider({ date }: { date: Date }) {
  let label: string;
  if (isToday(date)) {
    label = "Today";
  } else if (isYesterday(date)) {
    label = "Yesterday";
  } else {
    label = format(date, "MMMM d, yyyy");
  }

  return (
    <div className="flex items-center justify-center my-4">
      <span className="text-xs text-muted-foreground bg-carbon px-3 py-1 rounded-full">
        {label}
      </span>
    </div>
  );
}

function ChatSkeleton() {
  return (
    <div className="flex-1 p-4 space-y-4">
      <div className="flex justify-start">
        <Skeleton className="h-12 w-48 rounded-2xl" />
      </div>
      <div className="flex justify-end">
        <Skeleton className="h-10 w-40 rounded-2xl" />
      </div>
      <div className="flex justify-start">
        <Skeleton className="h-16 w-56 rounded-2xl" />
      </div>
    </div>
  );
}

export default function Chat() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { messages, isLoading, isSending, sendMessage, markAsRead } = useMessages({
    conversationId: conversationId || null,
  });

  // Fetch other user info
  useEffect(() => {
    if (!conversationId || !user) return;

    const fetchOtherUser = async () => {
      setIsLoadingUser(true);
      try {
        // Get the other participant
        const { data: participants, error: partError } = await supabase
          .from("conversation_participants")
          .select("user_id")
          .eq("conversation_id", conversationId)
          .neq("user_id", user.id)
          .single();

        if (partError || !participants) {
          console.error("[Chat] Error fetching participant:", partError);
          return;
        }

        // Get their profile
        const { data: profile, error: profileError } = await supabase.rpc("get_public_profile", {
          profile_user_id: participants.user_id,
        });

        if (!profileError && profile && Array.isArray(profile) && profile.length > 0) {
          setOtherUser({
            user_id: profile[0].user_id,
            name: profile[0].name,
            handle: profile[0].handle,
            avatar_url: profile[0].avatar_url,
            is_verified: profile[0].is_verified || false,
          });
        }
      } catch (err) {
        console.error("[Chat] Unexpected error:", err);
      } finally {
        setIsLoadingUser(false);
      }
    };

    fetchOtherUser();
  }, [conversationId, user]);

  // Mark messages as read when viewing
  useEffect(() => {
    if (conversationId && user && messages.length > 0) {
      markAsRead();
    }
  }, [conversationId, user, messages.length, markAsRead]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleBack = () => {
    triggerHaptic("light");
    navigate("/messages");
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isSending) return;

    triggerHaptic("light");
    const success = await sendMessage(inputValue);
    if (success) {
      setInputValue("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Group messages by date
  const renderMessages = () => {
    const elements: React.ReactNode[] = [];
    let lastDate: Date | null = null;

    messages.forEach((msg, index) => {
      const msgDate = new Date(msg.created_at);
      
      if (!lastDate || !isSameDay(lastDate, msgDate)) {
        elements.push(<DateDivider key={`date-${index}`} date={msgDate} />);
        lastDate = msgDate;
      }

      elements.push(
        <MessageBubble
          key={msg.id}
          message={msg}
          isOwn={msg.sender_id === user?.id}
        />
      );
    });

    return elements;
  };

  return (
    <div className="min-h-screen bg-carbon flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-carbon/95 backdrop-blur-sm border-b border-border/30">
        <div
          className="flex items-center gap-3 px-4 py-3"
          style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
        >
          <motion.button
            onClick={handleBack}
            className="p-2 -ml-2 rounded-full hover:bg-white/5"
            whileTap={{ scale: 0.95 }}
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </motion.button>

          {isLoadingUser ? (
            <div className="flex items-center gap-2">
              <Skeleton className="w-10 h-10 rounded-full" />
              <div className="space-y-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ) : otherUser ? (
            <button
              onClick={() => {
                triggerHaptic("light");
                navigate(`/profile/${otherUser.user_id}`);
              }}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <div className="w-10 h-10 rounded-full bg-obsidian overflow-hidden">
                {otherUser.avatar_url ? (
                  <img
                    src={otherUser.avatar_url}
                    alt={otherUser.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-lg font-display text-muted-foreground">
                    {otherUser.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="text-left">
                <div className="flex items-center gap-1">
                  <span className="font-medium text-sm text-foreground">{otherUser.name}</span>
                  {otherUser.is_verified && (
                    <BadgeCheck className="w-4 h-4 text-gold fill-gold/20" />
                  )}
                </div>
                {otherUser.handle && (
                  <p className="text-xs text-muted-foreground">@{otherUser.handle}</p>
                )}
              </div>
            </button>
          ) : (
            <span className="text-foreground font-medium">Chat</span>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {isLoading ? (
          <ChatSkeleton />
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-20">
            <p className="text-muted-foreground text-sm">No messages yet</p>
            <p className="text-muted-foreground/60 text-xs mt-1">
              Send a message to start the conversation
            </p>
          </div>
        ) : (
          <>
            {renderMessages()}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div
        className="sticky bottom-0 bg-carbon border-t border-border/30 px-4 py-3"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1 bg-obsidian border border-border/30 rounded-full px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
            maxLength={1000}
          />
          <motion.button
            onClick={handleSend}
            disabled={!inputValue.trim() || isSending}
            className="p-2.5 rounded-full bg-primary text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed"
            whileTap={{ scale: 0.95 }}
          >
            {isSending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </motion.button>
        </div>
      </div>
    </div>
  );
}
