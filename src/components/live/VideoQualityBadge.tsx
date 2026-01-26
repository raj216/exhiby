import { type QualityStats, getQualityDescription } from "@/lib/dailyQualityMonitor";
import { Badge } from "@/components/ui/badge";
import { Signal, SignalLow, SignalMedium, SignalHigh } from "lucide-react";

interface VideoQualityBadgeProps {
  qualityStats: QualityStats | null;
  className?: string;
}

/**
 * Dev-only badge showing current video resolution and quality status.
 * Only renders in development mode for debugging purposes.
 */
export function VideoQualityBadge({ qualityStats, className = "" }: VideoQualityBadgeProps) {
  // Only show in development mode
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  if (!qualityStats) {
    return (
      <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/60 backdrop-blur-sm ${className}`}>
        <Signal className="w-3 h-3 text-muted-foreground animate-pulse" />
        <span className="text-[10px] font-mono text-muted-foreground">Connecting...</span>
      </div>
    );
  }

  const { receiveHeight, receiveBitrate, packetLoss, isStuckLowQuality, currentLayer, targetLayer } = qualityStats;
  
  // Determine quality tier for visual indicator
  const getQualityColor = () => {
    if (isStuckLowQuality) return "text-amber-400";
    if (receiveHeight >= 720) return "text-emerald-400";
    if (receiveHeight >= 540) return "text-amber-400";
    return "text-red-400";
  };

  const getSignalIcon = () => {
    if (receiveHeight >= 720) return <SignalHigh className={`w-3 h-3 ${getQualityColor()}`} />;
    if (receiveHeight >= 540) return <SignalMedium className={`w-3 h-3 ${getQualityColor()}`} />;
    return <SignalLow className={`w-3 h-3 ${getQualityColor()}`} />;
  };

  const resolutionLabel = receiveHeight > 0 ? `${receiveHeight}p` : "—";
  const bitrateLabel = receiveBitrate > 0 ? `${(receiveBitrate / 1000).toFixed(0)}k` : "—";
  const layerInfo = currentLayer !== targetLayer ? `L${currentLayer}→${targetLayer}` : `L${currentLayer}`;

  return (
    <div 
      className={`flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/60 backdrop-blur-sm border border-white/10 ${className}`}
      title={`Resolution: ${receiveHeight}p | Bitrate: ${(receiveBitrate / 1000).toFixed(0)} kbps | Packet Loss: ${(packetLoss * 100).toFixed(1)}% | Layer: ${layerInfo}${isStuckLowQuality ? " | ⚠️ Stuck low quality" : ""}`}
    >
      {getSignalIcon()}
      <span className={`text-[10px] font-mono font-medium ${getQualityColor()}`}>
        {resolutionLabel}
      </span>
      <span className="text-[10px] font-mono text-muted-foreground">
        {bitrateLabel}
      </span>
      {isStuckLowQuality && (
        <span className="text-[10px] text-amber-400">⚠</span>
      )}
    </div>
  );
}
