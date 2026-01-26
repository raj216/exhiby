/**
 * Daily.co Quality Monitor for Art Studio
 * 
 * Monitors network stats and video quality to ensure audiences receive
 * the best possible clarity for viewing fine art details (pencil lines, 
 * brush strokes, shading).
 * 
 * Key features:
 * - Art-optimized quality: Prioritizes resolution over framerate
 * - Stuck-low-quality detection: Auto-recovers when bandwidth is good but quality is low
 * - Adaptive degradation: Smooth step-down (1080→720→540→360) without getting stuck
 * - Dev-only logging: Network stats, video layers, and quality decisions
 */

import type { DailyCall } from "@daily-co/daily-js";

// Quality monitoring interval (5 seconds)
const MONITOR_INTERVAL_MS = 5000;

// Stuck quality detection: if bitrate is good but resolution is low for this long, force recovery
const STUCK_QUALITY_THRESHOLD_MS = 15000;

// Minimum incoming bitrate (bps) to consider "good network" for video
const GOOD_NETWORK_BITRATE = 800000; // 800 Kbps

// Resolution thresholds for art teaching clarity
const RESOLUTION_TIERS = {
  HIGH: 720,    // 720p+ is excellent for art details
  MEDIUM: 540,  // 540p is acceptable
  LOW: 360,     // 360p is emergency only
};

// Layer mapping for simulcast
const LAYER_FOR_QUALITY = {
  high: 2,      // Request highest layer (1080p)
  medium: 1,    // Request medium layer (720p)
  low: 0,       // Request lowest layer (480p)
};

export interface QualityStats {
  // Network stats
  availableIncomingBitrate: number;
  availableOutgoingBitrate: number;
  packetLoss: number;
  jitter: number;
  roundTripTime: number;
  
  // Video receive stats
  receiveWidth: number;
  receiveHeight: number;
  receiveFrameRate: number;
  receiveBitrate: number;
  
  // Quality decision
  currentLayer: number;
  targetLayer: number;
  isStuckLowQuality: boolean;
  qualityReason: string;
}

interface MonitorState {
  lastGoodBitrateTime: number | null;
  lastLowResolutionTime: number | null;
  currentTargetLayer: number;
  isRecovering: boolean;
  consecutiveGoodSamples: number;
  consecutiveBadSamples: number;
}

/**
 * Creates a quality monitor for a Daily call.
 * 
 * @param call - The Daily call object
 * @param isHost - Whether this is the host (affects monitoring strategy)
 * @param onQualityChange - Callback when quality strategy changes
 */
export function createQualityMonitor(
  call: DailyCall,
  isHost: boolean,
  onQualityChange?: (stats: QualityStats) => void
): { start: () => void; stop: () => void; getStats: () => QualityStats | null } {
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let lastStats: QualityStats | null = null;
  
  const state: MonitorState = {
    lastGoodBitrateTime: null,
    lastLowResolutionTime: null,
    currentTargetLayer: 2, // Start requesting highest
    isRecovering: false,
    consecutiveGoodSamples: 0,
    consecutiveBadSamples: 0,
  };

  const isDev = process.env.NODE_ENV === "development";

  const log = (...args: any[]) => {
    if (isDev) {
      console.log("[QualityMonitor]", ...args);
    }
  };

  const warn = (...args: any[]) => {
    if (isDev) {
      console.warn("[QualityMonitor]", ...args);
    }
  };

  /**
   * Analyze current network and video stats to determine optimal quality
   */
  const analyzeQuality = async (): Promise<QualityStats | null> => {
    try {
      // Get network stats from Daily
      const stats = await call.getNetworkStats();
      const participants = call.participants();
      
      // Find the host participant (for viewers, we care about the host's video)
      const hostParticipant = isHost 
        ? participants?.local 
        : Object.values(participants || {}).find((p: any) => p.owner && !p.local);
      
      if (!hostParticipant) {
        log("No host participant found, skipping analysis");
        return null;
      }

      // Extract network quality metrics
      const networkStats = stats?.stats?.latest;
      const availableIncomingBitrate = networkStats?.videoRecvBitsPerSecond || 0;
      const availableOutgoingBitrate = networkStats?.videoSendBitsPerSecond || 0;
      const packetLoss = networkStats?.videoRecvPacketLoss || 0;
      // Use available fields from Daily's network stats
      const jitter = networkStats?.videoRecvJitter || networkStats?.audioRecvJitter || 0;
      const roundTripTime = networkStats?.networkRoundTripTime || 0;
      
      // Extract video receive stats
      const videoTrack = (hostParticipant as any).tracks?.video;
      const receiveWidth = videoTrack?.receiveSettings?.width || 0;
      const receiveHeight = videoTrack?.receiveSettings?.height || 0;
      const receiveFrameRate = videoTrack?.receiveSettings?.framerate || 0;
      const receiveBitrate = availableIncomingBitrate;
      
      // Determine current layer from track state
      let currentLayer = 2; // Assume high
      if (receiveHeight < RESOLUTION_TIERS.LOW) {
        currentLayer = 0;
      } else if (receiveHeight < RESOLUTION_TIERS.MEDIUM) {
        currentLayer = 1;
      }
      
      // Quality decision logic for art teaching
      const now = Date.now();
      let targetLayer = state.currentTargetLayer;
      let isStuckLowQuality = false;
      let qualityReason = "";

      // Check if we have good bandwidth
      const hasGoodBandwidth = receiveBitrate >= GOOD_NETWORK_BITRATE && packetLoss < 0.05;
      const hasLowResolution = receiveHeight > 0 && receiveHeight < RESOLUTION_TIERS.HIGH;

      if (hasGoodBandwidth) {
        state.lastGoodBitrateTime = now;
        state.consecutiveGoodSamples++;
        state.consecutiveBadSamples = 0;
        
        // If bandwidth is good but we're still getting low resolution
        if (hasLowResolution) {
          if (!state.lastLowResolutionTime) {
            state.lastLowResolutionTime = now;
          }
          
          // Stuck detection: good bitrate + low resolution for too long
          const stuckDuration = now - state.lastLowResolutionTime;
          if (stuckDuration > STUCK_QUALITY_THRESHOLD_MS) {
            isStuckLowQuality = true;
            qualityReason = `Stuck at ${receiveHeight}p despite ${(receiveBitrate / 1000).toFixed(0)}kbps available`;
            
            // Force recovery: request highest layer
            targetLayer = LAYER_FOR_QUALITY.high;
            state.isRecovering = true;
            
            warn(`STUCK LOW QUALITY detected! Forcing recovery to layer ${targetLayer}`);
          }
        } else {
          // Good resolution, clear stuck timer
          state.lastLowResolutionTime = null;
          state.isRecovering = false;
          
          // Network is good, request highest quality for art detail
          if (state.consecutiveGoodSamples >= 3) {
            targetLayer = LAYER_FOR_QUALITY.high;
            qualityReason = "Good network - requesting max quality for art details";
          }
        }
      } else {
        // Poor network
        state.consecutiveBadSamples++;
        state.consecutiveGoodSamples = 0;
        state.lastLowResolutionTime = null;
        
        // Art-optimized degradation: prioritize resolution over framerate
        // Step down smoothly based on consecutive bad samples
        if (state.consecutiveBadSamples >= 5) {
          targetLayer = LAYER_FOR_QUALITY.low;
          qualityReason = "Poor network - stepping to emergency quality";
        } else if (state.consecutiveBadSamples >= 3) {
          targetLayer = LAYER_FOR_QUALITY.medium;
          qualityReason = "Degraded network - stepping to medium quality";
        } else {
          // Keep current, might recover
          qualityReason = "Network fluctuation - monitoring";
        }
      }

      // Apply layer change if needed (viewers only)
      if (!isHost && targetLayer !== state.currentTargetLayer) {
        log(`Changing receive layer: ${state.currentTargetLayer} → ${targetLayer} (${qualityReason})`);
        
        try {
          call.updateReceiveSettings({
            base: {
              video: {
                layer: targetLayer,
              },
            },
          });
          state.currentTargetLayer = targetLayer;
        } catch (e) {
          warn("Failed to update receive settings:", e);
        }
      }

      const qualityStats: QualityStats = {
        availableIncomingBitrate,
        availableOutgoingBitrate,
        packetLoss,
        jitter,
        roundTripTime,
        receiveWidth,
        receiveHeight,
        receiveFrameRate,
        receiveBitrate,
        currentLayer,
        targetLayer,
        isStuckLowQuality,
        qualityReason,
      };

      // Log stats in dev mode
      log("Quality stats:", {
        resolution: `${receiveWidth}x${receiveHeight}@${receiveFrameRate}fps`,
        bitrate: `${(receiveBitrate / 1000).toFixed(0)}kbps`,
        packetLoss: `${(packetLoss * 100).toFixed(1)}%`,
        rtt: `${(roundTripTime * 1000).toFixed(0)}ms`,
        layer: `${currentLayer}→${targetLayer}`,
        quality: qualityReason || "stable",
      });

      lastStats = qualityStats;
      onQualityChange?.(qualityStats);
      
      return qualityStats;
    } catch (e) {
      warn("Error analyzing quality:", e);
      return null;
    }
  };

  const start = () => {
    if (intervalId) return;
    
    log(`Starting quality monitor (${isHost ? "host" : "viewer"} mode)`);
    
    // Initial analysis
    setTimeout(() => analyzeQuality(), 2000);
    
    // Periodic monitoring
    intervalId = setInterval(() => {
      analyzeQuality();
    }, MONITOR_INTERVAL_MS);
  };

  const stop = () => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
      log("Quality monitor stopped");
    }
  };

  const getStats = () => lastStats;

  return { start, stop, getStats };
}

/**
 * Get human-readable quality description
 */
export function getQualityDescription(height: number): string {
  if (height >= 1080) return "HD 1080p";
  if (height >= 720) return "HD 720p";
  if (height >= 540) return "SD 540p";
  if (height >= 360) return "Low 360p";
  if (height > 0) return `Very Low ${height}p`;
  return "Unknown";
}

/**
 * Check if current quality is acceptable for art teaching
 */
export function isQualityAcceptable(height: number): boolean {
  return height >= RESOLUTION_TIERS.MEDIUM;
}
