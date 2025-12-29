import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { X, Users, AlertCircle, Loader2, Mic, MicOff, Video, VideoOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLiveViewers } from "@/hooks/useLiveViewers";
import { toast } from "sonner";

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
  
  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [permissionError, setPermissionError] = useState(false);
  
  const { viewerCount, joinAsViewer, leaveAsViewer } = useLiveViewers(eventId || null);
  
  const isCreator = user?.id === event?.creator_id;

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

  // Join as viewer when component mounts (for non-creators)
  useEffect(() => {
    if (event && user && !isCreator) {
      console.log("[LiveRoom] Joining as viewer...");
      joinAsViewer();
    }

    return () => {
      if (user && !isCreator) {
        console.log("[LiveRoom] Leaving as viewer...");
        leaveAsViewer();
      }
    };
  }, [event, user, isCreator, joinAsViewer, leaveAsViewer]);

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
        await supabase
          .from("live_viewers")
          .delete()
          .eq("event_id", event.id);
          
        toast.success("Stream ended");
      }
    } else {
      await leaveAsViewer();
    }
    
    navigate("/");
  }, [isCreator, event, leaveAsViewer, navigate]);

  // Handle permission errors from iframe
  const handleIframeLoad = () => {
    console.log("[LiveRoom] Daily iframe loaded");
  };

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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-background z-50 flex flex-col"
    >
      {/* Top Bar Overlay */}
      <div 
        className="absolute top-0 left-0 right-0 z-10 p-4"
        style={{ 
          background: "linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 70%, transparent 100%)",
          paddingTop: "max(16px, env(safe-area-inset-top))"
        }}
      >
        <div className="flex items-center justify-between">
          {/* Artist Info */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-primary/50 bg-muted">
              {event.creator?.avatar_url ? (
                <img
                  src={event.creator.avatar_url}
                  alt={event.creator.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-sm font-medium">
                  {event.creator?.name?.[0] || "?"}
                </div>
              )}
            </div>
            <div>
              <p className="text-white font-semibold text-sm">{event.creator?.name}</p>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <div className="relative">
                    <div className="w-2 h-2 rounded-full bg-live" />
                    <div className="absolute inset-0 w-2 h-2 rounded-full bg-live animate-ping" />
                  </div>
                  <span className="text-xs font-bold text-white">LIVE</span>
                </div>
                <div className="flex items-center gap-1 text-white/70">
                  <Users className="w-3 h-3" />
                  <motion.span 
                    key={viewerCount}
                    initial={{ scale: 1.2 }}
                    animate={{ scale: 1 }}
                    className="text-xs"
                  >
                    {viewerCount}
                  </motion.span>
                </div>
              </div>
            </div>
          </div>

          {/* Close Button */}
          <button
            onClick={handleClose}
            className="w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center hover:bg-black/70 transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      {/* Event Title */}
      <div className="absolute bottom-20 left-0 right-0 z-10 px-4">
        <h2 className="text-white font-display text-xl drop-shadow-lg">{event.title}</h2>
        {isCreator && (
          <p className="text-white/70 text-sm mt-1">You are the host</p>
        )}
      </div>

      {/* Daily.co Iframe - Full Screen */}
      <iframe
        src={event.room_url}
        allow="camera; microphone; fullscreen; display-capture; autoplay"
        className="w-full h-full border-0"
        onLoad={handleIframeLoad}
        onError={() => {
          console.error("[LiveRoom] Iframe error");
          setPermissionError(true);
        }}
      />

      {/* Bottom Control Bar for Creator */}
      {isCreator && (
        <div className="absolute bottom-0 left-0 right-0 z-10 p-4 bg-gradient-to-t from-black/80 to-transparent">
          <div className="flex items-center justify-center">
            <button
              onClick={handleClose}
              className="px-6 py-3 rounded-full bg-destructive text-white font-semibold hover:bg-destructive/90 transition-colors"
            >
              End Stream
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
