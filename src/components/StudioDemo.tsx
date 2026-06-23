import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Sparkles,
  Camera,
  Image as ImageIcon,
  Palette,
  CheckCircle2,
  Clock,
  Pointer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { triggerClickHaptic } from "@/lib/haptics";

interface StudioDemoProps {
  /** Called when the user finishes or skips the walkthrough. */
  onComplete: () => void;
}

// Brand splash duration, then per-step durations (ms). The last step's bar
// fills and then holds — it never auto-advances, it waits for the CTA.
const INTRO_MS = 1300;
const STEP_MS = [4600, 5000, 4400, 4200] as const;

const EASE = [0.22, 1, 0.36, 1] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Each step renders a realistic *mock* of the real screen — copy mirrors the
// live CreatorVerificationFlow ("Unlock Your Studio") so the demo matches the
// actual product the user is about to use.
// ─────────────────────────────────────────────────────────────────────────────
const STEPS = [
  {
    key: "open",
    title: "Unlock your Studio",
    blurb: "Open your profile and tap “Open Studio” to start your creator application.",
    Mock: OpenStudioMock,
  },
  {
    key: "photos",
    title: "Show your work",
    blurb: "Add 3 photos — you creating, a work in progress, and a finished piece.",
    Mock: PhotosMock,
  },
  {
    key: "questions",
    title: "Two quick questions",
    blurb: "Tell us what you'll teach and your creative background. A few sentences each.",
    Mock: QuestionsMock,
  },
  {
    key: "submit",
    title: "Submit & you're in",
    blurb: "We review every application personally and reply within 24 hours.",
    Mock: SubmitMock,
  },
] as const;

export function StudioDemo({ onComplete }: StudioDemoProps) {
  const reduceMotion = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const mockRef = useRef<HTMLDivElement>(null);

  const [intro, setIntro] = useState(!reduceMotion);
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);

  const progressRef = useRef(0);
  const holdStart = useRef(0);
  const isLast = index === STEPS.length - 1;

  // ── Navigation ───────────────────────────────────────────────────────────
  const resetProgress = () => {
    progressRef.current = 0;
    setProgress(0);
  };
  const goNext = useCallback(() => {
    triggerClickHaptic();
    resetProgress();
    setIndex((i) => Math.min(i + 1, STEPS.length - 1));
  }, []);
  const goBack = useCallback(() => {
    triggerClickHaptic();
    resetProgress();
    setIndex((i) => Math.max(i - 1, 0));
  }, []);
  const finish = useCallback(() => {
    triggerClickHaptic();
    onComplete();
  }, [onComplete]);

  // ── Brand splash → first step ─────────────────────────────────────────────
  useEffect(() => {
    if (!intro) return;
    const t = setTimeout(() => setIntro(false), INTRO_MS);
    return () => clearTimeout(t);
  }, [intro]);

  // ── Focus the dialog on mount (a11y) ──────────────────────────────────────
  useEffect(() => {
    rootRef.current?.focus();
  }, []);

  // ── Keyboard controls (a11y): arrows, space to pause, escape to skip ──────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); finish(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); isLast ? finish() : goNext(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); goBack(); }
      else if (e.key === " " || e.key === "Spacebar") { e.preventDefault(); setPaused((p) => !p); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goBack, finish, isLast]);

  // ── Pause when tab is hidden, resume when visible ─────────────────────────
  useEffect(() => {
    const onVis = () => setPaused(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // ── Stories-style progress driver (rAF) — disabled under reduced motion ───
  useEffect(() => {
    if (intro || paused || reduceMotion) return;
    let raf = 0;
    let start: number | undefined;
    const dur = STEP_MS[index];
    const resumeFrom = progressRef.current;

    const tick = (ts: number) => {
      if (start === undefined) start = ts - resumeFrom * dur;
      const p = Math.min((ts - start) / dur, 1);
      setProgress(p);
      progressRef.current = p;
      if (p >= 1) {
        if (index < STEPS.length - 1) {
          progressRef.current = 0;
          setProgress(0);
          setIndex((i) => i + 1);
        }
        return; // last step holds at full
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [index, intro, paused, reduceMotion]);

  // ── Press-and-hold to pause; quick tap left/right to navigate (Stories) ───
  const onPointerDown = () => {
    holdStart.current = Date.now();
    setPaused(true);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    setPaused(false);
    const held = Date.now() - holdStart.current;
    if (held < 250 && mockRef.current) {
      const rect = mockRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      if (x < rect.width * 0.33) goBack();
      else if (isLast) finish();
      else goNext();
    }
  };

  const step = STEPS[index];
  const Mock = step.Mock;

  return (
    <motion.div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label="How to open your Studio — a quick walkthrough"
      tabIndex={-1}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: EASE }}
      className="fixed inset-0 z-50 bg-carbon flex flex-col outline-none overflow-hidden"
    >
      {/* Brand spotlight wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse at 50% 32%, hsl(7 100% 67% / 0.14), transparent 62%)" }}
      />

      <AnimatePresence mode="wait">
        {intro ? (
          /* ── Cinematic brand splash ──────────────────────────────────── */
          <motion.div
            key="intro"
            className="relative z-10 flex-1 flex flex-col items-center justify-center px-6"
            exit={{ opacity: 0, scale: 1.04, transition: { duration: 0.4, ease: EASE } }}
          >
            <motion.h1
              initial={reduceMotion ? false : { scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.7, ease: EASE }}
              className="font-display text-6xl font-bold tracking-tighter text-gradient-electric"
              style={{ textShadow: "0 0 50px hsl(7 100% 67% / 0.45)" }}
            >
              Exhiby
            </motion.h1>
            <motion.p
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45, duration: 0.55, ease: EASE }}
              className="mt-4 text-sm text-muted-foreground"
            >
              Here's how to open your Studio
            </motion.p>
          </motion.div>
        ) : (
          /* ── Walkthrough ─────────────────────────────────────────────── */
          <motion.div
            key="walk"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="relative z-10 flex-1 flex flex-col min-h-0"
          >
            {/* Segmented progress bar + Skip */}
            <div className="flex items-center gap-3 px-5 pt-6 pb-2 flex-shrink-0">
              <div className="flex-1 flex gap-1.5">
                {STEPS.map((s, i) => {
                  const fill = i < index ? 1 : i === index ? progress : 0;
                  return (
                    <div key={s.key} className="flex-1 h-1 rounded-full bg-foreground/15 overflow-hidden">
                      <div
                        className="h-full bg-electric rounded-full"
                        style={{
                          width: reduceMotion ? (i <= index ? "100%" : "0%") : `${fill * 100}%`,
                        }}
                      />
                    </div>
                  );
                })}
              </div>
              <button
                onClick={finish}
                className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors px-1"
              >
                Skip
              </button>
            </div>

            {/* SR-only live announcement of the current step */}
            <p className="sr-only" aria-live="polite">
              Step {index + 1} of {STEPS.length}: {step.title}
            </p>

            {/* Phone mock — tap zones + hold-to-pause */}
            <div className="flex-1 flex items-center justify-center px-6 min-h-0 py-2">
              <div
                ref={mockRef}
                onPointerDown={onPointerDown}
                onPointerUp={onPointerUp}
                className="relative w-full max-w-[290px] select-none cursor-pointer"
              >
                <div className="relative rounded-[2rem] border border-border/40 bg-obsidian/80 shadow-[0_20px_80px_hsl(7_100%_67%/0.12)] overflow-hidden aspect-[9/16]">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={step.key}
                      initial={reduceMotion ? false : { opacity: 0, scale: 0.97, x: 24 }}
                      animate={{ opacity: 1, scale: 1, x: 0 }}
                      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97, x: -24 }}
                      transition={{ duration: 0.4, ease: EASE }}
                      className="absolute inset-0 p-4 flex flex-col"
                    >
                      <Mock reduceMotion={!!reduceMotion} />
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* Caption + primary CTA */}
            <div className="flex-shrink-0 px-6 pb-8 pt-1 text-center">
              <AnimatePresence mode="wait">
                <motion.div
                  key={step.key}
                  initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                >
                  <h2 className="font-display text-2xl text-foreground mb-2 leading-tight">{step.title}</h2>
                  <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed mb-6">
                    {step.blurb}
                  </p>
                </motion.div>
              </AnimatePresence>

              <motion.button
                onClick={isLast ? finish : goNext}
                whileTap={{ scale: 0.97 }}
                className="w-full max-w-xs mx-auto py-3.5 rounded-2xl bg-gradient-electric text-white font-semibold flex items-center justify-center gap-2 shadow-[0_8px_30px_hsl(7_100%_67%/0.35)]"
              >
                {isLast ? "Open my Studio" : "Next"}
                <ArrowRight className="w-5 h-5" />
              </motion.button>

              <p className="text-[11px] text-muted-foreground/50 mt-3">
                {isLast ? "That's it — you're ready to create" : "Tap the right edge to skip ahead · hold to pause"}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

interface MockProps {
  reduceMotion: boolean;
}

// ─── Step 1: realistic profile screen + fake finger tapping "Open Studio" ──────
function OpenStudioMock({ reduceMotion }: MockProps) {
  return (
    <div className="flex flex-col h-full">
      <p className="text-[9px] font-bold tracking-[0.2em] text-muted-foreground/50 mb-3">PROFILE</p>

      {/* Identity row */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-full bg-gradient-electric flex items-center justify-center text-white font-display text-lg">
          A
        </div>
        <div className="flex-1">
          <div className="h-2.5 w-24 rounded-full bg-foreground/25 mb-1.5" />
          <div className="h-2 w-14 rounded-full bg-foreground/12" />
        </div>
      </div>

      {/* Stat pills */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        {["Sessions", "Followers", "Saved"].map((l) => (
          <div key={l} className="rounded-xl bg-obsidian border border-border/40 py-2 flex flex-col items-center gap-1">
            <div className="h-2 w-5 rounded-full bg-foreground/30" />
            <span className="text-[7px] text-muted-foreground/60">{l}</span>
          </div>
        ))}
      </div>

      <div className="mb-auto space-y-2">
        <div className="h-2 w-full rounded-full bg-foreground/10" />
        <div className="h-2 w-2/3 rounded-full bg-foreground/10" />
      </div>

      {/* The target CTA — pulses to draw the eye */}
      <motion.div
        animate={reduceMotion ? undefined : {
          boxShadow: [
            "0 0 0px hsl(7 100% 67% / 0.0)",
            "0 0 28px hsl(7 100% 67% / 0.55)",
            "0 0 0px hsl(7 100% 67% / 0.0)",
          ],
        }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        className="relative w-full py-3 rounded-2xl bg-gradient-electric text-white text-sm font-semibold flex items-center justify-center gap-2"
      >
        <Sparkles className="w-4 h-4" />
        Open Studio
      </motion.div>

      {/* Fake finger: travels to the button and "taps" with a ripple */}
      {!reduceMotion && (
        <motion.div
          className="absolute left-1/2 bottom-7 text-foreground"
          initial={{ x: 40, y: 36, opacity: 0, scale: 1 }}
          animate={{
            x: [40, 0, 0, 0, 40],
            y: [36, 0, 0, 4, 36],
            opacity: [0, 1, 1, 1, 0],
            scale: [1, 1, 0.86, 1, 1],
          }}
          transition={{ duration: 2.6, times: [0, 0.35, 0.5, 0.62, 1], repeat: Infinity, ease: "easeInOut" }}
        >
          <Pointer className="w-7 h-7 drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]" />
        </motion.div>
      )}
    </div>
  );
}

// ─── Step 2: 3 art-like photo thumbnails dropping in with check badges ─────────
function PhotosMock({ reduceMotion }: MockProps) {
  const slots = [
    { label: "You Creating", Icon: Camera, grad: "from-[#6D5BFF] to-[#A78BFA]" },
    { label: "In Progress", Icon: ImageIcon, grad: "from-[#FF8A4C] to-[#FFC24B]" },
    { label: "Finished", Icon: Palette, grad: "from-[#2DD4BF] to-[#22D3EE]" },
  ];
  return (
    <div className="flex flex-col h-full">
      <Palette className="w-6 h-6 text-electric mb-2" />
      <p className="font-display text-base text-foreground mb-1 leading-tight">Show your work</p>
      <p className="text-[9px] text-muted-foreground/60 mb-3">Three quick photos of your craft</p>

      <div className="grid grid-cols-3 gap-2 mb-auto">
        {slots.map(({ label, Icon, grad }, i) => (
          <motion.div
            key={label}
            initial={reduceMotion ? false : { opacity: 0, y: 14, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: reduceMotion ? 0 : 0.4 + i * 0.7, duration: 0.45, ease: EASE }}
            className="relative aspect-[3/4] rounded-xl overflow-hidden border border-border/40"
          >
            <div className={cn("absolute inset-0 bg-gradient-to-br opacity-90", grad)} />
            <div className="absolute inset-0 flex items-center justify-center">
              <Icon className="w-5 h-5 text-white/80" />
            </div>
            <motion.div
              initial={reduceMotion ? false : { scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: reduceMotion ? 0 : 0.7 + i * 0.7, type: "spring", stiffness: 320, damping: 18 }}
              className="absolute top-1 right-1 w-4 h-4 rounded-full bg-electric flex items-center justify-center shadow"
            >
              <CheckCircle2 className="w-2.5 h-2.5 text-white" />
            </motion.div>
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 py-1">
              <span className="text-[7px] font-semibold text-white leading-none">{label}</span>
            </div>
          </motion.div>
        ))}
      </div>

      <motion.p
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: reduceMotion ? 0 : 2.4 }}
        className="text-[10px] text-center text-electric font-medium mt-3"
      >
        3 / 3 uploaded ✓
      </motion.p>
    </div>
  );
}

// ─── Step 3: two answer fields "typing" then validating ────────────────────────
function QuestionsMock({ reduceMotion }: MockProps) {
  const fields = [
    { q: "What will people experience live?", lines: ["100%", "80%"] },
    { q: "Your creative background", lines: ["100%", "60%"] },
  ];
  return (
    <div className="flex flex-col h-full">
      <div className="w-7 h-7 rounded-lg bg-electric/20 border border-electric/30 flex items-center justify-center mb-2">
        <span className="font-display text-electric text-sm font-bold leading-none">?</span>
      </div>
      <p className="font-display text-base text-foreground mb-3 leading-tight">Two quick questions</p>

      <div className="space-y-4 mb-auto">
        {fields.map(({ q, lines }, i) => (
          <div key={q}>
            <p className="text-[9px] font-semibold text-foreground/80 mb-1.5 leading-snug">{q}</p>
            <div className="rounded-xl bg-obsidian border border-border/40 px-3 py-2.5 space-y-1.5">
              {lines.map((w, j) => (
                <motion.div
                  key={j}
                  initial={reduceMotion ? false : { width: 0 }}
                  animate={{ width: w }}
                  transition={{ delay: reduceMotion ? 0 : 0.4 + i * 0.9 + j * 0.3, duration: 0.6, ease: EASE }}
                  className="h-1.5 rounded-full bg-foreground/20"
                />
              ))}
            </div>
            <motion.p
              initial={reduceMotion ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduceMotion ? 0 : 1.3 + i * 0.9 }}
              className="text-[9px] text-electric text-right mt-1 font-medium"
            >
              ✓ Looks good
            </motion.p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Step 4: submitted success ─────────────────────────────────────────────────
function SubmitMock({ reduceMotion }: MockProps) {
  return (
    <div className="flex flex-col h-full items-center justify-center text-center">
      <motion.div
        initial={reduceMotion ? false : { scale: 0, rotate: -12 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ delay: reduceMotion ? 0 : 0.15, type: "spring", stiffness: 260, damping: 18 }}
        className="w-16 h-16 mb-4 rounded-full bg-gradient-electric flex items-center justify-center shadow-[0_0_40px_hsl(7_100%_67%/0.5)]"
      >
        <CheckCircle2 className="w-8 h-8 text-white" />
      </motion.div>
      <p className="font-display text-xl text-foreground mb-2">Application sent</p>
      <p className="text-[11px] text-muted-foreground leading-relaxed mb-4 px-3">
        We'll review your work and reply within 24 hours.
      </p>
      <div className="flex items-start gap-2 rounded-xl bg-obsidian border border-border/30 px-3 py-2.5 text-left mx-1">
        <Clock className="w-4 h-4 text-electric flex-shrink-0 mt-0.5" />
        <p className="text-[10px] text-foreground/80 leading-relaxed">
          Your Studio activates automatically once you're approved.
        </p>
      </div>
    </div>
  );
}
