import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { AlertCircle, Loader2, MicOff, VideoOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLiveViewers } from "@/hooks/useLiveViewers";
import { useDaily } from "@/hooks/useDaily";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  DailyVideoTile,
  LiveRoomControls,
  LiveRoomHeader,
  LiveRoomChat,
  LiveRoomMaterials,
  ChatMessage,
  Material,
} from "@/components/live";

interface EventData {
  id: string;
  title: string;
  cover_url: string | null;
  room_url: string | null;
  creator_id: string;
  is_live: boolean;
  creator?: {
    name: string;
    avatar_url: string | null;
  };
}

export default function LiveRoom() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isMobile = useIsMobile();

  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [permissionError, setPermissionError] = useState(false);
  
  // UI State
  const [isUIVisible, setIsUIVisible] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [showMaterials, setShowMaterials] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [materials] = useState<Material[]>([
    { id: "1", name: "Graphite Pencil Set", brand: "Faber-Castell", description: "2B, 4B, 6B grades" },
    { id: "2", name: "Sketchbook", brand: "Strathmore", description: "400 Series, 9x12" },
    { id: "3", name: "Kneaded Eraser", brand: "Prismacolor" },
  ]);
  
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const { viewerCount, joinAsViewer, leaveAsViewer } = useLiveViewers(eventId || null);
  
  const isCreator = user?.id === event?.creator_id;

  // Daily SDK integration
  const {
    localParticipant,
    remoteParticipants,
    isJoined,
    isJoining,
    isCameraOn,
    isMicOn,
    error: dailyError,
    join,
    leave,
    toggleCamera,
    toggleMic,
  } = useDaily({
    roomUrl: event?.room_url || null,
    isHost: isCreator,
    userName: user?.email?.split("@")[0] || "Guest",
    onJoined: () => {
      console.log("[LiveRoom] Successfully joined Daily room");
      toast.success("Connected to stream");
    },
    onLeft: () => {
      console.log("[LiveRoom] Left Daily room");
    },
    onError: (err) => {
      console.error("[LiveRoom] Daily error:", err);
      if (err.includes("NotAllowedError") || err.includes("permission")) {
        setPermissionError(true);
      }
    },
  });

  // Auto-hide UI after inactivity
  const resetHideTimer = useCallback(() => {
    setIsUIVisible(true);
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }
    hideTimerRef.current = setTimeout(() => {
      if (!showChat && !showMaterials) {
        setIsUIVisible(false);
      }
    }, 3000);
  }, [showChat, showMaterials]);

  // Show UI on interaction
  useEffect(() => {
    const handleInteraction = () => resetHideTimer();
    
    window.addEventListener("mousemove", handleInteraction);
    window.addEventListener("touchstart", handleInteraction);
    
    resetHideTimer();
    
    return () => {
      window.removeEventListener("mousemove", handleInteraction);
      window.removeEventListener("touchstart", handleInteraction);
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, [resetHideTimer]);

  // Fetch event data
  useEffect(() => {
    if (!eventId) {
      setError("No event ID provided");
      setLoading(false);
      return;
    }

    const fetchEvent = async () => {
      console.log("[LiveRoom] Fetching event:", eventId);

      try {
        const { data, error: fetchError } = await supabase
          .from("events")
          .select("id, title, cover_url, room_url, creator_id, is_live")
          .eq("id", eventId)
          .single();

        if (fetchError) {
          console.error("[LiveRoom] Error fetching event:", fetchError);
          setError("Event not found");
          return;
        }

        console.log("[LiveRoom] Event data:", data);

        // Fetch creator profile
        const { data: profiles } = await supabase.rpc("get_all_public_profiles");
        const creatorProfile = profiles?.find((p: any) => p.user_id === data.creator_id);

        setEvent({
          ...data,
          creator: creatorProfile
            ? { name: creatorProfile.name, avatar_url: creatorProfile.avatar_url }
            : { name: "Unknown Artist", avatar_url: null },
        });

        if (!data.room_url) {
          console.log("[LiveRoom] No room_url found");
          setError("Live stream not available");
        }
      } catch (err) {
        console.error("[LiveRoom] Unexpected error:", err);
        setError("Failed to load event");
      } finally {
        setLoading(false);
      }
    };

    fetchEvent();
  }, [eventId]);

  // Join Daily room and viewer tracking when event loads
  useEffect(() => {
    if (event?.room_url && !isJoined && !isJoining && !dailyError) {
      console.log("[LiveRoom] Auto-joining Daily room...");
      join();
    }
  }, [event?.room_url, isJoined, isJoining, dailyError, join]);

  // Join as viewer when component mounts (for non-creators)
  useEffect(() => {
    if (event && user && !isCreator && isJoined) {
      console.log("[LiveRoom] Joining as viewer...");
      joinAsViewer();
    }

    return () => {
      if (user && !isCreator) {
        console.log("[LiveRoom] Leaving as viewer...");
        leaveAsViewer();
      }
    };
  }, [event, user, isCreator, isJoined, joinAsViewer, leaveAsViewer]);

  // Handle closing the live room
  const handleClose = useCallback(async () => {
    if (isCreator && event) {
      console.log("[LiveRoom] Creator ending stream...");

      const { error: updateError } = await supabase
        .from("events")
        .update({
          is_live: false,
          live_ended_at: new Date().toISOString(),
        })
        .eq("id", event.id);

      if (updateError) {
        console.error("[LiveRoom] Error ending stream:", updateError);
        toast.error("Failed to end stream");
      } else {
        // Clean up all viewers
        await supabase.from("live_viewers").delete().eq("event_id", event.id);
        toast.success("Stream ended");
      }
    } else {
      await leaveAsViewer();
    }

    await leave();
    navigate("/");
  }, [isCreator, event, leaveAsViewer, leave, navigate]);

  // Chat handlers
  const handleOpenChat = () => {
    setShowChat(true);
    setShowMaterials(false);
  };

  const handleCloseChat = () => {
    setShowChat(false);
  };

  const handleSendMessage = (message: string) => {
    const newMessage: ChatMessage = {
      id: crypto.randomUUID(),
      username: user?.email?.split("@")[0] || "You",
      message,
      timestamp: new Date(),
    };
    setChatMessages((prev) => [...prev, newMessage]);
    // TODO: Wire to actual chat backend
  };

  // Materials handlers
  const handleOpenMaterials = () => {
    setShowMaterials(true);
    setShowChat(false);
  };

  const handleCloseMaterials = () => {
    setShowMaterials(false);
  };

  // Other handlers
  const handleRaiseHand = () => {
    setHandRaised((prev) => !prev);
    toast.success(handRaised ? "Hand lowered" : "Hand raised!");
    // TODO: Wire to backend notification
  };

  const handleSwipeToPay = () => {
    toast.success("Payment initiated!");
    // TODO: Wire to payment flow
  };

  // Get the host participant (for viewers to see)
  const hostParticipant = isCreator ? localParticipant : remoteParticipants[0];

  if (loading) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-electric mx-auto mb-4" />
          <p className="text-muted-foreground">Loading live room...</p>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
        <div className="text-center max-w-md px-6">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-display text-foreground mb-2">Stream Unavailable</h2>
          <p className="text-muted-foreground mb-6">{error || "This live stream is not available."}</p>
          <button
            onClick={() => navigate("/")}
            className="px-6 py-3 rounded-xl bg-electric text-white font-medium hover:bg-electric/90 transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  if (!event.room_url) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
        <div className="text-center max-w-md px-6">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-display text-foreground mb-2">Room Not Ready</h2>
          <p className="text-muted-foreground mb-6">
            The live room hasn't been created yet. Please wait for the creator to start the stream.
          </p>
          <button
            onClick={() => navigate("/")}
            className="px-6 py-3 rounded-xl bg-electric text-white font-medium hover:bg-electric/90 transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  if (permissionError) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
        <div className="text-center max-w-md px-6">
          <div className="flex items-center justify-center gap-2 mb-4">
            <MicOff className="w-8 h-8 text-destructive" />
            <VideoOff className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="text-xl font-display text-foreground mb-2">Camera/Mic Blocked</h2>
          <p className="text-muted-foreground mb-6">
            Please allow camera and microphone permissions in your browser settings, then refresh the page.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 rounded-xl bg-electric text-white font-medium hover:bg-electric/90 transition-colors"
            >
              Refresh Page
            </button>
            <button
              onClick={() => navigate("/")}
              className="px-6 py-3 rounded-xl bg-muted text-foreground font-medium hover:bg-muted/80 transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Connecting state
  if (isJoining) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-electric mx-auto mb-4" />
          <p className="text-muted-foreground">Connecting to stream...</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-background z-50"
      onClick={resetHideTimer}
    >
      {/* Video Container - Responsive Layout */}
      <div
        className={`w-full h-full ${
          isMobile
            ? "flex flex-col" // Mobile: vertical
            : "flex flex-row" // Desktop: horizontal
        }`}
      >
        {/* Main Video (Host or Self) */}
        <div className={`relative ${isMobile ? "flex-1" : "flex-1"} bg-surface overflow-hidden`}>
          {hostParticipant ? (
            <DailyVideoTile
              participant={hostParticipant}
              className="w-full h-full"
              isMirrored={isCreator}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-surface">
              {event.cover_url ? (
                <img
                  src={event.cover_url}
                  alt={event.title}
                  className="w-full h-full object-cover opacity-50"
                />
              ) : (
                <p className="text-muted-foreground">Waiting for host...</p>
              )}
            </div>
          )}

          {/* Header Overlay */}
          <LiveRoomHeader
            creatorName={event.creator?.name || "Unknown Artist"}
            creatorAvatar={event.creator?.avatar_url || null}
            eventTitle={event.title}
            viewerCount={viewerCount}
            isUIVisible={isUIVisible && !showMaterials}
            onClose={handleClose}
          />

          {/* Chat Overlay */}
          <LiveRoomChat
            isOpen={showChat}
            onClose={handleCloseChat}
            messages={chatMessages}
            onSendMessage={handleSendMessage}
          />

          {/* Materials Panel */}
          <LiveRoomMaterials
            isOpen={showMaterials}
            onClose={handleCloseMaterials}
            materials={materials}
          />

          {/* Controls */}
          <LiveRoomControls
            isHost={isCreator}
            isCameraOn={isCameraOn}
            isMicOn={isMicOn}
            isUIVisible={isUIVisible && !showChat}
            onToggleCamera={toggleCamera}
            onToggleMic={toggleMic}
            onEndStream={handleClose}
            onOpenChat={handleOpenChat}
            onRaiseHand={handleRaiseHand}
            onOpenMaterials={handleOpenMaterials}
            onSwipeToPay={handleSwipeToPay}
            handRaised={handRaised}
          />
        </div>

        {/* Desktop: Self-view pip for host */}
        {!isMobile && isCreator && localParticipant && (
          <div className="absolute bottom-24 right-4 w-48 h-32 rounded-xl overflow-hidden border-2 border-white/20 shadow-2xl z-10">
            <DailyVideoTile
              participant={localParticipant}
              className="w-full h-full"
              isMirrored
              showName
            />
          </div>
        )}
      </div>
    </motion.div>
  );
}
