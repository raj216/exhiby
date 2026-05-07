/**
 * useCreatorAudience
 * ─────────────────────────────────────────────────────────────────────────────
 * Returns audience stats and attendee list for a creator's sessions.
 *
 * Segment logic:
 *   VIP       — attended 5+ sessions
 *   REPEAT    — attended 2–4 sessions
 *   NEW       — attended 1 session
 *
 * Realtime: subscribes to tickets INSERT/UPDATE so the audience tab updates
 * instantly when new attendees purchase tickets.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AttendeeSegment = "VIP" | "REPEAT" | "NEW";

export interface CreatorAttendee {
  userId: string;
  name: string;
  avatarUrl: string | null;
  sessionsAttended: number;
  totalSpent: number; // cents
  lastAttended: Date;
  segment: AttendeeSegment;
}

export interface CreatorAudienceStats {
  uniqueAttendees: number;
  vipFans: number;      // 5+ sessions
  repeatAttendees: number; // 2+ sessions
}

export function useCreatorAudience(creatorId: string | undefined) {
  const [attendees, setAttendees] = useState<CreatorAttendee[]>([]);
  const [stats, setStats] = useState<CreatorAudienceStats>({
    uniqueAttendees: 0,
    vipFans: 0,
    repeatAttendees: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  // Keep a stable ref to the event IDs so the realtime subscription doesn't
  // need to be recreated every time the list changes.
  const eventIdsRef = useRef<string[]>([]);

  const fetchAudience = useCallback(async () => {
    if (!creatorId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // 1. Get all events for this creator
      const { data: events } = await supabase
        .from("events")
        .select("id, title, price")
        .eq("creator_id", creatorId);

      if (!events || events.length === 0) {
        setAttendees([]);
        setStats({ uniqueAttendees: 0, vipFans: 0, repeatAttendees: 0 });
        setIsLoading(false);
        return;
      }

      const eventIds = events.map((e) => e.id);
      eventIdsRef.current = eventIds;
      const priceMap = new Map(events.map((e) => [e.id, Number(e.price) || 0]));

      // 2. Get all tickets for those events (exclude self-tickets from creator)
      //    Count both paid and free tickets — all are valid audience members.
      const { data: tickets } = await supabase
        .from("tickets")
        .select("id, event_id, user_id, purchased_at, attended_at, payment_status")
        .in("event_id", eventIds)
        .neq("user_id", creatorId)
        .in("payment_status", ["paid", "free"]);

      if (!tickets || tickets.length === 0) {
        setAttendees([]);
        setStats({ uniqueAttendees: 0, vipFans: 0, repeatAttendees: 0 });
        setIsLoading(false);
        return;
      }

      // 3. Build per-user aggregation
      const userMap = new Map<
        string,
        { sessionsAttended: number; totalSpent: number; lastAttended: Date }
      >();

      for (const ticket of tickets) {
        const price = priceMap.get(ticket.event_id) || 0;
        const attendedAt = ticket.attended_at
          ? new Date(ticket.attended_at)
          : ticket.purchased_at
          ? new Date(ticket.purchased_at)
          : new Date();

        if (userMap.has(ticket.user_id)) {
          const existing = userMap.get(ticket.user_id)!;
          existing.sessionsAttended += 1;
          existing.totalSpent += price;
          if (attendedAt > existing.lastAttended) {
            existing.lastAttended = attendedAt;
          }
        } else {
          userMap.set(ticket.user_id, {
            sessionsAttended: 1,
            totalSpent: price,
            lastAttended: attendedAt,
          });
        }
      }

      // 4. Fetch profiles for all attendees
      const userIds = Array.from(userMap.keys());
      const { data: profiles } = await supabase.rpc("get_creator_profiles", {
        user_ids: userIds,
      });

      const profileMap = new Map(
        (profiles || []).map((p: { user_id: string; name: string; avatar_url: string | null }) => [
          p.user_id,
          p,
        ])
      );

      // 5. Build attendee list with segments
      const list: CreatorAttendee[] = [];
      for (const [userId, data] of userMap.entries()) {
        const profile = profileMap.get(userId);
        const segment: AttendeeSegment =
          data.sessionsAttended >= 5
            ? "VIP"
            : data.sessionsAttended >= 2
            ? "REPEAT"
            : "NEW";

        list.push({
          userId,
          name: (profile as { name?: string })?.name || "Unknown",
          avatarUrl: (profile as { avatar_url?: string | null })?.avatar_url ?? null,
          sessionsAttended: data.sessionsAttended,
          totalSpent: data.totalSpent,
          lastAttended: data.lastAttended,
          segment,
        });
      }

      // Sort by sessions attended desc, then by last attended
      list.sort((a, b) => {
        if (b.sessionsAttended !== a.sessionsAttended) {
          return b.sessionsAttended - a.sessionsAttended;
        }
        return b.lastAttended.getTime() - a.lastAttended.getTime();
      });

      const uniqueAttendees = list.length;
      const vipFans = list.filter((a) => a.segment === "VIP").length;
      const repeatAttendees = list.filter((a) => a.segment !== "NEW").length;

      setAttendees(list);
      setStats({ uniqueAttendees, vipFans, repeatAttendees });
    } catch (err) {
      console.error("[useCreatorAudience] Error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [creatorId]);

  useEffect(() => {
    fetchAudience();
  }, [fetchAudience]);

  // ── Realtime subscription: re-fetch when any ticket for this creator changes
  useEffect(() => {
    if (!creatorId) return;

    // Subscribe to creator_earnings so we're notified of any ticket purchase
    // (earnings are created by the purchase-ticket edge function on success).
    const channel = supabase
      .channel(`audience-rt-${creatorId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "creator_earnings",
          filter: `creator_id=eq.${creatorId}`,
        },
        () => {
          // Debounce slightly to batch rapid purchases
          setTimeout(() => fetchAudience(), 300);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "tickets",
        },
        (payload) => {
          // Only refetch if ticket is for one of this creator's events
          const eventId = (payload.new as { event_id?: string })?.event_id;
          if (eventId && eventIdsRef.current.includes(eventId)) {
            setTimeout(() => fetchAudience(), 300);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [creatorId, fetchAudience]);

  return { attendees, stats, isLoading, refetch: fetchAudience };
}
