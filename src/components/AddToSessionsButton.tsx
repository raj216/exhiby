import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Check, Loader2 } from "lucide-react";
import { useSavedSessions } from "@/hooks/useSavedSessions";
import { useAuth } from "@/contexts/AuthContext";
import { triggerClickHaptic } from "@/lib/haptics";
import { toast } from "sonner";

interface AddToSessionsButtonProps {
  eventId: string;
  creatorId: string;
  variant?: "default" | "compact" | "icon";
  className?: string;
}

export function AddToSessionsButton({
  eventId,
  creatorId,
  variant = "default",
  className = "",
}: AddToSessionsButtonProps) {
  const { user } = useAuth();
  const { isEventSaved, saveSession, removeSession } = useSavedSessions();
  const [isLoading, setIsLoading] = useState(false);

  const isSaved = isEventSaved(eventId);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerClickHaptic();

    if (!user) {
      toast.error("Please sign in to save sessions");
      return;
    }

    // Don't allow saving your own events
    if (user.id === creatorId) {
      toast.info("This is your own session");
      return;
    }

    setIsLoading(true);

    try {
      if (isSaved) {
        const success = await removeSession(eventId);
        if (success) {
          toast.success("Removed from My Sessions");
        } else {
          toast.error("Failed to remove session");
        }
      } else {
        const success = await saveSession(eventId, creatorId);
        if (success) {
          toast.success("Added to My Sessions! You'll get reminders.");
        } else {
          toast.error("Failed to save session");
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (variant === "icon") {
    return (
      <button
        onClick={handleClick}
        disabled={isLoading}
        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
          isSaved
            ? "bg-electric/20 border border-electric/50 text-electric"
            : "bg-muted/50 border border-border/40 text-muted-foreground hover:bg-muted/70"
        } ${className}`}
        title={isSaved ? "Remove from My Sessions" : "Add to My Sessions"}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isSaved ? (
          <Check className="w-4 h-4" />
        ) : (
          <Plus className="w-4 h-4" />
        )}
      </button>
    );
  }

  if (variant === "compact") {
    return (
      <button
        onClick={handleClick}
        disabled={isLoading}
        className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all ${
          isSaved
            ? "bg-electric/15 border border-electric/40 text-electric"
            : "bg-muted/50 border border-border/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground"
        } ${className}`}
      >
        {isLoading ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : isSaved ? (
          <>
            <Check className="w-3 h-3" />
            Added
          </>
        ) : (
          <>
            <Plus className="w-3 h-3" />
            Add
          </>
        )}
      </button>
    );
  }

  return (
    <motion.button
      onClick={handleClick}
      disabled={isLoading}
      whileTap={{ scale: 0.95 }}
      className={`w-full py-2.5 text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-all ${
        isSaved
          ? "bg-electric/15 text-electric border border-electric/50"
          : "bg-muted/50 text-foreground border border-border/40 hover:bg-muted/70"
      } ${className}`}
    >
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.span
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2"
          >
            <Loader2 className="w-4 h-4 animate-spin" />
            Saving...
          </motion.span>
        ) : isSaved ? (
          <motion.span
            key="saved"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            Added ✓
          </motion.span>
        ) : (
          <motion.span
            key="add"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add to My Sessions
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
