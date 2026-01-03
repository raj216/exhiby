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
  desktopSize?: boolean;
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
  desktopSize = false,
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
      className={`w-full flex-shrink-0 snap-center flex flex-col ${isEnded ? 'opacity-75' : 'cursor-pointer'}`}
      whileHover={isEnded ? undefined : { scale: 1.02 }}
      whileTap={isEnded ? undefined : { scale: 0.98 }}
      onClick={handleCardTap}
    >
      {/* Image Container with badges and buttons */}
      <div className={`poster-card relative w-full ${desktopSize ? 'aspect-[3/4]' : ''}`} style={{ minHeight: desktopSize ? undefined : '240px' }}>
        {/* Background - simulated blurred video */}
        <div className="absolute inset-0 bg-gradient-to-b from-obsidian/50 to-carbon rounded-xl overflow-hidden">
          <img
            src={coverImage}
            alt=""
            className={`w-full h-full object-cover opacity-30 blur-sm ${isEnded ? 'grayscale' : ''}`}
          />
        </div>

        {/* Cover Image Overlay */}
        <div className="absolute inset-3 rounded-lg overflow-hidden shadow-deep">
          <img
            src={coverImage}
            alt={title}
            className={`w-full h-full object-cover ${isEnded ? 'grayscale' : ''}`}
          />
        </div>

        {/* Top Badge - LIVE or ENDED with viewer count */}
        <div className="absolute top-5 left-5">
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
        <h3 className="font-display text-base sm:text-lg text-foreground font-semibold line-clamp-2 leading-tight">
          {title}
        </h3>
        <p className="text-sm text-muted-foreground mt-1">{artistName}</p>
      </div>
    </motion.div>
  );
}
