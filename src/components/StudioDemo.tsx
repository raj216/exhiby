import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Camera,
  Image as ImageIcon,
  Palette,
  CheckCircle2,
  Clock,
  Hand,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { triggerClickHaptic } from "@/lib/haptics";

interface StudioDemoProps {
  /** Called when the user finishes or skips the walkthrough. */
  onComplete: () => void;
}

// How long each step lingers before auto-advancing (ms). The last step never
// auto-advances — it waits for the user to tap "Got it".
const AUTO_ADVANCE_MS = 4200;

// ─────────────────────────────────────────────────────────────────────────────
// Each step renders a small animated *mock* of the real screen — not the live
// flow. Copy and visuals mirror CreatorVerificationFlow so what the user sees
// here is exactly what they'll do for real.
// ─────────────────────────────────────────────────────────────────────────────
const STEPS = [
  {
    key: "open",
    title: "Open your Studio",
    blurb: "Tap “Open your Studio” on your profile to start your creator application.",
    Mock: OpenStudioMock,
  },
  {
    key: "photos",
    title: "Show your work",
    blurb: "Upload 3 photos — you creating, a work in progress, and a finished piece.",
    Mock: PhotosMock,
  },
  {
    key: "questions",
    title: "Two quick questions",
    blurb: "Tell us what you'll teach and your creative background. 2–3 sentences each.",
    Mock: QuestionsMock,
  },
  {
    key: "submit",
    title: "Submit & you're done",
    blurb: "We review every application personally and reply within 24 hours.",
    Mock: SubmitMock,
  },
] as const;

export function StudioDemo({ onComplete }: StudioDemoProps) {
  const [index, setIndex] = useState(0);
  const isLast = index === STEPS.length - 1;

  const next = useCallback(() => {
    triggerClickHaptic();
    setIndex((i) => Math.min(i + 1, STEPS.length - 1));
  }, []);

  const back = useCallback(() => {
    triggerClickHaptic();
    setIndex((i) => Math.max(i - 1, 0));
  }, []);

  const finish = useCallback(() => {
    triggerClickHaptic();
    onComplete();
  }, [onComplete]);

  // Gentle auto-advance so it feels like a short demo reel. Stops on the last
  // step and resets its timer whenever the user navigates manually.
  useEffect(() => {
    if (isLast) return;
    const t = setTimeout(() => setIndex((i) => Math.min(i + 1, STEPS.length - 1)), AUTO_ADVANCE_MS);
    return () => clearTimeout(t);
  }, [index, isLast]);

  const step = STEPS[index];
  const Mock = step.Mock;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-0 z-50 bg-carbon/95 backdrop-blur-xl flex flex-col"
    >
      {/* ── Top bar: progress dots + skip ──────────────────────────────── */}
      <div className="flex items-center justify-between px-5 pt-6 pb-2 flex-shrink-0">
        <div className="flex gap-2 items-center">
          {STEPS.map((s, i) => (
            <div
              key={s.key}
              className={cn(
                "h-1 rounded-full transition-all duration-300",
                i === index ? "w-8 bg-electric" : i < index ? "w-4 bg-electric/50" : "w-4 bg-border/30"
              )}
            />
          ))}
        </div>
        <button
          onClick={finish}
          className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors px-2 py-1"
        >
          Skip
        </button>
      </div>

      {/* ── Mock screen ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center px-6 min-h-0">
        <div className="w-full max-w-[300px]">
          {/* Phone-ish frame */}
          <div className="relative rounded-[2rem] border border-border/40 bg-obsidian/70 shadow-[0_0_60px_hsl(7_100%_67%/0.10)] overflow-hidden aspect-[9/16]">
            <AnimatePresence mode="wait">
              <motion.div
                key={step.key}
                initial={{ opacity: 0, scale: 0.97, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: -12 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-0 p-4 flex flex-col"
              >
                <Mock />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ── Caption + controls ──────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-6 pb-8 pt-2 text-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={step.key}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            <h2 className="font-display text-2xl text-foreground mb-2 leading-tight">
              {step.title}
            </h2>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed mb-6">
              {step.blurb}
            </p>
          </motion.div>
        </AnimatePresence>

        <div className="flex items-center gap-3 max-w-xs mx-auto">
          {index > 0 && (
            <button
              onClick={back}
              className="w-12 h-12 rounded-2xl bg-obsidian border border-border/40 flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </button>
          )}

          {isLast ? (
            <button
              onClick={finish}
              className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-electric to-crimson text-white font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            >
              Got it — let's go
              <ArrowRight className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={next}
              className="flex-1 py-3.5 rounded-2xl bg-electric text-carbon font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            >
              Next
              <ArrowRight className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Step 1 mock: home with a glowing "Open your Studio" button ────────────────
function OpenStudioMock() {
  return (
    <div className="flex flex-col h-full">
      <p className="text-[10px] font-bold tracking-widest text-muted-foreground/60 mb-1">YOUR PROFILE</p>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-electric/40 to-crimson/40" />
        <div className="flex-1">
          <div className="h-2.5 w-20 rounded-full bg-foreground/20 mb-1.5" />
          <div className="h-2 w-12 rounded-full bg-foreground/10" />
        </div>
      </div>

      <div className="space-y-2 mb-auto">
        <div className="h-2 w-full rounded-full bg-foreground/10" />
        <div className="h-2 w-3/4 rounded-full bg-foreground/10" />
      </div>

      {/* The hero CTA, pulsing */}
      <motion.button
        animate={{
          boxShadow: [
            "0 0 18px hsl(7 100% 67% / 0.35)",
            "0 0 36px hsl(7 100% 67% / 0.6)",
            "0 0 18px hsl(7 100% 67% / 0.35)",
          ],
        }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        className="relative w-full py-3 rounded-2xl bg-gradient-to-r from-electric to-crimson text-white text-sm font-semibold flex items-center justify-center gap-2"
      >
        <Sparkles className="w-4 h-4" />
        Open your Studio
      </motion.button>

      {/* Animated tapping hand */}
      <motion.div
        className="self-center mt-3 text-electric"
        initial={{ y: -4, opacity: 0.5 }}
        animate={{ y: [-4, 2, -4], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
      >
        <Hand className="w-7 h-7" />
      </motion.div>
    </div>
  );
}

// ─── Step 2 mock: 3 photo slots filling in with checkmarks ─────────────────────
function PhotosMock() {
  const slots = [
    { label: "You Creating", Icon: Camera },
    { label: "Work in Progress", Icon: ImageIcon },
    { label: "Finished Piece", Icon: Palette },
  ];
  return (
    <div className="flex flex-col h-full">
      <Palette className="w-7 h-7 text-electric mb-2" />
      <p className="font-display text-lg text-foreground mb-3 leading-tight">Show your work</p>

      <div className="space-y-2.5 mb-auto">
        {slots.map(({ label, Icon }, i) => (
          <motion.div
            key={label}
            initial={{ borderColor: "hsl(0 0% 100% / 0.1)" }}
            animate={{ borderColor: "hsl(7 100% 67% / 0.9)" }}
            transition={{ delay: 0.5 + i * 0.7, duration: 0.4 }}
            className="relative flex items-center gap-3 rounded-xl border-2 border-dashed bg-obsidian/60 px-3 py-2.5"
          >
            <div className="w-9 h-9 rounded-lg bg-obsidian border border-border/40 flex items-center justify-center flex-shrink-0">
              <Icon className="w-4 h-4 text-muted-foreground" />
            </div>
            <span className="text-xs font-semibold text-foreground">{label}</span>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.5 + i * 0.7, type: "spring", stiffness: 300, damping: 18 }}
              className="absolute top-2 right-2 w-5 h-5 rounded-full bg-electric flex items-center justify-center"
            >
              <CheckCircle2 className="w-3 h-3 text-white" />
            </motion.div>
          </motion.div>
        ))}
      </div>

      <p className="text-[10px] text-center text-muted-foreground/60 mt-3">3/3 photos uploaded</p>
    </div>
  );
}

// ─── Step 3 mock: two answer fields validating ─────────────────────────────────
function QuestionsMock() {
  const fields = [
    "What will people experience in your live sessions?",
    "Describe your creative background",
  ];
  return (
    <div className="flex flex-col h-full">
      <div className="w-8 h-8 rounded-lg bg-electric/20 border border-electric/30 flex items-center justify-center mb-2">
        <span className="font-display text-electric text-base font-bold leading-none">?</span>
      </div>
      <p className="font-display text-lg text-foreground mb-3 leading-tight">Two quick questions</p>

      <div className="space-y-4 mb-auto">
        {fields.map((q, i) => (
          <div key={q}>
            <p className="text-[10px] font-semibold text-foreground/80 mb-1.5 leading-snug">{q}</p>
            <div className="rounded-xl bg-obsidian/60 border border-border/40 px-3 py-2 space-y-1.5">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: "100%" }}
                transition={{ delay: 0.4 + i * 0.8, duration: 0.7 }}
                className="h-1.5 rounded-full bg-foreground/20"
              />
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: "70%" }}
                transition={{ delay: 0.7 + i * 0.8, duration: 0.6 }}
                className="h-1.5 rounded-full bg-foreground/20"
              />
            </div>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.3 + i * 0.8 }}
              className="text-[10px] text-electric text-right mt-1"
            >
              ✓ Good
            </motion.p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Step 4 mock: submitted success ────────────────────────────────────────────
function SubmitMock() {
  return (
    <div className="flex flex-col h-full items-center justify-center text-center">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.15, type: "spring", stiffness: 280, damping: 20 }}
        className="w-16 h-16 mb-4 rounded-full bg-gradient-to-br from-electric to-crimson flex items-center justify-center"
      >
        <CheckCircle2 className="w-8 h-8 text-white" />
      </motion.div>
      <p className="font-display text-xl text-foreground mb-2">Application sent</p>
      <p className="text-[11px] text-muted-foreground leading-relaxed mb-4 px-2">
        We'll review your work and reply within 24 hours.
      </p>
      <div className="flex items-start gap-2 rounded-xl bg-obsidian/60 border border-border/30 px-3 py-2.5 text-left">
        <Clock className="w-4 h-4 text-electric flex-shrink-0 mt-0.5" />
        <p className="text-[10px] text-foreground/80 leading-relaxed">
          Your studio activates automatically once approved.
        </p>
      </div>
    </div>
  );
}
