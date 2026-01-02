import Daily, {
  DailyCall,
  DailyEventObjectParticipant,
  DailyEventObjectParticipantLeft,
} from "@daily-co/daily-js";
import { useCallback, useEffect, useRef, useState } from "react";

export type DailyJoinStatus =
  | "idle"
  | "creating_call_object"
  | "ready_to_join"
  | "joining"
  | "joined"
  | "error"
  | "timeout";

// ─────────────────────────────────────────────────────────────────────────────
// Singleton helpers to prevent "Duplicate DailyIframe instances" error.
// ─────────────────────────────────────────────────────────────────────────────
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
  })().finally(() => {
    sharedDestroyPromise = null;
  });

  return sharedDestroyPromise;
}

async function getOrCreateSharedCallObject(reason: string): Promise<DailyCall> {
  // Wait for any in-flight destroy (StrictMode mount/unmount/mount).
  if (sharedDestroyPromise) await sharedDestroyPromise;

  if (sharedCallObject) {
    console.log(`[useDaily][singleton] reusing existing sharedCallObject (${reason})`);
    return sharedCallObject;
  }

  const existing = Daily.getCallInstance();
  if (existing) {
    console.log(`[useDaily][singleton] reusing Daily.getCallInstance() (${reason})`);
    sharedCallObject = existing;
    return existing;
  }

  if (sharedCreatePromise) {
    console.log(`[useDaily][singleton] waiting on in-flight create (${reason})`);
    return sharedCreatePromise;
  }

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
}

interface UseDailyOptions {
  roomUrl: string | null;
  isHost: boolean;
  userName: string;
  joinTimeoutMs?: number;
  autoJoin?: boolean; // default true - automatically join when ready
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
  autoJoin = true,
  onJoined,
  onLeft,
  onError,
  onStatusChange,
}: UseDailyOptions) {
  // ─── Refs ───────────────────────────────────────────────────────────────────
  const callObjectRef = useRef<DailyCall | null>(null);
  const listenersAttachedRef = useRef(false);
  const videoElementsRef = useRef<Map<string, HTMLVideoElement | null>>(new Map());
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const joiningRef = useRef(false);
  const hasJoinedRef = useRef(false);
  const mountedRef = useRef(true);

  // ─── State ──────────────────────────────────────────────────────────────────
  const [participants, setParticipants] = useState<DailyParticipantInfo[]>([]);
  const [isJoined, setIsJoined] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(isHost);
  const [isMicOn, setIsMicOn] = useState(isHost);
  const [error, setError] = useState<string | null>(null);
  const [errorStack, setErrorStack] = useState<string | null>(null);
  const [status, setStatus] = useState<DailyJoinStatus>("idle");
  const [initKey, setInitKey] = useState(0);

  // ─── Helpers ────────────────────────────────────────────────────────────────
  const updateStatus = useCallback(
    (newStatus: DailyJoinStatus) => {
      console.log("[useDaily] Status:", newStatus);
      setStatus(newStatus);
      onStatusChange?.(newStatus);
    },
    [onStatusChange]
  );

  const clearJoinTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const convertParticipant = useCallback(
    (p: any): DailyParticipantInfo => ({
      sessionId: p.session_id,
      userName: p.user_name || "Guest",
      isLocal: p.local,
      videoTrack: p.tracks?.video?.track || null,
      audioTrack: p.tracks?.audio?.track || null,
      videoOn: p.tracks?.video?.state === "playable",
      audioOn: p.tracks?.audio?.state === "playable",
    }),
    []
  );

  const updateParticipants = useCallback(
    (call: DailyCall) => {
      const pList = Object.values(call.participants()).map(convertParticipant);
      setParticipants(pList);
    },
    [convertParticipant]
  );

  // ─── Internal Join ──────────────────────────────────────────────────────────
  const performJoin = useCallback(async () => {
    const call = callObjectRef.current;

    // Guard: must have call object and roomUrl
    if (!call) {
      console.error("[useDaily] performJoin: no call object");
      setError("Cannot join: call object not ready");
      updateStatus("error");
      return;
    }

    if (!roomUrl) {
      console.error("[useDaily] performJoin: no roomUrl");
      setError("Cannot join: room URL is missing");
      updateStatus("error");
      return;
    }

    // Guard: prevent duplicate joins
    if (joiningRef.current) {
      console.log("[useDaily] performJoin: already joining, skipping");
      return;
    }

    if (hasJoinedRef.current || isJoined) {
      console.log("[useDaily] performJoin: already joined, skipping");
      return;
    }

    joiningRef.current = true;
    hasJoinedRef.current = true;

    console.log("[useDaily] performJoin: starting...", { roomUrl, isHost, userName });

    setIsJoining(true);
    setError(null);
    setErrorStack(null);
    updateStatus("joining");

    // Set up join timeout
    timeoutRef.current = setTimeout(() => {
      console.error("[useDaily] Join timeout after", joinTimeoutMs, "ms");
      joiningRef.current = false;
      hasJoinedRef.current = false;
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
      // Note: status will be set to "joined" by the joined-meeting event handler
    } catch (err: any) {
      console.error("[useDaily] Join error:", err);
      clearJoinTimeout();
      joiningRef.current = false;
      hasJoinedRef.current = false;
      setError(err?.message || "Failed to join room");
      setErrorStack(err?.stack || null);
      setIsJoining(false);
      updateStatus("error");
      onError?.(err?.message || "Failed to join room");
    }
  }, [roomUrl, isHost, userName, isJoined, joinTimeoutMs, updateStatus, clearJoinTimeout, onError]);

  // ─── Effect: Initialize Call Object ─────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;

    if (!roomUrl) {
      console.log("[useDaily] No roomUrl provided, staying idle");
      return;
    }

    let cancelled = false;

    const init = async () => {
      console.log("[useDaily] init() start", { roomUrl, initKey });
      updateStatus("creating_call_object");

      try {
        const call = await getOrCreateSharedCallObject("init");
        
        if (cancelled || !mountedRef.current) {
          console.log("[useDaily] init cancelled, aborting");
          return;
        }

        // Store the call object in ref
        callObjectRef.current = call;
        console.log("[useDaily] callObjectRef.current set");

        // Attach listeners only once per hook instance
        if (listenersAttachedRef.current) {
          console.log("[useDaily] Listeners already attached, updating status");
          updateStatus("ready_to_join");
          return;
        }
        listenersAttachedRef.current = true;

        // Event handlers
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
          hasJoinedRef.current = false;
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
          hasJoinedRef.current = false;

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

        // Attach all listeners
        call.on("joined-meeting", handleJoinedMeeting);
        call.on("left-meeting", handleLeftMeeting);
        call.on("participant-joined", handleParticipantJoined);
        call.on("participant-left", handleParticipantLeft);
        call.on("participant-updated", handleParticipantUpdated);
        call.on("track-started", handleTrackStarted);
        call.on("track-stopped", handleTrackStopped);
        call.on("error", handleError);
        call.on("camera-error", handleCameraError);

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

        (listenersAttachedRef as any).currentCleanup = cleanup;

        console.log("[useDaily] Call object ready, status -> ready_to_join");
        updateStatus("ready_to_join");
      } catch (err: any) {
        console.error("[useDaily] Failed to init call object:", err);
        setError(err?.message || "Failed to create call object");
        setErrorStack(err?.stack || null);
        updateStatus("error");
        onError?.(err?.message || "Failed to create call object");
      }
    };

    init();

    return () => {
      cancelled = true;
      mountedRef.current = false;
      clearJoinTimeout();

      if ((listenersAttachedRef as any).currentCleanup) {
        (listenersAttachedRef as any).currentCleanup();
      }

      console.log("[useDaily] Cleanup: hard destroy call object");
      destroySharedCallObject("unmount");
      callObjectRef.current = null;
      listenersAttachedRef.current = false;
      joiningRef.current = false;
      hasJoinedRef.current = false;
    };
  }, [roomUrl, initKey, updateStatus, clearJoinTimeout, updateParticipants, onJoined, onLeft, onError]);

  // ─── Effect: Auto-join when ready ───────────────────────────────────────────
  useEffect(() => {
    if (!autoJoin) {
      console.log("[useDaily] autoJoin disabled, waiting for manual join()");
      return;
    }

    if (status !== "ready_to_join") {
      return;
    }

    if (!callObjectRef.current) {
      console.log("[useDaily] status is ready_to_join but callObjectRef is null, waiting...");
      return;
    }

    if (!roomUrl) {
      console.log("[useDaily] status is ready_to_join but roomUrl is null");
      return;
    }

    if (hasJoinedRef.current || isJoined) {
      console.log("[useDaily] Already joined, skipping auto-join");
      return;
    }

    console.log("[useDaily] Auto-joining (status=ready_to_join, callObject ready, roomUrl present)");
    performJoin();
  }, [status, autoJoin, roomUrl, isJoined, performJoin]);

  // ─── External join (for manual trigger) ─────────────────────────────────────
  const join = useCallback(() => {
    if (status !== "ready_to_join" && status !== "idle") {
      console.warn("[useDaily] join() called but status is:", status);
    }
    performJoin();
  }, [status, performJoin]);

  // ─── Leave ──────────────────────────────────────────────────────────────────
  const leave = useCallback(async () => {
    clearJoinTimeout();
    joiningRef.current = false;
    hasJoinedRef.current = false;

    const call = callObjectRef.current;
    if (call) {
      try {
        await call.leave();
        console.log("[useDaily] Left meeting");
      } catch (e) {
        console.warn("[useDaily] Leave error (ignored):", e);
      }
    }

    setIsJoined(false);
    setIsJoining(false);
    setParticipants([]);
    updateStatus("idle");
  }, [clearJoinTimeout, updateStatus]);

  // ─── Reset (hard cleanup + re-init) ─────────────────────────────────────────
  const reset = useCallback(async () => {
    console.log("[useDaily] reset() called - hard cleanup");
    clearJoinTimeout();

    if ((listenersAttachedRef as any).currentCleanup) {
      (listenersAttachedRef as any).currentCleanup();
    }

    await destroySharedCallObject("reset");

    callObjectRef.current = null;
    listenersAttachedRef.current = false;
    joiningRef.current = false;
    hasJoinedRef.current = false;

    setIsJoined(false);
    setIsJoining(false);
    setParticipants([]);
    setError(null);
    setErrorStack(null);
    updateStatus("idle");

    // Increment initKey to trigger re-init
    setInitKey((k) => k + 1);
  }, [clearJoinTimeout, updateStatus]);

  // ─── Camera / Mic toggles ───────────────────────────────────────────────────
  const toggleCamera = useCallback(async () => {
    const call = callObjectRef.current;
    if (!call) return;

    const newState = !isCameraOn;
    await call.setLocalVideo(newState);
    setIsCameraOn(newState);
  }, [isCameraOn]);

  const toggleMic = useCallback(async () => {
    const call = callObjectRef.current;
    if (!call) return;

    const newState = !isMicOn;
    await call.setLocalAudio(newState);
    setIsMicOn(newState);
  }, [isMicOn]);

  // ─── Video element binding ──────────────────────────────────────────────────
  const getVideoElement = useCallback((sessionId: string) => {
    return videoElementsRef.current.get(sessionId) || null;
  }, []);

  const setVideoElement = useCallback((sessionId: string, element: HTMLVideoElement | null) => {
    if (element) {
      videoElementsRef.current.set(sessionId, element);
    } else {
      videoElementsRef.current.delete(sessionId);
    }
  }, []);

  // ─── Derived state ──────────────────────────────────────────────────────────
  const localParticipant = participants.find((p) => p.isLocal) || null;
  const remoteParticipants = participants.filter((p) => !p.isLocal);

  return {
    // Participants
    participants,
    localParticipant,
    remoteParticipants,

    // Connection state
    isJoined,
    isJoining,
    status,
    error,
    errorStack,

    // Media state
    isCameraOn,
    isMicOn,

    // Actions
    join,
    leave,
    reset,
    toggleCamera,
    toggleMic,

    // Video elements
    getVideoElement,
    setVideoElement,
  };
}
