import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UseEventTicketResult {
  hasValidTicket: boolean;
  isLoading: boolean;
  ticketId: string | null;
  purchaseTicket: () => Promise<boolean>;
  markAttended: () => Promise<void>;
  refetch: () => void;
}

/**
 * Hook to check if current user has a valid ticket for a specific event.
 * Used to prevent double-charging on rejoin for paid live sessions.
 */
export function useEventTicket(eventId: string | null, userId: string | undefined): UseEventTicketResult {
  const [hasValidTicket, setHasValidTicket] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [ticketId, setTicketId] = useState<string | null>(null);

  const fetchTicket = useCallback(async () => {
    if (!eventId || !userId) {
      setHasValidTicket(false);
      setTicketId(null);
      setIsLoading(false);
      return;
    }

    try {
      console.log("[useEventTicket] Checking ticket for event:", eventId, "user:", userId);
      
      const { data, error } = await supabase
        .from("tickets")
        .select("id, purchased_at")
        .eq("event_id", eventId)
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        console.error("[useEventTicket] Error checking ticket:", error);
        setHasValidTicket(false);
        setTicketId(null);
      } else if (data) {
        console.log("[useEventTicket] Found valid ticket:", data.id);
        setHasValidTicket(true);
        setTicketId(data.id);
      } else {
        console.log("[useEventTicket] No ticket found for this event");
        setHasValidTicket(false);
        setTicketId(null);
      }
    } catch (err) {
      console.error("[useEventTicket] Unexpected error:", err);
      setHasValidTicket(false);
      setTicketId(null);
    } finally {
      setIsLoading(false);
    }
  }, [eventId, userId]);

  useEffect(() => {
    fetchTicket();
  }, [fetchTicket]);

  /**
   * Purchase a ticket for this event.
   * Returns true if successful, false otherwise.
   * Uses upsert to prevent duplicates on (event_id, user_id).
   */
  const purchaseTicket = useCallback(async (): Promise<boolean> => {
    if (!eventId || !userId) {
      console.error("[useEventTicket] Cannot purchase: missing eventId or userId");
      return false;
    }

    try {
      console.log("[useEventTicket] Creating ticket for event:", eventId);

      // Use upsert to prevent duplicates - if ticket already exists, just update purchased_at
      const { data, error } = await supabase
        .from("tickets")
        .upsert(
          {
            event_id: eventId,
            user_id: userId,
            purchased_at: new Date().toISOString(),
          },
          {
            onConflict: "event_id,user_id",
            ignoreDuplicates: false,
          }
        )
        .select("id")
        .single();

      if (error) {
        console.error("[useEventTicket] Error creating ticket:", error);
        return false;
      }

      console.log("[useEventTicket] Ticket created successfully:", data.id);
      setHasValidTicket(true);
      setTicketId(data.id);
      return true;
    } catch (err) {
      console.error("[useEventTicket] Unexpected error creating ticket:", err);
      return false;
    }
  }, [eventId, userId]);

  /**
   * Mark the ticket as attended (user joined the live session).
   */
  const markAttended = useCallback(async (): Promise<void> => {
    if (!ticketId || !userId) {
      return;
    }

    try {
      console.log("[useEventTicket] Marking ticket as attended:", ticketId);

      const { error } = await supabase
        .from("tickets")
        .update({ attended_at: new Date().toISOString() })
        .eq("id", ticketId)
        .eq("user_id", userId);

      if (error) {
        console.error("[useEventTicket] Error marking attended:", error);
      }
    } catch (err) {
      console.error("[useEventTicket] Unexpected error marking attended:", err);
    }
  }, [ticketId, userId]);

  return {
    hasValidTicket,
    isLoading,
    ticketId,
    purchaseTicket,
    markAttended,
    refetch: fetchTicket,
  };
}
