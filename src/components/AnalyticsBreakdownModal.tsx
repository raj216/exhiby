import { motion, AnimatePresence } from "framer-motion";
import { X, DollarSign, Ticket, Calendar } from "lucide-react";
import { format } from "date-fns";
import { SessionBreakdown } from "@/hooks/useMonthlyAnalytics";
import { triggerClickHaptic } from "@/lib/haptics";

interface AnalyticsBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: "earnings" | "tickets";
  total: number;
  breakdowns: SessionBreakdown[];
  showValues: boolean;
}

export function AnalyticsBreakdownModal({
  isOpen,
  onClose,
  type,
  total,
  breakdowns,
  showValues,
}: AnalyticsBreakdownModalProps) {
  const isEarnings = type === "earnings";
  
  const handleClose = () => {
    triggerClickHaptic();
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />
          
          {/* Bottom Sheet Modal */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 max-h-[70vh] bg-obsidian rounded-t-3xl border-t border-border/40 overflow-hidden"
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pb-4 border-b border-border/30">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  isEarnings ? "bg-gold/20" : "bg-electric/20"
                }`}>
                  {isEarnings ? (
                    <DollarSign className="w-5 h-5 text-gold" />
                  ) : (
                    <Ticket className="w-5 h-5 text-electric" />
                  )}
                </div>
                <div>
                  <h2 className="font-display text-lg text-foreground">
                    {isEarnings ? "This Month Earnings" : "Tickets Sold"}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(), "MMMM yyyy")}
                  </p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* Total */}
            <div className="px-5 py-4 border-b border-border/30 bg-carbon/50">
              <p className="text-xs text-muted-foreground mb-1">Total</p>
              <p className={`font-display text-3xl ${isEarnings ? "text-gold" : "text-foreground"}`}>
                {showValues 
                  ? (isEarnings ? `$${total.toLocaleString()}` : total.toLocaleString())
                  : "••••"
                }
              </p>
            </div>

            {/* Per-Session Breakdown */}
            <div className="overflow-y-auto max-h-[40vh] px-5 py-4">
              {breakdowns.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground text-sm">
                    No sessions this month yet
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-3">
                    Per Session
                  </p>
                  {breakdowns.map((session) => (
                    <div
                      key={session.eventId}
                      className="flex items-center justify-between py-3 px-4 bg-surface rounded-xl border border-border/20"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center flex-shrink-0">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-foreground text-sm font-medium truncate">
                            {session.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(session.date), "MMM d, yyyy")}
                          </p>
                        </div>
                      </div>
                      <div className="text-right pl-3">
                        <p className={`font-medium ${isEarnings ? "text-gold" : "text-foreground"}`}>
                          {showValues
                            ? (isEarnings 
                                ? `$${session.earnings.toLocaleString()}` 
                                : session.ticketCount.toLocaleString())
                            : "••••"
                          }
                        </p>
                        {isEarnings && (
                          <p className="text-xs text-muted-foreground">
                            {session.ticketCount} ticket{session.ticketCount !== 1 ? 's' : ''}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
