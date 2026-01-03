import { motion } from "framer-motion";
import { triggerClickHaptic } from "@/lib/haptics";
import { LiveBadge } from "./EventStatusBadge";

interface LiveMarqueeCardProps {
  id: string;
  coverImage: string;
  title: string;
  price: number;
  viewers: number;
  artistName: string;
  endedAt?: string | null;
  onClick?: () => void;
  layoutId?: string;
}

// Smart badge component based on price
function SmartBadge({ price }: { price: number }) {
  if (price === 0) {
    return (
      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-transparent border border-white/40 backdrop-blur-sm">
        <span className="text-xs sm:text-sm font-medium text-white whitespace-nowrap">🟢 Free Entry</span>
      </div>
    );
  }
  
  return (
    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 shadow-lg">
      <span className="text-xs sm:text-sm font-semibold text-white whitespace-nowrap">🎓 Masterclass • ${price}</span>
    </div>
  );
}

export function LiveMarqueeCard({
  id,
  coverImage,
  title,
  price,
  viewers,
  artistName,
  endedAt,
  onClick,
  layoutId,
}: LiveMarqueeCardProps) {
  const isEnded = !!endedAt;

  const handleJoin = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isEnded) return; // Don't allow joining ended streams
    triggerClickHaptic();
    onClick?.();
  };

  const handleCardTap = () => {
    if (isEnded) return; // Don't allow joining ended streams
    triggerClickHaptic();
    onClick?.();
  };

  return (
    <motion.div
      layoutId={layoutId || `room-card-${id}`}
      className={`poster-card w-full flex-shrink-0 snap-center ${isEnded ? 'opacity-75' : 'cursor-pointer'}`}
      style={{ minHeight: '300px' }}
      whileHover={isEnded ? undefined : { scale: 1.02 }}
      whileTap={isEnded ? undefined : { scale: 0.98 }}
      onClick={handleCardTap}
    >
      {/* Background - simulated blurred video */}
      <div className="absolute inset-0 bg-gradient-to-b from-obsidian/50 to-carbon">
        <img
          src={coverImage}
          alt=""
          className={`w-full h-full object-cover opacity-30 blur-sm ${isEnded ? 'grayscale' : ''}`}
        />
      </div>

      {/* Cover Image Overlay */}
      <div className="absolute inset-4 rounded-xl overflow-hidden shadow-deep">
        <img
          src={coverImage}
          alt={title}
          className={`w-full h-full object-cover ${isEnded ? 'grayscale' : ''}`}
        />
      </div>

      {/* Top Badge - LIVE or ENDED with viewer count */}
      <div className="absolute top-6 left-6">
        <LiveBadge viewers={viewers} endedAt={endedAt} size="md" />
      </div>

      {/* Bottom Info */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-carbon via-carbon/90 to-transparent">
        <h3 className="font-display text-lg sm:text-xl text-foreground mb-1 line-clamp-2">
          {title}
        </h3>
        <p className="text-sm text-muted-foreground mb-3">{artistName}</p>

        {/* Smart Badge (left) + Join Button (right) - stacked on narrow cards */}
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
    </motion.div>
  );
}
