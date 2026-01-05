import { motion } from "framer-motion";
import { Bell, BellRing, Calendar } from "lucide-react";
import { useState } from "react";
import { triggerClickHaptic } from "@/lib/haptics";
import { format } from "date-fns";

interface UpcomingEventCardProps {
  id: string;
  coverImage: string;
  title: string;
  scheduledAt: string;
  price: number;
  isFree: boolean;
  category?: string;
  artistName?: string;
  artistAvatar?: string;
  onClick?: () => void;
  onRemind?: () => void;
  desktopSize?: boolean;
}

export function UpcomingEventCard({
  id,
  coverImage,
  title,
  scheduledAt,
  price,
  isFree,
  category,
  artistName,
  artistAvatar,
  onClick,
  onRemind,
  desktopSize = false,
}: UpcomingEventCardProps) {
  const [reminded, setReminded] = useState(false);

  const handleRemind = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerClickHaptic();
    setReminded(!reminded);
    onRemind?.();
  };

  const handleCardTap = () => {
    triggerClickHaptic();
    onClick?.();
  };

  // Format the scheduled date
  const formatEventDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return format(date, "MMM d • h:mm a");
  };

  return (
    <motion.div
      className="w-full flex-shrink-0 snap-center flex flex-col cursor-pointer"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={handleCardTap}
    >
      {/* Artist Header - Above Image (if available) */}
      {artistName && (
        <div className="flex items-center gap-2 mb-2 px-1">
          {artistAvatar ? (
            <img 
              src={artistAvatar} 
              alt={artistName}
              className="w-8 h-8 rounded-full object-cover border border-border/30"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center border border-border/30">
              <span className="text-xs font-medium text-muted-foreground">
                {artistName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <span className="text-sm font-medium text-foreground truncate">{artistName}</span>
        </div>
      )}

      {/* Image Container */}
      <div 
        className={`poster-card relative w-full rounded-xl overflow-hidden ${desktopSize ? 'aspect-[4/5]' : ''}`} 
        style={{ minHeight: desktopSize ? undefined : '200px' }}
      >
        {/* Cover Image */}
        <img
          src={coverImage}
          alt={title}
          className="w-full h-full object-cover"
        />

        {/* Date Badge - Top Left */}
        <div className="absolute top-3 left-3">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-obsidian/80 backdrop-blur-sm border border-border/30">
            <Calendar className="w-3 h-3 text-electric" />
            <span className="text-xs font-medium text-foreground whitespace-nowrap">
              {formatEventDate(scheduledAt)}
            </span>
          </div>
        </div>

        {/* Price Badge - Top Right */}
        <div className="absolute top-3 right-3">
          <div className="inline-flex items-center px-2.5 py-1.5 rounded-full bg-electric shadow-lg">
            <span className="text-xs font-bold text-obsidian">
              {isFree ? "Free" : `$${price}`}
            </span>
          </div>
        </div>

        {/* Bottom Section - inside image */}
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-carbon via-carbon/80 to-transparent">
          <button 
            onClick={handleRemind}
            className={`w-full py-2 text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-all ${
              reminded 
                ? 'bg-electric text-obsidian' 
                : 'bg-obsidian/60 border border-electric/50 text-electric hover:bg-electric/10'
            }`}
          >
            {reminded ? (
              <>
                <BellRing className="w-4 h-4" />
                Reminder Set
              </>
            ) : (
              <>
                <Bell className="w-4 h-4" />
                Remind Me
              </>
            )}
          </button>
        </div>
      </div>

      {/* Info Section - below image */}
      <div className="pt-3 pb-1 px-1">
        {/* Title - 2 lines max */}
        <h3 className="font-display text-base sm:text-lg text-foreground font-semibold line-clamp-2 leading-tight">
          {title}
        </h3>
        
        {/* Category */}
        {category && (
          <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
            <span className="text-primary">{category}</span>
          </p>
        )}
      </div>
    </motion.div>
  );
}
