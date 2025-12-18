import { motion } from "framer-motion";
import { triggerHaptic } from "@/lib/haptics";
import { EventStatusBadge } from "./EventStatusBadge";
import { useEventStatus, EventTiming } from "@/hooks/useEventStatus";

export type CreatorStatus = "live" | "scheduled" | "offline";

export interface StudioCardProps {
  id: string;
  image: string;
  artistName: string;
  // New timing-based props
  timing?: EventTiming;
  // Legacy props for backward compatibility
  status?: CreatorStatus;
  scheduledTime?: string;
  eventTitle?: string;
  price?: number;
  onTap: (status: CreatorStatus) => void;
}

export function StudioCard({
  id,
  image,
  artistName,
  timing,
  status: legacyStatus,
  scheduledTime,
  onTap,
}: StudioCardProps) {
  // Use the new event status hook if timing is provided
  const eventStatus = useEventStatus(timing || null);

  // Determine the effective status
  const effectiveStatus: CreatorStatus = timing
    ? eventStatus.isLive
      ? "live"
      : eventStatus.isUpcoming
      ? "scheduled"
      : "offline"
    : legacyStatus || "offline";

  const handleTap = () => {
    triggerHaptic("light");
    onTap(effectiveStatus);
  };

  // Get countdown label from hook or fallback to scheduledTime
  const countdownLabel = timing ? eventStatus.countdownLabel : scheduledTime;

  return (
    <motion.div
      className="flex-shrink-0 snap-start cursor-pointer"
      whileTap={{ scale: 0.95 }}
      onClick={handleTap}
    >
      {/* Square Card */}
      <div className="relative w-28 aspect-square rounded-xl overflow-hidden bg-obsidian border border-border/20">
        {/* Artwork Image */}
        <img
          src={image}
          alt={artistName}
          className="w-full h-full object-cover"
        />

        {/* Status Badge - Top Left */}
        {timing ? (
          <div className="absolute top-2 left-2">
            <EventStatusBadge
              status={eventStatus.status}
              countdownLabel={eventStatus.countdownLabel}
              size="sm"
            />
          </div>
        ) : (
          <>
            {effectiveStatus === "live" && (
              <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-full bg-carbon/80 backdrop-blur-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-crimson opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-crimson" />
                </span>
                <span className="text-[10px] font-semibold text-crimson uppercase tracking-wide">
                  Live
                </span>
              </div>
            )}

            {effectiveStatus === "scheduled" && scheduledTime && (
              <div className="absolute top-2 left-2 inline-flex items-center justify-center px-2.5 py-1.5 rounded-full bg-carbon/80 backdrop-blur-sm border border-border/30">
                <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap leading-none">
                  {scheduledTime}
                </span>
              </div>
            )}
          </>
        )}

        {/* Offline = No badge, clean image */}
      </div>

      {/* Creator Name */}
      <p className="mt-2 text-xs text-muted-foreground text-center truncate max-w-28">
        {artistName}
      </p>
    </motion.div>
  );
}
