import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, SwitchCamera, X } from "lucide-react";
import { useDaily } from "@/hooks/useDaily";
import { triggerHaptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

export const STUDIO_CAM_PREFIX = "__studio_cam__";

interface StudioCameraViewProps {
  roomUrl: string;
  eventTitle: string;
  creatorName: string;
  onDisconnect: () => void;
}

export function StudioCameraView({
  roomUrl,
  eventTitle,
  creatorName,
  onDisconnect,
}: StudioCameraViewProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const confirmTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    participants,
    isJoined,
    isMicOn,
    toggleMic,
    switchCamera,
    leave,
  } = useDaily({
    roomUrl,
    isHost: true,
    userName: STUDIO_CAM_PREFIX + creatorName,
  });

  // Local participant video
  const local = participants.find((p) => p.isLocal);
  const videoTrack = local?.videoTrack ?? null;

  // Attach video track
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (videoTrack) {
      const stream = new MediaStream([videoTrack]);
      el.srcObject = stream;
      el.play().catch(() => {});
    } else {
      el.srcObject = null;
    }
  }, [videoTrack]);

  // Screen wake lock when joined
  useEffect(() => {
    if (!isJoined) return;
    let cancelled = false;

    const requestLock = async () => {
      try {
        // @ts-ignore - wakeLock may not exist on all browsers
        if ("wakeLock" in navigator) {
          // @ts-ignore
          const lock: WakeLockSentinel = await navigator.wakeLock.request("screen");
          if (cancelled) {
            lock.release().catch(() => {});
            return;
          }
          wakeLockRef.current = lock;
        }
      } catch (e) {
        console.warn("[StudioCameraView] Wake lock failed:", e);
      }
    };

    requestLock();

    const handleVisibility = () => {
      if (document.visibilityState === "visible" && !wakeLockRef.current) {
        requestLock();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibility);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
  }, [isJoined]);

  const handleDisconnect = async () => {
    if (!confirmDisconnect) {
      triggerHaptic("medium");
      setConfirmDisconnect(true);
      if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
      confirmTimeoutRef.current = setTimeout(() => setConfirmDisconnect(false), 3000);
      return;
    }
    triggerHaptic("heavy");
    if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
    try {
      await leave();
    } catch {
      // ignore
    }
    onDisconnect();
  };

  const handleToggleMic = () => {
    triggerHaptic("light");
    toggleMic();
  };

  const handleSwitchCamera = () => {
    triggerHaptic("light");
    switchCamera();
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black overflow-hidden">
      {/* Full-screen camera preview */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Dark gradient overlay */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/60 via-transparent to-black/70" />

      {/* Top-left: Pulsing LIVE badge */}
      <div className="absolute top-6 left-6 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-md border border-white/10">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full rounded-full bg-live opacity-75 animate-ping" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-live" />
        </span>
        <span className="text-xs font-semibold text-white uppercase tracking-wider">
          Live
        </span>
      </div>

      {/* Top-right: Studio Camera pill */}
      <div className="absolute top-6 right-6 px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-md border border-white/10">
        <span className="text-xs font-medium text-white/90">Studio Camera</span>
      </div>

      {/* Event title (centered, top, subtle) */}
      {eventTitle && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 max-w-[70%]">
          <p className="text-xs text-white/60 truncate text-center">{eventTitle}</p>
        </div>
      )}

      {/* Bottom controls */}
      <div className="absolute bottom-10 left-0 right-0 flex items-center justify-center gap-5 px-6">
        {/* Mic toggle */}
        <button
          onClick={handleToggleMic}
          className={cn(
            "w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 backdrop-blur-md border border-white/20 shadow-2xl active:scale-95",
            isMicOn
              ? "bg-white text-black"
              : "bg-live text-white"
          )}
          aria-label={isMicOn ? "Mute microphone" : "Unmute microphone"}
        >
          {isMicOn ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
        </button>

        {/* Switch camera */}
        <button
          onClick={handleSwitchCamera}
          className="w-14 h-14 rounded-full flex items-center justify-center bg-black/50 backdrop-blur-md border border-white/20 text-white shadow-2xl active:scale-95 transition-all duration-200 hover:bg-black/70"
          aria-label="Switch camera"
        >
          <SwitchCamera className="w-6 h-6" />
        </button>

        {/* Disconnect (two-tap confirm) */}
        <button
          onClick={handleDisconnect}
          className={cn(
            "h-14 rounded-full flex items-center justify-center backdrop-blur-md border shadow-2xl active:scale-95 transition-all duration-200",
            confirmDisconnect
              ? "bg-live text-white border-live px-5 gap-2"
              : "w-14 bg-black/50 text-white border-white/20 hover:bg-black/70"
          )}
          aria-label={confirmDisconnect ? "Tap again to disconnect" : "Disconnect"}
        >
          <X className="w-6 h-6" />
          {confirmDisconnect && (
            <span className="text-sm font-semibold">Tap to confirm</span>
          )}
        </button>
      </div>

      {/* Connection status (when not yet joined) */}
      {!isJoined && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            <p className="text-white/70 text-sm">Connecting studio camera…</p>
          </div>
        </div>
      )}
    </div>
  );
}
