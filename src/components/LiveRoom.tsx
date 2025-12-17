import { useEffect, useRef, useState } from "react";
import DailyIframe, { DailyCall } from "@daily-co/daily-js";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

interface LiveRoomProps {
  roomUrl?: string;
  onLeave?: () => void;
}

export function LiveRoom({ roomUrl, onLeave }: LiveRoomProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const callFrameRef = useRef<DailyCall | null>(null);
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    if (!roomUrl || !containerRef.current) return;

    const initCall = async () => {
      setIsJoining(true);

      // Create the Daily frame
      const callFrame = DailyIframe.createFrame(containerRef.current!, {
        iframeStyle: {
          width: "100%",
          height: "100%",
          border: "none",
          borderRadius: "0",
        },
        showLeaveButton: true,
        showFullscreenButton: true,
        theme: {
          colors: {
            accent: "#FF6B58",
            accentText: "#FFFFFF",
            background: "#0F0F11",
            backgroundAccent: "#1C1C1F",
            baseText: "#FFFFFF",
            border: "#2A2A2E",
            mainAreaBg: "#0F0F11",
            mainAreaBgAccent: "#1C1C1F",
            mainAreaText: "#FFFFFF",
            supportiveText: "#8A8A8E",
          },
        },
      });

      callFrameRef.current = callFrame;

      // Handle leave event
      callFrame.on("left-meeting", () => {
        onLeave?.();
      });

      // Join the room
      try {
        await callFrame.join({ url: roomUrl });
      } catch (error) {
        console.error("Failed to join Daily room:", error);
      } finally {
        setIsJoining(false);
      }
    };

    initCall();

    // Cleanup on unmount
    return () => {
      if (callFrameRef.current) {
        callFrameRef.current.destroy();
        callFrameRef.current = null;
      }
    };
  }, [roomUrl, onLeave]);

  // Loading state when no room URL
  if (!roomUrl) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-muted-foreground font-sans">Loading Stage...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-background z-50"
    >
      {/* Joining overlay */}
      {isJoining && (
        <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-4"
          >
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-muted-foreground font-sans">Joining the Stage...</p>
          </motion.div>
        </div>
      )}

      {/* Daily.co frame container */}
      <div ref={containerRef} className="w-full h-full" />
    </motion.div>
  );
}
