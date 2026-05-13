import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ArrowLeft, Zap, Mail, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlan } from "@/hooks/usePlan";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Plan {
  id: "free" | "pro" | "plus";
  name: string;
  badge?: string;
  monthlyPrice: number;
  annualMonthlyPrice: number;
  annualTotal: number;
  annualSavings: number;
  tagline: string;
  annualTagline: string;
  features: string[];
  featuresLabel?: string;
  cta: string;
  ctaHref?: string;
  isPro?: boolean;
}

const PLANS: Plan[] = [
  {
    id: "free",
    name: "FREE STUDIO",
    monthlyPrice: 0,
    annualMonthlyPrice: 0,
    annualTotal: 0,
    annualSavings: 0,
    tagline: "forever free to start",
    annualTagline: "forever free to start",
    features: [
      "First 10 sessions — zero commission",
      "Unlimited live sessions",
      "Built-in ticketing & payments",
      "Basic analytics",
      "8% commission",
      "Up to 50 attendees per session",
    ],
    cta: "Start Free Studio",
  },
  {
    id: "pro",
    name: "PRO STUDIO",
    badge: "Most Popular",
    monthlyPrice: 29,
    annualMonthlyPrice: 24,
    annualTotal: 290,
    annualSavings: 58,
    tagline: "per month · cancel anytime",
    annualTagline: "per month · billed $290/yr · save $58",
    featuresLabel: "EVERYTHING IN FREE, PLUS:",
    features: [
      "Custom studio colors",
      "Custom studio URL",
      "Advanced analytics",
      "Unlimited attendees per session",
      "Priority support",
      "Early access to new features",
      "4% commission",
    ],
    cta: "Contact Us",
    ctaHref: "mailto:studio@joinexhiby.com?subject=Pro Studio Plan",
    isPro: true,
  },
  {
    id: "plus",
    name: "STUDIO PLUS",
    monthlyPrice: 99,
    annualMonthlyPrice: 82,
    annualTotal: 990,
    annualSavings: 198,
    tagline: "per month · for serious creators",
    annualTagline: "per month · billed $990/yr · save $198",
    features: [
      "Everything in Pro",
      "Dedicated account manager",
      "Custom integrations",
      "White-label studio room",
      "API access",
      "Early feature co-development",
    ],
    cta: "Contact Us",
    ctaHref: "mailto:studio@joinexhiby.com?subject=Studio Plus Plan",
  },
];

// ─── Stagger helpers ──────────────────────────────────────────────────────────
const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
} as const;

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Pricing() {
  const navigate = useNavigate();
  const [annual, setAnnual] = useState(true);
  const { tier: currentTier } = usePlan();

  return (
    <div className="min-h-screen bg-carbon text-foreground overflow-x-hidden">
      <Seo
        title="Pricing — Free, Pro, Plus plans for creators | Exhiby"
        description="Pick a Studio plan on Exhiby. Free for getting started. Pro adds advanced analytics, audience email, and studio tools. Plus is everything, unlimited."
        path="/pricing"
      />
      {/* ── Nav bar ── */}
      <header className="sticky top-0 z-40 flex items-center gap-3 px-5 py-4 bg-carbon/90 backdrop-blur-xl border-b border-border/20">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full bg-obsidian flex items-center justify-center hover:bg-surface-elevated transition-colors"
          aria-label="Back"
        >
          <ArrowLeft className="w-4 h-4 text-foreground" />
        </button>
        <span className="font-display text-base font-semibold text-foreground tracking-tight">
          Pricing
        </span>
      </header>

      {/* ── Hero ── */}
      <section className="pt-16 pb-10 px-5 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-electric/10 border border-electric/20 mb-5">
            <Zap className="w-3 h-3 text-electric" />
            <span className="text-xs font-semibold text-electric tracking-wide uppercase">
              Simple pricing
            </span>
          </div>

          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-semibold text-foreground leading-none tracking-tight mb-5">
            Start free.
            <br />
            <span className="bg-gradient-electric bg-clip-text text-transparent">
              Scale when you're ready.
            </span>
          </h1>

          <p className="text-base sm:text-lg text-muted-foreground max-w-lg mx-auto leading-relaxed">
            No upfront risk. No monthly fees to start. We take a small
            commission only when you earn — zero during beta.
          </p>
        </motion.div>

        {/* ── Billing toggle ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="mt-10 flex items-center justify-center gap-3"
        >
          <button
            onClick={() => setAnnual(false)}
            className={cn(
              "px-5 py-2 rounded-full text-sm font-medium transition-all duration-300",
              !annual
                ? "bg-electric text-white shadow-[0_0_20px_hsl(7_100%_67%/0.35)]"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Monthly
          </button>

          <button
            onClick={() => setAnnual(true)}
            className={cn(
              "flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-all duration-300",
              annual
                ? "bg-electric text-white shadow-[0_0_20px_hsl(7_100%_67%/0.35)]"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Annual
            <span
              className={cn(
                "text-[11px] font-semibold px-2 py-0.5 rounded-full transition-colors",
                annual
                  ? "bg-white/20 text-white"
                  : "bg-green-500/15 text-green-400"
              )}
            >
              Save 17%
            </span>
          </button>
        </motion.div>
      </section>

      {/* ── Cards grid ── */}
      <section className="pb-20 px-5">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-5 items-start"
        >
          {PLANS.map((plan) => (
            <PricingCard key={plan.id} plan={plan} annual={annual} currentTier={currentTier} />
          ))}
        </motion.div>

        {/* ── Footer footnote ── */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="text-center text-xs text-muted-foreground mt-12"
        >
          All plans include secure payments via Stripe · Cancel anytime · No
          long-term contracts
        </motion.p>
      </section>
    </div>
  );
}

// ─── Plan Card ────────────────────────────────────────────────────────────────
function PricingCard({ plan, annual, currentTier }: { plan: Plan; annual: boolean; currentTier: string }) {
  const navigate = useNavigate();
  const price = annual ? plan.annualMonthlyPrice : plan.monthlyPrice;
  const tagline = annual ? plan.annualTagline : plan.tagline;
  const isCurrent = plan.id === currentTier;

  const handleCta = () => {
    if (isCurrent) {
      navigate("/settings");
      return;
    }
    if (plan.id === "free") {
      navigate("/auth");
    } else if (plan.ctaHref) {
      window.location.href = plan.ctaHref;
    }
  };

  return (
    <motion.div
      variants={itemVariants}
      className={cn(
        "relative flex flex-col rounded-3xl border transition-all duration-500",
        plan.isPro
          ? "border-electric/40 bg-obsidian shadow-[0_0_60px_hsl(7_100%_67%/0.12)] md:-mt-4 md:mb-4"
          : "border-border/25 bg-obsidian/70"
      )}
    >
      {/* Most Popular badge */}
      {plan.badge && (
        <div className="absolute -top-4 inset-x-0 flex justify-center pointer-events-none">
          <span className="inline-flex items-center px-4 py-1.5 rounded-full text-xs font-semibold text-white bg-gradient-electric shadow-[0_4px_16px_hsl(7_100%_67%/0.45)]">
            {plan.badge}
          </span>
        </div>
      )}

      <div className="p-7 flex flex-col h-full">
        {/* Plan name */}
        <p className="text-[11px] font-bold tracking-widest text-muted-foreground mb-5">
          {plan.name}
        </p>

        {/* Price */}
        <div className="mb-1.5">
          <div className="flex items-start gap-1 leading-none">
            <span className="font-display text-5xl font-semibold text-foreground relative -top-1">
              <span className="text-2xl text-muted-foreground align-top leading-none mr-0.5">$</span>
              <AnimatePresence mode="wait">
                <motion.span
                  key={price}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  className={cn(
                    "inline-block",
                    plan.isPro ? "text-electric" : "text-foreground"
                  )}
                >
                  {price}
                </motion.span>
              </AnimatePresence>
            </span>
          </div>
        </div>

        {/* Tagline */}
        <AnimatePresence mode="wait">
          <motion.p
            key={tagline}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="text-xs text-muted-foreground mb-7 leading-relaxed"
          >
            {tagline}
          </motion.p>
        </AnimatePresence>

        {/* Divider */}
        <div className="border-t border-border/20 mb-6" />

        {/* Features label */}
        {plan.featuresLabel && (
          <p className="text-[10px] font-bold tracking-widest text-muted-foreground mb-4">
            {plan.featuresLabel}
          </p>
        )}

        {/* Feature list */}
        <ul className="space-y-3 flex-1">
          {plan.features.map((feat) => (
            <li key={feat} className="flex items-start gap-3">
              <span className="mt-0.5 flex-shrink-0 w-4 h-4 rounded-full bg-electric/10 flex items-center justify-center">
                <Check className="w-2.5 h-2.5 text-electric" strokeWidth={3} />
              </span>
              <span className="text-sm text-foreground/80 leading-snug">{feat}</span>
            </li>
          ))}
        </ul>

        {/* CTA */}
        <button
          onClick={handleCta}
          className={cn(
            "mt-8 w-full py-3.5 rounded-2xl text-sm font-semibold transition-all duration-300 active:scale-[0.98] flex items-center justify-center gap-2",
            isCurrent
              ? "bg-muted/40 border border-border/30 text-muted-foreground cursor-default"
              : plan.isPro
              ? "bg-gradient-electric text-white shadow-[0_4px_24px_hsl(7_100%_67%/0.35)] hover:shadow-[0_6px_32px_hsl(7_100%_67%/0.5)]"
              : "bg-transparent border border-border/40 text-foreground hover:bg-surface-elevated hover:border-border/70"
          )}
        >
          {isCurrent ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-electric" />
              Current Plan
            </>
          ) : (
            <>
              {plan.id !== "free" && <Mail className="w-4 h-4 opacity-70" />}
              {plan.cta}
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}
