import { motion } from "framer-motion";
import { Bell, MessageCircle, Heart } from "lucide-react";
import { triggerClickHaptic } from "@/lib/haptics";
import { LoadingButton } from "@/components/ui/loading-button";
import { Skeleton } from "@/components/ui/skeleton";

interface ProfileActionBarProps {
  isFollowing: boolean;
  isFollowLoading?: boolean;
  isLoading?: boolean;
  onFollowClick: () => void;
  onMessageClick: () => void;
  onSupportClick: () => void;
}

function ProfileActionBarSkeleton() {
  return (
    <div className="flex gap-3 px-4 mt-6 animate-fade-in">
      {/* Follow button skeleton */}
      <Skeleton className="flex-1 h-12 rounded-2xl" />
      {/* Message button skeleton */}
      <Skeleton className="flex-1 h-12 rounded-2xl" />
      {/* Tip button skeleton */}
      <Skeleton className="w-24 h-12 rounded-2xl" />
    </div>
  );
}

export function ProfileActionBar({
  isFollowing,
  isFollowLoading = false,
  isLoading = false,
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

  // Show skeleton while loading
  if (isLoading) {
    return <ProfileActionBarSkeleton />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="flex gap-3 px-4 mt-6"
    >
      {/* Follow Button - Electric Clay when not following */}
      <LoadingButton
        loading={isFollowLoading}
        loadingText={isFollowing ? "Unfollowing..." : "Following..."}
        onClick={handleFollow}
        className={`flex-1 py-3 rounded-2xl font-semibold transition-all ${
          isFollowing
            ? "bg-obsidian border border-border text-foreground hover:bg-muted"
            : "text-white shadow-electric hover:opacity-90"
        }`}
        style={!isFollowing ? {
          background: "linear-gradient(135deg, hsl(7 100% 67%), hsl(345 100% 50%))"
        } : undefined}
      >
        <Bell className={`w-5 h-5 ${isFollowing ? "fill-electric text-electric" : ""}`} />
        <span>{isFollowing ? "Following" : "Follow"}</span>
      </LoadingButton>

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

// Export skeleton for external use
export { ProfileActionBarSkeleton };
