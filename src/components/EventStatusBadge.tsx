import { motion } from "framer-motion";
import { EventStatus } from "@/hooks/useEventStatus";

interface EventStatusBadgeProps {
  status: EventStatus;
  countdownLabel?: string;
  viewers?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function EventStatusBadge({
  status,
  countdownLabel,
  viewers,
  size = "sm",
  className = "",
}: EventStatusBadgeProps) {
  // Don't render anything for ENDED status
  if (status === "ENDED") {
    return null;
  }

  // Size configurations
  const sizeStyles = {
    sm: {
      wrapper: "px-2.5 py-1.5 gap-1.5",
      text: "text-[10px]",
      dot: "w-2 h-2",
    },
    md: {
      wrapper: "px-3 py-1.5 gap-2",
      text: "text-xs",
      dot: "w-2 h-2",
    },
    lg: {
      wrapper: "px-3.5 py-2 gap-2",
      text: "text-sm",
      dot: "w-2.5 h-2.5",
    },
  };

  const styles = sizeStyles[size];

  if (status === "LIVE") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`
          inline-flex items-center justify-center
          ${styles.wrapper}
          rounded-full
          bg-carbon/90 backdrop-blur-sm
          border border-crimson/30
          min-h-[28px]
          ${className}
        `}
      >
        {/* Pulsing red dot */}
        <span className="relative flex-shrink-0">
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-crimson opacity-75`}
            style={{ width: styles.dot.split(" ")[0].replace("w-", "") + "px" }}
          />
          <span className={`relative inline-flex rounded-full ${styles.dot} bg-crimson`} />
        </span>

        {/* LIVE text */}
        <span className={`${styles.text} font-semibold text-crimson uppercase tracking-wide leading-none`}>
          LIVE
        </span>

        {/* Optional viewer count */}
        {viewers !== undefined && (
          <span className={`${styles.text} text-muted-foreground leading-none`}>
            {viewers} watching
          </span>
        )}
      </motion.div>
    );
  }

  // UPCOMING status with countdown
  if (status === "UPCOMING" && countdownLabel) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`
          inline-flex items-center justify-center
          ${styles.wrapper}
          rounded-full
          bg-carbon/90 backdrop-blur-sm
          border border-border/30
          min-h-[28px]
          ${className}
        `}
      >
        <span
          className={`
            ${styles.text}
            font-medium
            text-foreground
            whitespace-nowrap
            leading-none
            text-center
          `}
        >
          {countdownLabel}
        </span>
      </motion.div>
    );
  }

  return null;
}

/**
 * Standalone LIVE badge for simpler use cases
 */
export function LiveBadge({
  viewers,
  size = "sm",
  className = "",
}: {
  viewers?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <EventStatusBadge
      status="LIVE"
      viewers={viewers}
      size={size}
      className={className}
    />
  );
}

/**
 * Standalone countdown badge for simpler use cases
 */
export function CountdownBadge({
  label,
  size = "sm",
  className = "",
}: {
  label: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <EventStatusBadge
      status="UPCOMING"
      countdownLabel={label}
      size={size}
      className={className}
    />
  );
}
