import { useState } from "react";
import { motion } from "framer-motion";
import { Bell, BellRing, Clock } from "lucide-react";

interface ScheduledCardProps {
  coverImage: string;
  title: string;
  price: number;
  artistName: string;
  startsIn: string;
}

export function ScheduledCard({
  coverImage,
  title,
  price,
  artistName,
  startsIn,
}: ScheduledCardProps) {
  const [reminded, setReminded] = useState(false);

  return (
    <motion.div
      className="relative w-44 flex-shrink-0 snap-center"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Card */}
      <div className="rounded-2xl overflow-hidden bg-card shadow-card">
        {/* Image */}
        <div className="relative aspect-square">
          <img
            src={coverImage}
            alt={title}
            className="w-full h-full object-cover"
          />
          {/* Time Badge */}
          <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-full glass">
            <Clock className="w-3 h-3 text-primary" />
            <span className="text-xs font-medium text-foreground">
              {startsIn}
            </span>
          </div>
        </div>

        {/* Info */}
        <div className="p-3">
          <h4 className="font-medium text-sm text-foreground line-clamp-1 mb-0.5">
            {title}
          </h4>
          <p className="text-xs text-muted-foreground mb-2">{artistName}</p>

          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-primary">
              {price === 0 ? "Free" : `$${price}`}
            </span>

            {/* Remind Button */}
            <button
              onClick={() => setReminded(!reminded)}
              className={`p-2 rounded-full transition-colors ${
                reminded
                  ? "bg-primary text-primary-foreground"
                  : "bg-surface-elevated text-muted-foreground hover:text-foreground"
              }`}
            >
              {reminded ? (
                <BellRing className="w-4 h-4" />
              ) : (
                <Bell className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
