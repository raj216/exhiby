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
  onClick?: () => void;
  layoutId?: string;
}

export function LiveMarqueeCard({
  id,
  coverImage,
  title,
  price,
  viewers,
  artistName,
  onClick,
  layoutId,
}: LiveMarqueeCardProps) {
  const handleJoin = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerClickHaptic();
    onClick?.();
  };

  const handleCardTap = () => {
    triggerClickHaptic();
    onClick?.();
  };

  return (
    <motion.div
      layoutId={layoutId || `room-card-${id}`}
      className="poster-card w-full flex-shrink-0 snap-center cursor-pointer"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={handleCardTap}
    >
      {/* Background - simulated blurred video */}
      <div className="absolute inset-0 bg-gradient-to-b from-obsidian/50 to-carbon">
        <img
          src={coverImage}
          alt=""
          className="w-full h-full object-cover opacity-30 blur-sm"
        />
      </div>

      {/* Cover Image Overlay */}
      <div className="absolute inset-4 rounded-xl overflow-hidden shadow-deep">
        <img
          src={coverImage}
          alt={title}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Top Badge - LIVE with viewer count */}
      <div className="absolute top-6 left-6">
        <LiveBadge viewers={viewers} size="md" />
      </div>

      {/* Bottom Info */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-carbon via-carbon/90 to-transparent">
        <h3 className="font-display text-xl text-foreground mb-1 line-clamp-2">
          {title}
        </h3>
        <p className="text-sm text-muted-foreground mb-3">{artistName}</p>

        {/* Entry Price - Gold accent */}
        <div className="flex items-center justify-between">
          <div className="price-tag">
            {price === 0 ? "Free Entry" : `Entry: $${price}`}
          </div>
          <button 
            onClick={handleJoin}
            className="btn-electric px-4 py-2 text-sm"
          >
            Join
          </button>
        </div>
      </div>
    </motion.div>
  );
}
