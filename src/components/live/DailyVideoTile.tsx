import { useEffect, useRef } from "react";
import { DailyParticipantInfo } from "@/hooks/useDaily";
import { User } from "lucide-react";

interface DailyVideoTileProps {
  participant: DailyParticipantInfo;
  className?: string;
  showName?: boolean;
  isMirrored?: boolean;
  useContain?: boolean; // true = contain (desktop), false = cover (mobile FaceTime style)
}

export function DailyVideoTile({
  participant,
  className = "",
  showName = false,
  isMirrored = false,
  useContain = true, // Default to contain for teaching use-case
}: DailyVideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Attach video track
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    if (participant.videoTrack && participant.videoOn) {
      const stream = new MediaStream([participant.videoTrack]);
      videoEl.srcObject = stream;
      videoEl.play().catch(console.error);
    } else {
      videoEl.srcObject = null;
    }

    return () => {
      videoEl.srcObject = null;
    };
  }, [participant.videoTrack, participant.videoOn]);

  // Attach audio track (only for remote participants)
  useEffect(() => {
    const audioEl = audioRef.current;
    if (!audioEl || participant.isLocal) return;

    if (participant.audioTrack && participant.audioOn) {
      const stream = new MediaStream([participant.audioTrack]);
      audioEl.srcObject = stream;
      audioEl.play().catch(console.error);
    } else {
      audioEl.srcObject = null;
    }

    return () => {
      audioEl.srcObject = null;
    };
  }, [participant.audioTrack, participant.audioOn, participant.isLocal]);

  return (
    <div className={`relative bg-black overflow-hidden ${className}`}>
      {/* Video element - useContain: true = contain (no crop), false = cover (FaceTime style) */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={participant.isLocal}
        className={`w-full h-full ${useContain ? "object-contain" : "object-cover"} object-center ${isMirrored ? "scale-x-[-1]" : ""}`}
      />
      
      {/* Audio element for remote participants */}
      {!participant.isLocal && (
        <audio ref={audioRef} autoPlay playsInline />
      )}
      
      {/* Fallback when no video */}
      {!participant.videoOn && (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
            <User className="w-10 h-10 text-muted-foreground" />
          </div>
        </div>
      )}
      
      {/* Name badge */}
      {showName && (
        <div className="absolute bottom-2 left-2 px-2 py-1 rounded bg-black/50 backdrop-blur-sm">
          <span className="text-xs text-white font-medium">
            {participant.userName}
            {participant.isLocal && " (You)"}
          </span>
        </div>
      )}
    </div>
  );
}
