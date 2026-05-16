import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type EarningType = "ticket" | "tip";

export interface EarningRecord {
  id: string;
  event_id: string;
  event_title: string;
  amount_gross: number; // cents
  platform_fee: number; // cents
  amount_net: number; // cents
  currency: string;
  created_at: string;       // when the earning row was logged (purchase time)
  session_date: string;     // when the session was scheduled (events.scheduled_at)
                            // OR purchase date as fallback if scheduled_at is null
  session_date_estimated: boolean; // true when session_date fell back to created_at
  ticket_count: number;
  type: EarningType;
}

export interface CreatorEarningsData {
  lifetimeEarnings: number; // cents
  thisMonthEarnings: number; // cents
  lastMonthEarnings: number; // cents
  totalPaidOut: number; // cents
  availableToPayout: number; // cents
  transactions: EarningRecord[];
}

export function useCreatorEarnings(userId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["creator-earnings", userId],
    queryFn: async (): Promise<CreatorEarningsData> => {
      if (!userId) {
        return { lifetimeEarnings: 0, thisMonthEarnings: 0, lastMonthEarnings: 0, totalPaidOut: 0, availableToPayout: 0, transactions: [] };
      }

      // Fetch earnings and payouts in parallel
      const [earningsRes, payoutsRes] = await Promise.all([
        supabase
          .from("creator_earnings")
          .select("id, event_id, user_id, amount_gross, platform_fee, amount_net, currency, created_at, status, ticket_id")
          .eq("creator_id", userId)
          .eq("status", "succeeded")
          .order("created_at", { ascending: false }),
        supabase
          .from("creator_payouts")
          .select("amount, status")
          .eq("creator_id", userId)
          .in("status", ["pending", "paid"]),
      ]);

      const earnings = earningsRes.data || [];
      const payouts = payoutsRes.data || [];

      if (earnings.length === 0) {
        return { lifetimeEarnings: 0, thisMonthEarnings: 0, lastMonthEarnings: 0, totalPaidOut: 0, availableToPayout: 0, transactions: [] };
      }

      // Get event titles + scheduled dates (the real session date, not purchase date)
      const eventIds = [...new Set(earnings.map(e => e.event_id))];
      const { data: events } = await supabase
        .from("events")
        .select("id, title, scheduled_at")
        .in("id", eventIds);

      const eventMap = new Map(
        (events || []).map(e => [e.id, { title: e.title, scheduled_at: e.scheduled_at as string | null }])
      );

      const now = new Date();
      const thisMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const lastMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
      const lastMonthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

      let lifetimeEarnings = 0;
      let thisMonthEarnings = 0;
      let lastMonthEarnings = 0;

      // Group by event_id + type (ticket vs tip)
      const groupKey = (eventId: string, isTip: boolean) => `${eventId}::${isTip ? "tip" : "ticket"}`;
      const groupMap = new Map<string, EarningRecord>();

      for (const e of earnings) {
        const gross = e.amount_gross || 0;
        // Cap legacy rows that were recorded at 10% — free plan max is 8%.
        // Pro/Plus rows are at 4% so they are never affected by this cap.
        const maxFee = Math.round(gross * 0.08);
        const correctedFee = Math.min(e.platform_fee || 0, maxFee);
        const correctedNet = gross - correctedFee;

        lifetimeEarnings += correctedNet;

        const createdAt = new Date(e.created_at);
        if (createdAt >= thisMonthStart) {
          thisMonthEarnings += correctedNet;
        } else if (createdAt >= lastMonthStart && createdAt < lastMonthEnd) {
          lastMonthEarnings += correctedNet;
        }

        const isTip = e.ticket_id === null;
        const key = groupKey(e.event_id, isTip);

        if (groupMap.has(key)) {
          const existing = groupMap.get(key)!;
          existing.amount_gross += gross;
          existing.platform_fee += correctedFee;
          existing.amount_net += correctedNet;
          existing.ticket_count += isTip ? 0 : 1;
        } else {
          const evt = eventMap.get(e.event_id);
          const hasScheduled = !!evt?.scheduled_at;
          groupMap.set(key, {
            id: e.id,
            event_id: e.event_id,
            event_title: evt?.title || "Untitled Session",
            user_id: e.user_id,
            amount_gross: gross,
            platform_fee: correctedFee,
            amount_net: correctedNet,
            currency: e.currency,
            created_at: e.created_at,
            session_date: hasScheduled ? evt!.scheduled_at! : e.created_at,
            session_date_estimated: !hasScheduled,
            ticket_count: isTip ? 0 : 1,
            type: isTip ? "tip" : "ticket",
          });
        }
      }

      const totalPaidOut = payouts.reduce((sum, p) => sum + (p.amount || 0), 0);
      const availableToPayout = Math.max(0, lifetimeEarnings - totalPaidOut);

      const transactions = Array.from(groupMap.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      return { lifetimeEarnings, thisMonthEarnings, lastMonthEarnings, totalPaidOut, availableToPayout, transactions };
    },
    enabled: !!userId,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`creator-earnings-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "creator_earnings",
          filter: `creator_id=eq.${userId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["creator-earnings", userId] });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "creator_earnings",
          filter: `creator_id=eq.${userId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["creator-earnings", userId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  return query;
}
