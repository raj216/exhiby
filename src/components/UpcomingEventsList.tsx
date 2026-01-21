import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, Loader2, Radio, Clock, Calendar, CalendarClock, Share } from "lucide-react";
import { format, isToday, isTomorrow, differenceInMinutes } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { triggerClickHaptic } from "@/lib/haptics";
import { useAuth } from "@/contexts/AuthContext";
import { DeleteEventModal } from "./DeleteEventModal";
import { RescheduleEventModal } from "./RescheduleEventModal";

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
  const [goingLiveId, setGoingLiveId] = useState<string | null>(null);
  const [deleteModalEvent, setDeleteModalEvent] = useState<Event | null>(null);
  const [rescheduleModalEvent, setRescheduleModalEvent] = useState<Event | null>(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  // Don't render if no events
  if (events.length === 0) {
    return null;
  }

  const formatEventDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) {
      return { date: "Today", time: format(date, "h:mm a") };
    }
    if (isTomorrow(date)) {
      return { date: "Tomorrow", time: format(date, "h:mm a") };
    }
    return { date: format(date, "MMM d"), time: format(date, "h:mm a") };
  };

  const handleShare = async (event: Event) => {
    triggerClickHaptic();
    
    const shareUrl = `${window.location.origin}/event/${event.id}`;
    const shareData = {
      title: event.title,
      text: "Join this session on Exhiby!",
      url: shareUrl,
    };
    
    if (navigator.share && navigator.canShare?.(shareData)) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('Share failed:', err);
        }
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl);
        toast({
          title: "Link Copied",
          description: "Event link copied to clipboard",
        });
      } catch (err) {
        console.error('Clipboard failed:', err);
      }
    }
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

  const handleDeleteClick = (event: Event) => {
    triggerClickHaptic();
    setDeleteModalEvent(event);
  };

  const handleRescheduleClick = (event: Event) => {
    triggerClickHaptic();
    setRescheduleModalEvent(event);
  };

  const renderEventCard = (event: Event) => {
    const status = getEventStatus(event);
    const isCreator = user?.id === event.creator_id;
    
    return (
      <motion.div
        key={event.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, x: -100 }}
        className={`flex items-center gap-3 rounded-xl p-3 border ${
          status === "ready_to_go_live" 
            ? "bg-surface border-destructive/30" 
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
            <div className="mt-0.5">
              <p className="text-xs text-destructive flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatEventDate(event.scheduled_at).date}
              </p>
              <p className="text-xs text-destructive/80 ml-4">
                {formatEventDate(event.scheduled_at).time}
              </p>
            </div>
          ) : status === "upcoming" ? (
            <div className="mt-0.5">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {formatEventDate(event.scheduled_at).date}
              </p>
              <p className="text-xs text-muted-foreground/80 ml-4">
                {formatEventDate(event.scheduled_at).time}
              </p>
            </div>
          ) : (
            <div className="mt-0.5">
              <p className="text-xs text-muted-foreground">
                {formatEventDate(event.scheduled_at).date}
              </p>
              <p className="text-xs text-muted-foreground/80">
                {formatEventDate(event.scheduled_at).time}
              </p>
            </div>
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

        {/* Reschedule Button - only show for event creator on upcoming events */}
        {isCreator && status === "upcoming" && (
          <button
            onClick={() => handleRescheduleClick(event)}
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-muted hover:bg-muted/80 transition-colors"
            title="Reschedule"
          >
            <CalendarClock className="w-4 h-4 text-accent" />
          </button>
        )}

        {/* Share Button - only show for event creator */}
        {isCreator && (
          <button
            onClick={() => handleShare(event)}
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 glass border border-border/40 hover:bg-white/15 transition-colors"
            title="Share"
          >
            <Share className="w-4 h-4 text-foreground" />
          </button>
        )}

        {/* Delete Button - only show for event creator */}
        {isCreator && (
          <button
            onClick={() => handleDeleteClick(event)}
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-muted hover:bg-muted/80 transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4 text-destructive" />
          </button>
        )}
      </motion.div>
    );
  };

  return (
    <>
      <div className="px-4 mt-4">
        <h3 className="text-sm font-medium text-muted-foreground mb-3">My Studio Schedule</h3>
        <div className="space-y-2">
          <AnimatePresence>
            {filteredEvents.map(event => renderEventCard(event))}
          </AnimatePresence>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModalEvent && (
        <DeleteEventModal
          isOpen={!!deleteModalEvent}
          onClose={() => setDeleteModalEvent(null)}
          eventId={deleteModalEvent.id}
          eventTitle={deleteModalEvent.title}
          onDeleted={onEventDeleted}
        />
      )}

      {/* Reschedule Modal */}
      {rescheduleModalEvent && (
        <RescheduleEventModal
          isOpen={!!rescheduleModalEvent}
          onClose={() => setRescheduleModalEvent(null)}
          eventId={rescheduleModalEvent.id}
          eventTitle={rescheduleModalEvent.title}
          currentScheduledAt={rescheduleModalEvent.scheduled_at}
          onRescheduled={onEventDeleted}
        />
      )}
    </>
  );
}