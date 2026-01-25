import { motion } from "framer-motion";
import { Bell, MessageCircle, Heart, Loader2 } from "lucide-react";
import { triggerClickHaptic } from "@/lib/haptics";

interface ProfileActionBarProps {
  isFollowing: boolean;
  isFollowLoading?: boolean;
  onFollowClick: () => void;
  onMessageClick: () => void;
  onSupportClick: () => void;
}

export function ProfileActionBar({
  isFollowing,
  isFollowLoading = false,
  onFollowClick,
  onMessageClick,
  onSupportClick,
}: ProfileActionBarProps) {
  const handleFollow = () => {
    if (isFollowLoading) return;
    triggerClickHaptic();
    onFollowClick();
  };

  const handleMessage = () => {
    triggerClickHaptic();
    onMessageClick();
  };

  const handleSupport = () => {
    triggerClickHaptic();
    onSupportClick();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="flex gap-3 px-4 mt-6"
    >
      {/* Follow Button - Electric Clay when not following */}
      <motion.button
        whileTap={isFollowLoading ? undefined : { scale: 0.95 }}
        onClick={handleFollow}
        disabled={isFollowLoading}
        className={`flex-1 py-3 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-70 ${
          isFollowing
            ? "bg-obsidian border border-border text-foreground"
            : "text-white shadow-electric"
        }`}
        style={!isFollowing ? {
          background: "linear-gradient(135deg, hsl(7 100% 67%), hsl(345 100% 50%))"
        } : undefined}
      >
        {isFollowLoading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Bell className={`w-5 h-5 ${isFollowing ? "fill-electric text-electric" : ""}`} />
        )}
        <span>{isFollowLoading ? (isFollowing ? "Unfollowing..." : "Following...") : (isFollowing ? "Following" : "Follow")}</span>
      </motion.button>

      {/* Message Button */}
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={handleMessage}
        className="flex-1 py-3 rounded-2xl bg-obsidian border border-border font-semibold flex items-center justify-center gap-2 text-foreground hover:bg-muted transition-colors"
      >
        <MessageCircle className="w-5 h-5" />
        <span>Message</span>
      </motion.button>

      {/* Tip Button - Gold accent */}
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={handleSupport}
        className="py-3 px-5 rounded-2xl font-semibold flex items-center justify-center gap-2 text-carbon shadow-gold"
        style={{
          background: "linear-gradient(135deg, hsl(43 72% 52%), hsl(38 80% 45%))"
        }}
      >
        <Heart className="w-5 h-5" />
        <span>Tip</span>
      </motion.button>
    </motion.div>
  );
}