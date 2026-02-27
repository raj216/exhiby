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
  transactions: EarningRecord[];
}

export function useCreatorEarnings(userId: string | undefined) {
  return useQuery({
    queryKey: ["creator-earnings", userId],
    queryFn: async (): Promise<CreatorEarningsData> => {
      if (!userId) {
        return { lifetimeEarnings: 0, thisMonthEarnings: 0, lastMonthEarnings: 0, transactions: [] };
      }

      // Fetch all earnings for this creator
      const { data: earnings, error } = await supabase
        .from("creator_earnings")
        .select("id, event_id, user_id, amount_gross, platform_fee, amount_net, currency, created_at, status")
        .eq("creator_id", userId)
        .eq("status", "succeeded")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[useCreatorEarnings] Error:", error);
        return { lifetimeEarnings: 0, thisMonthEarnings: 0, lastMonthEarnings: 0, transactions: [] };
      }

      if (!earnings || earnings.length === 0) {
        return { lifetimeEarnings: 0, thisMonthEarnings: 0, lastMonthEarnings: 0, transactions: [] };
      }

      // Get event titles
      const eventIds = [...new Set(earnings.map(e => e.event_id))];
      const { data: events } = await supabase
        .from("events")
        .select("id, title")
        .in("id", eventIds);

      const eventMap = new Map((events || []).map(e => [e.id, e.title]));

      // Calculate month boundaries in UTC
      const now = new Date();
      const thisMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const lastMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
      const lastMonthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

      let lifetimeEarnings = 0;
      let thisMonthEarnings = 0;
      let lastMonthEarnings = 0;

      // Group by event for transaction list
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

        // Group by event
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

      const transactions = Array.from(eventGroupMap.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      return { lifetimeEarnings, thisMonthEarnings, lastMonthEarnings, transactions };
    },
    enabled: !!userId,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
}
