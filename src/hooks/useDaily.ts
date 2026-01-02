import { useState, useEffect, useCallback, useRef } from "react";
import Daily, {
  DailyCall,
  DailyParticipant,
  DailyEventObjectParticipant,
  DailyEventObjectParticipantLeft,
} from "@daily-co/daily-js";

// ---------------------------------------------------------------------------
// Daily singleton (prevents "Duplicate DailyIframe instances" in StrictMode)
// ---------------------------------------------------------------------------
let sharedCallObject: DailyCall | null = null;
let sharedCreatePromise: Promise<DailyCall> | null = null;
let sharedDestroyPromise: Promise<void> | null = null;

async function destroySharedCallObject(reason: string) {
  if (sharedDestroyPromise) return sharedDestroyPromise;

  const call = sharedCallObject ?? Daily.getCallInstance();
  if (!call) return;

  sharedDestroyPromise = (async () => {
    console.log(`[useDaily][singleton] destroy start (${reason})`);
    try {
      await call.leave();
      console.log("[useDaily][singleton] left meeting");
    } catch (e) {
      console.warn("[useDaily][singleton] leave error (ignored):", e);
    }

    try {
      call.destroy();
      console.log("[useDaily][singleton] destroyed call object");
    } catch (e) {
      console.warn("[useDaily][singleton] destroy error (ignored):", e);
    }

    sharedCallObject = null;
    // Daily may still report an instance briefly; ensure future init waits on this.
  })().finally(() => {
    sharedDestroyPromise = null;
  });

  return sharedDestroyPromise;
}

async function getOrCreateSharedCallObject(reason: string) {
  // Wait for any in-flight destroy (StrictMode mount/unmount/mount).
  if (sharedDestroyPromise) await sharedDestroyPromise;

  if (sharedCallObject) return sharedCallObject;

  const existing = Daily.getCallInstance();
  if (existing) {
    console.log(`[useDaily][singleton] reusing existing instance (${reason})`);
    sharedCallObject = existing;
    return existing;
  }

  if (sharedCreatePromise) return sharedCreatePromise;

  sharedCreatePromise = (async () => {
    console.log(`[useDaily][singleton] create start (${reason})`);
    const call = Daily.createCallObject({
      subscribeToTracksAutomatically: true,
    });
    sharedCallObject = call;
    console.log("[useDaily][singleton] created call object");
    return call;
  })().finally(() => {
    sharedCreatePromise = null;
  });

  return sharedCreatePromise;
}

export type DailyJoinStatus = 
  | "idle"
  | "creating_call_object"
  | "call_object_ready"
  | "joining"
  | "joined"
  | "error"
  | "timeout";

export interface DailyParticipantInfo {
  sessionId: string;
  userName: string;
  isLocal: boolean;
  videoTrack: MediaStreamTrack | null;
  audioTrack: MediaStreamTrack | null;
  hasVideo: boolean;
  hasAudio: boolean;
}

interface UseDailyOptions {
  roomUrl: string | null;
  isHost: boolean;
  userName?: string;
  joinTimeoutMs?: number;
  onJoined?: () => void;
  onLeft?: () => void;
  onError?: (error: string) => void;
  onStatusChange?: (status: DailyJoinStatus) => void;
}

interface UseDailyReturn {
  callObject: DailyCall | null;
  participants: DailyParticipantInfo[];
  localParticipant: DailyParticipantInfo | null;
  remoteParticipants: DailyParticipantInfo[];
  isJoined: boolean;
  isJoining: boolean;
  isCameraOn: boolean;
  isMicOn: boolean;
  error: string | null;
  errorStack: string | null;
  status: DailyJoinStatus;
  join: () => Promise<void>;
  leave: () => Promise<void>;
  reset: () => Promise<void>; // hard cleanup + recreate call object
  toggleCamera: () => void;
  toggleMic: () => void;
  getVideoElement: (sessionId: string) => HTMLVideoElement | null;
}

export function useDaily({
  roomUrl,
  isHost,
  userName = "Guest",
  joinTimeoutMs = 12000,
  onJoined,
  onLeft,
  onError,
  onStatusChange,
}: UseDailyOptions): UseDailyReturn {
  const [callObject, setCallObject] = useState<DailyCall | null>(null);
  const callObjectRef = useRef<DailyCall | null>(null);

  const [participants, setParticipants] = useState<DailyParticipantInfo[]>([]);
  const [isJoined, setIsJoined] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const joiningRef = useRef(false);

  const [isCameraOn, setIsCameraOn] = useState(isHost);
  const [isMicOn, setIsMicOn] = useState(isHost);
  const [error, setError] = useState<string | null>(null);
  const [errorStack, setErrorStack] = useState<string | null>(null);
  const [status, setStatus] = useState<DailyJoinStatus>("idle");

  const [initKey, setInitKey] = useState(0);

  const videoElementsRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listenersAttachedRef = useRef(false);

  // Update status and notify
  const updateStatus = useCallback((newStatus: DailyJoinStatus) => {
    console.log(`[useDaily] Status: ${newStatus}`);
    setStatus(newStatus);
    onStatusChange?.(newStatus);
  }, [onStatusChange]);

  // Convert Daily participant to our format
  const convertParticipant = useCallback((p: DailyParticipant): DailyParticipantInfo => {
    const videoTrack = p.tracks?.video?.persistentTrack || null;
    const audioTrack = p.tracks?.audio?.persistentTrack || null;
    
    return {
      sessionId: p.session_id,
      userName: p.user_name || "Guest",
      isLocal: p.local,
      videoTrack,
      audioTrack,
      hasVideo: p.tracks?.video?.state === "playable",
      hasAudio: p.tracks?.audio?.state === "playable",
    };
  }, []);

  // Update participants list
  const updateParticipants = useCallback((call: DailyCall) => {
    const allParticipants = call.participants();
    const participantList = Object.values(allParticipants).map(convertParticipant);
    console.log(`[useDaily] Participants updated: ${participantList.length} total`);
    setParticipants(participantList);
  }, [convertParticipant]);

  // Clear timeout helper
  const clearJoinTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Initialize call object (idempotent + StrictMode-safe)
  useEffect(() => {
    if (!roomUrl) {
      console.log("[useDaily] No roomUrl provided, skipping initialization");
      return;
    }

    let cancelled = false;

    const init = async () => {
      console.log("[useDaily] init() start", { roomUrl, initKey });
      updateStatus("creating_call_object");

      try {
        const call = await getOrCreateSharedCallObject("init");
        if (cancelled) return;

        callObjectRef.current = call;
        setCallObject(call);

        // Attach listeners only once per hook instance.
        if (listenersAttachedRef.current) return;
        listenersAttachedRef.current = true;

        const handleJoinedMeeting = () => {
          console.log("[useDaily] Event: joined-meeting");
          clearJoinTimeout();
          joiningRef.current = false;
          setIsJoined(true);
          setIsJoining(false);
          updateStatus("joined");
          updateParticipants(call);
          onJoined?.();
        };

        const handleLeftMeeting = () => {
          console.log("[useDaily] Event: left-meeting");
          joiningRef.current = false;
          setIsJoined(false);
          setIsJoining(false);
          setParticipants([]);
          updateStatus("idle");
          onLeft?.();
        };

        const handleParticipantJoined = (event: DailyEventObjectParticipant | undefined) => {
          console.log("[useDaily] Event: participant-joined:", event?.participant?.user_name);
          updateParticipants(call);
        };

        const handleParticipantLeft = (event: DailyEventObjectParticipantLeft | undefined) => {
          console.log("[useDaily] Event: participant-left:", event?.participant?.user_name);
          if (event?.participant?.session_id) {
            videoElementsRef.current.delete(event.participant.session_id);
          }
          updateParticipants(call);
        };

        const handleParticipantUpdated = () => {
          updateParticipants(call);
        };

        const handleTrackStarted = () => {
          console.log("[useDaily] Event: track-started");
          updateParticipants(call);
        };

        const handleTrackStopped = () => {
          console.log("[useDaily] Event: track-stopped");
          updateParticipants(call);
        };

        const handleError = (event: any) => {
          console.error("[useDaily] Event: error:", event);
          clearJoinTimeout();
          joiningRef.current = false;

          const errorMessage = event?.errorMsg || event?.error?.message || "An error occurred";
          setError(errorMessage);
          setErrorStack(event?.error?.stack || null);
          setIsJoining(false);
          updateStatus("error");
          onError?.(errorMessage);
        };

        const handleCameraError = (event: any) => {
          console.error("[useDaily] Event: camera-error:", event);
          const errorMessage = event?.errorMsg?.errorMsg || event?.error?.message || "Camera access denied";
          setError(errorMessage);
          onError?.(errorMessage);
        };

        call.on("joined-meeting", handleJoinedMeeting);
        call.on("left-meeting", handleLeftMeeting);
        call.on("participant-joined", handleParticipantJoined);
        call.on("participant-left", handleParticipantLeft);
        call.on("participant-updated", handleParticipantUpdated);
        call.on("track-started", handleTrackStarted);
        call.on("track-stopped", handleTrackStopped);
        call.on("error", handleError);
        call.on("camera-error", handleCameraError);

        // Cleanup for this hook instance
        const cleanup = () => {
          call.off("joined-meeting", handleJoinedMeeting);
          call.off("left-meeting", handleLeftMeeting);
          call.off("participant-joined", handleParticipantJoined);
          call.off("participant-left", handleParticipantLeft);
          call.off("participant-updated", handleParticipantUpdated);
          call.off("track-started", handleTrackStarted);
          call.off("track-stopped", handleTrackStopped);
          call.off("error", handleError);
          call.off("camera-error", handleCameraError);
        };

        // Stash cleanup on the ref so we can run it in the effect cleanup.
        (listenersAttachedRef as any).currentCleanup = cleanup;

        console.log("[useDaily] Call object ready");
        updateStatus("call_object_ready");
      } catch (err: any) {
        console.error("[useDaily] Failed to init call object:", err);
        setError(err?.message || "Failed to create call object");
        setErrorStack(err?.stack || null);
        updateStatus("error");
      }
    };

    init();

    return () => {
      cancelled = true;
      console.log("[useDaily] Cleanup: hard destroy call object");

      clearJoinTimeout();
      joiningRef.current = false;
      setIsJoining(false);

      try {
        const cleanup = (listenersAttachedRef as any).currentCleanup as undefined | (() => void);
        cleanup?.();
      } catch (e) {
        console.warn("[useDaily] Listener cleanup error (ignored):", e);
      }

      listenersAttachedRef.current = false;
      (listenersAttachedRef as any).currentCleanup = null;

      // Hard cleanup (async, but singleton creation waits for it).
      void destroySharedCallObject("unmount");

      callObjectRef.current = null;
      setCallObject(null);
      setParticipants([]);
      setIsJoined(false);
    };
  }, [roomUrl, initKey, updateParticipants, onJoined, onLeft, onError, updateStatus, clearJoinTimeout]);

  // Join the call (guarded against concurrent / duplicate joins)
  const join = useCallback(async () => {
    const call = callObjectRef.current;

    if (!call || !roomUrl) {
      console.error("[useDaily] join() called but callObject or roomUrl is missing");
      setError("Cannot join: call object or room URL is missing");
      updateStatus("error");
      return;
    }

    if (joiningRef.current || isJoined) {
      console.log("[useDaily] join() blocked (already joining/joined)");
      return;
    }

    joiningRef.current = true;

    console.log("[useDaily] Starting join process...", {
      roomUrl,
      isHost,
      userName,
    });

    setIsJoining(true);
    setError(null);
    setErrorStack(null);
    updateStatus("joining");

    // Set up join timeout
    timeoutRef.current = setTimeout(() => {
      console.error("[useDaily] Join timeout after", joinTimeoutMs, "ms");
      joiningRef.current = false;
      setError(`Join timeout: could not connect within ${joinTimeoutMs / 1000} seconds`);
      setIsJoining(false);
      updateStatus("timeout");
      onError?.(`Join timeout after ${joinTimeoutMs / 1000} seconds`);
    }, joinTimeoutMs);

    try {
      console.log("[useDaily] Calling call.join()...");

      await call.join({
        url: roomUrl,
        userName,
        startVideoOff: !isHost,
        startAudioOff: !isHost,
      });

      console.log("[useDaily] join() resolved; configuring local tracks...");

      if (isHost) {
        console.log("[useDaily] Host: enabling camera + mic");
        await call.setLocalVideo(true);
        await call.setLocalAudio(true);
        setIsCameraOn(true);
        setIsMicOn(true);
      } else {
        console.log("[useDaily] Viewer: ensuring camera + mic are disabled");
        await call.setLocalVideo(false);
        await call.setLocalAudio(false);
        setIsCameraOn(false);
        setIsMicOn(false);
      }

      console.log("[useDaily] Local track configuration complete");
    } catch (err: any) {
      console.error("[useDaily] Join error:", err);
      clearJoinTimeout();
      joiningRef.current = false;
      setError(err?.message || "Failed to join room");
      setErrorStack(err?.stack || null);
      setIsJoining(false);
      updateStatus("error");
      onError?.(err?.message || "Failed to join room");
    }
  }, [roomUrl, isHost, userName, isJoined, joinTimeoutMs, updateStatus, clearJoinTimeout, onError]);

  // Leave the call
  const leave = useCallback(async () => {
    console.log("[useDaily] leave() called");
    clearJoinTimeout();
    joiningRef.current = false;

    const call = callObjectRef.current;
    if (!call) {
      console.log("[useDaily] No call object, nothing to leave");
      return;
    }

    try {
      const meetingState = call.meetingState();
      console.log("[useDaily] Current meeting state:", meetingState);

      if (meetingState === "joined-meeting" || meetingState === "joining-meeting") {
        await call.leave();
        console.log("[useDaily] Left meeting successfully");
      }
    } catch (err) {
      console.error("[useDaily] Leave error:", err);
    }
  }, [clearJoinTimeout]);

  // Hard cleanup + recreate call object
  const reset = useCallback(async () => {
    console.log("[useDaily] reset() called");
    clearJoinTimeout();
    joiningRef.current = false;

    setError(null);
    setErrorStack(null);
    setIsJoining(false);
    setIsJoined(false);
    setParticipants([]);

    await destroySharedCallObject("retry");
    setInitKey((k) => k + 1);
  }, [clearJoinTimeout]);

  // Toggle camera
  const toggleCamera = useCallback(() => {
    if (!callObject || !isHost) return;
    
    const newState = !isCameraOn;
    console.log("[useDaily] Toggling camera to:", newState);
    callObject.setLocalVideo(newState);
    setIsCameraOn(newState);
  }, [callObject, isHost, isCameraOn]);

  // Toggle mic
  const toggleMic = useCallback(() => {
    if (!callObject || !isHost) return;
    
    const newState = !isMicOn;
    console.log("[useDaily] Toggling mic to:", newState);
    callObject.setLocalAudio(newState);
    setIsMicOn(newState);
  }, [callObject, isHost, isMicOn]);

  // Get or create video element for a participant
  const getVideoElement = useCallback((sessionId: string): HTMLVideoElement | null => {
    const participant = participants.find(p => p.sessionId === sessionId);
    if (!participant?.videoTrack) return null;

    let videoEl = videoElementsRef.current.get(sessionId);
    
    if (!videoEl) {
      videoEl = document.createElement("video");
      videoEl.autoplay = true;
      videoEl.playsInline = true;
      videoEl.muted = participant.isLocal;
      videoElementsRef.current.set(sessionId, videoEl);
    }

    const stream = new MediaStream([participant.videoTrack]);
    if (videoEl.srcObject !== stream) {
      videoEl.srcObject = stream;
    }

    return videoEl;
  }, [participants]);

  // Derived state
  const localParticipant = participants.find(p => p.isLocal) || null;
  const remoteParticipants = participants.filter(p => !p.isLocal);

  return {
    callObject,
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
    join,
    leave,
    reset,
    toggleCamera,
    toggleMic,
    getVideoElement,
  };
}
