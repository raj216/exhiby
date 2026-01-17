import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, Loader2, Radio, Clock, Calendar, AlertCircle } from "lucide-react";
import { format, isToday, isTomorrow, differenceInMinutes } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { triggerClickHaptic } from "@/lib/haptics";
import { useAuth } from "@/contexts/AuthContext";

interface Event {
  id: string;
  title: string;
  cover_url: string | null;
  scheduled_at: string;
  is_free: boolean;
  price: number;
  creator_id: string;
  is_live: boolean | null;
  live_ended_at: string | null;
}

interface UpcomingEventsListProps {
  events: Event[];
  onEventDeleted: () => void;
}

type EventStatus = "upcoming" | "ready_to_go_live" | "missed" | "live";

export function UpcomingEventsList({
  events,
  onEventDeleted
}: UpcomingEventsListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [goingLiveId, setGoingLiveId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  // Don't render if no events
  if (events.length === 0) {
    return null;
  }

  const formatEventDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) {
      return `Today • ${format(date, "h:mm a")}`;
    }
    if (isTomorrow(date)) {
      return `Tomorrow • ${format(date, "h:mm a")}`;
    }
    return format(date, "MMM d • h:mm a");
  };

  // Determine event status based on time window:
  // - "upcoming": future (more than 15 min before start_time)
  // - "ready_to_go_live": within 15 min before to 60 min after start_time
  // - "missed": more than 60 min after start_time and never went live
  // - "live": currently live
  const getEventStatus = (event: Event): EventStatus => {
    if (event.is_live) {
      return "live";
    }
    
    const now = new Date();
    const scheduledDate = new Date(event.scheduled_at);
    const minutesUntilStart = differenceInMinutes(scheduledDate, now);
    const minutesSinceStart = differenceInMinutes(now, scheduledDate);
    
    // More than 15 minutes before start = upcoming
    if (minutesUntilStart > 15) {
      return "upcoming";
    }
    
    // Within 15 min before to 60 min after = ready to go live
    if (minutesUntilStart <= 15 && minutesSinceStart <= 60) {
      return "ready_to_go_live";
    }
    
    // More than 60 min after start = missed
    return "missed";
  };

  // Filter events to only show relevant ones (upcoming + ready_to_go_live)
  const filteredEvents = events.filter(event => {
    const status = getEventStatus(event);
    // Show upcoming and ready_to_go_live, hide missed
    return status === "upcoming" || status === "ready_to_go_live" || status === "live";
  });

  // Don't render if no relevant events after filtering
  if (filteredEvents.length === 0) {
    return null;
  }

  const handleGoLive = async (eventId: string) => {
    triggerClickHaptic();
    setGoingLiveId(eventId);
    try {
      const response = await supabase.functions.invoke("create-live-room", {
        body: { event_id: eventId },
      });

      if (response.error) {
        throw new Error(response.error.message || "Failed to create room");
      }

      toast({ title: "Going live!" });
      navigate(`/live/${eventId}`);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to go live",
        variant: "destructive"
      });
    } finally {
      setGoingLiveId(null);
    }
  };

  const handleDelete = async (eventId: string) => {
    triggerClickHaptic();
    setDeletingId(eventId);
    try {
      const { error } = await supabase.from('events').delete().eq('id', eventId);

      if (error) throw error;
      toast({ title: "Event deleted" });
      onEventDeleted();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to delete event",
        variant: "destructive"
      });
    } finally {
      setDeletingId(null);
    }
  };

  const renderEventCard = (event: Event) => {
    const status = getEventStatus(event);
    
    return (
      <motion.div
        key={event.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, x: -100 }}
        className={`flex items-center gap-3 rounded-xl p-3 border ${
          status === "ready_to_go_live" 
            ? "bg-destructive/10 border-destructive/30" 
            : "bg-obsidian border-border/30"
        }`}
      >
        {/* Thumbnail */}
        <div className="w-14 h-14 rounded-lg overflow-hidden bg-surface flex-shrink-0">
          {event.cover_url ? (
            <img src={event.cover_url} alt={event.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-2xl">
              🎨
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground text-sm truncate">{event.title}</p>
          {status === "ready_to_go_live" ? (
            <p className="text-xs text-destructive mt-0.5 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Scheduled for {formatEventDate(event.scheduled_at)}
            </p>
          ) : status === "upcoming" ? (
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formatEventDate(event.scheduled_at)}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatEventDate(event.scheduled_at)}
            </p>
          )}
        </div>

        {/* Action Button based on status */}
        {status === "ready_to_go_live" ? (
          <button
            onClick={() => handleGoLive(event.id)}
            disabled={goingLiveId === event.id}
            className="px-3 py-1.5 rounded-full text-xs font-semibold bg-destructive text-white flex items-center gap-1.5 hover:bg-destructive/90 transition-colors disabled:opacity-50"
          >
            {goingLiveId === event.id ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Radio className="w-3 h-3" />
            )}
            Go Live Now
          </button>
        ) : status === "upcoming" ? (
          <div className="flex-shrink-0">
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
              event.is_free 
                ? "bg-muted/80 text-muted-foreground border border-border/50" 
                : "bg-accent/15 text-accent border border-accent/30"
            }`}>
              {event.is_free ? "Free" : `$${event.price?.toFixed(2)}`}
            </span>
          </div>
        ) : null}

        {/* Delete Button - only show for event creator */}
        {user?.id === event.creator_id && (
          <button
            onClick={() => handleDelete(event.id)}
            disabled={deletingId === event.id}
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-muted"
          >
            {deletingId === event.id ? (
              <Loader2 className="w-4 h-4 text-destructive animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4 text-destructive" />
            )}
          </button>
        )}
      </motion.div>
    );
  };

  return (
    <div className="px-4 mt-4">
      <h3 className="text-sm font-medium text-muted-foreground mb-3">My Studio Schedule</h3>
      <div className="space-y-2">
        <AnimatePresence>
          {filteredEvents.map(event => renderEventCard(event))}
        </AnimatePresence>
      </div>
    </div>
  );
}