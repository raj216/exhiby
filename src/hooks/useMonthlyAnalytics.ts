import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SessionBreakdown {
  eventId: string;
  title: string;
  date: string;
  earnings: number;
  ticketCount: number;
}

export interface MonthlyAnalytics {
  totalEarnings: number;
  totalTickets: number;
  sessionBreakdowns: SessionBreakdown[];
}

export function useMonthlyAnalytics(userId: string | undefined) {
  const [analytics, setAnalytics] = useState<MonthlyAnalytics>({
    totalEarnings: 0,
    totalTickets: 0,
    sessionBreakdowns: [],
  });
  const [loading, setLoading] = useState(true);

  // Get the first and last day of the current month
  const { monthStart, monthEnd } = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return {
      monthStart: start.toISOString(),
      monthEnd: end.toISOString(),
    };
  }, []);

  const fetchAnalytics = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // First, get all events created by this user
      const { data: events, error: eventsError } = await supabase
        .from("events")
        .select("id, title, price, scheduled_at, is_free")
        .eq("creator_id", userId);

      if (eventsError) {
        console.error("Error fetching events:", eventsError);
        setLoading(false);
        return;
      }

      if (!events || events.length === 0) {
        setAnalytics({
          totalEarnings: 0,
          totalTickets: 0,
          sessionBreakdowns: [],
        });
        setLoading(false);
        return;
      }

      const eventIds = events.map((e) => e.id);
      const eventMap = new Map(events.map((e) => [e.id, e]));

      // Get all tickets for these events purchased this month
      const { data: tickets, error: ticketsError } = await supabase
        .from("tickets")
        .select("id, event_id, purchased_at")
        .in("event_id", eventIds)
        .gte("purchased_at", monthStart)
        .lte("purchased_at", monthEnd);

      if (ticketsError) {
        console.error("Error fetching tickets:", ticketsError);
        setLoading(false);
        return;
      }

      // Calculate per-session breakdown
      const breakdownMap = new Map<string, SessionBreakdown>();

      if (tickets) {
        for (const ticket of tickets) {
          const event = eventMap.get(ticket.event_id);
          if (!event) continue;

          const price = event.is_free ? 0 : Number(event.price) || 0;

          if (breakdownMap.has(ticket.event_id)) {
            const existing = breakdownMap.get(ticket.event_id)!;
            existing.earnings += price;
            existing.ticketCount += 1;
          } else {
            breakdownMap.set(ticket.event_id, {
              eventId: ticket.event_id,
              title: event.title,
              date: event.scheduled_at,
              earnings: price,
              ticketCount: 1,
            });
          }
        }
      }

      const sessionBreakdowns = Array.from(breakdownMap.values()).sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      const totalEarnings = sessionBreakdowns.reduce((sum, s) => sum + s.earnings, 0);
      const totalTickets = sessionBreakdowns.reduce((sum, s) => sum + s.ticketCount, 0);

      setAnalytics({
        totalEarnings,
        totalTickets,
        sessionBreakdowns,
      });
    } catch (err) {
      console.error("Error fetching monthly analytics:", err);
    } finally {
      setLoading(false);
    }
  }, [userId, monthStart, monthEnd]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Subscribe to realtime updates on tickets table for auto-update
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel("monthly-analytics")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "tickets",
        },
        () => {
          // Refetch analytics when a new ticket is inserted
          fetchAnalytics();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchAnalytics]);

  return { analytics, loading, refetch: fetchAnalytics };
}
