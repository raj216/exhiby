import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UseEventTicketResult {
  hasValidTicket: boolean;
  isLoading: boolean;
  ticketId: string | null;
  paymentStatus: string | null;
  purchaseTicket: () => Promise<boolean>;
  markAttended: () => Promise<void>;
  refetch: () => void;
  pollForConfirmation: () => void;
}

/**
 * Hook to check if current user has a valid ticket for a specific event.
 * Only considers tickets with payment_status 'paid' or 'free' as valid.
 * Pending tickets (awaiting Stripe webhook) are NOT valid for entry.
 */
export function useEventTicket(eventId: string | null, userId: string | undefined): UseEventTicketResult {
  const [hasValidTicket, setHasValidTicket] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const verifyCalledRef = useRef(false);

  const fetchTicket = useCallback(async () => {
    if (!eventId || !userId) {
      setHasValidTicket(false);
      setTicketId(null);
      setPaymentStatus(null);
      setIsLoading(false);
      return;
    }

    try {
      console.log("[useEventTicket] Checking ticket for event:", eventId, "user:", userId);
      
      // Only count tickets with confirmed payment status
      const { data, error } = await supabase
        .from("tickets")
        .select("id, purchased_at, payment_status")
        .eq("event_id", eventId)
        .eq("user_id", userId)
        .in("payment_status", ["paid", "free"])
        .maybeSingle();

      if (error) {
        console.error("[useEventTicket] Error checking ticket:", error);
        setHasValidTicket(false);
        setTicketId(null);
        setPaymentStatus(null);
      } else if (data) {
        console.log("[useEventTicket] Found valid ticket:", data.id, "status:", data.payment_status);
        setHasValidTicket(true);
        setTicketId(data.id);
        setPaymentStatus(data.payment_status);
      } else {
        console.log("[useEventTicket] No valid ticket found for this event");
        setHasValidTicket(false);
        setTicketId(null);
        setPaymentStatus(null);
      }
    } catch (err) {
      console.error("[useEventTicket] Unexpected error:", err);
      setHasValidTicket(false);
      setTicketId(null);
      setPaymentStatus(null);
    } finally {
      setIsLoading(false);
    }
  }, [eventId, userId]);

  useEffect(() => {
    fetchTicket();
  }, [fetchTicket]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, []);

  /**
   * Call verify-checkout-session edge function as a fallback
   * when webhook hasn't updated the ticket yet.
   */
  const verifyCheckoutSession = useCallback(async (): Promise<boolean> => {
    if (!eventId) return false;
    try {
      console.log("[useEventTicket] Calling verify-checkout-session fallback...");
      const { data, error } = await supabase.functions.invoke("verify-checkout-session", {
        body: { event_id: eventId },
      });
      if (error) {
        console.error("[useEventTicket] Verify error:", error);
        return false;
      }
      if (data?.verified) {
        console.log("[useEventTicket] Verify confirmed! Ticket:", data.ticket_id);
        return true;
      }
      console.log("[useEventTicket] Verify result:", data);
      return false;
    } catch (err) {
      console.error("[useEventTicket] Verify unexpected error:", err);
      return false;
    }
  }, [eventId]);

  /**
   * Poll for ticket confirmation after Stripe redirect.
   * Checks every 2 seconds. After 3 failed DB checks, calls
   * verify-checkout-session as a fallback to check Stripe directly.
   */
  const pollForConfirmation = useCallback(() => {
    if (!eventId || !userId) return;
    
    // Reset verify flag for new poll cycle
    verifyCalledRef.current = false;
    
    // Clear any existing poll
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    let attempts = 0;
    const maxAttempts = 20; // 40 seconds total

    console.log("[useEventTicket] Starting poll for payment confirmation...");
    
    pollIntervalRef.current = setInterval(async () => {
      attempts++;
      console.log(`[useEventTicket] Poll attempt ${attempts}/${maxAttempts}`);

      try {
        // First check if the ticket is already confirmed in DB
        const { data, error } = await supabase
          .from("tickets")
          .select("id, payment_status")
          .eq("event_id", eventId)
          .eq("user_id", userId)
          .in("payment_status", ["paid", "free"])
          .maybeSingle();

        if (data && !error) {
          console.log("[useEventTicket] Payment confirmed! Ticket:", data.id);
          setHasValidTicket(true);
          setTicketId(data.id);
          setPaymentStatus(data.payment_status);
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          return;
        }

        // After 3 attempts (~6s), use fallback to check Stripe directly
        if (attempts >= 3 && !verifyCalledRef.current) {
          verifyCalledRef.current = true;
          const verified = await verifyCheckoutSession();
          if (verified) {
            // Re-fetch ticket to update local state
            await fetchTicket();
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
            return;
          }
        }

        // After more attempts, try verify again
        if (attempts >= 8 && attempts % 4 === 0) {
          const verified = await verifyCheckoutSession();
          if (verified) {
            await fetchTicket();
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
            return;
          }
        }
      } catch (err) {
        console.error("[useEventTicket] Poll error:", err);
      }

      if (attempts >= maxAttempts) {
        console.warn("[useEventTicket] Payment confirmation poll timed out");
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      }
    }, 2000);
  }, [eventId, userId, verifyCheckoutSession, fetchTicket]);

  /**
   * Purchase a ticket for this event (free events only).
   * For paid events, use the create-checkout-session flow instead.
   */
  const purchaseTicket = useCallback(async (): Promise<boolean> => {
    if (!eventId || !userId) {
      console.error("[useEventTicket] Cannot purchase: missing eventId or userId");
      return false;
    }

    try {
      console.log("[useEventTicket] Requesting ticket for event:", eventId);

      const { data, error } = await supabase.functions.invoke("purchase-ticket", {
        body: { event_id: eventId },
      });

      if (error) {
        console.error("[useEventTicket] Error requesting ticket:", error);
        return false;
      }

      const ticket_id = (data as { ticket_id?: string } | null)?.ticket_id;
      if (!ticket_id) {
        console.error("[useEventTicket] Missing ticket_id in response");
        return false;
      }

      console.log("[useEventTicket] Ticket created successfully:", ticket_id);
      setHasValidTicket(true);
      setTicketId(ticket_id);
      setPaymentStatus("free");
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
    paymentStatus,
    purchaseTicket,
    markAttended,
    refetch: fetchTicket,
    pollForConfirmation,
  };
}
