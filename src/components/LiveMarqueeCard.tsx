import { motion } from "framer-motion";
import { triggerClickHaptic } from "@/lib/haptics";
import { LiveBadge } from "./EventStatusBadge";

interface LiveMarqueeCardProps {
  id: string;
  coverImage: string;
  title: string;
  description?: string;
  price: number;
  viewers: number;
  artistName: string;
  artistAvatar?: string;
  category?: string;
  endedAt?: string | null;
  onClick?: () => void;
  layoutId?: string;
  desktopSize?: boolean;
}

// Smart badge component based on price
function SmartBadge({ price }: { price: number }) {
  if (price === 0) {
    return (
      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/80 border border-border/50 backdrop-blur-sm">
        <span className="text-xs sm:text-sm font-medium text-muted-foreground whitespace-nowrap">Free Entry</span>
      </div>
    );
  }
  
  return (
    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent/15 border border-accent/40 shadow-lg">
      <span className="text-xs sm:text-sm font-semibold text-accent whitespace-nowrap">🎓 Masterclass • ${price}</span>
    </div>
  );
}

export function LiveMarqueeCard({
  id,
  coverImage,
  title,
  description,
  price,
  viewers,
  artistName,
  artistAvatar,
  category,
  endedAt,
  onClick,
  layoutId,
  desktopSize = false,
}: LiveMarqueeCardProps) {
  const isEnded = !!endedAt;

  const handleJoin = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isEnded) return;
    triggerClickHaptic();
    onClick?.();
  };

  const handleCardTap = () => {
    if (isEnded) return;
    triggerClickHaptic();
    onClick?.();
  };

  return (
    <motion.div
      layoutId={layoutId || `room-card-${id}`}
      className={`w-full flex-shrink-0 snap-center flex flex-col ${isEnded ? 'opacity-75' : 'cursor-pointer'}`}
      whileHover={isEnded ? undefined : { scale: 1.02 }}
      whileTap={isEnded ? undefined : { scale: 0.98 }}
      onClick={handleCardTap}
    >
      {/* Artist Header - Above Image */}
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

      {/* Image Container with LIVE badge */}
      <div className={`poster-card relative w-full rounded-xl overflow-hidden ${desktopSize ? 'aspect-[4/5]' : ''}`} style={{ minHeight: desktopSize ? undefined : '200px' }}>
        {/* Cover Image */}
        <img
          src={coverImage}
          alt={title}
          className={`w-full h-full object-cover ${isEnded ? 'grayscale' : ''}`}
        />

        {/* LIVE Badge - Top Left */}
        <div className="absolute top-3 left-3">
          <LiveBadge viewers={viewers} endedAt={endedAt} size="md" />
        </div>

        {/* Bottom Buttons - inside image */}
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-carbon via-carbon/80 to-transparent">
          <div className="flex flex-col gap-2">
            <SmartBadge price={price} />
            {isEnded ? (
              <div className="w-full py-2 text-sm font-medium text-center text-muted-foreground bg-muted/50 rounded-lg">
                Stream Ended
              </div>
            ) : (
              <button 
                onClick={handleJoin}
                className="btn-electric w-full py-2 text-sm font-semibold"
              >
                Join
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Info Section - below image */}
      <div className="pt-3 pb-1 px-1">
        {/* Title - 2 lines max */}
        <h3 className="font-display text-base sm:text-lg text-foreground font-semibold line-clamp-2 leading-tight">
          {title}
        </h3>
        
        {/* Category • Description */}
        <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
          {category && (
            <span>{category}</span>
          )}
          {category && description && (
            <span className="mx-1">•</span>
          )}
          {description && (
            <span>{description}</span>
          )}
          {!category && !description && (
            <span>Studio session</span>
          )}
        </p>
      </div>
    </motion.div>
  );
}
