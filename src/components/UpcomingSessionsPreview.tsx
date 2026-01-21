import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Palette, Calendar, Clock, Users, Radio, AlertCircle } from "lucide-react";
import { format, parseISO, differenceInMinutes } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AddToSessionsButton } from "./AddToSessionsButton";
import { triggerClickHaptic } from "@/lib/haptics";
import { Button } from "@/components/ui/button";

// Session status based on time + database state
type SessionStatus = "upcoming" | "live" | "recently_ended" | "missed";

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
  is_live: boolean | null;
  live_ended_at: string | null;
  // Computed status
  status: SessionStatus;
  endedMinutesAgo?: number;
}

interface UpcomingSessionsPreviewProps {
  creatorUserId: string;
}

// Compute session status based on time and database state
function computeSessionStatus(
  scheduledAt: string,
  isLive: boolean | null,
  liveEndedAt: string | null,
  now: Date
): { status: SessionStatus; endedMinutesAgo?: number } {
  const scheduledTime = parseISO(scheduledAt);
  const minutesSinceScheduled = differenceInMinutes(now, scheduledTime);

  // If currently live
  if (isLive === true) {
    return { status: "live" };
  }

  // If ended (has live_ended_at)
  if (liveEndedAt) {
    const endedTime = parseISO(liveEndedAt);
    const minutesSinceEnded = differenceInMinutes(now, endedTime);
    
    // Show for 20 minutes after ending
    if (minutesSinceEnded <= 20) {
      return { status: "recently_ended", endedMinutesAgo: minutesSinceEnded };
    }
    // Hide after 20 minutes
    return { status: "recently_ended", endedMinutesAgo: minutesSinceEnded };
  }

  // If scheduled time is in the future
  if (scheduledTime > now) {
    return { status: "upcoming" };
  }

  // Scheduled time passed but never went live (missed)
  // Show as missed for up to 60 minutes, then hide
  if (minutesSinceScheduled <= 60) {
    return { status: "missed" };
  }

  // Beyond 60 minutes - treat as hidden (won't be shown)
  return { status: "missed", endedMinutesAgo: minutesSinceScheduled };
}

export function UpcomingSessionsPreview({ creatorUserId }: UpcomingSessionsPreviewProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sessions, setSessions] = useState<UpcomingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());

  // Check if viewing own profile
  const isOwnProfile = user?.id === creatorUserId;

  const fetchUpcomingSessions = useCallback(async () => {
    try {
      const currentTime = new Date();
      const twentyMinutesAgo = new Date(currentTime.getTime() - 20 * 60 * 1000);
      const sixtyMinutesAgo = new Date(currentTime.getTime() - 60 * 60 * 1000);

      // Fetch sessions with proper time-aware filtering:
      // 1. Future scheduled sessions (upcoming)
      // 2. Currently live sessions
      // 3. Recently ended sessions (within 20 min)
      // 4. Missed sessions (scheduled passed but not live, within 60 min)
      // IMPORTANT: future sessions must be truly scheduled (not ended/cancelled).
      // We defensively exclude rows that have live_ended_at set, even if scheduled_at is in the future,
      // to prevent "ghost" sessions from rendering.
      const { data: events, error: eventsError } = await supabase
        .from("events")
        .select(
          "id, title, scheduled_at, price, is_free, cover_url, is_live, creator_id, live_ended_at"
        )
        .eq("creator_id", creatorUserId)
        .or(
          // Future scheduled sessions (must not be ended)
          `and(scheduled_at.gt.${currentTime.toISOString()},live_ended_at.is.null,or(is_live.is.null,is_live.eq.false)),` +
            // Currently live
            `and(is_live.eq.true,live_ended_at.is.null),` +
            // Recently ended (20 min)
            `live_ended_at.gte.${twentyMinutesAgo.toISOString()},` +
            // Missed within 60 min
            `and(scheduled_at.gte.${sixtyMinutesAgo.toISOString()},scheduled_at.lte.${currentTime.toISOString()},live_ended_at.is.null,or(is_live.is.null,is_live.eq.false))`
        )
        .order("scheduled_at", { ascending: true })
        .limit(10); // Fetch more initially, filter client-side

      if (eventsError) {
        console.error("Error fetching upcoming sessions:", eventsError);
        return;
      }

      if (!events || events.length === 0) {
        setSessions([]);
        return;
      }

      // Get ticket counts and saved counts for each event
      const sessionsWithStatus: UpcomingSession[] = await Promise.all(
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

          const { status, endedMinutesAgo } = computeSessionStatus(
            event.scheduled_at,
            event.is_live,
            event.live_ended_at,
            currentTime
          );

          return {
            ...event,
            ticketCount: ticketResult.count || 0,
            savedCount: savedResult.count || 0,
            status,
            endedMinutesAgo,
          };
        })
      );

      // Filter out sessions that should be hidden
      const visibleSessions = sessionsWithStatus.filter((session) => {
        // Always show upcoming and live
        if (session.status === "upcoming" || session.status === "live") {
          return true;
        }
        // Show recently ended only for 20 min
        if (session.status === "recently_ended") {
          return (session.endedMinutesAgo || 0) <= 20;
        }
        // Show missed only for 60 min (creator-only, but we filter in render)
        if (session.status === "missed") {
          return (session.endedMinutesAgo || 0) <= 60;
        }
        return false;
      });

      // Sort: LIVE first, then upcoming (soonest first), then recently ended, then missed
      const sortedSessions = visibleSessions.sort((a, b) => {
        const statusOrder: Record<SessionStatus, number> = {
          live: 0,
          upcoming: 1,
          recently_ended: 2,
          missed: 3,
        };

        if (statusOrder[a.status] !== statusOrder[b.status]) {
          return statusOrder[a.status] - statusOrder[b.status];
        }

        // Within same status, sort by scheduled time
        const aTime = parseISO(a.scheduled_at).getTime();
        const bTime = parseISO(b.scheduled_at).getTime();
        
        if (a.status === "upcoming") {
          return aTime - bTime; // Soonest first for upcoming
        }
        return bTime - aTime; // Most recent first for ended/missed
      });

      // Limit to 3 sessions
      setSessions(sortedSessions.slice(0, 3));
    } catch (err) {
      console.error("Error fetching sessions:", err);
    } finally {
      setLoading(false);
    }
  }, [creatorUserId]);

  useEffect(() => {
    fetchUpcomingSessions();
  }, [fetchUpcomingSessions]);

  // Update relative times every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
      fetchUpcomingSessions();
    }, 60000);

    return () => clearInterval(interval);
  }, [fetchUpcomingSessions]);

  // Subscribe to realtime changes on events table
  useEffect(() => {
    const channel = supabase
      .channel(`creator-events-${creatorUserId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "events",
          filter: `creator_id=eq.${creatorUserId}`,
        },
        () => {
          // Refetch when any event changes
          fetchUpcomingSessions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [creatorUserId, fetchUpcomingSessions]);

  const handleSessionClick = (session: UpcomingSession) => {
    triggerClickHaptic();
    navigate(`/live/${session.id}`);
  };

  const renderStatusBadge = (session: UpcomingSession) => {
    switch (session.status) {
      case "live":
        return (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            LIVE
          </div>
        );
      case "recently_ended":
        return (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            Ended {session.endedMinutesAgo || 0}m ago
          </div>
        );
      case "missed":
        // Only show missed label to the creator
        if (isOwnProfile) {
          return (
            <div className="flex items-center gap-1 text-xs text-orange-400/80">
              <AlertCircle className="w-3 h-3" />
              Missed
            </div>
          );
        }
        return null;
      default:
        return null;
    }
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

  // Filter missed sessions for non-owners
  const displaySessions = sessions.filter((session) => {
    if (session.status === "missed" && !isOwnProfile) {
      return false;
    }
    return true;
  });

  if (displaySessions.length === 0) {
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
        <AnimatePresence mode="popLayout">
          {displaySessions.map((session, index) => {
            const scheduledDate = parseISO(session.scheduled_at);
            const dateStr = format(scheduledDate, "EEE, MMM d");
            const timeStr = format(scheduledDate, "h:mm a");
            const priceStr = session.is_free ? "Free" : `$${session.price}`;
            const totalInterested = session.ticketCount + session.savedCount;
            const isLive = session.status === "live";
            const isEnded = session.status === "recently_ended";
            const isMissed = session.status === "missed";

            return (
              <motion.div
                key={session.id}
                layout
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ delay: 0.1 + index * 0.05 }}
                onClick={() => handleSessionClick(session)}
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                  isLive
                    ? "bg-red-500/5 border-red-500/30 hover:bg-red-500/10"
                    : isEnded
                    ? "bg-muted/20 border-border/20 opacity-70 hover:opacity-90"
                    : isMissed
                    ? "bg-orange-500/5 border-orange-500/20 hover:bg-orange-500/10"
                    : "bg-obsidian/50 border-border/30 hover:bg-obsidian/70"
                }`}
              >
                {/* Event Thumbnail */}
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-surface shrink-0">
                  {session.cover_url ? (
                    <img 
                      src={session.cover_url} 
                      alt={session.title} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div
                      className={`w-full h-full flex items-center justify-center ${
                        isLive
                          ? "bg-red-500/20"
                          : isEnded
                          ? "bg-muted/30"
                          : isMissed
                          ? "bg-orange-500/10"
                          : "bg-electric/10"
                      }`}
                    >
                      {isLive ? (
                        <Radio className="w-5 h-5 text-red-400" />
                      ) : (
                        <Palette className={`w-5 h-5 ${isEnded || isMissed ? "text-muted-foreground" : "text-electric"}`} />
                      )}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className={`text-sm font-medium truncate ${isEnded ? "text-muted-foreground" : "text-foreground"}`}>
                      {session.title}
                    </h4>
                    {renderStatusBadge(session)}
                  </div>
                  <div className={`flex items-center gap-2 mt-1 text-xs ${isEnded ? "text-muted-foreground/60" : "text-muted-foreground"}`}>
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
                    <span className={`font-medium ${isEnded ? "text-muted-foreground/60" : "text-gold"}`}>{priceStr}</span>
                  </div>
                  {totalInterested > 0 && (
                    <div className={`flex items-center gap-1 mt-1.5 text-xs ${isEnded ? "text-muted-foreground/40" : "text-muted-foreground/70"}`}>
                      <Users className="w-3 h-3" />
                      {totalInterested} interested
                    </div>
                  )}
                </div>

                {/* Action area - different based on status */}
                {isLive ? (
                  <Button
                    size="sm"
                    className="bg-red-500 hover:bg-red-600 text-white text-xs h-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSessionClick(session);
                    }}
                  >
                    Join Live
                  </Button>
                ) : !isOwnProfile && user && session.status === "upcoming" ? (
                  <AddToSessionsButton
                    eventId={session.id}
                    creatorId={session.creator_id}
                    variant="compact"
                  />
                ) : null}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
