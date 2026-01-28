import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Send, BadgeCheck, Loader2, Check, CheckCheck, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useConversations } from "@/hooks/useConversations";
import { useMessages, Message } from "@/hooks/useMessages";
import { useMessageReactions, REACTION_EMOJIS, ReactionCount } from "@/hooks/useMessageReactions";
import { useTypingIndicator } from "@/hooks/useTypingIndicator";
import { triggerHaptic } from "@/lib/haptics";
import { format, isToday, isYesterday, isSameDay } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { DeleteConversationModal } from "@/components/DeleteConversationModal";
import { toast } from "sonner";

interface OtherUser {
  user_id: string;
  name: string;
  handle: string | null;
  avatar_url: string | null;
  is_verified: boolean;
}

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  isLastRead?: boolean;
  reactions: ReactionCount[];
  onReact: (emoji: string) => void;
}

import React from "react";

const ReactionPicker = React.forwardRef<
  HTMLDivElement,
  { onSelect: (emoji: string) => void; onClose: () => void }
>(({ onSelect, onClose }, ref) => {
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.8, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: 10 }}
      className="absolute bottom-full mb-2 left-0 z-50 bg-obsidian border border-border/50 rounded-full px-2 py-1.5 shadow-lg max-w-[calc(100vw-32px)] overflow-x-auto whitespace-nowrap scrollbar-hide"
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      <div className="flex items-center gap-1">
        {REACTION_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => {
              onSelect(emoji);
              onClose();
            }}
            className="w-8 h-8 flex items-center justify-center text-lg hover:bg-white/10 rounded-full transition-colors flex-shrink-0"
          >
            {emoji}
          </button>
        ))}
      </div>
    </motion.div>
  );
});

ReactionPicker.displayName = "ReactionPicker";

function ReactionsDisplay({ 
  reactions, 
  onReact, 
  isOwn 
}: { 
  reactions: ReactionCount[]; 
  onReact: (emoji: string) => void; 
  isOwn: boolean;
}) {
  if (reactions.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-1 mt-1 ${isOwn ? "justify-end" : "justify-start"}`}>
      {reactions.map(({ emoji, count, hasReacted }) => (
        <button
          key={emoji}
          onClick={() => onReact(emoji)}
          className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-colors ${
            hasReacted
              ? "bg-primary/20 border border-primary/40"
              : "bg-obsidian/80 border border-border/30 hover:bg-muted/30"
          }`}
        >
          <span>{emoji}</span>
          {count > 1 && <span className="text-muted-foreground">{count}</span>}
        </button>
      ))}
    </div>
  );
}

function MessageBubble({ message, isOwn, isLastRead, reactions, onReact }: MessageBubbleProps) {
  const [showPicker, setShowPicker] = useState(false);
  const timeStr = format(new Date(message.created_at), "h:mm a");
  const isFailed = message._status === "failed";
  const isSending = message._status === "sending";
  const isRead = Boolean(message.read_at);

  return (
    <div className={`flex flex-col ${isOwn ? "items-end" : "items-start"} mb-2 group relative`}>
      {/* Reaction picker toggle */}
      <div className={`flex items-end gap-1 ${isOwn ? "flex-row-reverse" : "flex-row"}`}>
        <div
          className={`max-w-[75%] px-4 py-2 rounded-2xl ${
            isOwn
              ? "bg-primary text-primary-foreground rounded-br-md"
              : "bg-obsidian text-foreground rounded-bl-md"
          } ${isFailed ? "opacity-60" : ""}`}
        >
          <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
          <div className={`flex items-center gap-1.5 mt-1 ${isOwn ? "justify-end" : "justify-start"}`}>
            <span className="text-[10px] opacity-60">{timeStr}</span>
            {isOwn && !isFailed && !isSending && (
              isRead ? (
                <CheckCheck className="w-3.5 h-3.5 text-accent" />
              ) : (
                <Check className="w-3.5 h-3.5 opacity-60" />
              )
            )}
            {isSending && <Loader2 className="w-3 h-3 animate-spin opacity-60" />}
            {isFailed && <span className="text-[10px] text-destructive">Failed</span>}
          </div>
        </div>
        
        {/* Add reaction button - shows on hover/focus */}
        {!isSending && !isFailed && (
          <div className="relative">
            <button
              onClick={() => {
                triggerHaptic("light");
                setShowPicker(!showPicker);
              }}
              className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1.5 rounded-full hover:bg-muted/30 transition-all"
            >
              <Plus className="w-4 h-4 text-muted-foreground" />
            </button>
            
            <AnimatePresence>
              {showPicker && (
                <>
                  {/* Backdrop to close picker */}
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowPicker(false)} 
                  />
                  <ReactionPicker
                    onSelect={(emoji) => {
                      triggerHaptic("light");
                      onReact(emoji);
                    }}
                    onClose={() => setShowPicker(false)}
                  />
                </>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Reactions display */}
      <ReactionsDisplay reactions={reactions} onReact={onReact} isOwn={isOwn} />

      {/* "Seen" label under the last read message */}
      {isOwn && isLastRead && isRead && reactions.length === 0 && (
        <span className="text-[10px] text-muted-foreground mt-1 mr-1">
          Seen
        </span>
      )}
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

function TypingIndicator({ userName }: { userName: string | null }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="flex items-center gap-2 mb-2"
    >
      <div className="flex items-center gap-1 px-4 py-2 bg-obsidian rounded-2xl rounded-bl-md">
        <div className="flex gap-1">
          <span className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
      <span className="text-xs text-muted-foreground">{userName || "Someone"} is typing...</span>
    </motion.div>
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
  // Support both existing conversation route and new chat route
  const { conversationId: paramConversationId, targetUserId } = useParams<{ 
    conversationId?: string; 
    targetUserId?: string;
  }>();
  
  const navigate = useNavigate();
  const { user } = useAuth();
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  
  // For new chats, we need to track if we've found an existing conversation
  const [activeConversationId, setActiveConversationId] = useState<string | null>(paramConversationId || null);
  const [isNewChat, setIsNewChat] = useState(Boolean(targetUserId && !paramConversationId));
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get refetch from conversations to update unread counts after marking read
  const { refetch: refetchConversations, getOrCreateConversation } = useConversations();

  const { messages, isLoading, isSending, sendMessage, markAsRead } = useMessages({
    conversationId: activeConversationId,
    onMessagesMarkedRead: refetchConversations,
  });

  const { getReactionsForMessage, toggleReaction } = useMessageReactions({
    conversationId: activeConversationId,
  });

  const { isOtherTyping, typingUserName, setTyping } = useTypingIndicator(
    activeConversationId,
    otherUser?.name
  );

  // Check for existing conversation when opening new chat
  useEffect(() => {
    if (!targetUserId || !user || paramConversationId) return;

    const checkExistingConversation = async () => {
      try {
        // Check if we already have a conversation with this user
        const { data: participants } = await supabase
          .from("conversation_participants")
          .select("conversation_id")
          .eq("user_id", user.id);
        
        if (!participants || participants.length === 0) {
          console.log("[Chat] No existing conversations found");
          return;
        }

        // Check which of our conversations include the target user
        for (const p of participants) {
          const { data: otherParticipant } = await supabase
            .from("conversation_participants")
            .select("user_id")
            .eq("conversation_id", p.conversation_id)
            .eq("user_id", targetUserId)
            .maybeSingle();

          if (otherParticipant) {
            // Found existing conversation - check if it has messages
            const { count } = await supabase
              .from("messages")
              .select("id", { count: "exact", head: true })
              .eq("conversation_id", p.conversation_id);

            if (count && count > 0) {
              console.log("[Chat] Found existing conversation with messages:", p.conversation_id);
              setActiveConversationId(p.conversation_id);
              setIsNewChat(false);
              // Redirect to the proper URL
              navigate(`/messages/${p.conversation_id}`, { replace: true });
              return;
            }
          }
        }

        console.log("[Chat] No existing conversation with messages found, staying in new chat mode");
      } catch (err) {
        console.error("[Chat] Error checking existing conversation:", err);
      }
    };

    checkExistingConversation();
  }, [targetUserId, user, paramConversationId, navigate]);

  // Fetch other user info
  useEffect(() => {
    const targetId = targetUserId || null;
    
    // If we have a conversationId (from param or found), fetch the other user from participants
    if (activeConversationId && user) {
      const fetchOtherUser = async () => {
        setIsLoadingUser(true);
        try {
          const { data: participants, error: partError } = await supabase
            .from("conversation_participants")
            .select("user_id")
            .eq("conversation_id", activeConversationId)
            .neq("user_id", user.id)
            .single();

          if (partError || !participants) {
            console.error("[Chat] Error fetching participant:", partError);
            return;
          }

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
      return;
    }

    // If we have a targetUserId (new chat), fetch their profile directly
    if (targetId && user) {
      const fetchTargetUser = async () => {
        setIsLoadingUser(true);
        try {
          const { data: profile, error: profileError } = await supabase.rpc("get_public_profile", {
            profile_user_id: targetId,
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
          console.error("[Chat] Unexpected error fetching target user:", err);
        } finally {
          setIsLoadingUser(false);
        }
      };

      fetchTargetUser();
    }
  }, [activeConversationId, targetUserId, user]);

  // Mark messages as read when viewing
  useEffect(() => {
    if (activeConversationId && user && messages.length > 0) {
      markAsRead();
    }
  }, [activeConversationId, user, messages.length, markAsRead]);

  // Mark messages as read when tab becomes visible again
  useEffect(() => {
    if (!activeConversationId || !user) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && messages.length > 0) {
        console.log("[Chat] Tab became visible - marking messages as read");
        markAsRead();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [activeConversationId, user, messages.length, markAsRead]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleBack = () => {
    triggerHaptic("light");
    // Use history-based navigation, fallback to /messages if no history
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/messages");
    }
  };

  const handleDeleteClick = () => {
    triggerHaptic("light");
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!activeConversationId || !user) return;
    
    setIsDeleting(true);
    try {
      const { error: updateError } = await supabase
        .from("conversation_participants")
        .update({ deleted_at: new Date().toISOString() })
        .eq("conversation_id", activeConversationId)
        .eq("user_id", user.id);

      if (updateError) {
        console.error("[Chat] Delete error:", updateError);
        toast.error("Failed to delete conversation");
        return;
      }

      toast.success("Conversation deleted");
      setDeleteModalOpen(false);
      navigate("/messages", { replace: true });
    } catch (err) {
      console.error("[Chat] Unexpected delete error:", err);
      toast.error("Failed to delete conversation");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isSending || isCreatingConversation) return;
    if (!user) return;

    triggerHaptic("light");
    setTyping(false);

    // If this is a new chat (no conversation yet), create the conversation first
    if (isNewChat && targetUserId && !activeConversationId) {
      setIsCreatingConversation(true);
      try {
        const conversationId = await getOrCreateConversation(targetUserId);
        if (!conversationId) {
          console.error("[Chat] Failed to create conversation");
          setIsCreatingConversation(false);
          return;
        }
        
        // Update state with new conversation ID
        setActiveConversationId(conversationId);
        setIsNewChat(false);
        
        // Now send the message (need to do it manually since useMessages might not have updated yet)
        const { error: insertError } = await supabase
          .from("messages")
          .insert({
            conversation_id: conversationId,
            sender_id: user.id,
            content: inputValue.trim(),
          });

        if (insertError) {
          console.error("[Chat] Error sending first message:", insertError);
          setIsCreatingConversation(false);
          return;
        }

        setInputValue("");
        // Navigate to the proper URL
        navigate(`/messages/${conversationId}`, { replace: true });
        setIsCreatingConversation(false);
        return;
      } catch (err) {
        console.error("[Chat] Error creating conversation:", err);
        setIsCreatingConversation(false);
        return;
      }
    }

    // Normal send for existing conversations
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

  // Group messages by date and find last read message
  const renderMessages = () => {
    const elements: React.ReactNode[] = [];
    let lastDate: Date | null = null;

    // Find the last read message sent by the current user
    const ownMessages = messages.filter((m) => m.sender_id === user?.id);
    const lastReadOwnMessage = [...ownMessages]
      .reverse()
      .find((m) => m.read_at !== null);

    messages.forEach((msg, index) => {
      const msgDate = new Date(msg.created_at);
      
      if (!lastDate || !isSameDay(lastDate, msgDate)) {
        elements.push(<DateDivider key={`date-${index}`} date={msgDate} />);
        lastDate = msgDate;
      }

      const isOwn = msg.sender_id === user?.id;
      const isLastRead = isOwn && lastReadOwnMessage?.id === msg.id;

      elements.push(
        <MessageBubble
          key={msg.id}
          message={msg}
          isOwn={isOwn}
          isLastRead={isLastRead}
          reactions={getReactionsForMessage(msg.id)}
          onReact={(emoji) => toggleReaction(msg.id, emoji)}
        />
      );
    });

    return elements;
  };

  const showLoading = isLoading && !isNewChat;

  return (
    <div className="min-h-screen bg-carbon flex flex-col overflow-x-hidden">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-carbon/95 backdrop-blur-sm border-b border-border/30">
        <div
          className="flex items-center justify-between gap-3 px-4 py-3"
          style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <motion.button
              onClick={handleBack}
              className="p-2 -ml-2 rounded-full hover:bg-white/5 flex-shrink-0"
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
                className="flex items-center gap-2 hover:opacity-80 transition-opacity min-w-0"
              >
                <div className="w-10 h-10 rounded-full bg-obsidian overflow-hidden flex-shrink-0">
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
                <div className="text-left min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="font-medium text-sm text-foreground truncate">{otherUser.name}</span>
                    {otherUser.is_verified && (
                      <BadgeCheck className="w-4 h-4 text-gold fill-gold/20 flex-shrink-0" />
                    )}
                  </div>
                  {otherUser.handle && (
                    <p className="text-xs text-muted-foreground truncate">@{otherUser.handle}</p>
                  )}
                </div>
              </button>
            ) : (
              <span className="text-foreground font-medium">Chat</span>
            )}
          </div>

          {/* Delete button - only show for existing conversations */}
          {activeConversationId && !isNewChat && (
            <motion.button
              onClick={handleDeleteClick}
              className="p-2 rounded-full hover:bg-white/10 text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
              whileTap={{ scale: 0.95 }}
              aria-label="Delete conversation"
            >
              <Trash2 className="w-5 h-5" />
            </motion.button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-4">
        {showLoading ? (
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
            <AnimatePresence>
              {isOtherTyping && <TypingIndicator userName={typingUserName} />}
            </AnimatePresence>
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
            onChange={(e) => {
              setInputValue(e.target.value);
              if (activeConversationId) {
                setTyping(e.target.value.length > 0);
              }
            }}
            onKeyDown={handleKeyDown}
            onBlur={() => setTyping(false)}
            placeholder="Type a message..."
            className="flex-1 bg-obsidian border border-border/30 rounded-full px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
            maxLength={1000}
          />
          <motion.button
            onClick={handleSend}
            disabled={!inputValue.trim() || isSending || isCreatingConversation}
            className="p-2.5 rounded-full bg-primary text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed"
            whileTap={{ scale: 0.95 }}
          >
            {isSending || isCreatingConversation ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </motion.button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteConversationModal
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
      />
    </div>
  );
}
