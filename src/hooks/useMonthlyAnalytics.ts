import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

const DEBUG_TICKETS = import.meta.env.DEV && localStorage.getItem("debug_tickets") === "1";

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
      // First, get all PAID events created by this user (is_free = false AND price > 0)
      const { data: events, error: eventsError } = await supabase
        .from("events")
        .select("id, title, price, scheduled_at, is_free")
        .eq("creator_id", userId)
        .eq("is_free", false);

      if (eventsError) {
        console.error("Error fetching events:", eventsError);
        setLoading(false);
        return;
      }

      // Filter to only include events with price > 0
      const paidEvents = (events || []).filter(e => Number(e.price) > 0);

      if (DEBUG_TICKETS) {
        console.log("[MonthlyAnalytics] creatorId:", userId);
        console.log("[MonthlyAnalytics] Total events (is_free=false):", events?.length || 0);
        console.log("[MonthlyAnalytics] Paid events (price > 0):", paidEvents.length);
      }

      if (paidEvents.length === 0) {
        if (DEBUG_TICKETS) {
          console.log("[MonthlyAnalytics] No paid events found, returning 0 tickets");
        }
        setAnalytics({
          totalEarnings: 0,
          totalTickets: 0,
          sessionBreakdowns: [],
        });
        setLoading(false);
        return;
      }

      const eventIds = paidEvents.map((e) => e.id);
      const eventMap = new Map(paidEvents.map((e) => [e.id, e]));

      // Get all tickets for PAID events purchased this month
      // Note: Currently the tickets table doesn't have a payment_status field.
      // Tickets are only inserted for:
      //   - Free events: via direct client insert (RLS allows)
      //   - Paid events: via purchase-ticket edge function after successful payment
      // 
      // CRITICAL: The edge function allows creators to bypass payment for their OWN events
      // (for testing). These self-tickets are NOT sales and must be excluded.
      // A real "sale" = ticket where user_id != event.creator_id
      const { data: tickets, error: ticketsError } = await supabase
        .from("tickets")
        .select("id, event_id, purchased_at, user_id, payment_status")
        .in("event_id", eventIds)
        .eq("payment_status", "paid")
        .gte("purchased_at", monthStart)
        .lte("purchased_at", monthEnd);

      if (ticketsError) {
        console.error("Error fetching tickets:", ticketsError);
        setLoading(false);
        return;
      }

      if (DEBUG_TICKETS) {
        console.log("[MonthlyAnalytics] Raw tickets found for paid events this month:", tickets?.length || 0);
      }

      // Calculate per-session breakdown (only for paid sessions)
      // CRITICAL: Exclude self-tickets (creator buying their own event = not a real sale)
      const breakdownMap = new Map<string, SessionBreakdown>();
      let skippedSelfTickets = 0;

      if (tickets) {
        for (const ticket of tickets) {
          const event = eventMap.get(ticket.event_id);
          if (!event) continue;

          // Double-check: only count if event is paid (is_free=false AND price > 0)
          const price = Number(event.price) || 0;
          if (event.is_free || price <= 0) {
            if (DEBUG_TICKETS) {
              console.log("[MonthlyAnalytics] Skipping ticket for free/zero-price event:", ticket.event_id);
            }
            continue;
          }

          // CRITICAL: Skip self-tickets - creator purchasing their own event is NOT a sale
          // The edge function allows creators to bypass payment for testing, but these
          // should never count as "Tickets Sold"
          if (ticket.user_id === userId) {
            skippedSelfTickets++;
            if (DEBUG_TICKETS) {
              console.log("[MonthlyAnalytics] Skipping self-ticket (creator=buyer):", ticket.id);
            }
            continue;
          }

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

      if (DEBUG_TICKETS) {
        console.log("[MonthlyAnalytics] Self-tickets skipped (not counted as sales):", skippedSelfTickets);
      }

      const sessionBreakdowns = Array.from(breakdownMap.values()).sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      const totalEarnings = sessionBreakdowns.reduce((sum, s) => sum + s.earnings, 0);
      const totalTickets = sessionBreakdowns.reduce((sum, s) => sum + s.ticketCount, 0);

      if (DEBUG_TICKETS) {
        console.log("[MonthlyAnalytics] Final ticketsCount:", totalTickets);
        console.log("[MonthlyAnalytics] Qualifying paid ticket purchases:", totalTickets);
        console.log("[MonthlyAnalytics] Session breakdowns:", sessionBreakdowns);
      }

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
      .channel(`monthly-analytics-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "creator_earnings",
          filter: `creator_id=eq.${userId}`,
        },
        () => {
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
