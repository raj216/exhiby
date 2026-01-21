import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { triggerClickHaptic } from "@/lib/haptics";
import { useScrollLock } from "@/hooks/useScrollLock";

interface DeleteEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  eventTitle: string;
  onDeleted: () => void;
}

export function DeleteEventModal({
  isOpen,
  onClose,
  eventId,
  eventTitle,
  onDeleted,
}: DeleteEventModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Lock body scroll when modal is open
  useScrollLock(isOpen);

  const handleDelete = async () => {
    triggerClickHaptic();
    setIsDeleting(true);

    try {
      // Clean up dependent rows so audience-facing surfaces can't show orphaned items.
      // NOTE: DB-level FK cascades also protect us, but we still delete notifications explicitly.
      const [{ error: notificationsError }, { error: eventsError }] = await Promise.all([
        supabase.from("notifications").delete().eq("link", `/live/${eventId}`),
        supabase.from("events").delete().eq("id", eventId),
      ]);

      if (notificationsError) {
        // Non-blocking: deleting notifications is best-effort
        console.warn("[DeleteEventModal] Failed to delete notifications:", notificationsError);
      }

      if (eventsError) throw eventsError;

      toast({ title: "Studio deleted" });
      onDeleted();
      onClose();
    } catch (error: any) {
      console.error("Error deleting event:", error);
      toast({
        title: "Error",
        description: "Failed to delete studio",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    if (!isDeleting) {
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
                  disabled={isDeleting}
                  className="absolute top-4 right-4 w-8 h-8 rounded-full bg-surface-elevated flex items-center justify-center hover:bg-surface transition-colors z-10"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>

                {/* Icon */}
                <div className="flex justify-center mb-4">
                  <div className="w-14 h-14 rounded-full bg-destructive/15 flex items-center justify-center">
                    <AlertTriangle className="w-7 h-7 text-destructive" />
                  </div>
                </div>
              </div>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto px-5">
                <div className="text-center mb-6">
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    Delete this scheduled studio?
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    This will remove "<span className="text-foreground">{eventTitle}</span>" and notify guests. This can't be undone.
                  </p>
                </div>
              </div>

              {/* Action buttons - sticky at bottom */}
              <div className="flex-shrink-0 p-5 pt-0">
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={handleClose}
                    disabled={isDeleting}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="flex-1"
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      "Delete"
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
