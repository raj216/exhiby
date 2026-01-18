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
  | "timeout";

// ─────────────────────────────────────────────────────────────────────────────
// Module-level singleton to prevent "Duplicate DailyIframe instances" error
// This survives React StrictMode double-mount cycles
// ─────────────────────────────────────────────────────────────────────────────
let globalCallObject: DailyCall | null = null;
let globalInstanceId = 0;
let initializationPromise: Promise<DailyCall> | null = null;

// ─────────────────────────────────────────────────────────────────────────────
// Art Studio Video Quality Configuration
// Optimized for fine detail visibility (pencil strokes, shading, texture)
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

// Host send settings for art studio quality
const ART_STUDIO_SEND_SETTINGS = {
  video: {
    maxQuality: 'high' as const,
    // Disable auto-adjust to prevent sudden quality drops during drawing
    allowAdaptiveLayers: true,
    encodings: {
      low: { maxBitrate: 600000, maxFramerate: 30 },
      medium: { maxBitrate: 1500000, maxFramerate: 30 },
      high: { maxBitrate: 4000000, maxFramerate: 30 },
    },
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

  // Create new instance with art-studio optimized settings
  console.log("[Daily] Creating call object with Art Studio HD settings");
  initializationPromise = new Promise((resolve) => {
    const call = Daily.createCallObject({
      subscribeToTracksAutomatically: true,
      dailyConfig: {
        // Art-optimized simulcast layers with higher bitrates
        camSimulcastEncodings: ART_STUDIO_SIMULCAST_ENCODINGS,
        // Use VP9 when available for better quality-to-bitrate ratio
        preferH264ForCam: false,
        // Avoid automatic bandwidth adjustments that cause sudden quality drops
        avoidEval: true,
      } as any, // Type assertion for advanced config options
      // Enable video processing for stable stream
      videoSource: true,
      audioSource: true,
    });
    globalCallObject = call;
    globalInstanceId++;
    console.log("[Daily] Art Studio call object created, instanceId:", globalInstanceId);
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

  // Callbacks stored in refs to avoid effect re-runs
  const callbacksRef = useRef({ onJoined, onLeft, onError, onStatusChange });
  callbacksRef.current = { onJoined, onLeft, onError, onStatusChange };

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
        const call = await getOrCreateCallObject();

        // Check if this instance is still valid
        if (cancelled || !mountedRef.current || currentInstanceId !== instanceIdRef.current) {
          console.log("[useDaily] Init cancelled or stale instance");
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
          console.log("[useDaily] Event: participant-left:", event?.participant?.user_name);
          updateParticipants(call);
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

            // Configure tracks for host with art-studio HD camera constraints
            if (isHost && mountedRef.current) {
              console.log("[useDaily] Host: enabling Art Studio HD camera + mic");
              
              // Apply art-studio camera constraints for 1080p@30fps
              try {
                await call.setInputDevicesAsync({
                  videoSource: {
                    ...ART_STUDIO_CAMERA_CONSTRAINTS,
                  } as any,
                });
                console.log("[useDaily] Host: Art Studio camera constraints applied");
              } catch (e) {
                console.warn("[useDaily] Could not apply camera constraints, using defaults:", e);
              }
              
              await call.setLocalVideo(true);
              await call.setLocalAudio(true);
              
              // Best-effort: broadcast current facing mode to others (default: front/user)
              try {
                call.setUserData({ facingMode: "user" });
              } catch (e) {
                console.warn("[useDaily] Could not set facingMode userData:", e);
              }
              
              // Apply art-studio send settings for maximum visual clarity
              try {
                call.updateSendSettings(ART_STUDIO_SEND_SETTINGS);
                console.log("[useDaily] Host: Art Studio send settings applied (4Mbps max)");
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
    status,
    join: () => {}, // Auto-join is handled internally
    leave,
    reset,
    toggleCamera,
    switchCamera,
    toggleMic,
  };
}
