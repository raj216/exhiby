import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Ticket, Calendar, User } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { useMonthlyAnalytics } from "@/hooks/useMonthlyAnalytics";
import { triggerClickHaptic } from "@/lib/haptics";

export default function TicketsHistory() {
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
        <div className="w-8 h-8 border-2 border-electric border-t-transparent rounded-full animate-spin" />
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
          <h1 className="font-display text-xl text-foreground">Ticket Sales</h1>
        </div>
      </div>

      {/* Hero Section */}
      <div className="px-4 py-8 border-b border-border/30 bg-obsidian/50">
        <div className="max-w-screen-xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-full bg-electric/20 flex items-center justify-center">
              <Ticket className="w-6 h-6 text-electric" />
            </div>
          </div>
          <p className="text-sm text-muted-foreground mb-1">Total Tickets Sold</p>
          <p className="font-display text-5xl text-foreground mb-2">
            {analytics.totalTickets.toLocaleString()}
          </p>
          <p className="text-sm text-muted-foreground">
            {format(new Date(), "MMMM yyyy")}
          </p>
        </div>
      </div>

      {/* Ticket Buyers List */}
      <div className="px-4 py-6 max-w-screen-xl mx-auto pb-24">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-4">
          Sessions
        </p>
        
        {analytics.sessionBreakdowns.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mx-auto mb-4">
              <Ticket className="w-8 h-8 text-muted-foreground/50" />
            </div>
            <p className="text-muted-foreground">No tickets sold this month yet</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Schedule sessions to start selling
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {analytics.sessionBreakdowns.map((session) => (
              <div
                key={session.eventId}
                className="flex items-center gap-4 py-4 px-4 bg-obsidian rounded-2xl border border-border/20"
              >
                {/* Avatar placeholder */}
                <div className="w-12 h-12 rounded-full bg-electric/10 flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-electric" />
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
                  </div>
                </div>
                
                {/* Ticket count badge */}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-electric/10 border border-electric/20">
                  <Ticket className="w-3.5 h-3.5 text-electric" />
                  <span className="text-sm font-medium text-electric">
                    {session.ticketCount}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
