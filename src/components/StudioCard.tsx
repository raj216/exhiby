import { motion } from "framer-motion";
import { triggerHaptic } from "@/lib/haptics";

export type CreatorStatus = "live" | "scheduled" | "offline";

export interface StudioCardProps {
  id: string;
  image: string;
  artistName: string;
  status: CreatorStatus;
  scheduledTime?: string;
  eventTitle?: string;
  price?: number;
  onTap: (status: CreatorStatus) => void;
}

export function StudioCard({
  id,
  image,
  artistName,
  status,
  scheduledTime,
  onTap,
}: StudioCardProps) {
  const handleTap = () => {
    triggerHaptic("light");
    onTap(status);
  };

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
        {status === "live" && (
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

        {status === "scheduled" && scheduledTime && (
          <div className="absolute top-2 left-2 px-2 py-1 rounded-full bg-carbon/80 backdrop-blur-sm border border-border/30">
            <span className="text-[10px] font-medium text-muted-foreground">
              {scheduledTime}
            </span>
          </div>
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
