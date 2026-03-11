import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, DollarSign, Ticket, Calendar, Clock, ExternalLink, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { useCreatorEarnings } from "@/hooks/useCreatorEarnings";
import { useStripeConnect } from "@/hooks/useStripeConnect";
import { triggerClickHaptic } from "@/lib/haptics";
import { toast } from "sonner";

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function EarningsHistory() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isLoading: authLoading } = useAuth();
  const { data: earnings, isLoading: loading, refetch: refetchEarnings } = useCreatorEarnings(user?.id);
  const { status: connectStatus, loading: connectLoading, startOnboarding, getDashboardLink, requestPayout, refetchStatus } = useStripeConnect(user?.id);
  const [payoutLoading, setPayoutLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth", { replace: true });
    }
  }, [user, authLoading, navigate]);

  // Handle Stripe onboarding return
  useEffect(() => {
    const onboardingResult = searchParams.get("stripe_onboarding");
    if (onboardingResult === "complete") {
      toast.success("Stripe onboarding completed! Verifying your account...");
      refetchStatus();
    } else if (onboardingResult === "refresh") {
      toast.info("Please complete Stripe onboarding to enable payouts.");
      refetchStatus();
    }
  }, [searchParams, refetchStatus]);

  const handleBack = () => {
    triggerClickHaptic();
    navigate(-1);
  };

  const handlePayoutClick = async () => {
    triggerClickHaptic();

    if (connectStatus === "not_connected" || connectStatus === "onboarding_incomplete") {
      // Start or resume onboarding
      const url = await startOnboarding();
      if (url) {
        window.location.href = url;
      } else {
        toast.error("Could not start Stripe onboarding. Please try again.");
      }
      return;
    }

    if (connectStatus === "pending_verification") {
      toast.info("Your account is being verified by Stripe. Payouts will be available once verification is complete.");
      return;
    }

    if (connectStatus === "active") {
      // Request payout
      setPayoutLoading(true);
      const result = await requestPayout();
      setPayoutLoading(false);

      if (result.success) {
        toast.success(`Payout of ${formatCents(result.amount || 0)} requested successfully!`);
        refetchEarnings();
        refetchStatus();
      } else {
        toast.error(result.error || "Payout failed. Please try again.");
      }
    }
  };

  const handleDashboardClick = async () => {
    triggerClickHaptic();
    const url = await getDashboardLink();
    if (url) {
      window.open(url, "_blank");
    } else {
      toast.error("Could not open Stripe dashboard.");
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-carbon flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const data = earnings || { lifetimeEarnings: 0, thisMonthEarnings: 0, lastMonthEarnings: 0, totalPaidOut: 0, availableToPayout: 0, transactions: [] };
  const canPayout = data.availableToPayout > 0;

  const getPayoutButtonText = () => {
    if (payoutLoading || connectLoading) return "Processing...";
    if (connectStatus === "not_connected" || connectStatus === "onboarding_incomplete") return "Set Up Payouts";
    if (connectStatus === "pending_verification") return "Verification Pending";
    if (connectStatus === "active" && canPayout) return `Payout ${formatCents(data.availableToPayout)}`;
    return "No Balance";
  };

  const getPayoutButtonDisabled = () => {
    if (payoutLoading || connectLoading) return true;
    if (connectStatus === "pending_verification") return true;
    if (connectStatus === "active" && !canPayout) return true;
    return false;
  };

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

      {/* Hero - Lifetime Total */}
      <div className="px-4 py-8 border-b border-border/30 bg-obsidian/50">
        <div className="max-w-screen-xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-full bg-gold/20 flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-gold" />
            </div>
          </div>
          <p className="text-sm text-muted-foreground mb-1">Lifetime Earnings</p>
          <p className="font-display text-5xl text-gold mb-2">
            {formatCents(data.lifetimeEarnings)}
          </p>

          {/* Month breakdowns */}
          <div className="grid grid-cols-2 gap-3 mt-6">
            <div className="bg-carbon/60 rounded-2xl p-4 border border-border/20">
              <p className="text-xs text-muted-foreground mb-1">This Month</p>
              <p className="font-display text-xl text-foreground">
                {formatCents(data.thisMonthEarnings)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {format(new Date(), "MMMM yyyy")}
              </p>
            </div>
            <div className="bg-carbon/60 rounded-2xl p-4 border border-border/20">
              <p className="text-xs text-muted-foreground mb-1">Last Month</p>
              <p className="font-display text-xl text-foreground">
                {formatCents(data.lastMonthEarnings)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {format(new Date(new Date().getFullYear(), new Date().getMonth() - 1), "MMMM yyyy")}
              </p>
            </div>
          </div>

          {/* Payout Section */}
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div className="bg-carbon/60 rounded-2xl p-4 border border-border/20">
              <p className="text-xs text-muted-foreground mb-1">Available to Payout</p>
              <p className="font-display text-lg text-gold">
                {formatCents(data.availableToPayout)}
              </p>
            </div>
            <div className="bg-carbon/60 rounded-2xl p-4 border border-border/20">
              <p className="text-xs text-muted-foreground mb-1">Paid Out</p>
              <p className="font-display text-lg text-muted-foreground">
                {formatCents(data.totalPaidOut)}
              </p>
            </div>
          </div>

          {/* Verified Status Badge */}
          {connectStatus === "active" && (
            <div className="mt-6 flex items-center gap-2 px-4 py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
              <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-emerald-400">Payouts Enabled</p>
                <p className="text-xs text-muted-foreground">Your Stripe account is verified and ready for payouts.</p>
              </div>
            </div>
          )}

          {/* Payout Button */}
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={handlePayoutClick}
            disabled={getPayoutButtonDisabled()}
            className={`mt-4 w-full py-4 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-colors ${
              getPayoutButtonDisabled()
                ? "bg-muted/30 border border-border/40 text-muted-foreground cursor-not-allowed"
                : "text-obsidian"
            }`}
            style={
              !getPayoutButtonDisabled()
                ? { background: "linear-gradient(135deg, hsl(43 72% 52%), hsl(38 80% 45%))" }
                : undefined
            }
          >
            {(payoutLoading || connectLoading) && <Loader2 className="w-4 h-4 animate-spin" />}
            {connectStatus === "pending_verification" && <Clock className="w-4 h-4" />}
            {connectStatus === "active" && canPayout && <CheckCircle className="w-4 h-4" />}
            {(connectStatus === "not_connected" || connectStatus === "onboarding_incomplete") && <ExternalLink className="w-4 h-4" />}
            <span>{getPayoutButtonText()}</span>
          </motion.button>

          {/* Connect status hints */}
          {connectStatus === "active" && (
            <div className="mt-3 space-y-2">
              <button
                onClick={handleDashboardClick}
                className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1"
              >
                <ExternalLink className="w-3 h-3" />
                Open Stripe Dashboard
              </button>
            </div>
          )}
          {connectStatus === "pending_verification" && (
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Stripe is reviewing your account. This usually takes 1–2 business days.
            </p>
          )}
          {(connectStatus === "not_connected" || connectStatus === "onboarding_incomplete") && (
            <div className="mt-3 space-y-2">
              <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-muted/20 border border-border/20">
                <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Set up payouts through Stripe's secure verification. You'll need to provide identity details and bank account info. Your earnings are safe until you're ready.
                </p>
              </div>
            </div>
          )}

          {/* Payout timing note — always visible */}
          <div className="mt-4 px-3 py-2 rounded-xl bg-muted/10 border border-border/10">
            <p className="text-[11px] text-muted-foreground/70 leading-relaxed text-center">
              Your first payout may take around 7 days to process through Stripe. After that, payout timing may become faster depending on your Stripe account status.
            </p>
          </div>
        </div>
      </div>

      {/* Transaction List */}
      <div className="px-4 py-6 max-w-screen-xl mx-auto pb-24">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-4">
          Transactions
        </p>

        {data.transactions.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mx-auto mb-4">
              <DollarSign className="w-8 h-8 text-muted-foreground/50" />
            </div>
            <p className="text-muted-foreground">No earnings yet</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Start hosting paid sessions to earn
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.transactions.map((tx) => (
              <div
                key={tx.id}
                className="py-4 px-4 bg-obsidian rounded-2xl border border-border/20"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gold/10 flex items-center justify-center flex-shrink-0">
                    <Ticket className="w-5 h-5 text-gold" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground font-medium truncate">
                      {tx.event_title}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Calendar className="w-3 h-3 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(tx.created_at), "MMM d, yyyy")}
                      </p>
                      <span className="text-muted-foreground/50">•</span>
                      <p className="text-xs text-muted-foreground">
                        {tx.ticket_count} attendee{tx.ticket_count !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-lg text-gold">
                      +{formatCents(tx.amount_net)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-2 ml-16 text-xs text-muted-foreground">
                  <span>Gross: {formatCents(tx.amount_gross)}</span>
                  <span>Platform Fee (10%): −{formatCents(tx.platform_fee)}</span>
                  <span className="text-gold">Net: {formatCents(tx.amount_net)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
