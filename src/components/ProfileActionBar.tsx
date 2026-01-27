import { motion } from "framer-motion";
import { Heart } from "lucide-react";
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
    <div className="grid grid-cols-3 gap-3 px-4 mt-6 animate-fade-in">
      <Skeleton className="h-11 rounded-2xl" />
      <Skeleton className="h-11 rounded-2xl" />
      <Skeleton className="h-11 rounded-2xl" />
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
      className="grid grid-cols-3 gap-3 px-4 mt-6"
    >
      {/* Follow Button - Text only */}
      <LoadingButton
        loading={isFollowLoading}
        loadingText="..."
        onClick={handleFollow}
        className={`h-11 rounded-2xl text-sm font-medium transition-all flex items-center justify-center ${
          isFollowing
            ? "bg-white/10 text-white hover:bg-white/15"
            : "bg-white text-carbon hover:bg-white/90"
        }`}
      >
        {isFollowing ? "Following" : "Follow"}
      </LoadingButton>

      {/* Message Button - Text only */}
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={handleMessage}
        className="h-11 rounded-2xl bg-white/10 text-sm font-medium flex items-center justify-center text-white hover:bg-white/15 transition-colors"
      >
        Message
      </motion.button>

      {/* Tip Button - With icon, Gold accent */}
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={handleSupport}
        className="h-11 rounded-2xl bg-yellow-500 text-sm font-medium flex items-center justify-center gap-2 text-carbon hover:bg-yellow-400 transition-colors"
      >
        <Heart className="w-4 h-4" />
        Tip
      </motion.button>
    </motion.div>
  );
}

// Export skeleton for external use
export { ProfileActionBarSkeleton };
