import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { triggerHaptic } from "@/lib/haptics";

interface LiveAccessCardProps {
  eventId: string;
  title: string;
  thumbnailUrl?: string | null;
  liveStartedAt?: string | null;
  isOwnProfile?: boolean;
}

export function LiveAccessCard({ 
  eventId, 
  title, 
  thumbnailUrl, 
  liveStartedAt,
  isOwnProfile = false 
}: LiveAccessCardProps) {
  const navigate = useNavigate();

  const handleJoin = () => {
    triggerHaptic("medium");
    navigate(`/live/${eventId}`);
  };

  // Calculate "Started X min ago"
  const getStartedLabel = () => {
    if (!liveStartedAt) return null;
    const startedDate = new Date(liveStartedAt);
    const now = new Date();
    const diffMs = now.getTime() - startedDate.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    
    if (diffMin < 1) return "Just started";
    if (diffMin === 1) return "Started 1 min ago";
    if (diffMin < 60) return `Started ${diffMin} min ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours === 1) return "Started 1 hour ago";
    return `Started ${diffHours} hours ago`;
  };

  const startedLabel = getStartedLabel();
  const ctaText = isOwnProfile ? "Go to Live Room" : "Join Live";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      onClick={handleJoin}
      className="relative overflow-hidden rounded-2xl cursor-pointer group"
      style={{
        background: "rgba(20, 20, 20, 0.85)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: "1px solid rgba(255, 59, 48, 0.4)",
        boxShadow: "0 0 40px rgba(255, 59, 48, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
      }}
    >
      {/* Inner glow effect */}
      <div 
        className="absolute inset-0 opacity-40 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at top left, rgba(255, 59, 48, 0.2), transparent 50%)",
        }}
      />

      <div className="relative flex items-center gap-4 p-4">
        {/* Thumbnail */}
        <div className="relative w-24 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-obsidian border border-border/30">
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-obsidian to-carbon">
              <div className="w-3 h-3 rounded-full bg-destructive animate-pulse" />
            </div>
          )}
          {/* Live overlay on thumbnail */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          {/* Pulsing dot on thumbnail */}
          <div className="absolute top-2 right-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive" />
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Live Now indicator */}
          <div className="flex items-center gap-2 mb-1">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: "#FF3B30" }} />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ background: "#FF3B30" }} />
            </span>
            <span 
              className="text-xs font-bold uppercase tracking-wide"
              style={{ color: "#FF3B30" }}
            >
              Live Now
            </span>
          </div>
          
          {/* Stream Title */}
          <p className="text-foreground font-semibold text-sm line-clamp-1">
            {title}
          </p>

          {/* Started time */}
          {startedLabel && (
            <p className="text-muted-foreground text-xs mt-0.5">
              {startedLabel}
            </p>
          )}
        </div>

        {/* Join Button */}
        <Button
          onClick={(e) => {
            e.stopPropagation();
            handleJoin();
          }}
          className="flex-shrink-0 rounded-full px-5 font-semibold text-white shadow-lg transition-all duration-200 hover:scale-105"
          style={{
            background: "linear-gradient(135deg, #FF3B30, #FF6B58)",
            boxShadow: "0 4px 20px rgba(255, 59, 48, 0.4)",
          }}
        >
          {ctaText}
        </Button>
      </div>

      {/* Animated border glow */}
      <motion.div
        className="absolute inset-0 rounded-2xl pointer-events-none"
        style={{
          border: "1px solid rgba(255, 59, 48, 0.3)",
        }}
        animate={{
          boxShadow: [
            "0 0 20px rgba(255, 59, 48, 0.15)",
            "0 0 35px rgba(255, 59, 48, 0.3)",
            "0 0 20px rgba(255, 59, 48, 0.15)",
          ],
        }}
        transition={{
          duration: 2.5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
    </motion.div>
  );
}
