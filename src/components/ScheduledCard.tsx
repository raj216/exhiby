import { useState } from "react";
import { motion } from "framer-motion";
import { Bell, BellRing, Clock } from "lucide-react";
import { triggerClickHaptic } from "@/lib/haptics";
import { EventStatusBadge } from "./EventStatusBadge";
import { useEventStatus, EventTiming } from "@/hooks/useEventStatus";

interface ScheduledCardProps {
  coverImage: string;
  title: string;
  price: number;
  artistName: string;
  // New timing-based prop
  timing?: EventTiming;
  // Legacy prop for backward compatibility
  startsIn?: string;
}

export function ScheduledCard({
  coverImage,
  title,
  price,
  artistName,
  timing,
  startsIn,
}: ScheduledCardProps) {
  const [reminded, setReminded] = useState(false);
  
  // Use the new event status hook if timing is provided
  const eventStatus = useEventStatus(timing || null);

  const handleRemind = () => {
    triggerClickHaptic();
    setReminded(!reminded);
  };

  // Get countdown label from hook or fallback to startsIn
  const countdownLabel = timing ? eventStatus.countdownLabel : startsIn;

  return (
    <motion.div
      className="relative w-full flex-shrink-0 snap-center"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Card */}
      <div className="rounded-2xl overflow-hidden bg-obsidian shadow-card border border-border/30">
        {/* Image */}
        <div className="relative aspect-square">
          <img
            src={coverImage}
            alt={title}
            className="w-full h-full object-cover"
          />
          
          {/* Status Badge */}
          <div className="absolute top-2 left-2">
            {timing ? (
              <EventStatusBadge
                status={eventStatus.status}
                countdownLabel={eventStatus.countdownLabel}
                size="sm"
              />
            ) : (
              <div className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-full glass min-h-[28px]">
                <Clock className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                <span className="text-xs font-medium text-foreground whitespace-nowrap leading-none">
                  {countdownLabel}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="p-3">
          <h4 className="font-medium text-sm text-foreground line-clamp-1 mb-0.5">
            {title}
          </h4>
          <p className="text-xs text-muted-foreground mb-2">{artistName}</p>

          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">
              {price === 0 ? "Free" : `$${price}`}
            </span>

            {/* Remind Button */}
            <button
              onClick={handleRemind}
              className={`p-2 rounded-full transition-all duration-luxury ease-luxury ${
                reminded
                  ? "bg-muted text-foreground border border-border/50"
                  : "bg-obsidian text-muted-foreground hover:text-foreground border border-border/50"
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
