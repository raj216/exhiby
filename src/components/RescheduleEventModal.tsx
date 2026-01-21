import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { triggerClickHaptic } from "@/lib/haptics";
import { format } from "date-fns";
import { useScrollLock } from "@/hooks/useScrollLock";

interface RescheduleEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  eventTitle: string;
  currentScheduledAt: string;
  onRescheduled: () => void;
}

export function RescheduleEventModal({
  isOpen,
  onClose,
  eventId,
  eventTitle,
  currentScheduledAt,
  onRescheduled,
}: RescheduleEventModalProps) {
  // Parse current date and time from ISO string
  const currentDate = new Date(currentScheduledAt);
  const defaultDate = format(currentDate, "yyyy-MM-dd");
  const defaultTime = format(currentDate, "HH:mm");

  const [scheduledDate, setScheduledDate] = useState(defaultDate);
  const [scheduledTime, setScheduledTime] = useState(defaultTime);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Lock body scroll when modal is open
  useScrollLock(isOpen);

  // Get today's date for min attribute
  const today = new Date().toISOString().split("T")[0];

  const handleReschedule = async () => {
    triggerClickHaptic();

    if (!scheduledDate || !scheduledTime) {
      toast({
        title: "Error",
        description: "Please select date and time",
        variant: "destructive",
      });
      return;
    }

    // Validate future date
    const newDateTime = new Date(`${scheduledDate}T${scheduledTime}`);
    const now = new Date();

    if (newDateTime <= now) {
      toast({
        title: "Error",
        description: "Please select a future date and time",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Update ONLY the scheduled_at field and reset live status
      // IMPORTANT: Preserve creator_id, status fields - only update timestamp
      // Set is_live to FALSE (not null) so queries with is_live.eq.false still match
      const { error } = await supabase
        .from("events")
        .update({
          scheduled_at: newDateTime.toISOString(),
          // Reset to scheduled state (not live, not ended)
          is_live: false,
          live_ended_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", eventId);

      if (error) throw error;

      // Trigger reschedule notification edge function
      const { data: session } = await supabase.auth.getSession();
      
      fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify-reschedule`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.session?.access_token}`,
        },
        body: JSON.stringify({
          event_id: eventId,
        }),
      }).catch((err) => console.error("Failed to trigger reschedule notifications:", err));

      toast({ title: "Studio rescheduled", description: "Guests will be notified of the new time" });
      onRescheduled();
      onClose();
    } catch (error: any) {
      console.error("Error rescheduling event:", error);
      toast({
        title: "Error",
        description: "Failed to reschedule studio",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      // Reset to current values on close
      setScheduledDate(defaultDate);
      setScheduledTime(defaultTime);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Full-viewport container for centering */}
          <div className="fixed inset-0 z-[60] grid place-items-center" style={{ height: "100dvh" }}>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleClose}
              className="absolute inset-0 bg-carbon/80 backdrop-blur-sm"
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-[min(92vw,400px)] max-h-[85dvh] bg-obsidian rounded-2xl flex flex-col overflow-hidden"
              style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
            >
              {/* Header - fixed at top */}
              <div className="flex-shrink-0 p-5 pb-0">
                {/* Close button */}
                <button
                  onClick={handleClose}
                  disabled={isSubmitting}
                  className="absolute top-4 right-4 w-8 h-8 rounded-full bg-surface-elevated flex items-center justify-center hover:bg-surface transition-colors z-10"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>

                {/* Icon */}
                <div className="flex justify-center mb-4">
                  <div className="w-14 h-14 rounded-full bg-accent/15 flex items-center justify-center">
                    <Calendar className="w-7 h-7 text-accent" />
                  </div>
                </div>
              </div>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto px-5">
                {/* Title */}
                <div className="text-center mb-5">
                  <h3 className="text-lg font-semibold text-foreground mb-1">
                    Reschedule Studio
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    "{eventTitle}"
                  </p>
                </div>

                {/* Date & Time pickers */}
                <div className="space-y-4 mb-6">
                  <div>
                    <Label htmlFor="reschedule-date" className="text-sm text-muted-foreground mb-2 block">
                      New Date
                    </Label>
                    <Input
                      id="reschedule-date"
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      min={today}
                      className="bg-surface border-border/30"
                    />
                  </div>
                  <div>
                    <Label htmlFor="reschedule-time" className="text-sm text-muted-foreground mb-2 block">
                      New Time
                    </Label>
                    <Input
                      id="reschedule-time"
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="bg-surface border-border/30"
                    />
                  </div>
                </div>
              </div>

              {/* Action buttons - sticky at bottom */}
              <div className="flex-shrink-0 p-5 pt-4">
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={handleClose}
                    disabled={isSubmitting}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleReschedule}
                    disabled={isSubmitting}
                    className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      "Update Schedule"
                    )}
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
