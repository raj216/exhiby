import { motion } from "framer-motion";

interface LiveMarqueeCardProps {
  coverImage: string;
  title: string;
  price: number;
  viewers: number;
  artistName: string;
}

export function LiveMarqueeCard({
  coverImage,
  title,
  price,
  viewers,
  artistName,
}: LiveMarqueeCardProps) {
  return (
    <motion.div
      className="poster-card w-72 flex-shrink-0 snap-center"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Background - simulated blurred video */}
      <div className="absolute inset-0 bg-gradient-to-b from-muted/50 to-background">
        <img
          src={coverImage}
          alt=""
          className="w-full h-full object-cover opacity-30 blur-sm"
        />
      </div>

      {/* Cover Image Overlay */}
      <div className="absolute inset-4 rounded-xl overflow-hidden shadow-2xl">
        <img
          src={coverImage}
          alt={title}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Top Badge - LIVE */}
      <div className="absolute top-6 left-6 flex items-center gap-2 px-3 py-1.5 rounded-full glass">
        <div className="relative">
          <div className="w-2 h-2 rounded-full bg-live" />
          <div className="absolute inset-0 w-2 h-2 rounded-full bg-live animate-ping" />
        </div>
        <span className="text-xs font-semibold text-foreground">LIVE</span>
        <span className="text-xs text-muted-foreground">
          {viewers} watching
        </span>
      </div>

      {/* Bottom Info */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background/80 to-transparent">
        <h3 className="font-serif text-xl text-foreground mb-1 line-clamp-2">
          {title}
        </h3>
        <p className="text-sm text-muted-foreground mb-3">{artistName}</p>

        {/* Entry Price */}
        <div className="flex items-center justify-between">
          <div className="px-3 py-1.5 rounded-full bg-surface-elevated">
            <span className="text-sm font-medium text-primary">
              {price === 0 ? "Free Entry" : `Entry: $${price}`}
            </span>
          </div>
          <button className="px-4 py-2 rounded-full bg-gradient-gold text-primary-foreground text-sm font-semibold shadow-gold">
            Join
          </button>
        </div>
      </div>
    </motion.div>
  );
}
