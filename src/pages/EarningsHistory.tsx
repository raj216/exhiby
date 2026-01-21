import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, DollarSign, Ticket, Calendar, Clock } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { useMonthlyAnalytics } from "@/hooks/useMonthlyAnalytics";
import { triggerClickHaptic } from "@/lib/haptics";
import featureFlags from "@/lib/featureFlags";

export default function EarningsHistory() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { analytics, loading } = useMonthlyAnalytics(user?.id);

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth", { replace: true });
    }
  }, [user, authLoading, navigate]);

  const handleBack = () => {
    triggerClickHaptic();
    navigate(-1);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-carbon flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ x: "100%", opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: "100%", opacity: 0 }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className="min-h-screen bg-carbon"
    >
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-carbon/95 backdrop-blur-md border-b border-border/30">
        <div className="flex items-center gap-4 px-4 py-4 max-w-screen-xl mx-auto">
          <button
            onClick={handleBack}
            className="w-10 h-10 rounded-full bg-muted/50 border border-border/40 flex items-center justify-center hover:bg-muted/70 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="font-display text-xl text-foreground">Earnings</h1>
        </div>
      </div>

      {/* Hero Section */}
      <div className="px-4 py-8 border-b border-border/30 bg-obsidian/50">
        <div className="max-w-screen-xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-full bg-gold/20 flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-gold" />
            </div>
          </div>
          <p className="text-sm text-muted-foreground mb-1">Total Balance</p>
          <p className="font-display text-5xl text-gold mb-2">
            ${analytics.totalEarnings.toLocaleString()}
          </p>
          <p className="text-sm text-muted-foreground">
            {format(new Date(), "MMMM yyyy")}
          </p>
          
          {/* Payout CTA - Hidden when payments disabled */}
          {featureFlags.paymentsEnabled ? (
            <motion.button
              whileTap={{ scale: 0.98 }}
              className="mt-6 w-full py-4 rounded-2xl font-semibold text-obsidian"
              style={{
                background: "linear-gradient(135deg, hsl(43 72% 52%), hsl(38 80% 45%))",
              }}
            >
              Payout
            </motion.button>
          ) : (
            <div className="mt-6 w-full py-4 rounded-2xl bg-muted/30 border border-border/40 text-center">
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span className="text-sm font-medium">Payouts coming soon</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Transaction List */}
      <div className="px-4 py-6 max-w-screen-xl mx-auto pb-24">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-4">
          Transactions
        </p>
        
        {analytics.sessionBreakdowns.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mx-auto mb-4">
              <DollarSign className="w-8 h-8 text-muted-foreground/50" />
            </div>
            <p className="text-muted-foreground">No earnings this month yet</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Start hosting sessions to earn
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {analytics.sessionBreakdowns.map((session) => (
              <div
                key={session.eventId}
                className="flex items-center gap-4 py-4 px-4 bg-obsidian rounded-2xl border border-border/20"
              >
                {/* Icon */}
                <div className="w-12 h-12 rounded-full bg-gold/10 flex items-center justify-center flex-shrink-0">
                  <Ticket className="w-5 h-5 text-gold" />
                </div>
                
                {/* Details */}
                <div className="flex-1 min-w-0">
                  <p className="text-foreground font-medium truncate">
                    {session.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Calendar className="w-3 h-3 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(session.date), "MMM d, yyyy")}
                    </p>
                    <span className="text-muted-foreground/50">•</span>
                    <p className="text-xs text-muted-foreground">
                      {session.ticketCount} ticket{session.ticketCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                
                {/* Amount */}
                <div className="text-right">
                  <p className="font-display text-lg text-gold">
                    +${session.earnings.toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
