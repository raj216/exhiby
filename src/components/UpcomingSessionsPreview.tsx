import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Palette, Calendar, Clock, Users } from "lucide-react";
import { format, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

interface UpcomingSession {
  id: string;
  title: string;
  scheduled_at: string;
  price: number;
  is_free: boolean;
  cover_url: string | null;
  ticketCount: number;
}

interface UpcomingSessionsPreviewProps {
  creatorUserId: string;
}

export function UpcomingSessionsPreview({ creatorUserId }: UpcomingSessionsPreviewProps) {
  const [sessions, setSessions] = useState<UpcomingSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUpcomingSessions = async () => {
      setLoading(true);
      try {
        // Get upcoming events for this creator
        const { data: events, error: eventsError } = await supabase
          .from("events")
          .select("id, title, scheduled_at, price, is_free, cover_url")
          .eq("creator_id", creatorUserId)
          .gte("scheduled_at", new Date().toISOString())
          .is("live_ended_at", null)
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

        // Get ticket counts for each event
        const sessionsWithCounts: UpcomingSession[] = await Promise.all(
          events.map(async (event) => {
            const { count } = await supabase
              .from("tickets")
              .select("*", { count: "exact", head: true })
              .eq("event_id", event.id);

            return {
              ...event,
              ticketCount: count || 0,
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

          return (
            <motion.div
              key={session.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + index * 0.1 }}
              className="flex items-start gap-3 p-3 rounded-xl bg-obsidian/50 border border-border/30"
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
                {session.ticketCount > 0 && (
                  <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground/70">
                    <Users className="w-3 h-3" />
                    {session.ticketCount} attending
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
