import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Calendar, Clock, UserPlus, Home, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { triggerClickHaptic } from "@/lib/haptics";

interface SessionEndedScreenProps {
  title: string;
  artistName: string;
  artistAvatar: string | null;
  scheduledAt: Date;
  creatorId: string;
  isMissed: boolean;
  onRemove?: () => void;
  onBack: () => void;
}

export function SessionEndedScreen({
  title,
  artistName,
  artistAvatar,
  scheduledAt,
  creatorId,
  isMissed,
  onRemove,
  onBack,
}: SessionEndedScreenProps) {
  const navigate = useNavigate();

  const handleViewCreator = () => {
    triggerClickHaptic();
    navigate(`/creator/${creatorId}`);
  };

  const handleBackToHome = () => {
    triggerClickHaptic();
    onBack();
  };

  const handleRemove = () => {
    triggerClickHaptic();
    onRemove?.();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-carbon flex flex-col"
    >
      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        {/* Artist Avatar */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          {artistAvatar ? (
            <img
              src={artistAvatar}
              alt={artistName}
              className="w-24 h-24 rounded-full object-cover border-2 border-border/50"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center text-3xl font-display text-muted-foreground border-2 border-border/50">
              {artistName.charAt(0).toUpperCase()}
            </div>
          )}
        </motion.div>

        {/* Status Badge */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className={`px-3 py-1 rounded-full text-xs font-medium mb-4 ${
            isMissed
              ? "bg-muted text-muted-foreground"
              : "bg-muted/50 text-muted-foreground"
          }`}
        >
          {isMissed ? "Session Missed" : "Session Ended"}
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="font-display text-2xl text-foreground mb-2"
        >
          {title}
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="text-muted-foreground text-sm mb-2"
        >
          This studio session is over.
        </motion.p>

        {/* Creator Line */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-muted-foreground text-sm"
        >
          by {artistName}
        </motion.p>

        {/* Session Details */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="flex items-center gap-4 mt-4 text-xs text-muted-foreground"
        >
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {scheduledAt.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {scheduledAt.toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
        </motion.div>
      </div>

      {/* Action Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="p-6 pb-safe space-y-3"
      >
        {/* Primary CTA - View Creator */}
        <Button
          onClick={handleViewCreator}
          className="w-full h-12 bg-foreground text-background hover:bg-foreground/90 font-medium"
        >
          <UserPlus className="w-4 h-4 mr-2" />
          View {artistName}
        </Button>

        {/* Secondary CTA - Back to Home */}
        <Button
          onClick={handleBackToHome}
          variant="outline"
          className="w-full h-12 border-border/50 text-foreground hover:bg-muted/50"
        >
          <Home className="w-4 h-4 mr-2" />
          Back to Home
        </Button>

        {/* Remove from list */}
        {onRemove && (
          <Button
            onClick={handleRemove}
            variant="ghost"
            className="w-full h-10 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Remove from My Sessions
          </Button>
        )}
      </motion.div>
    </motion.div>
  );
}
