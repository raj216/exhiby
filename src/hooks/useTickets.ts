import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface TicketWithEvent {
  id: string;
  event_id: string;
  purchased_at: string;
  attended_at: string | null;
  event: {
    id: string;
    title: string;
    scheduled_at: string;
    category: string | null;
    creator_id: string;
    is_live: boolean | null;
    live_ended_at: string | null;
    creator?: {
      name: string;
      avatar_url: string | null;
    };
  };
}

export type TicketSessionStatus = "upcoming" | "starting_soon" | "live" | "ended" | "missed";

export interface UpcomingSession {
  id: string;
  eventId: string;
  title: string;
  artistName: string;
  artistAvatar: string | null;
  coverUrl: string | null;
  scheduledAt: Date;
  endTime: Date;
  category: string | null;
  isLive: boolean;
  creatorId: string;
  status: TicketSessionStatus;
  attended: boolean;
}

export interface PastSession {
  id: string;
  eventId: string;
  artistName: string;
  category: string | null;
  attendedAt: Date;
}

export function useTickets(userId: string | undefined) {
  const [upcomingSessions, setUpcomingSessions] = useState<UpcomingSession[]>([]);
  const [pastSessions, setPastSessions] = useState<PastSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTickets = async () => {
      if (!userId) {
        setUpcomingSessions([]);
        setPastSessions([]);
        setIsLoading(false);
        return;
      }

      try {
        // Fetch tickets with event details
        const { data: tickets, error } = await supabase
          .from("tickets")
          .select(`
            id,
            event_id,
            purchased_at,
            attended_at
          `)
          .eq("user_id", userId)
          .in("payment_status", ["paid", "free"]);

        if (error) {
          console.error("Error fetching tickets:", error);
          setIsLoading(false);
          return;
        }

        if (!tickets || tickets.length === 0) {
          setUpcomingSessions([]);
          setPastSessions([]);
          setIsLoading(false);
          return;
        }

        // Fetch events for these tickets
        const eventIds = tickets.map(t => t.event_id);
        const { data: events, error: eventsError } = await supabase
          .from("events")
          .select("id, title, cover_url, scheduled_at, end_time, duration_minutes, category, creator_id, is_live, live_ended_at")
          .in("id", eventIds);

        if (eventsError) {
          console.error("Error fetching events:", eventsError);
          setIsLoading(false);
          return;
        }

        // Get unique creator IDs
        const creatorIds = [...new Set(events?.map(e => e.creator_id) || [])];
        
        // Fetch creator profiles using secure RPC
        const { data: profiles, error: profilesError } = await supabase
          .rpc("get_creator_profiles", { user_ids: creatorIds });

        if (profilesError) {
          console.error("Error fetching profiles:", profilesError);
        }

        // Create a map for quick lookup
        const eventMap = new Map(events?.map(e => [e.id, e]) || []);
        const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

        const now = new Date();
        const upcoming: UpcomingSession[] = [];
        const past: PastSession[] = [];

        for (const ticket of tickets) {
          const event = eventMap.get(ticket.event_id);
          if (!event) continue;

          const creator = profileMap.get(event.creator_id);
          const scheduledAt = new Date(event.scheduled_at);
          
          // Compute end_time
          let endTime: Date;
          if (event.end_time) {
            endTime = new Date(event.end_time);
          } else {
            const durationMs = (event.duration_minutes || 60) * 60 * 1000;
            endTime = new Date(scheduledAt.getTime() + durationMs);
          }
          
          const hasEnded = event.live_ended_at !== null || now > endTime;
          const wasAttended = ticket.attended_at !== null;
          const isLive = event.is_live || false;

          // Compute status
          let status: TicketSessionStatus;
          if (isLive && !event.live_ended_at) {
            status = "live";
          } else if (hasEnded) {
            status = wasAttended ? "ended" : "missed";
          } else if (now < scheduledAt) {
            const msUntilStart = scheduledAt.getTime() - now.getTime();
            const minutesUntilStart = msUntilStart / (1000 * 60);
            status = minutesUntilStart <= 15 ? "starting_soon" : "upcoming";
          } else {
            status = "starting_soon";
          }

          // All sessions go to upcoming array (we filter in UI)
          upcoming.push({
            id: ticket.id,
            eventId: event.id,
            title: event.title,
            artistName: creator?.name || "Unknown Artist",
            artistAvatar: creator?.avatar_url || null,
            coverUrl: event.cover_url ?? null,
            scheduledAt,
            endTime,
            category: event.category,
            isLive,
            creatorId: event.creator_id,
            status,
            attended: wasAttended,
          });

          // Also add to past if ended (for past sessions section)
          if (hasEnded) {
            past.push({
              id: ticket.id,
              eventId: event.id,
              artistName: creator?.name || "Unknown Artist",
              category: event.category,
              attendedAt: ticket.attended_at 
                ? new Date(ticket.attended_at) 
                : new Date(event.live_ended_at || event.scheduled_at),
            });
          }
        }

        // Sort upcoming by scheduled time (soonest first)
        upcoming.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
        
        // Sort past by attended date (most recent first)
        past.sort((a, b) => b.attendedAt.getTime() - a.attendedAt.getTime());

        setUpcomingSessions(upcoming);
        setPastSessions(past);
      } catch (err) {
        console.error("Error in useTickets:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTickets();
  }, [userId]);

  return { upcomingSessions, pastSessions, isLoading };
}
