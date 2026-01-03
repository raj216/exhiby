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
  isOwnProfile = false,
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
      className="relative overflow-hidden rounded-2xl cursor-pointer group glass border border-live/30 shadow-electric"
    >
      {/* Inner glow effect */}
      <div
        className="absolute inset-0 opacity-40 pointer-events-none bg-[radial-gradient(ellipse_at_top_left,hsl(var(--live)/0.25),transparent_55%)]"
      />

      <div className="relative flex items-center gap-4 p-4">
        {/* Thumbnail */}
        <div className="relative w-24 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-obsidian border border-border/30">
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={`Live stream thumbnail for ${title}`}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-obsidian to-carbon">
              <div className="w-3 h-3 rounded-full bg-live animate-pulse" />
            </div>
          )}

          {/* Live overlay on thumbnail */}
          <div className="absolute inset-0 bg-gradient-to-t from-background/70 to-transparent" />

          {/* Pulsing dot on thumbnail */}
          <div className="absolute top-2 right-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-live opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-live" />
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Live Now indicator */}
          <div className="flex items-center gap-2 mb-1">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-live opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-live" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wide text-live">Live Now</span>
          </div>

          {/* Stream Title */}
          <p className="text-foreground font-semibold text-sm line-clamp-1">{title}</p>

          {/* Started time */}
          {startedLabel && (
            <p className="text-muted-foreground text-xs mt-0.5">{startedLabel}</p>
          )}
        </div>

        {/* Join Button */}
        <Button
          onClick={(e) => {
            e.stopPropagation();
            handleJoin();
          }}
          className="flex-shrink-0 rounded-full px-5 font-semibold text-primary-foreground shadow-electric transition-all duration-200 hover:scale-105 bg-gradient-electric"
        >
          {ctaText}
        </Button>
      </div>

      {/* Animated border glow */}
      <motion.div
        className="absolute inset-0 rounded-2xl pointer-events-none"
        animate={{
          boxShadow: [
            "0 0 20px hsl(var(--live) / 0.15)",
            "0 0 35px hsl(var(--live) / 0.30)",
            "0 0 20px hsl(var(--live) / 0.15)",
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
