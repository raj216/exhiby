import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Palette, Calendar, Clock, Users } from "lucide-react";
import { format, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AddToSessionsButton } from "./AddToSessionsButton";
import { triggerClickHaptic } from "@/lib/haptics";

interface UpcomingSession {
  id: string;
  title: string;
  scheduled_at: string;
  price: number;
  is_free: boolean;
  cover_url: string | null;
  ticketCount: number;
  savedCount: number;
  creator_id: string;
}

interface UpcomingSessionsPreviewProps {
  creatorUserId: string;
}

export function UpcomingSessionsPreview({ creatorUserId }: UpcomingSessionsPreviewProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sessions, setSessions] = useState<UpcomingSession[]>([]);
  const [loading, setLoading] = useState(true);

  // Check if viewing own profile
  const isOwnProfile = user?.id === creatorUserId;

  useEffect(() => {
    const fetchUpcomingSessions = async () => {
      setLoading(true);
      try {
        // Get scheduled events for this creator (not ended, not currently live)
        // This includes future events AND past-scheduled events that haven't started
        const { data: events, error: eventsError } = await supabase
          .from("events")
          .select("id, title, scheduled_at, price, is_free, cover_url, is_live, creator_id")
          .eq("creator_id", creatorUserId)
          .is("live_ended_at", null)
          .or("is_live.is.null,is_live.eq.false") // Not currently live
          .order("scheduled_at", { ascending: true })
          .limit(3);

        if (eventsError) {
          console.error("Error fetching upcoming sessions:", eventsError);
          setLoading(false);
          return;
        }

        if (!events || events.length === 0) {
          setSessions([]);
          setLoading(false);
          return;
        }

        // Get ticket counts and saved counts for each event
        const sessionsWithCounts: UpcomingSession[] = await Promise.all(
          events.map(async (event) => {
            const [ticketResult, savedResult] = await Promise.all([
              supabase
                .from("tickets")
                .select("*", { count: "exact", head: true })
                .eq("event_id", event.id),
              supabase
                .from("saved_sessions")
                .select("*", { count: "exact", head: true })
                .eq("event_id", event.id),
            ]);

            return {
              ...event,
              ticketCount: ticketResult.count || 0,
              savedCount: savedResult.count || 0,
              creator_id: event.creator_id,
            };
          })
        );

        setSessions(sessionsWithCounts);
      } catch (err) {
        console.error("Error fetching sessions:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchUpcomingSessions();
  }, [creatorUserId]);

  const handleSessionClick = (eventId: string) => {
    triggerClickHaptic();
    navigate(`/live/${eventId}`);
  };

  if (loading) {
    return (
      <div className="mt-6">
        <div className="h-4 w-40 bg-muted/50 rounded animate-pulse mb-3" />
        <div className="space-y-3">
          <div className="h-20 bg-muted/30 rounded-xl animate-pulse" />
          <div className="h-20 bg-muted/30 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (sessions.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
      className="mt-6"
    >
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-sm font-semibold text-foreground">Upcoming Sessions</h3>
        <div className="flex-1 h-px bg-border/50" />
      </div>

      <div className="space-y-3">
        {sessions.map((session, index) => {
          const scheduledDate = parseISO(session.scheduled_at);
          const dateStr = format(scheduledDate, "EEE, MMM d");
          const timeStr = format(scheduledDate, "h:mm a");
          const priceStr = session.is_free ? "Free" : `$${session.price}`;
          const totalInterested = session.ticketCount + session.savedCount;

          return (
            <motion.div
              key={session.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + index * 0.1 }}
              onClick={() => handleSessionClick(session.id)}
              className="flex items-start gap-3 p-3 rounded-xl bg-obsidian/50 border border-border/30 cursor-pointer hover:bg-obsidian/70 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-electric/10 flex items-center justify-center shrink-0">
                <Palette className="w-5 h-5 text-electric" />
              </div>

              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-foreground truncate">
                  {session.title}
                </h4>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {dateStr}
                  </div>
                  <span>•</span>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {timeStr}
                  </div>
                  <span>•</span>
                  <span className="text-gold font-medium">{priceStr}</span>
                </div>
                {totalInterested > 0 && (
                  <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground/70">
                    <Users className="w-3 h-3" />
                    {totalInterested} interested
                  </div>
                )}
              </div>

              {/* Add to My Sessions button - only show for non-owners */}
              {!isOwnProfile && user && (
                <AddToSessionsButton
                  eventId={session.id}
                  creatorId={session.creator_id}
                  variant="compact"
                />
              )}
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
