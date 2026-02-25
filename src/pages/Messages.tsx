import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, MessageSquare, Trash2, BadgeCheck } from "lucide-react";
import { useConversations, Conversation } from "@/hooks/useConversations";
import { triggerHaptic } from "@/lib/haptics";
import { formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { DeleteConversationModal } from "@/components/DeleteConversationModal";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

function ConversationRow({ 
  conversation, 
  onClick, 
  onDelete 
}: { 
  conversation: Conversation; 
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  const timeAgo = conversation.last_message_at
    ? formatDistanceToNow(new Date(conversation.last_message_at), { addSuffix: true })
    : null;

  return (
    <motion.div
      className="w-full flex items-center gap-3 p-4 hover:bg-white/5 transition-colors border-b border-border/20"
    >
      {/* Clickable area for navigation */}
      <button
        onClick={onClick}
        className="flex-1 flex items-center gap-3 text-left"
      >
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <div className="w-12 h-12 rounded-full bg-obsidian overflow-hidden">
            {conversation.other_user_avatar ? (
              <img
                src={conversation.other_user_avatar}
                alt={conversation.other_user_name || "User"}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-lg font-display text-muted-foreground">
                {(conversation.other_user_name || "U").charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          {/* Unread badge */}
          {conversation.unread_count > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-xs font-bold flex items-center justify-center text-primary-foreground">
              {conversation.unread_count > 9 ? "9+" : conversation.unread_count}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={`font-medium text-sm truncate ${conversation.unread_count > 0 ? "text-foreground" : "text-foreground/90"}`}>
              {conversation.other_user_name || "Unknown User"}
            </span>
            {conversation.other_user_verified && (
              <BadgeCheck className="w-4 h-4 text-gold fill-gold/20 flex-shrink-0" />
            )}
          </div>
          {conversation.other_user_handle && (
            <p className="text-xs text-muted-foreground truncate">{conversation.other_user_handle}</p>
          )}
          {conversation.last_message_content && (
            <p className={`text-sm truncate mt-0.5 ${conversation.unread_count > 0 ? "text-foreground/80" : "text-muted-foreground"}`}>
              {conversation.last_message_content}
            </p>
          )}
        </div>

        {/* Time */}
        {timeAgo && (
          <span className="text-xs text-muted-foreground flex-shrink-0">{timeAgo}</span>
        )}
      </button>

      {/* Delete button */}
      <motion.button
        onClick={onDelete}
        className="p-2 rounded-full hover:bg-white/10 text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
        whileTap={{ scale: 0.95 }}
        aria-label="Delete conversation"
      >
        <Trash2 className="w-4 h-4" />
      </motion.button>
    </motion.div>
  );
}

function ConversationsSkeleton() {
  return (
    <div className="space-y-0">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-3 p-4 border-b border-border/20">
          <Skeleton className="w-12 h-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-3 w-12" />
        </div>
      ))}
    </div>
  );
}

export default function Messages() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { conversations, isLoading, error, refetch } = useConversations();
  
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleBack = () => {
    triggerHaptic("light");
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/");
    }
  };

  const handleConversationClick = (conversationId: string) => {
    triggerHaptic("light");
    navigate(`/messages/${conversationId}`);
  };

  const handleDeleteClick = (e: React.MouseEvent, conversationId: string) => {
    e.stopPropagation();
    triggerHaptic("light");
    setSelectedConversationId(conversationId);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedConversationId || !user) return;
    
    setIsDeleting(true);
    try {
      // Update the participant record to set deleted_at
      const { error: updateError } = await supabase
        .from("conversation_participants")
        .update({ deleted_at: new Date().toISOString() })
        .eq("conversation_id", selectedConversationId)
        .eq("user_id", user.id);

      if (updateError) {
        console.error("[Messages] Delete error:", updateError);
        toast.error("Failed to delete conversation");
        return;
      }

      toast.success("Conversation deleted");
      setDeleteModalOpen(false);
      setSelectedConversationId(null);
      refetch();
    } catch (err) {
      console.error("[Messages] Unexpected delete error:", err);
      toast.error("Failed to delete conversation");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-carbon">
      <div className="w-full max-w-[1200px] mx-auto lg:px-8">
        {/* Header */}
        <div className="sticky top-0 z-40 bg-carbon/95 backdrop-blur-sm border-b border-border/30">
          <div className="flex items-center gap-3 px-4 py-3" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
            <motion.button
              onClick={handleBack}
              className="p-2 -ml-2 rounded-full hover:bg-white/5"
              whileTap={{ scale: 0.95 }}
            >
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </motion.button>
            <h1 className="font-display text-lg text-foreground">Messages</h1>
          </div>
        </div>

        {/* Content */}
        <div>
        {isLoading ? (
          <ConversationsSkeleton />
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 px-4">
            <p className="text-muted-foreground text-center">{error}</p>
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4">
            <div className="w-16 h-16 rounded-full bg-obsidian flex items-center justify-center mb-4">
              <MessageSquare className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-foreground font-medium mb-1">No messages yet</p>
            <p className="text-muted-foreground text-sm text-center">
              Start a conversation by tapping Message on someone's profile
            </p>
          </div>
        ) : (
          <div>
            {conversations.map((conv) => (
              <ConversationRow
                key={conv.conversation_id}
                conversation={conv}
                onClick={() => handleConversationClick(conv.conversation_id)}
                onDelete={(e) => handleDeleteClick(e, conv.conversation_id)}
              />
            ))}
          </div>
        )}
      </div>

        {/* Delete Confirmation Modal */}
        <DeleteConversationModal
          open={deleteModalOpen}
          onOpenChange={setDeleteModalOpen}
          onConfirm={handleConfirmDelete}
          isDeleting={isDeleting}
        />
      </div>
    </div>
  );
}

