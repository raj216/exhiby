import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PublicCreatorStats {
  sessionsHosted: number;
  averageRating: number;
  totalGuests: number;
  isCreator: boolean;
}

export function usePublicCreatorStats(userId: string | undefined) {
  const [stats, setStats] = useState<PublicCreatorStats>({
    sessionsHosted: 0,
    averageRating: 0,
    totalGuests: 0,
    isCreator: false,
  });
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Check if user has creator role
      const { data: hasCreatorRole } = await supabase.rpc("has_role", {
        _user_id: userId,
        _role: "creator",
      });

      if (!hasCreatorRole) {
        setStats({
          sessionsHosted: 0,
          averageRating: 0,
          totalGuests: 0,
          isCreator: false,
        });
        setLoading(false);
        return;
      }

      // Count completed sessions (events where live_ended_at is set)
      const { count: sessionsCount, error: sessionsError } = await supabase
        .from("events")
        .select("*", { count: "exact", head: true })
        .eq("creator_id", userId)
        .not("live_ended_at", "is", null);

      if (sessionsError) {
        console.error("Error fetching sessions count:", sessionsError);
      }

      // Get all events for this creator to count total guests
      const { data: events, error: eventsError } = await supabase
        .from("events")
        .select("id")
        .eq("creator_id", userId);

      if (eventsError) {
        console.error("Error fetching events:", eventsError);
      }

      let totalGuests = 0;
      if (events && events.length > 0) {
        const eventIds = events.map((e) => e.id);
        
        // Count unique attendees from tickets table
        const { count: ticketsCount, error: ticketsError } = await supabase
          .from("tickets")
          .select("*", { count: "exact", head: true })
          .in("event_id", eventIds);

        if (ticketsError) {
          console.error("Error fetching tickets count:", ticketsError);
        }

        totalGuests = ticketsCount || 0;
      }

      // Fetch real ratings from session_feedback table
      let averageRating = 0;
      let ratingBasedGuests = 0;
      
      const { data: ratingStats, error: ratingError } = await supabase.rpc(
        "get_creator_rating_stats",
        { target_creator_id: userId }
      );

      if (ratingError) {
        console.error("Error fetching rating stats:", ratingError);
      } else if (ratingStats && ratingStats.length > 0) {
        averageRating = Number(ratingStats[0].average_rating) || 0;
        ratingBasedGuests = ratingStats[0].total_guests || 0;
      }

      // Use the higher of ticket-based or feedback-based guest count
      const finalGuestCount = Math.max(totalGuests, ratingBasedGuests);

      setStats({
        sessionsHosted: sessionsCount || 0,
        averageRating,
        totalGuests: finalGuestCount,
        isCreator: true,
      });
    } catch (err) {
      console.error("Error fetching public creator stats:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, refetch: fetchStats };
}
