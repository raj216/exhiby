import { motion } from "framer-motion";
import { Bell, MessageCircle, Heart } from "lucide-react";

interface ProfileActionBarProps {
  isFollowing: boolean;
  onFollowClick: () => void;
  onMessageClick: () => void;
  onSupportClick: () => void;
}

export function ProfileActionBar({
  isFollowing,
  onFollowClick,
  onMessageClick,
  onSupportClick,
}: ProfileActionBarProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="flex gap-3 px-4 mt-6"
    >
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={onFollowClick}
        className={`flex-1 py-3 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all ${
          isFollowing
            ? "bg-muted border border-border text-foreground"
            : "bg-primary text-primary-foreground"
        }`}
      >
        <Bell className={`w-5 h-5 ${isFollowing ? "fill-primary text-primary" : ""}`} />
        <span>{isFollowing ? "Following" : "Follow"}</span>
      </motion.button>

      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={onMessageClick}
        className="flex-1 py-3 rounded-2xl bg-muted border border-border font-semibold flex items-center justify-center gap-2 text-foreground hover:bg-muted/80 transition-colors"
      >
        <MessageCircle className="w-5 h-5" />
        <span>Message</span>
      </motion.button>

      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={onSupportClick}
        className="py-3 px-5 rounded-2xl bg-gradient-to-r from-primary to-amber-500 font-semibold flex items-center justify-center gap-2 text-primary-foreground"
      >
        <Heart className="w-5 h-5" />
        <span>Tip</span>
      </motion.button>
    </motion.div>
  );
}
