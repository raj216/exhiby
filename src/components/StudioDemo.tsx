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
  Search,
  MessageCircle,
  Bell,
  Home,
  Compass,
  User,
  CreditCard,
  Settings,
  Check,
  Link2,
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
const STEP_MS = [4600, 4400, 4800, 5400, 5200, 4400] as const;

const EASE = [0.22, 1, 0.36, 1] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Each step renders a realistic *mock* of the real screen. Copy, layout, colors
// and the orange application progress bar mirror the live product (Home →
// profile menu → CreatorVerificationFlow) so the demo matches exactly what the
// user is about to tap through.
// ─────────────────────────────────────────────────────────────────────────────
const STEPS = [
  {
    key: "home",
    title: "Start from your menu",
    blurb: "On the home screen, tap your profile in the bottom bar to open the menu.",
    Mock: HomeMock,
  },
  {
    key: "menu",
    title: "Open Your Studio",
    blurb: "Tap “Open Your Studio” to begin your creator application.",
    Mock: MenuMock,
  },
  {
    key: "unlock",
    title: "Start your application",
    blurb: "Three photos, two short questions. We review every one personally.",
    Mock: UnlockMock,
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
    blurb: "What you'll teach and your creative background. Be real — a few sentences.",
    Mock: QuestionsMock,
  },
  {
    key: "sent",
    title: "You're in",
    blurb: "Submit and we'll notify you the moment you're approved — within 24 hours.",
    Mock: SentMock,
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

// A floating finger that drifts onto a target and "taps" with a scale punch.
// `anchor` positions it (Tailwind) over the button it's tapping.
function TapFinger({ anchor, reduceMotion }: { anchor: string; reduceMotion: boolean }) {
  if (reduceMotion) return null;
  return (
    <motion.div
      aria-hidden
      className={cn("absolute z-30 text-foreground pointer-events-none", anchor)}
      initial={{ x: 26, y: 28, opacity: 0, scale: 1 }}
      animate={{
        x: [26, 0, 0, 0, 26],
        y: [28, 0, 0, 4, 28],
        opacity: [0, 1, 1, 1, 0],
        scale: [1, 1, 0.84, 1, 1],
      }}
      transition={{ duration: 2.6, times: [0, 0.38, 0.5, 0.62, 1], repeat: Infinity, ease: "easeInOut" }}
    >
      <Pointer className="w-7 h-7 drop-shadow-[0_2px_6px_rgba(0,0,0,0.55)]" />
    </motion.div>
  );
}

// The two-segment application progress bar that the real flow shows at the top.
function AppProgress({ active }: { active: 0 | 1 | 2 }) {
  return (
    <div className="flex gap-1.5 mb-3">
      {[0, 1].map((i) => (
        <div
          key={i}
          className={cn("h-0.5 flex-1 rounded-full", i < active ? "bg-electric" : "bg-foreground/15")}
        />
      ))}
    </div>
  );
}

// ─── Step 1: real Home screen — finger taps the Profile tab in the bottom nav ──
function HomeMock({ reduceMotion }: MockProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Top bar: logo · mode toggle · icons */}
      <div className="flex items-center gap-1.5 mb-3">
        <span className="font-display text-sm font-bold text-gradient-electric leading-none">Exhiby</span>
        <div className="ml-1 flex items-center rounded-full bg-obsidian border border-border/40 p-0.5">
          <span className="px-1.5 py-0.5 rounded-full bg-electric/20 text-electric text-[6px] font-semibold">Audience</span>
          <span className="px-1.5 py-0.5 text-muted-foreground/60 text-[6px]">Studio</span>
        </div>
        <div className="ml-auto flex gap-1">
          {[Search, MessageCircle, Bell].map((Icon, i) => (
            <div key={i} className="w-4 h-4 rounded-full bg-obsidian border border-border/40 flex items-center justify-center">
              <Icon className="w-2 h-2 text-muted-foreground" />
            </div>
          ))}
        </div>
      </div>

      {/* "No one's live" empty state */}
      <div className="flex-1 rounded-2xl border border-border/30 flex flex-col items-center justify-center text-center px-3">
        <div className="w-9 h-9 rounded-full border border-border/40 flex items-center justify-center mb-2">
          <Clock className="w-4 h-4 text-muted-foreground/60" />
        </div>
        <p className="font-display text-[11px] text-foreground mb-1 leading-tight">No one's live right now.</p>
        <p className="text-[8px] text-muted-foreground/55 mb-2.5 leading-snug">
          Check back soon — or open your own studio.
        </p>
        <div className="px-3 py-1 rounded-full border border-border/40 text-[8px] text-foreground/80">
          Explore Studios
        </div>
      </div>

      {/* Bottom nav — Profile pulses to draw the eye */}
      <div className="flex items-end justify-around pt-3 mt-3 border-t border-border/20">
        {[
          { Icon: Home, label: "Home", active: true },
          { Icon: Search, label: "Categories" },
          { Icon: Compass, label: "Passport" },
        ].map((t) => (
          <div key={t.label} className="flex flex-col items-center gap-0.5">
            <t.Icon className={cn("w-3.5 h-3.5", t.active ? "text-foreground" : "text-muted-foreground/55")} />
            <span className={cn("text-[6px]", t.active ? "text-foreground" : "text-muted-foreground/55")}>{t.label}</span>
          </div>
        ))}
        <div className="flex flex-col items-center gap-0.5">
          <motion.div
            animate={reduceMotion ? undefined : {
              boxShadow: [
                "0 0 0px hsl(7 100% 67% / 0)",
                "0 0 14px hsl(7 100% 67% / 0.8)",
                "0 0 0px hsl(7 100% 67% / 0)",
              ],
            }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            className="w-4 h-4 rounded-full bg-gradient-electric flex items-center justify-center text-white text-[7px] font-bold ring-1 ring-electric"
          >
            Z
          </motion.div>
          <span className="text-[6px] text-foreground">Profile</span>
        </div>
      </div>

      <TapFinger anchor="bottom-4 right-3" reduceMotion={reduceMotion} />
    </div>
  );
}

// ─── Step 2: the profile menu drawer — finger taps "Open Your Studio" ──────────
function MenuMock({ reduceMotion }: MockProps) {
  const rows = [
    { Icon: User, label: "View Profile", active: false },
    { Icon: Palette, label: "Open Your Studio", active: true },
    { Icon: CreditCard, label: "Wallet & Earnings", active: false },
    { Icon: Settings, label: "Settings", active: false },
  ];
  return (
    <div className="flex flex-col h-full">
      {/* Identity header */}
      <div className="flex items-center gap-2.5 mb-1">
        <div className="w-9 h-9 rounded-full bg-gradient-electric flex items-center justify-center text-white font-display text-sm ring-1 ring-electric">
          Z
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display text-xs text-foreground leading-none mb-0.5">zara</p>
          <p className="text-[8px] text-muted-foreground/60 leading-none">zara</p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 ml-11 mb-4">
        <span className="text-[7px] text-muted-foreground/60">Audience Mode ·</span>
        <span className="px-1.5 py-0.5 rounded-md bg-obsidian border border-border/40 text-[6px] font-bold text-muted-foreground tracking-wide">
          FREE
        </span>
      </div>

      <div className="h-px bg-border/30 mb-2" />

      {/* Menu rows */}
      <div className="space-y-1">
        {rows.map(({ Icon, label, active }) => (
          <motion.div
            key={label}
            animate={active && !reduceMotion ? {
              boxShadow: [
                "0 0 0px hsl(7 100% 67% / 0)",
                "0 0 22px hsl(7 100% 67% / 0.4)",
                "0 0 0px hsl(7 100% 67% / 0)",
              ],
            } : undefined}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5",
              active ? "bg-crimson/15 border border-crimson/30" : ""
            )}
          >
            <Icon className={cn("w-4 h-4", active ? "text-electric" : "text-muted-foreground/70")} />
            <span className={cn("text-[11px]", active ? "text-foreground font-semibold" : "text-foreground/80")}>
              {label}
            </span>
          </motion.div>
        ))}
      </div>

      <TapFinger anchor="top-[38%] left-[42%]" reduceMotion={reduceMotion} />
    </div>
  );
}

// ─── Step 3: "Unlock Your Studio" intro — finger taps "Start Application" ──────
function UnlockMock({ reduceMotion }: MockProps) {
  const reqs = [
    "3 photos showing your creative work",
    "2 short questions about what you'll teach",
    "Personal review — we'll notify you within 24 hours",
  ];
  return (
    <div className="flex flex-col h-full">
      <AppProgress active={0} />

      <div className="flex flex-col items-center text-center">
        <motion.div
          initial={reduceMotion ? false : { scale: 0, rotate: -12 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: reduceMotion ? 0 : 0.1, type: "spring", stiffness: 260, damping: 18 }}
          className="w-12 h-12 rounded-full bg-gradient-electric flex items-center justify-center shadow-[0_0_30px_hsl(7_100%_67%/0.45)] mb-2.5"
        >
          <Sparkles className="w-6 h-6 text-white" />
        </motion.div>
        <p className="font-display text-base text-foreground mb-1.5 leading-tight">Unlock Your Studio</p>
        <p className="text-[8px] text-muted-foreground/60 leading-snug px-2 mb-3">
          We review every application personally — looking for creators excited to share their process, not perfection.
        </p>
      </div>

      <div className="space-y-1.5 mb-auto">
        {reqs.map((r, i) => (
          <motion.div
            key={i}
            initial={reduceMotion ? false : { opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: reduceMotion ? 0 : 0.4 + i * 0.4, duration: 0.4, ease: EASE }}
            className="flex items-center gap-2.5 rounded-xl bg-obsidian border border-border/30 px-2.5 py-2"
          >
            <span className="w-4 h-4 rounded-full border border-crimson/40 flex items-center justify-center text-[7px] font-bold text-electric flex-shrink-0">
              {i + 1}
            </span>
            <span className="text-[8.5px] text-foreground/85 leading-snug">{r}</span>
          </motion.div>
        ))}
      </div>

      <div className="relative w-full py-2.5 rounded-xl bg-gradient-electric flex items-center justify-center gap-1.5 mt-3">
        <span className="text-[10px] font-semibold text-white">Start Application</span>
        <ArrowRight className="w-3 h-3 text-white" />
      </div>

      <TapFinger anchor="bottom-3 left-1/2" reduceMotion={reduceMotion} />
    </div>
  );
}

// ─── Step 4: "Show Your Work" — 3 slots fill with art, then finger taps Continue
function PhotosMock({ reduceMotion }: MockProps) {
  const slots = [
    { label: "You Creating", Icon: Camera },
    { label: "Work in Progress", Icon: ImageIcon },
    { label: "Finished Piece", Icon: Palette },
  ];
  return (
    <div className="flex flex-col h-full">
      <AppProgress active={1} />

      <div className="flex items-center gap-2 mb-1">
        <Palette className="w-4 h-4 text-electric" />
        <p className="font-display text-sm text-foreground leading-none">Show Your Work</p>
      </div>
      <p className="text-[8px] text-muted-foreground/60 mb-2.5 leading-snug">
        Each slot has a purpose. Read the label before choosing.
      </p>

      {/* Slots: grayscale "art" fills in with an orange ring + check badge */}
      <div className="space-y-1.5 mb-auto">
        {slots.map(({ label, Icon }, i) => (
          <div key={label} className="relative h-12 rounded-xl overflow-hidden">
            {/* empty placeholder */}
            <div className="absolute inset-0 flex items-center gap-2.5 rounded-xl border border-dashed border-border/50 px-2.5">
              <span className="w-7 h-7 rounded-lg bg-obsidian border border-border/40 flex items-center justify-center flex-shrink-0">
                <Icon className="w-3.5 h-3.5 text-muted-foreground/70" />
              </span>
              <span className="text-[9px] font-semibold text-foreground/80">{label}</span>
            </div>

            {/* filled photo */}
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: reduceMotion ? 0 : 0.6 + i * 0.7, duration: 0.45, ease: EASE }}
              className="absolute inset-0 rounded-xl overflow-hidden ring-2 ring-electric"
            >
              {/* grayscale art stand-in */}
              <div className="absolute inset-0 bg-gradient-to-br from-foreground/35 via-foreground/15 to-foreground/30" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Icon className="w-4 h-4 text-white/40" />
              </div>
              <motion.div
                initial={reduceMotion ? false : { scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: reduceMotion ? 0 : 0.85 + i * 0.7, type: "spring", stiffness: 320, damping: 18 }}
                className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-electric flex items-center justify-center"
              >
                <Check className="w-2 h-2 text-white" />
              </motion.div>
              <span className="absolute bottom-1 left-2 text-[8px] font-semibold text-white drop-shadow">{label}</span>
            </motion.div>
          </div>
        ))}
      </div>

      <motion.p
        key="counter"
        initial={false}
        animate={{ opacity: 1 }}
        className="text-[9px] text-center text-muted-foreground/70 my-2"
      >
        <motion.span
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: reduceMotion ? 0 : 2.5 }}
          className="text-electric font-medium"
        >
          3 / 3 photos uploaded
        </motion.span>
      </motion.p>

      {/* portfolio link field */}
      <div className="flex items-center gap-1.5 rounded-lg bg-obsidian border border-border/40 px-2 py-1.5 mb-2">
        <Link2 className="w-2.5 h-2.5 text-muted-foreground/60" />
        <span className="text-[7px] text-muted-foreground/50">Instagram, TikTok, or portfolio URL</span>
      </div>

      {/* Continue: muted → orange once 3/3 */}
      <div className="relative w-full py-2.5 rounded-xl overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0 bg-foreground/10" />
        <motion.div
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: reduceMotion ? 0 : 2.6, duration: 0.5 }}
          className="absolute inset-0 bg-gradient-electric"
        />
        <span className="relative flex items-center gap-1.5 text-[10px] font-semibold text-white">
          Continue <ArrowRight className="w-3 h-3" />
        </span>
      </div>

      <TapFinger anchor="bottom-3 left-1/2" reduceMotion={reduceMotion} />
    </div>
  );
}

// ─── Step 5: "Two Quick Questions" — fields fill, "✓ Good", finger taps Submit ─
function QuestionsMock({ reduceMotion }: MockProps) {
  const fields = [
    { q: "What will people experience in your live sessions?", lines: ["100%", "92%", "70%"] },
    { q: "Describe your creative background", lines: ["100%", "84%"] },
  ];
  return (
    <div className="flex flex-col h-full">
      <AppProgress active={2} />

      <div className="w-7 h-7 rounded-lg bg-crimson/20 border border-crimson/30 flex items-center justify-center mb-1.5">
        <span className="font-display text-electric text-sm font-bold leading-none">?</span>
      </div>
      <p className="font-display text-sm text-foreground mb-0.5 leading-tight">Two Quick Questions</p>
      <p className="text-[8px] text-muted-foreground/60 mb-3 leading-snug">
        This is what we read when reviewing you. Be real — 2-3 sentences is enough.
      </p>

      <div className="space-y-3 mb-auto">
        {fields.map(({ q, lines }, i) => (
          <div key={q}>
            <p className="text-[8.5px] font-semibold text-foreground/85 mb-1.5 leading-snug">{q}</p>
            <div
              className={cn(
                "rounded-xl bg-obsidian px-2.5 py-2 space-y-1.5 border",
                i === 0 ? "border-crimson/40" : "border-border/40"
              )}
            >
              {lines.map((w, j) => (
                <motion.div
                  key={j}
                  initial={reduceMotion ? false : { width: 0 }}
                  animate={{ width: w }}
                  transition={{ delay: reduceMotion ? 0 : 0.4 + i * 1.0 + j * 0.28, duration: 0.5, ease: EASE }}
                  className="h-1.5 rounded-full bg-foreground/25"
                />
              ))}
            </div>
            <motion.p
              initial={reduceMotion ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduceMotion ? 0 : 1.5 + i * 1.0 }}
              className="text-[8px] text-electric text-right mt-1 font-medium"
            >
              ✓ Good
            </motion.p>
          </div>
        ))}
      </div>

      {/* Submit: muted → gradient once both are "Good" */}
      <div className="relative w-full py-2.5 rounded-xl overflow-hidden flex items-center justify-center mt-2">
        <div className="absolute inset-0 bg-foreground/10" />
        <motion.div
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: reduceMotion ? 0 : 2.8, duration: 0.5 }}
          className="absolute inset-0 bg-gradient-electric"
        />
        <span className="relative flex items-center gap-1.5 text-[10px] font-semibold text-white">
          Submit Application <ArrowRight className="w-3 h-3" />
        </span>
      </div>

      <TapFinger anchor="bottom-3 left-1/2" reduceMotion={reduceMotion} />
    </div>
  );
}

// ─── Step 6: "Application Sent" success screen ─────────────────────────────────
function SentMock({ reduceMotion }: MockProps) {
  return (
    <div className="flex flex-col h-full items-center justify-center text-center">
      <motion.div
        initial={reduceMotion ? false : { scale: 0, rotate: -12 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ delay: reduceMotion ? 0 : 0.15, type: "spring", stiffness: 260, damping: 18 }}
        className="w-16 h-16 mb-4 rounded-full bg-gradient-electric flex items-center justify-center shadow-[0_0_40px_hsl(7_100%_67%/0.5)]"
      >
        <div className="w-9 h-9 rounded-full border-2 border-white flex items-center justify-center">
          <Check className="w-4 h-4 text-white" strokeWidth={3} />
        </div>
      </motion.div>
      <p className="font-display text-xl text-foreground mb-2">Application Sent</p>
      <p className="text-[10px] text-muted-foreground leading-relaxed mb-4 px-3">
        We'll personally review your work and reply within 24 hours. You'll be notified the moment you're approved.
      </p>
      <div className="flex items-start gap-2 rounded-xl bg-obsidian border border-border/30 px-3 py-2.5 text-left mx-1">
        <Clock className="w-4 h-4 text-electric flex-shrink-0 mt-0.5" />
        <p className="text-[9px] text-foreground/80 leading-relaxed">
          Your studio access activates automatically once approved — no action needed on your end.
        </p>
      </div>
    </div>
  );
}
