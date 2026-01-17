import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { AlertCircle, Loader2, MicOff, VideoOff, Clock, Calendar, Radio } from "lucide-react";
import { format, isPast } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useLiveViewers } from "@/hooks/useLiveViewers";
import { useMaterials } from "@/hooks/useMaterials";
import { useDaily, DailyJoinStatus } from "@/hooks/useDaily";
import { useLiveChat } from "@/hooks/useLiveChat";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  DailyVideoTile,
  LiveRoomControls,
  LiveRoomHeader,
  LiveRoomChat,
  LiveRoomMaterials,
  ChatNotificationToast,
} from "@/components/live";
import { DebugPanel } from "@/components/live/DebugPanel";
import { SessionFeedbackModal } from "@/components/SessionFeedbackModal";

interface EventData {
  id: string;
  title: string;
  cover_url: string | null;
  room_url: string | null;
  creator_id: string;
  is_live: boolean | null;
  scheduled_at: string;
  live_ended_at: string | null;
  category: string | null;
  creator?: {
    name: string;
    avatar_url: string | null;
  };
}

export default function LiveRoom() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { user, session } = useAuth();
  const { profile } = useProfile();
  const isMobile = useIsMobile();

  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [permissionError, setPermissionError] = useState(false);
  const [isRecreatingRoom, setIsRecreatingRoom] = useState(false);
  const [isRetryingDaily, setIsRetryingDaily] = useState(false);
  const [isEnding, setIsEnding] = useState(false);

  // UI State
  const [isUIVisible, setIsUIVisible] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [showMaterials, setShowMaterials] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  
  // Feedback modal state
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackLeftEarly, setFeedbackLeftEarly] = useState(false);
  const feedbackShownRef = useRef(false);
  
  // Debug state
  const [dailyStatus, setDailyStatus] = useState<DailyJoinStatus>("idle");
  
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const { viewerCount, joinAsViewer, leaveAsViewer } = useLiveViewers(eventId || null);
  
  const isCreator = user?.id === event?.creator_id;

  // Live chat from database with realtime
  const {
    messages: chatMessages,
    status: chatStatus,
    messageCount: chatMessageCount,
    sendMessage: sendChatMessage,
    unreadCount: chatUnreadCount,
    latestUnreadMessage,
    isChatOpen,
    openChat,
    closeChat,
    clearLatestUnread,
  } = useLiveChat({
    eventId: eventId || null,
    creatorId: event?.creator_id || null,
  });

  // Materials from database
  const {
    materials,
    addMaterial,
    updateMaterial,
    deleteMaterial,
  } = useMaterials(eventId || null);

  // Daily SDK integration
  const {
    localParticipant,
    remoteParticipants,
    isJoined,
    isJoining,
    isCameraOn,
    isMicOn,
    error: dailyError,
    errorStack: dailyErrorStack,
    status,
    join,
    leave,
    reset,
    toggleCamera,
    switchCamera,
    toggleMic,
  } = useDaily({
    roomUrl: event?.room_url || null,
    isHost: isCreator,
    userName: profile?.name || profile?.handle || user?.email?.split("@")[0] || "Guest",
    joinTimeoutMs: 12000,
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
    onStatusChange: (newStatus) => {
      console.log("[LiveRoom] Daily status changed:", newStatus);
      setDailyStatus(newStatus);
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
      console.error("[LiveRoom] No event ID in URL params");
      setError("No event ID provided");
      setLoading(false);
      return;
    }

    const fetchEvent = async () => {
      console.log("[LiveRoom] Fetching event:", eventId);

      try {
        const { data, error: fetchError } = await supabase
          .from("events")
          .select("id, title, cover_url, room_url, creator_id, is_live, scheduled_at, live_ended_at, category")
          .eq("id", eventId)
          .maybeSingle();

        if (fetchError) {
          console.error("[LiveRoom] Error fetching event:", fetchError);
          setError("Event not found");
          setLoading(false);
          return;
        }

        if (!data) {
          console.error("[LiveRoom] No event data returned for ID:", eventId);
          setError("Event not found");
          setLoading(false);
          return;
        }

        console.log("[LiveRoom] Event data:", JSON.stringify(data, null, 2));
        console.log("[LiveRoom] room_url:", data.room_url);
        console.log("[LiveRoom] is_live:", data.is_live);
        console.log("[LiveRoom] creator_id:", data.creator_id);

        // Fetch creator profile
        const { data: profiles } = await supabase.rpc("get_all_public_profiles");
        const creatorProfile = profiles?.find((p: any) => p.user_id === data.creator_id);

        setEvent({
          id: data.id,
          title: data.title,
          cover_url: data.cover_url,
          room_url: data.room_url,
          creator_id: data.creator_id,
          is_live: data.is_live,
          scheduled_at: data.scheduled_at,
          live_ended_at: data.live_ended_at,
          category: data.category,
          creator: creatorProfile
            ? { name: creatorProfile.name, avatar_url: creatorProfile.avatar_url }
            : { name: "Unknown Artist", avatar_url: null },
        });
      } catch (err) {
        console.error("[LiveRoom] Unexpected error:", err);
        setError("Failed to load event");
      } finally {
        setLoading(false);
      }
    };

    fetchEvent();
  }, [eventId]);

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

  // Handle recreating the room
  const handleRecreateRoom = useCallback(async () => {
    if (!eventId || !session?.access_token) {
      toast.error("You must be logged in to create a room");
      return;
    }

    console.log("[LiveRoom] Recreating room for event:", eventId);
    setIsRecreatingRoom(true);

    try {
      const response = await supabase.functions.invoke("create-live-room", {
        body: { event_id: eventId },
      });

      console.log("[LiveRoom] create-live-room response:", response);

      if (response.error) {
        console.error("[LiveRoom] Error from edge function:", response.error);
        toast.error(response.error.message || "Failed to create room");
        return;
      }

      const { room_url } = response.data;
      console.log("[LiveRoom] Room created:", room_url);

      if (room_url) {
        // Update local state
        setEvent((prev) => (prev ? { ...prev, room_url, is_live: true } : null));
        toast.success("Room created! Connecting...");
      } else {
        toast.error("No room URL returned");
      }
    } catch (err: any) {
      console.error("[LiveRoom] Error recreating room:", err);
      toast.error(err.message || "Failed to create room");
    } finally {
      setIsRecreatingRoom(false);
    }
  }, [eventId, session?.access_token]);

  const handleRetryDaily = useCallback(async () => {
    console.log("[LiveRoom] Retry Daily requested");
    setIsRetryingDaily(true);
    setPermissionError(false);

    try {
      await reset();
    } finally {
      setIsRetryingDaily(false);
    }
  }, [reset]);

  // Handle closing the live room (host = end stream, viewer = leave with feedback)
  const handleClose = useCallback(async () => {
    if (isEnding) return;
    setIsEnding(true);

    // Start leaving immediately for a snappier UX
    const leavePromise = leave();

    try {
      if (isCreator && event) {
        console.log("[LiveRoom] Creator ending stream...");

        const [updateRes] = await Promise.all([
          supabase
            .from("events")
            .update({
              is_live: false,
              live_ended_at: new Date().toISOString(),
            })
            .eq("id", event.id),

          // Clean up all viewers (doesn't need to block UI)
          supabase.from("live_viewers").delete().eq("event_id", event.id),
        ]);

        if (updateRes?.error) {
          console.error("[LiveRoom] Error ending stream:", updateRes.error);
          toast.error("Failed to end stream");
        } else {
          toast.success("Stream ended");
        }
        
        // Creator goes home without feedback modal
        await Promise.race([leavePromise, new Promise((r) => setTimeout(r, 1200))]);
        navigate("/");
      } else {
        // Viewer leaving - show feedback modal
        await leaveAsViewer();
        await Promise.race([leavePromise, new Promise((r) => setTimeout(r, 1200))]);
        
        // Show feedback modal for viewers (session ended normally)
        if (!feedbackShownRef.current && event) {
          feedbackShownRef.current = true;
          setFeedbackLeftEarly(false);
          setShowFeedbackModal(true);
        } else {
          navigate("/");
        }
      }
    } catch (err) {
      console.error("[LiveRoom] Error in handleClose:", err);
      navigate("/");
    }
  }, [isEnding, isCreator, event, leaveAsViewer, leave, navigate]);

  // Viewer leave handler (early leave)
  const handleLeave = useCallback(async () => {
    await leaveAsViewer();
    await leave();
    
    // Show feedback modal for viewers who left early
    if (!feedbackShownRef.current && event && !isCreator) {
      feedbackShownRef.current = true;
      setFeedbackLeftEarly(true);
      setShowFeedbackModal(true);
    } else {
      navigate("/");
    }
  }, [leaveAsViewer, leave, navigate, event, isCreator]);

  // Handle feedback modal close
  const handleFeedbackClose = useCallback(() => {
    setShowFeedbackModal(false);
    navigate("/");
  }, [navigate]);

  // Chat handlers - use the hook's open/close methods for proper unread tracking
  const handleOpenChat = () => {
    openChat();
    setShowChat(true);
    setShowMaterials(false);
  };

  const handleCloseChat = () => {
    closeChat();
    setShowChat(false);
  };

  const handleChatNotificationView = () => {
    handleOpenChat();
  };

  const handleSendMessage = async (message: string) => {
    return await sendChatMessage(message);
  };

  // Materials handlers
  const handleOpenMaterials = () => {
    setShowMaterials(true);
    setShowChat(false);
  };

  const handleCloseMaterials = () => {
    setShowMaterials(false);
  };

  const handleAddMaterial = async (name: string, brand?: string, spec?: string) => {
    return await addMaterial(name, brand, spec);
  };

  const handleUpdateMaterial = async (id: string, name: string, brand?: string, spec?: string) => {
    return await updateMaterial(id, name, brand, spec);
  };

  const handleDeleteMaterial = async (id: string) => {
    return await deleteMaterial(id);
  };

  // Other handlers
  const handleRaiseHand = () => {
    setHandRaised((prev) => !prev);
    toast.success(handRaised ? "Hand lowered" : "Hand raised!");
  };

  const handleSwipeToPay = () => {
    toast.success("Payment initiated!");
  };

  // Get the host participant (for viewers to see)
  const hostParticipant = isCreator ? localParticipant : remoteParticipants[0];

  // Debug data for panel
  const debugEventData = event ? {
    id: event.id,
    room_url: event.room_url,
    is_live: event.is_live,
    creator_id: event.creator_id,
  } : null;

  if (loading) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
        <DebugPanel
          eventId={eventId}
          eventData={null}
          dailyStatus={dailyStatus}
          errorMessage={null}
          errorStack={null}
          isRecreatingRoom={isRecreatingRoom}
          onRecreateRoom={handleRecreateRoom}
        />
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-electric mx-auto mb-4" />
          <p className="text-muted-foreground">Loading live room...</p>
        </div>
      </div>
    );
  }

  // Helper to check if event has truly ended
  const isEventEnded = event?.live_ended_at != null;
  
  // Helper to check if event is scheduled but not started
  const isScheduledNotStarted = event && !event.is_live && !event.live_ended_at && !event.room_url;
  
  // Helper to format scheduled time
  const formatScheduledTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return format(date, "EEEE, MMMM d 'at' h:mm a");
  };

  // Show "Stream Unavailable" only for ended events or truly not found
  if (error || !event) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
        <DebugPanel
          eventId={eventId}
          eventData={debugEventData}
          dailyStatus={dailyStatus}
          errorMessage={error}
          errorStack={null}
          isRecreatingRoom={isRecreatingRoom}
          onRecreateRoom={handleRecreateRoom}
        />
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

  // Show "Stream Ended" for ended events
  if (isEventEnded) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
        <div className="text-center max-w-md px-6">
          {event.cover_url && (
            <div className="w-24 h-24 rounded-2xl overflow-hidden mx-auto mb-6 opacity-60">
              <img src={event.cover_url} alt={event.title} className="w-full h-full object-cover" />
            </div>
          )}
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-display text-foreground mb-2">Studio Session Ended</h2>
          <p className="text-muted-foreground mb-2">{event.title}</p>
          <p className="text-sm text-muted-foreground/70 mb-6">
            This studio session has concluded.
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

  // Show waiting state for scheduled but not-yet-live events (for audience)
  if (!event.room_url) {
    const scheduledPast = isPast(new Date(event.scheduled_at));
    
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
        <DebugPanel
          eventId={eventId}
          eventData={debugEventData}
          dailyStatus={dailyStatus}
          errorMessage="Missing room_url for this event"
          errorStack={null}
          isRecreatingRoom={isRecreatingRoom}
          onRecreateRoom={handleRecreateRoom}
        />
        <div className="text-center max-w-md px-6">
          {/* Cover Image */}
          {event.cover_url && (
            <div className="w-32 h-32 rounded-2xl overflow-hidden mx-auto mb-6 shadow-lg">
              <img src={event.cover_url} alt={event.title} className="w-full h-full object-cover" />
            </div>
          )}
          
          {isCreator ? (
            // Creator view - Go Live CTA
            <>
              {scheduledPast ? (
                <div className="flex items-center justify-center gap-2 mb-4">
                  <Clock className="w-5 h-5 text-destructive" />
                  <span className="text-sm text-destructive font-medium">Ready to Go Live</span>
                </div>
              ) : (
                <Calendar className="w-10 h-10 text-electric mx-auto mb-4" />
              )}
              <h2 className="text-xl font-display text-foreground mb-2">{event.title}</h2>
              {event.category && (
                <p className="text-sm text-muted-foreground mb-2">{event.category}</p>
              )}
              <p className="text-muted-foreground mb-2">
                {scheduledPast 
                  ? `Scheduled for ${formatScheduledTime(event.scheduled_at)}`
                  : `Starts ${formatScheduledTime(event.scheduled_at)}`
                }
              </p>
              <p className="text-sm text-muted-foreground/70 mb-6">
                {scheduledPast 
                  ? "Your audience is waiting! Click below to start the stream."
                  : "Click below when you're ready to go live."
                }
              </p>
              <button
                onClick={handleRecreateRoom}
                disabled={isRecreatingRoom}
                className="px-6 py-3 rounded-xl bg-destructive text-white font-medium hover:bg-destructive/90 transition-colors disabled:opacity-50 flex items-center gap-2 mx-auto"
              >
                {isRecreatingRoom ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Going Live...
                  </>
                ) : (
                  <>
                    <Radio className="w-4 h-4" />
                    Go Live Now
                  </>
                )}
              </button>
            </>
          ) : (
            // Audience view - Waiting state
            <>
              <Clock className="w-10 h-10 text-electric mx-auto mb-4" />
              <h2 className="text-xl font-display text-foreground mb-2">{event.title}</h2>
              {event.creator && (
                <p className="text-sm text-muted-foreground mb-2">
                  by {event.creator.name}
                </p>
              )}
              {event.category && (
                <p className="text-xs text-muted-foreground/70 mb-3">{event.category}</p>
              )}
              <div className="bg-muted/30 rounded-xl px-4 py-3 mb-6">
                <p className="text-sm text-foreground">
                  {scheduledPast 
                    ? "This studio session hasn't started yet."
                    : "This studio session is scheduled for:"
                  }
                </p>
                <p className="text-sm text-electric font-medium mt-1">
                  {formatScheduledTime(event.scheduled_at)}
                </p>
              </div>
              <p className="text-sm text-muted-foreground mb-6">
                The creator will open the studio soon. Check back later or wait here.
              </p>
              <button
                onClick={() => navigate("/")}
                className="px-6 py-3 rounded-xl bg-muted text-foreground font-medium hover:bg-muted/80 transition-colors"
              >
                Back to Home
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // Only show permission error for hosts (viewers don't need camera/mic)
  if (permissionError && isCreator) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
        <DebugPanel
          eventId={eventId}
          eventData={debugEventData}
          dailyStatus={dailyStatus}
          errorMessage="Camera/Mic permission denied"
          errorStack={null}
          isRecreatingRoom={isRecreatingRoom}
          onRecreateRoom={handleRecreateRoom}
        />
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

  // Error or timeout state from Daily
  if (dailyStatus === "error" || dailyStatus === "timeout") {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
        <DebugPanel
          eventId={eventId}
          eventData={debugEventData}
          dailyStatus={dailyStatus}
          errorMessage={dailyError}
          errorStack={dailyErrorStack}
          isRecreatingRoom={isRecreatingRoom}
          onRecreateRoom={handleRecreateRoom}
        />
        <div className="text-center max-w-md px-6">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-display text-foreground mb-2">
            {dailyStatus === "timeout" ? "Connection Timeout" : "Connection Error"}
          </h2>
          <p className="text-muted-foreground mb-6">
            {dailyError || "Could not connect to the stream. Please try again."}
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={handleRetryDaily}
              disabled={isJoining || isRetryingDaily}
              className="px-6 py-3 rounded-xl bg-electric text-white font-medium hover:bg-electric/90 transition-colors disabled:opacity-50"
            >
              {isJoining || isRetryingDaily ? "Retrying..." : "Retry"}
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
  if (isJoining || status === "joining" || status === "creating") {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
        <DebugPanel
          eventId={eventId}
          eventData={debugEventData}
          dailyStatus={dailyStatus}
          errorMessage={dailyError}
          errorStack={dailyErrorStack}
          isRecreatingRoom={isRecreatingRoom}
          onRecreateRoom={handleRecreateRoom}
        />
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-electric mx-auto mb-4" />
          <p className="text-muted-foreground">Connecting to stream...</p>
          <p className="text-xs text-muted-foreground/50 mt-2">Status: {status}</p>
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
      {/* Debug Panel */}
      <DebugPanel
        eventId={eventId}
        eventData={debugEventData}
        dailyStatus={dailyStatus}
        errorMessage={dailyError}
        errorStack={dailyErrorStack}
        isRecreatingRoom={isRecreatingRoom}
        onRecreateRoom={handleRecreateRoom}
      />

      {/* Video Container - Responsive Layout */}
      <div
        className={`w-full h-full flex ${
          isMobile
            ? "flex-col" // Mobile/Tablet: fullscreen like FaceTime
            : "flex-row" // Desktop: horizontal layout
        } bg-black`}
      >
        {/* Main Video (Host or Self) */}
        <div className="relative flex-1 bg-black overflow-hidden">
          {hostParticipant ? (
            <DailyVideoTile
              participant={hostParticipant}
              className="w-full h-full"
              // Correct mirrored front camera for BOTH creator + audience
              isMirrored={hostParticipant.facingMode === "user"}
              useContain={!isMobile} // Mobile: cover (FaceTime style), Desktop: contain (no crop)
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-black">
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
            isHost={isCreator}
            onSwitchCamera={isCreator ? switchCamera : undefined}
          />

          {/* Chat Overlay */}
          <LiveRoomChat
            isOpen={showChat}
            onClose={handleCloseChat}
            messages={chatMessages}
            status={chatStatus}
            messageCount={chatMessageCount}
            onSendMessage={handleSendMessage}
            isAuthenticated={!!user}
          />

          {/* Materials Panel */}
          <LiveRoomMaterials
            isOpen={showMaterials}
            onClose={handleCloseMaterials}
            materials={materials}
            isHost={isCreator}
            onAddMaterial={handleAddMaterial}
            onUpdateMaterial={handleUpdateMaterial}
            onDeleteMaterial={handleDeleteMaterial}
          />

          {/* Controls */}
          <LiveRoomControls
            isHost={isCreator}
            isCameraOn={isCameraOn}
            isMicOn={isMicOn}
            isUIVisible={isUIVisible && !showChat}
            isEnding={isEnding}
            onToggleCamera={toggleCamera}
            onSwitchCamera={switchCamera}
            onToggleMic={toggleMic}
            onEndStream={handleClose}
            onLeave={handleLeave}
            onOpenChat={handleOpenChat}
            onRaiseHand={handleRaiseHand}
            onOpenMaterials={handleOpenMaterials}
            onSwipeToPay={handleSwipeToPay}
            handRaised={handRaised}
            unreadChatCount={showChat ? 0 : chatUnreadCount}
          />

          {/* Chat Notification Toast */}
          <ChatNotificationToast
            message={latestUnreadMessage}
            isChatOpen={showChat}
            onView={handleChatNotificationView}
            onDismiss={clearLatestUnread}
          />
        </div>

        {/* Desktop: optional self-view pip for host (avoid duplicating the same tile) */}
        {!isMobile &&
          isCreator &&
          localParticipant &&
          hostParticipant &&
          hostParticipant.sessionId !== localParticipant.sessionId && (
            <div className="absolute bottom-24 right-4 w-48 h-32 rounded-xl overflow-hidden border-2 border-white/20 shadow-2xl z-10">
              <DailyVideoTile
                participant={localParticipant}
                className="w-full h-full"
                // Correct mirrored front camera for creator PIP
                isMirrored={localParticipant.facingMode === "user"}
                showName
              />
            </div>
          )}
      </div>
      
      {/* Session Feedback Modal */}
      {event && (
        <SessionFeedbackModal
          isOpen={showFeedbackModal}
          onClose={handleFeedbackClose}
          eventId={event.id}
          creatorId={event.creator_id}
          creatorName={event.creator?.name || "the creator"}
          sessionTitle={event.title}
          leftEarly={feedbackLeftEarly}
        />
      )}
    </motion.div>
  );
}
