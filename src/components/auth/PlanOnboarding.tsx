import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Zap, Mail, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface PlanOnboardingProps {
  onComplete: () => void;
}

type PlanId = "free" | "pro" | "plus";

interface Plan {
  id: PlanId;
  name: string;
  badge?: string;
  monthlyPrice: number;
  tagline: string;
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
    tagline: "forever free to start",
    features: [
      "First 10 sessions — zero commission",
      "Unlimited live sessions",
      "Built-in ticketing & payments",
      "Basic analytics",
      "8% commission after 10 sessions",
      "Up to 50 attendees per session",
    ],
    cta: "Start Free",
  },
  {
    id: "pro",
    name: "PRO STUDIO",
    badge: "Most Popular",
    monthlyPrice: 29,
    tagline: "per month · cancel anytime",
    featuresLabel: "EVERYTHING IN FREE, PLUS:",
    features: [
      "Custom studio colors & URL",
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
    tagline: "per month · for serious creators",
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

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  },
} as const;

export function PlanOnboarding({ onComplete }: PlanOnboardingProps) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);

  const handleSelect = async (plan: Plan) => {
    if (plan.ctaHref) {
      window.location.href = plan.ctaHref;
      return;
    }

    if (!user) return;
    setSaving(true);

    try {
      // Mark plan selected in auth metadata (prevents showing this screen again)
      await supabase.auth.updateUser({
        data: { plan_onboarding_done: true, selected_plan: plan.id },
      });

      // Persist plan in profiles row
      await supabase
        .from("profiles")
        .update({ plan: plan.id } as never)
        .eq("user_id", user.id);

      onComplete();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="min-h-screen bg-carbon text-foreground overflow-x-hidden overflow-y-auto"
    >
      {/* Hero */}
      <section className="pt-14 pb-8 px-5 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Brand logo */}
          <div className="mb-8">
            <span className="font-display text-3xl font-bold text-gradient-electric tracking-tight">
              Exhiby
            </span>
          </div>

          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-electric/10 border border-electric/20 mb-5">
            <Zap className="w-3 h-3 text-electric" />
            <span className="text-xs font-semibold text-electric tracking-wide uppercase">
              One last step
            </span>
          </div>

          <h1 className="font-display text-4xl sm:text-5xl font-semibold text-foreground leading-none tracking-tight mb-4">
            Choose your plan
          </h1>
          <p className="text-base text-muted-foreground max-w-md mx-auto leading-relaxed">
            Start free — no credit card required. Upgrade anytime as your
            studio grows.
          </p>
        </motion.div>
      </section>

      {/* Plan cards */}
      <section className="pb-20 px-4">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-5 items-start"
        >
          {PLANS.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              onSelect={handleSelect}
              saving={saving}
            />
          ))}
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="text-center text-xs text-muted-foreground mt-10"
        >
          All plans include secure payments via Stripe · Cancel anytime · No
          long-term contracts
        </motion.p>
      </section>

      {saving && (
        <div className="fixed inset-0 bg-carbon/80 backdrop-blur-sm flex items-center justify-center z-50">
          <Loader2 className="w-8 h-8 text-electric animate-spin" />
        </div>
      )}
    </motion.div>
  );
}

function PlanCard({
  plan,
  onSelect,
  saving,
}: {
  plan: Plan;
  onSelect: (p: Plan) => void;
  saving: boolean;
}) {
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
      {/* Badge */}
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
                  key={plan.monthlyPrice}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  className={cn(
                    "inline-block",
                    plan.isPro ? "text-electric" : "text-foreground"
                  )}
                >
                  {plan.monthlyPrice}
                </motion.span>
              </AnimatePresence>
            </span>
          </div>
        </div>

        {/* Tagline */}
        <p className="text-xs text-muted-foreground mb-7 leading-relaxed">
          {plan.tagline}
        </p>

        {/* Divider */}
        <div className="border-t border-border/20 mb-6" />

        {/* Features label */}
        {plan.featuresLabel && (
          <p className="text-[10px] font-bold tracking-widest text-muted-foreground mb-4">
            {plan.featuresLabel}
          </p>
        )}

        {/* Features */}
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
          onClick={() => onSelect(plan)}
          disabled={saving}
          className={cn(
            "mt-8 w-full py-3.5 rounded-2xl text-sm font-semibold transition-all duration-300 active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed",
            plan.isPro
              ? "bg-gradient-electric text-white shadow-[0_4px_24px_hsl(7_100%_67%/0.35)] hover:shadow-[0_6px_32px_hsl(7_100%_67%/0.5)]"
              : plan.id === "free"
              ? "bg-electric/15 border border-electric/30 text-electric hover:bg-electric/20"
              : "bg-transparent border border-border/40 text-foreground hover:bg-surface-elevated hover:border-border/70"
          )}
        >
          {plan.id === "free" && <CheckCircle2 className="w-4 h-4 opacity-80" />}
          {plan.id !== "free" && <Mail className="w-4 h-4 opacity-70" />}
          {plan.cta}
        </button>
      </div>
    </motion.div>
  );
}
