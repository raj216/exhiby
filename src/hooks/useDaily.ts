import Daily, {
  DailyCall,
  DailyEventObjectParticipant,
  DailyEventObjectParticipantLeft,
} from "@daily-co/daily-js";
import { useCallback, useEffect, useRef, useState } from "react";

export type DailyJoinStatus =
  | "idle"
  | "creating"
  | "ready"
  | "joining"
  | "joined"
  | "error"
  | "timeout"
  | "host-left"
  | "meeting-ended";

// ─────────────────────────────────────────────────────────────────────────────
// Module-level singleton to prevent "Duplicate DailyIframe instances" error
// This survives React StrictMode double-mount cycles
// ─────────────────────────────────────────────────────────────────────────────
let globalCallObject: DailyCall | null = null;
let globalInstanceId = 0;
let initializationPromise: Promise<DailyCall> | null = null;

// ─────────────────────────────────────────────────────────────────────────────
// Art Studio Video & Audio Quality Configuration
// Optimized for fine detail visibility (pencil strokes, shading, texture)
// and crystal-clear voice for teaching/learning
// ─────────────────────────────────────────────────────────────────────────────

// HD camera constraints for 1080p @ 30fps - art-first clarity
const ART_STUDIO_CAMERA_CONSTRAINTS: MediaTrackConstraints = {
  width: { ideal: 1920, min: 1280 },      // 1080p ideal, 720p minimum fallback
  height: { ideal: 1080, min: 720 },
  frameRate: { ideal: 30, min: 24 },      // Smooth hand movements and strokes
  // Prefer accurate color reproduction over aggressive processing
  // @ts-ignore - advanced constraints may not be typed but are supported
  resizeMode: "none",                     // Avoid unnecessary resizing/processing
};

// Studio-grade audio constraints for crisp voice quality
// Optimized for teaching/learning with voice clarity as priority
const ART_STUDIO_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  // Echo cancellation - essential for speaker/mic setups
  echoCancellation: { ideal: true },
  // Noise suppression - reduces background noise (fans, AC, traffic)
  noiseSuppression: { ideal: true },
  // Auto gain control - maintains consistent volume levels
  autoGainControl: { ideal: true },
  // Higher sample rate for voice clarity (48kHz is CD quality)
  sampleRate: { ideal: 48000, min: 44100 },
  // Mono is sufficient and more stable for voice
  channelCount: { ideal: 1 },
  // Latency - prefer low latency for real-time interaction
  // @ts-ignore - advanced constraint
  latency: { ideal: 0.01, max: 0.05 },
};

// Simulcast encodings for adaptive quality with art-first priorities
// Higher bitrates than typical for preserving fine details during motion
const ART_STUDIO_SIMULCAST_ENCODINGS = [
  // High layer: Full 1080p for maximum detail clarity
  { 
    maxBitrate: 4000000,      // 4 Mbps - higher for fine art details
    maxFramerate: 30, 
    scaleResolutionDownBy: 1,
  },
  // Medium layer: 720p fallback - still good for art visibility
  { 
    maxBitrate: 1500000,      // 1.5 Mbps
    maxFramerate: 30, 
    scaleResolutionDownBy: 1.5,
  },
  // Low layer: 480p emergency fallback - avoid going lower
  { 
    maxBitrate: 600000,       // 600 Kbps
    maxFramerate: 30, 
    scaleResolutionDownBy: 2,
  },
];

// Host send settings for art studio quality - audio prioritized
const ART_STUDIO_SEND_SETTINGS = {
  video: {
    maxQuality: 'high' as const,
    // Allow adaptive layers so video can degrade before audio
    allowAdaptiveLayers: true,
    encodings: {
      low: { maxBitrate: 600000, maxFramerate: 30 },
      medium: { maxBitrate: 1500000, maxFramerate: 30 },
      high: { maxBitrate: 4000000, maxFramerate: 30 },
    },
  },
  audio: {
    // Prioritize audio quality - voice should always be clear
    maxQuality: 'high' as const,
    // Higher bitrate for voice clarity (Opus typically uses 32-128kbps)
    maxBitrate: 128000,  // 128 kbps for studio-quality voice
  },
};

// Viewer receive settings - request highest quality for art detail
const ART_STUDIO_RECEIVE_SETTINGS = {
  base: { 
    video: { 
      layer: 2,  // Request highest simulcast layer
    } 
  },
};

// Pre-acquired audio track for fast mic warmup
let preAcquiredAudioTrack: MediaStreamTrack | null = null;
let preAcquirePromise: Promise<MediaStreamTrack | null> | null = null;

/**
 * Pre-acquire microphone BEFORE joining Daily room to eliminate 10-15s delay.
 * This warms up the audio pipeline and ensures track is ready.
 */
async function preAcquireMicrophone(): Promise<MediaStreamTrack | null> {
  // If already in progress, wait for it
  if (preAcquirePromise) {
    if (process.env.NODE_ENV === "development") {
      console.log("[Daily] Waiting for in-flight mic pre-acquisition");
    }
    return preAcquirePromise;
  }

  // If already acquired and still live, reuse it
  if (preAcquiredAudioTrack && preAcquiredAudioTrack.readyState === "live") {
    if (process.env.NODE_ENV === "development") {
      console.log("[Daily] Reusing pre-acquired audio track, readyState:", preAcquiredAudioTrack.readyState);
    }
    return preAcquiredAudioTrack;
  }

  preAcquirePromise = (async () => {
    try {
      if (process.env.NODE_ENV === "development") {
        console.log("[Daily] Pre-acquiring microphone...");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: ART_STUDIO_AUDIO_CONSTRAINTS,
      });

      const audioTrack = stream.getAudioTracks()[0];
      if (!audioTrack) {
        console.warn("[Daily] No audio track returned from getUserMedia");
        return null;
      }

      // Wait for track to be live (not just created)
      if (audioTrack.readyState !== "live") {
        if (process.env.NODE_ENV === "development") {
          console.log("[Daily] Audio track readyState:", audioTrack.readyState, "- waiting for live...");
        }
        await new Promise<void>((resolve) => {
          if (audioTrack.readyState === "live") {
            resolve();
            return;
          }
          const checkInterval = setInterval(() => {
            if (audioTrack.readyState === "live") {
              clearInterval(checkInterval);
              resolve();
            }
          }, 50);
          // Timeout after 3 seconds
          setTimeout(() => {
            clearInterval(checkInterval);
            resolve();
          }, 3000);
        });
      }

      // Verify track is enabled
      if (!audioTrack.enabled) {
        audioTrack.enabled = true;
      }

      // DEV-only: Log audio track settings
      if (process.env.NODE_ENV === "development") {
        const settings = audioTrack.getSettings();
        console.log("[Daily] Pre-acquired audio track settings:", settings);
        console.log("[Daily] Audio track enabled:", audioTrack.enabled);
        console.log("[Daily] Audio track readyState:", audioTrack.readyState);
        console.log("[Daily] Audio track muted:", audioTrack.muted);
      }

      // Check if track is silent (might need re-request)
      if (audioTrack.muted) {
        if (process.env.NODE_ENV === "development") {
          console.log("[Daily] Audio track is muted, stopping and re-requesting...");
        }
        audioTrack.stop();
        
        // Re-request audio
        const retryStream = await navigator.mediaDevices.getUserMedia({
          audio: ART_STUDIO_AUDIO_CONSTRAINTS,
        });
        const retryTrack = retryStream.getAudioTracks()[0];
        if (retryTrack) {
          preAcquiredAudioTrack = retryTrack;
          if (process.env.NODE_ENV === "development") {
            console.log("[Daily] Retry audio track acquired, readyState:", retryTrack.readyState);
          }
          return retryTrack;
        }
      }

      preAcquiredAudioTrack = audioTrack;
      if (process.env.NODE_ENV === "development") {
        console.log("[Daily] Microphone pre-acquired successfully");
      }
      return audioTrack;
    } catch (err) {
      console.error("[Daily] Failed to pre-acquire microphone:", err);
      return null;
    }
  })();

  preAcquirePromise.finally(() => {
    preAcquirePromise = null;
  });

  return preAcquirePromise;
}

/**
 * Release pre-acquired audio track
 */
function releasePreAcquiredAudio(): void {
  if (preAcquiredAudioTrack) {
    if (process.env.NODE_ENV === "development") {
      console.log("[Daily] Releasing pre-acquired audio track");
    }
    preAcquiredAudioTrack.stop();
    preAcquiredAudioTrack = null;
  }
}

function getOrCreateCallObject(): Promise<DailyCall> {
  // Check for existing Daily instance first
  const existing = Daily.getCallInstance();
  if (existing) {
    console.log("[Daily] Reusing existing Daily.getCallInstance()");
    globalCallObject = existing;
    return Promise.resolve(existing);
  }

  if (globalCallObject) {
    console.log("[Daily] Reusing globalCallObject");
    return Promise.resolve(globalCallObject);
  }

  // If already initializing, wait for that
  if (initializationPromise) {
    console.log("[Daily] Waiting for in-flight initialization");
    return initializationPromise;
  }

  // Create new instance with simplified settings for maximum compatibility
  // NOTE: Daily posts dailyConfig to an iframe via postMessage.
  // Complex objects/functions in dailyConfig can cause "object can not be cloned" errors.
  // We apply art-studio settings AFTER join via updateSendSettings/setInputDevicesAsync instead.
  console.log("[Daily] Creating call object (simplified config for compatibility)");
  initializationPromise = new Promise((resolve) => {
    const call = Daily.createCallObject({
      subscribeToTracksAutomatically: true,
      // Minimal dailyConfig to avoid postMessage cloning issues
      dailyConfig: {
        avoidEval: true,
      },
      // Let Daily handle video/audio sources with defaults
      videoSource: true,
      audioSource: true,
    });
    globalCallObject = call;
    globalInstanceId++;
    console.log("[Daily] Call object created, instanceId:", globalInstanceId);
    resolve(call);
  });

  initializationPromise.finally(() => {
    initializationPromise = null;
  });

  return initializationPromise;
}

async function destroyCallObject(): Promise<void> {
  const call = globalCallObject || Daily.getCallInstance();
  if (!call) {
    console.log("[Daily] No call object to destroy");
    return;
  }

  console.log("[Daily] Destroying call object");
  
  try {
    const meetingState = call.meetingState();
    if (meetingState === "joined-meeting" || meetingState === "joining-meeting") {
      await call.leave();
      console.log("[Daily] Left meeting");
    }
  } catch (e) {
    console.warn("[Daily] Leave error (ignored):", e);
  }

  try {
    call.destroy();
    console.log("[Daily] Destroyed");
  } catch (e) {
    console.warn("[Daily] Destroy error (ignored):", e);
  }

  globalCallObject = null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
export interface DailyParticipantInfo {
  sessionId: string;
  userName: string;
  isLocal: boolean;
  videoTrack: MediaStreamTrack | null;
  audioTrack: MediaStreamTrack | null;
  videoOn: boolean;
  audioOn: boolean;
  // Best-effort camera facing mode for the *sender* (used to correct front-camera mirroring)
  facingMode?: "user" | "environment" | null;
}

interface UseDailyOptions {
  roomUrl: string | null;
  isHost: boolean;
  userName: string;
  joinTimeoutMs?: number;
  onJoined?: () => void;
  onLeft?: () => void;
  onError?: (error: string) => void;
  onStatusChange?: (status: DailyJoinStatus) => void;
  onHostLeft?: () => void;
  onMeetingEnded?: () => void;
  onNetworkQualityChange?: (quality: 'good' | 'low' | 'very-low') => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────
export function useDaily({
  roomUrl,
  isHost,
  userName,
  joinTimeoutMs = 12000,
  onJoined,
  onLeft,
  onError,
  onStatusChange,
  onHostLeft,
  onMeetingEnded,
  onNetworkQualityChange,
}: UseDailyOptions) {
  // Refs for preventing duplicate operations
  const callRef = useRef<DailyCall | null>(null);
  const hasInitializedRef = useRef(false);
  const hasJoinedRef = useRef(false);
  const isJoiningRef = useRef(false);
  const mountedRef = useRef(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const instanceIdRef = useRef(0);

  // State
  const [participants, setParticipants] = useState<DailyParticipantInfo[]>([]);
  const [isJoined, setIsJoined] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(isHost);
  const [isMicOn, setIsMicOn] = useState(isHost);
  const [error, setError] = useState<string | null>(null);
  const [errorStack, setErrorStack] = useState<string | null>(null);
  const [status, setStatus] = useState<DailyJoinStatus>("idle");
  const [audioError, setAudioError] = useState<string | null>(null);

  // Callbacks stored in refs to avoid effect re-runs
  const callbacksRef = useRef({ onJoined, onLeft, onError, onStatusChange, onHostLeft, onMeetingEnded, onNetworkQualityChange });
  callbacksRef.current = { onJoined, onLeft, onError, onStatusChange, onHostLeft, onMeetingEnded, onNetworkQualityChange };

  // Track if we already detected host leaving to avoid duplicate callbacks
  const hostLeftTriggeredRef = useRef(false);

  // Helper to update status
  const updateStatus = useCallback((newStatus: DailyJoinStatus) => {
    console.log("[useDaily] Status:", newStatus);
    setStatus(newStatus);
    callbacksRef.current.onStatusChange?.(newStatus);
  }, []);

  // Clear timeout
  const clearJoinTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Convert Daily participant to our format
  const convertParticipant = useCallback(
    (p: any): DailyParticipantInfo => {
      const userData = p?.userData ?? p?.user_data ?? p?.user_data?.data ?? null;
      const facingMode =
        userData?.facingMode === "user" || userData?.facingMode === "environment"
          ? userData.facingMode
          : null;

      return {
        sessionId: p.session_id,
        userName: p.user_name || "Guest",
        isLocal: p.local,
        videoTrack: p.tracks?.video?.track || null,
        audioTrack: p.tracks?.audio?.track || null,
        videoOn: p.tracks?.video?.state === "playable",
        audioOn: p.tracks?.audio?.state === "playable",
        facingMode,
      };
    },
    []
  );

  // Update participants list
  const updateParticipants = useCallback(
    (call: DailyCall) => {
      if (!mountedRef.current) return;
      const pList = Object.values(call.participants()).map(convertParticipant);
      setParticipants(pList);
    },
    [convertParticipant]
  );

  // Main initialization and join effect
  useEffect(() => {
    mountedRef.current = true;
    instanceIdRef.current++;
    const currentInstanceId = instanceIdRef.current;

    // Guard: No room URL yet
    if (!roomUrl) {
      console.log("[useDaily] No roomUrl, staying idle");
      updateStatus("idle");
      return;
    }

    // Guard: Already initialized this instance
    if (hasInitializedRef.current) {
      console.log("[useDaily] Already initialized, skipping");
      return;
    }

    let cancelled = false;

    const initAndJoin = async () => {
      console.log("[useDaily] Init start", { roomUrl, instanceId: currentInstanceId });
      hasInitializedRef.current = true;
      updateStatus("creating");

      try {
        // PRE-ACQUIRE MICROPHONE FOR HOST (eliminates 10-15s delay)
        // This runs in parallel with Daily call object creation
        let micPreAcquirePromise: Promise<MediaStreamTrack | null> | null = null;
        if (isHost) {
          if (process.env.NODE_ENV === "development") {
            console.log("[useDaily] Host: Pre-acquiring microphone before joining...");
          }
          micPreAcquirePromise = preAcquireMicrophone();
        }

        const call = await getOrCreateCallObject();

        // Wait for mic pre-acquisition to complete (if host)
        if (micPreAcquirePromise) {
          const preAcquiredTrack = await micPreAcquirePromise;
          if (process.env.NODE_ENV === "development") {
            console.log("[useDaily] Host: Mic pre-acquisition complete, track:", preAcquiredTrack ? "ready" : "failed");
          }
        }

        // Check if this instance is still valid
        if (cancelled || !mountedRef.current || currentInstanceId !== instanceIdRef.current) {
          console.log("[useDaily] Init cancelled or stale instance");
          releasePreAcquiredAudio();
          return;
        }

        callRef.current = call;
        console.log("[useDaily] Call object ready");

        // Check meeting state - maybe already joined from previous mount
        const meetingState = call.meetingState();
        console.log("[useDaily] Current meeting state:", meetingState);

        if (meetingState === "joined-meeting") {
          console.log("[useDaily] Already joined, syncing state");
          setIsJoined(true);
          setIsJoining(false);
          hasJoinedRef.current = true;
          updateStatus("joined");
          updateParticipants(call);
          return;
        }

        // Set up event handlers
        const handleJoinedMeeting = () => {
          if (!mountedRef.current) return;
          console.log("[useDaily] Event: joined-meeting");
          clearJoinTimeout();
          isJoiningRef.current = false;
          hasJoinedRef.current = true;
          setIsJoined(true);
          setIsJoining(false);
          updateStatus("joined");
          updateParticipants(call);
          callbacksRef.current.onJoined?.();
        };

        const handleLeftMeeting = () => {
          if (!mountedRef.current) return;
          console.log("[useDaily] Event: left-meeting");
          isJoiningRef.current = false;
          hasJoinedRef.current = false;
          setIsJoined(false);
          setIsJoining(false);
          setParticipants([]);
          updateStatus("idle");
          callbacksRef.current.onLeft?.();
        };

        const handleParticipantJoined = (event: DailyEventObjectParticipant | undefined) => {
          console.log("[useDaily] Event: participant-joined:", event?.participant?.user_name);
          updateParticipants(call);
        };

        const handleParticipantLeft = (event: DailyEventObjectParticipantLeft | undefined) => {
          console.log("[useDaily] Event: participant-left:", event?.participant?.user_name, "owner:", event?.participant?.owner);
          updateParticipants(call);
          
          // Detect when host/owner leaves - this means stream ended for viewers
          if (event?.participant?.owner && !event?.participant?.local && !hostLeftTriggeredRef.current) {
            console.log("[useDaily] Host/owner has left the meeting");
            hostLeftTriggeredRef.current = true;
            updateStatus("host-left");
            callbacksRef.current.onHostLeft?.();
          }
        };

        // Handle meeting ended event (room closed by host)
        const handleMeetingEnded = () => {
          if (!mountedRef.current) return;
          console.log("[useDaily] Event: meeting-ended");
          if (!hostLeftTriggeredRef.current) {
            hostLeftTriggeredRef.current = true;
            updateStatus("meeting-ended");
            callbacksRef.current.onMeetingEnded?.();
          }
        };

        const handleParticipantUpdated = () => updateParticipants(call);
        const handleTrackStarted = () => updateParticipants(call);
        const handleTrackStopped = () => updateParticipants(call);

        const handleError = (event: any) => {
          if (!mountedRef.current) return;
          console.error("[useDaily] Event: error:", event);
          clearJoinTimeout();
          isJoiningRef.current = false;
          hasJoinedRef.current = false;
          const errorMessage = event?.errorMsg || event?.error?.message || "An error occurred";
          setError(errorMessage);
          setErrorStack(event?.error?.stack || null);
          setIsJoining(false);
          updateStatus("error");
          callbacksRef.current.onError?.(errorMessage);
        };

        const handleCameraError = (event: any) => {
          console.error("[useDaily] Event: camera-error:", event);
          const errorMessage = event?.errorMsg?.errorMsg || event?.error?.message || "Camera access denied";
          setError(errorMessage);
          callbacksRef.current.onError?.(errorMessage);
        };

        // Audio error handler - separate from camera for clear user feedback
        const handleAudioError = (event: any) => {
          console.error("[useDaily] Event: audio-error:", event);
          const errorMessage = event?.error?.message || event?.errorMsg || "Microphone access denied or not found";
          setAudioError(errorMessage);
          // Don't set main error - audio issues shouldn't block video viewing
          console.warn("[useDaily] Audio error (non-blocking):", errorMessage);
        };

        // Network quality handler - prioritize audio stability and notify UI
        const handleNetworkQualityChange = (event: any) => {
          const { threshold, quality } = event || {};
          console.log("[useDaily] Network quality:", quality, "threshold:", threshold);
          
          // Notify UI about network quality changes for reconnection banner
          if (quality === 'low' || quality === 'very-low') {
            callbacksRef.current.onNetworkQualityChange?.(quality);
          } else if (quality === 'good') {
            callbacksRef.current.onNetworkQualityChange?.('good');
          }
          
          // On poor network, reduce video quality but maintain audio
          if (quality === 'low' || quality === 'very-low') {
            console.log("[useDaily] Poor network detected - prioritizing audio stability");
            try {
              // Request lower video layer to save bandwidth for audio
              call.updateReceiveSettings({
                base: { video: { layer: 0 } } // Request lowest video layer
              });
              // Update send settings to reduce video bitrate but maintain audio
              if (isHost) {
                call.updateSendSettings({
                  video: {
                    maxQuality: 'low' as const,
                    allowAdaptiveLayers: true,
                  },
                  // Audio settings are kept at high quality via the initial config
                } as any);
              }
            } catch (e) {
              console.warn("[useDaily] Could not adjust for poor network:", e);
            }
          } else if (quality === 'good') {
            // Restore high quality when network improves
            console.log("[useDaily] Good network - restoring high quality");
            try {
              call.updateReceiveSettings(ART_STUDIO_RECEIVE_SETTINGS);
              if (isHost) {
                call.updateSendSettings(ART_STUDIO_SEND_SETTINGS);
              }
            } catch (e) {
              console.warn("[useDaily] Could not restore quality settings:", e);
            }
          }
        };

        // Device change handler - reinitialize audio on device changes
        const handleAvailableDevicesUpdated = async (event: any) => {
          console.log("[useDaily] Available devices updated:", event);
          if (!isHost || !mountedRef.current) return;
          
          // Re-apply audio constraints when devices change
          try {
            const devices = await call.enumerateDevices();
            const audioInputs = devices?.devices?.filter((d: any) => d.kind === 'audioinput') || [];
            
            if (audioInputs.length > 0) {
              console.log("[useDaily] Re-applying audio settings after device change");
              // Re-enable audio to pick up the new/changed device
              await call.setLocalAudio(false);
              await new Promise(r => setTimeout(r, 100));
              await call.setLocalAudio(true);
              setAudioError(null); // Clear any previous audio error
            }
          } catch (e) {
            console.warn("[useDaily] Could not handle device change:", e);
          }
        };

        // App state handler (for tab visibility / app backgrounding)
        const handleAppMessage = (event: any) => {
          // Handle custom app messages if needed
          console.log("[useDaily] App message:", event);
        };

        // Attach listeners
        call.on("joined-meeting", handleJoinedMeeting);
        call.on("left-meeting", handleLeftMeeting);
        call.on("participant-joined", handleParticipantJoined);
        call.on("participant-left", handleParticipantLeft);
        call.on("participant-updated", handleParticipantUpdated);
        call.on("track-started", handleTrackStarted);
        call.on("track-stopped", handleTrackStopped);
        call.on("error", handleError);
        call.on("camera-error", handleCameraError);
        // @ts-ignore - Daily.co events that may not be fully typed
        call.on("nonfatal-error", handleAudioError);
        // @ts-ignore
        call.on("network-quality-change", handleNetworkQualityChange);
        // @ts-ignore
        call.on("available-devices-updated", handleAvailableDevicesUpdated);
        // @ts-ignore
        call.on("app-message", handleAppMessage);
        // @ts-ignore - Daily.co does have this event even if not typed
        call.on("meeting-ended", handleMeetingEnded);

        updateStatus("ready");

        // Now join if not already joining
        if (!isJoiningRef.current && !hasJoinedRef.current) {
          isJoiningRef.current = true;
          setIsJoining(true);
          updateStatus("joining");

          console.log("[useDaily] Starting join", { roomUrl, isHost, userName });

          // Set timeout
          timeoutRef.current = setTimeout(() => {
            if (!mountedRef.current) return;
            console.error("[useDaily] Join timeout");
            isJoiningRef.current = false;
            hasJoinedRef.current = false;
            setError(`Connection timeout after ${joinTimeoutMs / 1000} seconds`);
            setIsJoining(false);
            updateStatus("timeout");
            callbacksRef.current.onError?.("Connection timeout");
          }, joinTimeoutMs);

          try {
            await call.join({
              url: roomUrl,
              userName,
              startVideoOff: !isHost,
              startAudioOff: !isHost,
              // Request highest quality layer for art detail visibility
              receiveSettings: ART_STUDIO_RECEIVE_SETTINGS,
            });

            console.log("[useDaily] Join resolved");

            // Configure tracks for host with art-studio HD camera + studio audio
            if (isHost && mountedRef.current) {
              console.log("[useDaily] Host: enabling Art Studio HD camera + studio-grade audio");
              
              // FAST MIC WARM-UP: Since we pre-acquired the mic, enabling should be instant
              const warmupStart = performance.now();
              
              // Apply art-studio camera constraints for 1080p@30fps
              try {
                await call.setInputDevicesAsync({
                  videoSource: {
                    ...ART_STUDIO_CAMERA_CONSTRAINTS,
                  } as any,
                  audioSource: {
                    ...ART_STUDIO_AUDIO_CONSTRAINTS,
                  } as any,
                });
                console.log("[useDaily] Host: Art Studio camera + audio constraints applied");
              } catch (e) {
                console.warn("[useDaily] Could not apply input device constraints, using defaults:", e);
              }
              
              // Verify microphone is available before enabling
              try {
                const devices = await call.enumerateDevices();
                const audioInputs = devices?.devices?.filter((d: any) => d.kind === 'audioinput') || [];
                
                if (audioInputs.length === 0) {
                  console.error("[useDaily] No microphone found!");
                  setAudioError("No microphone found. Please connect a microphone and try again.");
                } else {
                  console.log("[useDaily] Found", audioInputs.length, "audio input device(s)");
                  setAudioError(null);
                }
              } catch (e) {
                console.warn("[useDaily] Could not enumerate audio devices:", e);
              }
              
              // Enable video first (can be parallel with audio)
              await call.setLocalVideo(true);
              
              // Enable audio - should be fast since mic was pre-acquired
              await call.setLocalAudio(true);
              
              // Release the pre-acquired track since Daily now has its own
              releasePreAcquiredAudio();
              
              const warmupTime = performance.now() - warmupStart;
              if (process.env.NODE_ENV === "development") {
                console.log(`[useDaily] Mic warm-up completed in ${warmupTime.toFixed(0)}ms`);
              }
              
              // DEV: Verify audio is being sent after 2 seconds
              if (process.env.NODE_ENV === "development") {
                setTimeout(async () => {
                  try {
                    const participants = call.participants();
                    const local = participants?.local;
                    if (local?.tracks?.audio) {
                      const audioTrack = local.tracks.audio;
                      console.log("[useDaily] Mic warm-up check (2s):");
                      console.log("  - Audio state:", audioTrack.state);
                      console.log("  - Audio subscribed:", audioTrack.subscribed);
                      console.log("  - Audio blocked:", audioTrack.blocked);
                      console.log("  - Audio off:", audioTrack.off);
                    }
                  } catch (e) {
                    console.warn("[useDaily] Warm-up check failed:", e);
                  }
                }, 2000);
              }
              
              // Best-effort: broadcast current facing mode to others (default: front/user)
              try {
                call.setUserData({ facingMode: "user" });
              } catch (e) {
                console.warn("[useDaily] Could not set facingMode userData:", e);
              }
              
              // Apply art-studio send settings for maximum visual clarity + audio priority
              try {
                call.updateSendSettings(ART_STUDIO_SEND_SETTINGS);
                console.log("[useDaily] Host: Art Studio send settings applied (video 4Mbps, audio 128kbps)");
              } catch (e) {
                console.warn("[useDaily] Could not apply Art Studio send settings:", e);
              }
              
              setIsCameraOn(true);
              setIsMicOn(true);
            } else if (mountedRef.current) {
              console.log("[useDaily] Viewer: requesting highest quality for art detail");
              
              // Viewers request to receive highest quality for fine art details
              call.updateReceiveSettings(ART_STUDIO_RECEIVE_SETTINGS);
              
              // Ensure viewer video/audio is disabled to prioritize host stream
              await call.setLocalVideo(false);
              await call.setLocalAudio(false);
              
              setIsCameraOn(false);
              setIsMicOn(false);
            }
          } catch (err: any) {
            if (!mountedRef.current) return;
            console.error("[useDaily] Join error:", err);
            clearJoinTimeout();
            isJoiningRef.current = false;
            hasJoinedRef.current = false;
            setError(err?.message || "Failed to join room");
            setErrorStack(err?.stack || null);
            setIsJoining(false);
            updateStatus("error");
            callbacksRef.current.onError?.(err?.message || "Failed to join room");
          }
        }
      } catch (err: any) {
        if (!mountedRef.current) return;
        console.error("[useDaily] Init error:", err);
        setError(err?.message || "Failed to initialize");
        setErrorStack(err?.stack || null);
        updateStatus("error");
        callbacksRef.current.onError?.(err?.message || "Failed to initialize");
      }
    };

    initAndJoin();

    // Cleanup on unmount
    return () => {
      cancelled = true;
      mountedRef.current = false;
      clearJoinTimeout();
      console.log("[useDaily] Cleanup, instanceId:", currentInstanceId);
      
      // Reset init flag so next mount can re-init
      hasInitializedRef.current = false;
      
      // Destroy call object on unmount
      destroyCallObject();
      callRef.current = null;
      isJoiningRef.current = false;
      hasJoinedRef.current = false;
    };
  }, [roomUrl, isHost, userName, joinTimeoutMs, updateStatus, clearJoinTimeout, updateParticipants]);

  // Leave the room
  const leave = useCallback(async () => {
    const call = callRef.current || globalCallObject;
    if (!call) return;

    try {
      await call.leave();
    } catch (e) {
      console.warn("[useDaily] Leave error:", e);
    }
  }, []);

  // Reset and retry
  const reset = useCallback(async () => {
    console.log("[useDaily] Reset requested");
    clearJoinTimeout();
    
    await destroyCallObject();
    
    // Reset all state
    callRef.current = null;
    hasInitializedRef.current = false;
    hasJoinedRef.current = false;
    isJoiningRef.current = false;
    
    setIsJoined(false);
    setIsJoining(false);
    setError(null);
    setErrorStack(null);
    setParticipants([]);
    updateStatus("idle");
    
    // Force re-init by incrementing instance ID
    instanceIdRef.current++;
    
    // Small delay then re-trigger init
    await new Promise(r => setTimeout(r, 100));
    
    if (roomUrl) {
      // Will re-run the effect since hasInitializedRef is now false
      hasInitializedRef.current = false;
      // Trigger re-render to re-run effect
      updateStatus("idle");
    }
  }, [roomUrl, clearJoinTimeout, updateStatus]);

  // Store isHost in ref for toggle callbacks
  const isHostRef = useRef(isHost);
  isHostRef.current = isHost;

  // Toggle camera (host only)
  const toggleCamera = useCallback(async () => {
    if (!isHostRef.current) {
      console.warn("[useDaily] Viewer cannot toggle camera");
      return;
    }
    const call = callRef.current || globalCallObject;
    if (!call) return;
    try {
      const newState = !isCameraOn;
      await call.setLocalVideo(newState);
      setIsCameraOn(newState);
    } catch (e) {
      console.error("[useDaily] Toggle camera error:", e);
    }
  }, [isCameraOn]);

  // Switch between front/back camera (host only)
  // On mobile (especially iOS), "cycleCamera" can cycle through multiple rear lenses (wide/ultra/tele),
  // which looks like zooming. We instead deterministically toggle between ONE front and ONE back camera.
  const preferredCameraIdsRef = useRef<{ front?: string; back?: string } | null>(null);
  const currentFacingRef = useRef<"user" | "environment" | null>(null);

  const pickPreferredCameraIds = (videoDevices: MediaDeviceInfo[]) => {
    const byLabel = (re: RegExp) =>
      videoDevices.filter((d) => re.test((d.label || "").toLowerCase()));

    const frontCandidates = byLabel(/front|user/);
    const backCandidates = byLabel(/back|rear|environment/);

    const pickBack = (candidates: MediaDeviceInfo[]) => {
      if (candidates.length === 0) return undefined;
      // Heuristic: prefer the "main" rear camera to avoid zoom-lens cycling
      const preferred =
        candidates.find((d) => /wide|1x|main|standard/.test((d.label || "").toLowerCase())) ||
        candidates.find((d) => !/ultra|tele|zoom|0\.5x|2x|3x/.test((d.label || "").toLowerCase())) ||
        candidates[0];
      return preferred.deviceId;
    };

    // If labels are missing, fall back to stable indexing when possible
    if (frontCandidates.length === 0 && backCandidates.length === 0) {
      return {
        front: videoDevices[0]?.deviceId,
        back: videoDevices[1]?.deviceId,
      };
    }

    return {
      front: frontCandidates[0]?.deviceId,
      back: pickBack(backCandidates),
    };
  };

  const inferFacingFromDevice = (
    deviceId: string | undefined,
    ids: { front?: string; back?: string } | null,
    devices: MediaDeviceInfo[]
  ): "user" | "environment" | null => {
    if (!deviceId) return null;
    if (ids?.front && deviceId === ids.front) return "user";
    if (ids?.back && deviceId === ids.back) return "environment";

    const match = devices.find((d) => d.deviceId === deviceId);
    const label = (match?.label || "").toLowerCase();
    if (/back|rear|environment/.test(label)) return "environment";
    if (/front|user/.test(label)) return "user";
    return null;
  };

  const switchCamera = useCallback(async () => {
    if (!isHostRef.current) {
      console.warn("[useDaily] Viewer cannot switch camera");
      return;
    }

    const call = callRef.current || globalCallObject;
    if (!call) {
      console.warn("[useDaily] No call object for switchCamera");
      return;
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === "videoinput");

      if (videoDevices.length < 2) {
        console.warn("[useDaily] Less than 2 cameras available");
        return;
      }

      if (!preferredCameraIdsRef.current) {
        preferredCameraIdsRef.current = pickPreferredCameraIds(videoDevices);
      }

      const ids = preferredCameraIdsRef.current;
      if (!ids?.front || !ids?.back) {
        console.warn("[useDaily] Could not resolve both front and back cameras", ids);
        return;
      }

      // Determine current facing mode once
      if (!currentFacingRef.current) {
        const inputSettings = await call.getInputDevices();
        const currentCameraId = (inputSettings?.camera as any)?.deviceId as string | undefined;
        currentFacingRef.current = inferFacingFromDevice(currentCameraId, ids, videoDevices) || "user";
      }

      const nextFacing: "user" | "environment" =
        currentFacingRef.current === "environment" ? "user" : "environment";
      const nextDeviceId = nextFacing === "user" ? ids.front : ids.back;

      console.log(`[useDaily] Switching camera to ${nextFacing} (${nextDeviceId})`);
      await call.setInputDevicesAsync({ videoDeviceId: nextDeviceId });
      currentFacingRef.current = nextFacing;

      // Broadcast facing mode so viewers can render front camera correctly
      try {
        call.setUserData({ facingMode: nextFacing });
      } catch (e) {
        console.warn("[useDaily] Could not set facingMode userData:", e);
      }
    } catch (e) {
      console.error("[useDaily] Switch camera error:", e);
    }
  }, []);

  // Toggle mic (host only)
  const toggleMic = useCallback(async () => {
    if (!isHostRef.current) {
      console.warn("[useDaily] Viewer cannot toggle mic");
      return;
    }
    const call = callRef.current || globalCallObject;
    if (!call) return;
    try {
      const newState = !isMicOn;
      await call.setLocalAudio(newState);
      setIsMicOn(newState);
    } catch (e) {
      console.error("[useDaily] Toggle mic error:", e);
    }
  }, [isMicOn]);

  // Retry audio - attempts to reinitialize audio after permission/device issues
  const retryAudio = useCallback(async () => {
    if (!isHostRef.current) {
      console.warn("[useDaily] Viewer cannot retry audio");
      return;
    }
    const call = callRef.current || globalCallObject;
    if (!call) return;
    
    console.log("[useDaily] Retrying audio initialization...");
    setAudioError(null);
    
    try {
      // Request microphone permission explicitly
      await navigator.mediaDevices.getUserMedia({ 
        audio: ART_STUDIO_AUDIO_CONSTRAINTS 
      });
      
      // Re-enumerate devices
      const devices = await call.enumerateDevices();
      const audioInputs = devices?.devices?.filter((d: any) => d.kind === 'audioinput') || [];
      
      if (audioInputs.length === 0) {
        setAudioError("No microphone found. Please connect a microphone.");
        return;
      }
      
      // Re-apply audio constraints
      await call.setInputDevicesAsync({
        audioSource: {
          ...ART_STUDIO_AUDIO_CONSTRAINTS,
        } as any,
      });
      
      // Enable audio
      await call.setLocalAudio(true);
      setIsMicOn(true);
      
      console.log("[useDaily] Audio retry successful");
    } catch (e: any) {
      console.error("[useDaily] Audio retry failed:", e);
      const errorMessage = e?.message || "Failed to access microphone";
      
      if (errorMessage.includes('Permission denied') || errorMessage.includes('NotAllowedError')) {
        setAudioError("Microphone permission denied. Please allow microphone access in your browser settings.");
      } else if (errorMessage.includes('NotFoundError')) {
        setAudioError("No microphone found. Please connect a microphone and try again.");
      } else {
        setAudioError(errorMessage);
      }
    }
  }, []);

  // Derived state
  const localParticipant = participants.find((p) => p.isLocal) || null;
  const remoteParticipants = participants.filter((p) => !p.isLocal);

  return {
    callObject: callRef.current,
    participants,
    localParticipant,
    remoteParticipants,
    isJoined,
    isJoining,
    isCameraOn,
    isMicOn,
    error,
    errorStack,
    audioError,
    status,
    join: () => {}, // Auto-join is handled internally
    leave,
    reset,
    toggleCamera,
    switchCamera,
    toggleMic,
    retryAudio,
  };
}
