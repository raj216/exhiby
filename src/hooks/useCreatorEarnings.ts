import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface EarningRecord {
  id: string;
  event_id: string;
  event_title: string;
  user_id: string;
  amount_gross: number; // cents
  platform_fee: number; // cents
  amount_net: number; // cents
  currency: string;
  created_at: string;
  ticket_count: number;
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
  return useQuery({
    queryKey: ["creator-earnings", userId],
    queryFn: async (): Promise<CreatorEarningsData> => {
      if (!userId) {
        return { lifetimeEarnings: 0, thisMonthEarnings: 0, lastMonthEarnings: 0, totalPaidOut: 0, availableToPayout: 0, transactions: [] };
      }

      // Fetch earnings and payouts in parallel
      const [earningsRes, payoutsRes] = await Promise.all([
        supabase
          .from("creator_earnings")
          .select("id, event_id, user_id, amount_gross, platform_fee, amount_net, currency, created_at, status")
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

      // Get event titles
      const eventIds = [...new Set(earnings.map(e => e.event_id))];
      const { data: events } = await supabase
        .from("events")
        .select("id, title")
        .in("id", eventIds);

      const eventMap = new Map((events || []).map(e => [e.id, e.title]));

      const now = new Date();
      const thisMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const lastMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
      const lastMonthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

      let lifetimeEarnings = 0;
      let thisMonthEarnings = 0;
      let lastMonthEarnings = 0;

      const eventGroupMap = new Map<string, EarningRecord>();

      for (const e of earnings) {
        const netCents = e.amount_net || 0;
        lifetimeEarnings += netCents;

        const createdAt = new Date(e.created_at);
        if (createdAt >= thisMonthStart) {
          thisMonthEarnings += netCents;
        } else if (createdAt >= lastMonthStart && createdAt < lastMonthEnd) {
          lastMonthEarnings += netCents;
        }

        if (eventGroupMap.has(e.event_id)) {
          const existing = eventGroupMap.get(e.event_id)!;
          existing.amount_gross += e.amount_gross || 0;
          existing.platform_fee += e.platform_fee || 0;
          existing.amount_net += netCents;
          existing.ticket_count += 1;
        } else {
          eventGroupMap.set(e.event_id, {
            id: e.id,
            event_id: e.event_id,
            event_title: eventMap.get(e.event_id) || "Untitled Session",
            user_id: e.user_id,
            amount_gross: e.amount_gross || 0,
            platform_fee: e.platform_fee || 0,
            amount_net: netCents,
            currency: e.currency,
            created_at: e.created_at,
            ticket_count: 1,
          });
        }
      }

      const totalPaidOut = payouts.reduce((sum, p) => sum + (p.amount || 0), 0);
      const availableToPayout = Math.max(0, lifetimeEarnings - totalPaidOut);

      const transactions = Array.from(eventGroupMap.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      return { lifetimeEarnings, thisMonthEarnings, lastMonthEarnings, totalPaidOut, availableToPayout, transactions };
    },
    enabled: !!userId,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
}
