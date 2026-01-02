import { useState, useEffect, useCallback, useRef } from "react";
import Daily, {
  DailyCall,
  DailyParticipant,
  DailyEventObjectParticipant,
  DailyEventObjectParticipantLeft,
} from "@daily-co/daily-js";

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
  const [participants, setParticipants] = useState<DailyParticipantInfo[]>([]);
  const [isJoined, setIsJoined] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(isHost);
  const [isMicOn, setIsMicOn] = useState(isHost);
  const [error, setError] = useState<string | null>(null);
  const [errorStack, setErrorStack] = useState<string | null>(null);
  const [status, setStatus] = useState<DailyJoinStatus>("idle");
  
  const videoElementsRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDestroyingRef = useRef(false);

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

  // Initialize call object - using singleton pattern to avoid duplicate instances
  useEffect(() => {
    if (!roomUrl) {
      console.log("[useDaily] No roomUrl provided, skipping initialization");
      return;
    }

    console.log("[useDaily] Initializing with roomUrl:", roomUrl);
    updateStatus("creating_call_object");

    // Check for existing instance first to avoid duplicate error
    let call = Daily.getCallInstance();
    
    if (call) {
      const meetingState = call.meetingState();
      console.log("[useDaily] Existing call instance found, state:", meetingState);
      
      // If there's an existing call in a meeting state, leave it first
      if (meetingState === 'joined-meeting' || meetingState === 'joining-meeting') {
        console.log("[useDaily] Leaving existing meeting before reinitializing");
        call.leave().then(() => {
          console.log("[useDaily] Left existing meeting");
        }).catch(err => {
          console.warn("[useDaily] Error leaving existing meeting:", err);
        });
      }
      
      // Destroy existing instance
      try {
        console.log("[useDaily] Destroying existing call instance");
        call.destroy();
      } catch (e) {
        console.warn("[useDaily] Error destroying existing instance:", e);
      }
      call = null;
    }
    
    // Create new instance
    try {
      console.log("[useDaily] Creating new call object");
      call = Daily.createCallObject({
        subscribeToTracksAutomatically: true,
      });
      console.log("[useDaily] Call object created successfully");
      updateStatus("call_object_ready");
    } catch (err: any) {
      console.error("[useDaily] Failed to create call object:", err);
      setError(err.message || "Failed to create call object");
      setErrorStack(err.stack || null);
      updateStatus("error");
      return;
    }

    // Event handlers
    const handleJoinedMeeting = () => {
      console.log("[useDaily] Event: joined-meeting");
      clearJoinTimeout();
      setIsJoined(true);
      setIsJoining(false);
      updateStatus("joined");
      updateParticipants(call!);
      onJoined?.();
    };

    const handleLeftMeeting = () => {
      console.log("[useDaily] Event: left-meeting");
      setIsJoined(false);
      setParticipants([]);
      updateStatus("idle");
      onLeft?.();
    };

    const handleParticipantJoined = (event: DailyEventObjectParticipant | undefined) => {
      console.log("[useDaily] Event: participant-joined:", event?.participant?.user_name);
      updateParticipants(call!);
    };

    const handleParticipantLeft = (event: DailyEventObjectParticipantLeft | undefined) => {
      console.log("[useDaily] Event: participant-left:", event?.participant?.user_name);
      if (event?.participant?.session_id) {
        videoElementsRef.current.delete(event.participant.session_id);
      }
      updateParticipants(call!);
    };

    const handleParticipantUpdated = () => {
      updateParticipants(call!);
    };

    const handleTrackStarted = () => {
      console.log("[useDaily] Event: track-started");
      updateParticipants(call!);
    };

    const handleTrackStopped = () => {
      console.log("[useDaily] Event: track-stopped");
      updateParticipants(call!);
    };

    const handleError = (event: any) => {
      console.error("[useDaily] Event: error:", event);
      clearJoinTimeout();
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

    setCallObject(call);

    return () => {
      console.log("[useDaily] Cleanup: removing event listeners and destroying call");
      clearJoinTimeout();
      
      if (isDestroyingRef.current) {
        console.log("[useDaily] Already destroying, skipping cleanup");
        return;
      }
      isDestroyingRef.current = true;

      // Remove event listeners
      call!.off("joined-meeting", handleJoinedMeeting);
      call!.off("left-meeting", handleLeftMeeting);
      call!.off("participant-joined", handleParticipantJoined);
      call!.off("participant-left", handleParticipantLeft);
      call!.off("participant-updated", handleParticipantUpdated);
      call!.off("track-started", handleTrackStarted);
      call!.off("track-stopped", handleTrackStopped);
      call!.off("error", handleError);
      call!.off("camera-error", handleCameraError);
      
      // Graceful cleanup
      const existingCall = Daily.getCallInstance();
      if (existingCall) {
        const meetingState = existingCall.meetingState();
        console.log("[useDaily] Cleanup: meeting state is", meetingState);
        
        if (meetingState === "joined-meeting" || meetingState === "joining-meeting") {
          existingCall.leave().then(() => {
            console.log("[useDaily] Cleanup: left meeting");
            try {
              existingCall.destroy();
              console.log("[useDaily] Cleanup: destroyed call object");
            } catch (e) {
              console.log("[useDaily] Cleanup: error destroying:", e);
            }
          }).catch(err => {
            console.warn("[useDaily] Cleanup: leave error:", err);
            try {
              existingCall.destroy();
            } catch (e) {
              console.log("[useDaily] Cleanup: error destroying after leave error:", e);
            }
          });
        } else {
          try {
            existingCall.destroy();
            console.log("[useDaily] Cleanup: destroyed call object (no meeting)");
          } catch (e) {
            console.log("[useDaily] Cleanup: error destroying:", e);
          }
        }
      }
      
      isDestroyingRef.current = false;
    };
  }, [roomUrl, updateParticipants, onJoined, onLeft, onError, updateStatus, clearJoinTimeout]);

  // Join the call
  const join = useCallback(async () => {
    if (!callObject || !roomUrl) {
      console.error("[useDaily] join() called but callObject or roomUrl is missing");
      setError("Cannot join: call object or room URL is missing");
      updateStatus("error");
      return;
    }
    
    if (isJoining || isJoined) {
      console.log("[useDaily] join() called but already joining or joined");
      return;
    }

    console.log("[useDaily] Starting join process...");
    console.log("[useDaily] Room URL:", roomUrl);
    console.log("[useDaily] Is Host:", isHost);
    console.log("[useDaily] User Name:", userName);

    setIsJoining(true);
    setError(null);
    setErrorStack(null);
    updateStatus("joining");

    // Set up join timeout
    timeoutRef.current = setTimeout(() => {
      console.error("[useDaily] Join timeout after", joinTimeoutMs, "ms");
      setError(`Join timeout: could not connect within ${joinTimeoutMs / 1000} seconds`);
      setIsJoining(false);
      updateStatus("timeout");
      onError?.(`Join timeout after ${joinTimeoutMs / 1000} seconds`);
    }, joinTimeoutMs);

    try {
      console.log("[useDaily] Calling callObject.join()...");
      
      await callObject.join({
        url: roomUrl,
        userName,
        startVideoOff: !isHost,
        startAudioOff: !isHost,
      });

      console.log("[useDaily] join() completed, setting up media...");

      // Set initial camera/mic state based on host status
      if (isHost) {
        console.log("[useDaily] Host: enabling camera and mic");
        await callObject.setLocalVideo(true);
        await callObject.setLocalAudio(true);
        setIsCameraOn(true);
        setIsMicOn(true);
      } else {
        console.log("[useDaily] Viewer: disabling camera and mic");
        await callObject.setLocalVideo(false);
        await callObject.setLocalAudio(false);
        setIsCameraOn(false);
        setIsMicOn(false);
      }
      
      console.log("[useDaily] Media setup complete");
    } catch (err: any) {
      console.error("[useDaily] Join error:", err);
      clearJoinTimeout();
      setError(err.message || "Failed to join room");
      setErrorStack(err.stack || null);
      setIsJoining(false);
      updateStatus("error");
      onError?.(err.message || "Failed to join room");
    }
  }, [callObject, roomUrl, isHost, userName, isJoining, isJoined, joinTimeoutMs, updateStatus, clearJoinTimeout, onError]);

  // Leave the call
  const leave = useCallback(async () => {
    console.log("[useDaily] leave() called");
    clearJoinTimeout();
    
    if (!callObject) {
      console.log("[useDaily] No call object, nothing to leave");
      return;
    }

    try {
      const meetingState = callObject.meetingState();
      console.log("[useDaily] Current meeting state:", meetingState);
      
      if (meetingState === "joined-meeting" || meetingState === "joining-meeting") {
        await callObject.leave();
        console.log("[useDaily] Left meeting successfully");
      }
    } catch (err) {
      console.error("[useDaily] Leave error:", err);
    }
  }, [callObject, clearJoinTimeout]);

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
    toggleCamera,
    toggleMic,
    getVideoElement,
  };
}
