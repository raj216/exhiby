import { motion } from "framer-motion";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface PullToRefreshIndicatorProps {
  pullDistance: number;
  isRefreshing: boolean;
  threshold: number;
  style?: React.CSSProperties;
}

export function PullToRefreshIndicator({
  pullDistance,
  isRefreshing,
  threshold,
  style,
}: PullToRefreshIndicatorProps) {
  const progress = Math.min(pullDistance / threshold, 1);
  const isReady = pullDistance >= threshold;

  return (
    <motion.div
      className="absolute left-1/2 -translate-x-1/2 z-30 pointer-events-none"
      style={style}
    >
      <div
        className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200",
          isReady || isRefreshing
            ? "bg-primary/20 border-2 border-primary"
            : "bg-obsidian/80 border border-border/50"
        )}
      >
        <RefreshCw
          className={cn(
            "w-5 h-5 transition-all duration-200",
            isReady || isRefreshing ? "text-primary" : "text-muted-foreground",
            isRefreshing && "animate-spin"
          )}
          style={{
            transform: isRefreshing ? undefined : `rotate(${progress * 180}deg)`,
          }}
        />
      </div>
    </motion.div>
  );
}
