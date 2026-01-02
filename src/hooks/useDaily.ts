import { useState, useEffect, useCallback, useRef } from "react";
import Daily, {
  DailyCall,
  DailyParticipant,
  DailyEventObjectParticipant,
  DailyEventObjectParticipantLeft,
} from "@daily-co/daily-js";

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
  onJoined?: () => void;
  onLeft?: () => void;
  onError?: (error: string) => void;
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
  onJoined,
  onLeft,
  onError,
}: UseDailyOptions): UseDailyReturn {
  const [callObject, setCallObject] = useState<DailyCall | null>(null);
  const [participants, setParticipants] = useState<DailyParticipantInfo[]>([]);
  const [isJoined, setIsJoined] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(isHost);
  const [isMicOn, setIsMicOn] = useState(isHost);
  const [error, setError] = useState<string | null>(null);
  
  const videoElementsRef = useRef<Map<string, HTMLVideoElement>>(new Map());

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
    setParticipants(participantList);
  }, [convertParticipant]);

  // Initialize call object - using singleton pattern to avoid duplicate instances
  useEffect(() => {
    if (!roomUrl) return;

    // Check for existing instance first to avoid duplicate error
    let call = Daily.getCallInstance();
    
    if (call) {
      // If there's an existing call and it's in a meeting, destroy it first
      const meetingState = call.meetingState();
      if (meetingState === 'joined-meeting' || meetingState === 'joining-meeting') {
        console.log("[useDaily] Destroying existing call instance");
        call.destroy();
        call = null;
      }
    }
    
    // Create new instance only if needed
    if (!call) {
      call = Daily.createCallObject({
        subscribeToTracksAutomatically: true,
      });
    }

    // Event handlers
    const handleJoinedMeeting = () => {
      console.log("[useDaily] Joined meeting");
      setIsJoined(true);
      setIsJoining(false);
      updateParticipants(call);
      onJoined?.();
    };

    const handleLeftMeeting = () => {
      console.log("[useDaily] Left meeting");
      setIsJoined(false);
      setParticipants([]);
      onLeft?.();
    };

    const handleParticipantJoined = (event: DailyEventObjectParticipant | undefined) => {
      console.log("[useDaily] Participant joined:", event?.participant?.user_name);
      updateParticipants(call);
    };

    const handleParticipantLeft = (event: DailyEventObjectParticipantLeft | undefined) => {
      console.log("[useDaily] Participant left:", event?.participant?.user_name);
      if (event?.participant?.session_id) {
        videoElementsRef.current.delete(event.participant.session_id);
      }
      updateParticipants(call);
    };

    const handleParticipantUpdated = () => {
      updateParticipants(call);
    };

    const handleTrackStarted = () => {
      updateParticipants(call);
    };

    const handleTrackStopped = () => {
      updateParticipants(call);
    };

    const handleError = (event: any) => {
      console.error("[useDaily] Error:", event);
      const errorMessage = event?.errorMsg || event?.error?.message || "An error occurred";
      setError(errorMessage);
      setIsJoining(false);
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

    setCallObject(call);

    return () => {
      // Remove event listeners
      call.off("joined-meeting", handleJoinedMeeting);
      call.off("left-meeting", handleLeftMeeting);
      call.off("participant-joined", handleParticipantJoined);
      call.off("participant-left", handleParticipantLeft);
      call.off("participant-updated", handleParticipantUpdated);
      call.off("track-started", handleTrackStarted);
      call.off("track-stopped", handleTrackStopped);
      call.off("error", handleError);
      
      // Only destroy if we still have a valid call object
      const existingCall = Daily.getCallInstance();
      if (existingCall) {
        const meetingState = existingCall.meetingState();
        if (meetingState !== "left-meeting" && meetingState !== "new") {
          existingCall.leave().catch(console.error);
        }
        // Use setTimeout to allow leave to complete before destroy
        setTimeout(() => {
          try {
            const callToDestroy = Daily.getCallInstance();
            if (callToDestroy) {
              callToDestroy.destroy();
            }
          } catch (e) {
            console.log("[useDaily] Instance already destroyed");
          }
        }, 100);
      }
    };
  }, [roomUrl, updateParticipants, onJoined, onLeft, onError]);

  // Join the call
  const join = useCallback(async () => {
    if (!callObject || !roomUrl || isJoining || isJoined) return;

    setIsJoining(true);
    setError(null);

    try {
      console.log("[useDaily] Joining room:", roomUrl);
      
      await callObject.join({
        url: roomUrl,
        userName,
        startVideoOff: !isHost,
        startAudioOff: !isHost,
      });

      // Set initial camera/mic state based on host status
      if (isHost) {
        await callObject.setLocalVideo(true);
        await callObject.setLocalAudio(true);
        setIsCameraOn(true);
        setIsMicOn(true);
      } else {
        await callObject.setLocalVideo(false);
        await callObject.setLocalAudio(false);
        setIsCameraOn(false);
        setIsMicOn(false);
      }
    } catch (err: any) {
      console.error("[useDaily] Join error:", err);
      setError(err.message || "Failed to join room");
      setIsJoining(false);
    }
  }, [callObject, roomUrl, isHost, userName, isJoining, isJoined]);

  // Leave the call
  const leave = useCallback(async () => {
    if (!callObject || !isJoined) return;

    try {
      await callObject.leave();
    } catch (err) {
      console.error("[useDaily] Leave error:", err);
    }
  }, [callObject, isJoined]);

  // Toggle camera
  const toggleCamera = useCallback(() => {
    if (!callObject || !isHost) return;
    
    const newState = !isCameraOn;
    callObject.setLocalVideo(newState);
    setIsCameraOn(newState);
  }, [callObject, isHost, isCameraOn]);

  // Toggle mic
  const toggleMic = useCallback(() => {
    if (!callObject || !isHost) return;
    
    const newState = !isMicOn;
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
    join,
    leave,
    toggleCamera,
    toggleMic,
    getVideoElement,
  };
}
