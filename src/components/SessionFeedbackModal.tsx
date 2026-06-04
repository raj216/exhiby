import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Star, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { triggerClickHaptic } from "@/lib/haptics";

interface SessionFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  creatorId: string;
  creatorName: string;
  sessionTitle: string;
  leftEarly: boolean;
}

// ── Fixed public tags ─────────────────────────────────────────────────────────
// All positive observations — complaint signals belong in private section only.
const PUBLIC_TAGS = [
  "Clear explanation",
  "Great energy",
  "Loved the process",
  "Very inspiring",
  "Interactive & engaging",
];

// ── App-level improvement — clearly separated from session quality ─────────────
const APP_ISSUES = ["Audio / Video", "Chat", "App performance", "Other"];

const LEFT_EARLY_REASONS = [
  "Too long",
  "Not what I expected",
  "Technical issues",
  "Ran out of time",
  "Other",
];

const STAR_LABELS = ["", "Poor", "Fair", "Good", "Great", "Excellent"];

// ── Reusable one-tap choice row ───────────────────────────────────────────────
function ChoiceRow({
  options,
  selected,
  onSelect,
}: {
  options: { value: string; label: string }[];
  selected: string;
  onSelect: (v: string) => void;
}) {
  return (
    <div className="flex gap-2 flex-wrap">
      {options.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => { triggerClickHaptic(); onSelect(selected === value ? "" : value); }}
          className={`px-3.5 py-2 rounded-full text-sm font-medium transition-colors ${
            selected === value
              ? "bg-electric text-carbon"
              : "bg-muted/50 text-muted-foreground hover:bg-muted"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// ── Section label ─────────────────────────────────────────────────────────────
function SectionLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <p className="text-sm font-semibold text-foreground mb-2.5">
      {children}
      {required && <span className="text-destructive ml-1">*</span>}
    </p>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export function SessionFeedbackModal({
  isOpen,
  onClose,
  eventId,
  creatorId,
  creatorName,
  sessionTitle,
  leftEarly,
}: SessionFeedbackModalProps) {
  const [rating,             setRating]             = useState(0);
  const [hoveredRating,      setHoveredRating]      = useState(0);
  const [valueGained,        setValueGained]        = useState("");
  const [selectedTags,       setSelectedTags]       = useState<string[]>([]);
  const [pacing,             setPacing]             = useState("");
  const [creatorEngagement,  setCreatorEngagement]  = useState("");
  const [wouldReturn,        setWouldReturn]        = useState("");
  const [appIssue,           setAppIssue]           = useState("");
  const [privateFeedback,    setPrivateFeedback]    = useState("");
  const [leftEarlyReason,    setLeftEarlyReason]    = useState("");
  const [isSubmitting,       setIsSubmitting]       = useState(false);
  const [submitted,          setSubmitted]          = useState(false);

  // Both mandatory questions must be answered before Submit unlocks
  const canSubmit = rating > 0 && valueGained !== "";

  const handleTagToggle = (tag: string) => {
    triggerClickHaptic();
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : prev.length >= 2 ? [...prev.slice(1), tag] : [...prev, tag]
    );
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    triggerClickHaptic();

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        toast.error("Please log in to submit feedback");
        return;
      }

      const { error } = await supabase.from("session_feedback").insert({
        event_id:            eventId,
        creator_id:          creatorId,
        audience_user_id:    userData.user.id,
        rating,
        public_tags:         selectedTags,
        // New coaching columns
        value_gained:        valueGained       || null,
        pacing:              pacing            || null,
        creator_engagement:  creatorEngagement || null,
        would_return:        wouldReturn       || null,
        // Platform / private
        improvement_category: appIssue         || null,
        private_feedback_text: privateFeedback || null,
        left_early:          leftEarly,
        left_early_reason:   leftEarlyReason   || null,
      });

      if (error) {
        console.error("[SessionFeedback] insert error:", error, {
          eventId, creatorId, rating, valueGained, pacing, creatorEngagement, wouldReturn, leftEarly, leftEarlyReason, appIssue,
        });
        if (error.code === "23505") {
          toast.info("You've already submitted feedback for this session");
          onClose();
        } else if (error.code === "42501" || /row-level security/i.test(error.message || "")) {
          toast.error("Couldn't verify your ticket for this session");
        } else {
          toast.error(error.message || "Failed to submit feedback");
        }
        return;
      }

      // Notify creator (fire and forget)
      supabase.functions
        .invoke("notify-creator-rating", {
          body: { event_id: eventId, creator_id: creatorId, rating },
        })
        .catch(() => {});

      setSubmitted(true);
    } catch (err) {
      console.error("[SessionFeedback] unexpected error:", err);
      toast.error("Failed to submit feedback");
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayRating = hoveredRating || rating;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-background/80 backdrop-blur-sm"
        >
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="w-full max-w-lg bg-card border border-border rounded-t-3xl sm:rounded-2xl max-h-[90vh] overflow-y-auto"
          >
            {submitted ? (
              /* ── Thank-you screen ───────────────────────────────────────── */
              <div className="flex flex-col items-center justify-center px-8 py-14 text-center gap-5">
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", damping: 15 }}
                >
                  <CheckCircle className="w-16 h-16 text-electric" />
                </motion.div>
                <div className="space-y-2">
                  <h2 className="font-display text-2xl text-foreground font-semibold">
                    Thank you
                  </h2>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Your feedback helps {creatorName} improve and makes every
                    session on Exhiby better.
                  </p>
                </div>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(star => (
                    <Star
                      key={star}
                      className={`w-7 h-7 ${star <= rating ? "fill-gold text-gold" : "text-muted-foreground/20"}`}
                    />
                  ))}
                </div>
                <button
                  onClick={onClose}
                  className="w-full py-4 rounded-xl text-white font-semibold"
                  style={{ background: "linear-gradient(135deg, hsl(7 100% 67%), hsl(345 100% 50%))" }}
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                {/* ── Header ─────────────────────────────────────────────── */}
                {/* No "Skip" — only X to close. Intentional. */}
                <div className="sticky top-0 bg-card/95 backdrop-blur-sm border-b border-border p-4 flex items-center justify-between z-10">
                  <div>
                    <h2 className="font-display text-lg text-foreground">How was the session?</h2>
                    <p className="text-sm text-muted-foreground mt-0.5 truncate max-w-[260px]">{sessionTitle}</p>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 rounded-full hover:bg-muted/50 transition-colors flex-shrink-0"
                  >
                    <X className="w-5 h-5 text-muted-foreground" />
                  </button>
                </div>

                <div className="p-4 space-y-6">

                  {/* ── MANDATORY 1: Star rating ────────────────────────── */}
                  <div className="space-y-3">
                    <SectionLabel required>Rate {creatorName}</SectionLabel>
                    <div className="flex flex-col items-center gap-1.5">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map(star => (
                          <button
                            key={star}
                            onClick={() => { triggerClickHaptic(); setRating(star); }}
                            onMouseEnter={() => setHoveredRating(star)}
                            onMouseLeave={() => setHoveredRating(0)}
                            className="p-1 transition-transform hover:scale-110"
                          >
                            <Star
                              className={`w-10 h-10 transition-colors ${
                                star <= displayRating ? "fill-gold text-gold" : "text-muted-foreground/30"
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                      <p className={`text-sm font-medium h-5 transition-colors ${
                        displayRating > 0 ? "text-gold" : "text-muted-foreground/40"
                      }`}>
                        {displayRating > 0 ? STAR_LABELS[displayRating] : "Tap to rate"}
                      </p>
                    </div>
                  </div>

                  {/* ── MANDATORY 2: Value gained ───────────────────────── */}
                  <div>
                    <SectionLabel required>Did this session give you value?</SectionLabel>
                    <ChoiceRow
                      selected={valueGained}
                      onSelect={setValueGained}
                      options={[
                        { value: "yes",      label: "Yes, absolutely" },
                        { value: "somewhat", label: "Somewhat" },
                        { value: "no",       label: "Not really" },
                      ]}
                    />
                  </div>

                  <div className="border-t border-border" />

                  {/* ── OPTIONAL: Public tags ───────────────────────────── */}
                  <div>
                    <SectionLabel>What stood out? <span className="text-muted-foreground font-normal text-xs">(pick up to 2)</span></SectionLabel>
                    <div className="flex flex-wrap gap-2">
                      {PUBLIC_TAGS.map(tag => (
                        <button
                          key={tag}
                          onClick={() => handleTagToggle(tag)}
                          className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                            selectedTags.includes(tag)
                              ? "bg-electric text-carbon"
                              : "bg-muted/50 text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* ── OPTIONAL: Pacing ────────────────────────────────── */}
                  <div>
                    <SectionLabel>How was the pacing?</SectionLabel>
                    <ChoiceRow
                      selected={pacing}
                      onSelect={setPacing}
                      options={[
                        { value: "too_fast", label: "Too fast" },
                        { value: "good",     label: "Just right" },
                        { value: "too_slow", label: "Too slow" },
                      ]}
                    />
                  </div>

                  {/* ── OPTIONAL: Creator engagement ────────────────────── */}
                  <div>
                    <SectionLabel>Did {creatorName} engage with the audience?</SectionLabel>
                    <ChoiceRow
                      selected={creatorEngagement}
                      onSelect={setCreatorEngagement}
                      options={[
                        { value: "very_interactive", label: "Very interactive" },
                        { value: "somewhat",         label: "Somewhat" },
                        { value: "one_sided",        label: "Felt one-sided" },
                      ]}
                    />
                  </div>

                  {/* ── OPTIONAL: Would return ──────────────────────────── */}
                  <div>
                    <SectionLabel>Would you attend another session by {creatorName}?</SectionLabel>
                    <ChoiceRow
                      selected={wouldReturn}
                      onSelect={setWouldReturn}
                      options={[
                        { value: "definitely",    label: "Definitely" },
                        { value: "maybe",         label: "Maybe" },
                        { value: "not_this_time", label: "Not this time" },
                      ]}
                    />
                  </div>

                  <div className="border-t border-border" />

                  {/* ── OPTIONAL: Left early reason (conditional) ───────── */}
                  {leftEarly && (
                    <div className="p-3 rounded-xl bg-muted/30 border border-border">
                      <SectionLabel>You left early — why?</SectionLabel>
                      <ChoiceRow
                        selected={leftEarlyReason}
                        onSelect={setLeftEarlyReason}
                        options={LEFT_EARLY_REASONS.map(r => ({ value: r, label: r }))}
                      />
                    </div>
                  )}

                  {/* ── OPTIONAL: Private text ──────────────────────────── */}
                  <div>
                    <SectionLabel>Anything else? <span className="text-muted-foreground font-normal text-xs">(private to Exhiby)</span></SectionLabel>
                    <div className="relative">
                      <textarea
                        placeholder="Tell us what felt off or what would make this better…"
                        value={privateFeedback}
                        onChange={e => { if (e.target.value.length <= 400) setPrivateFeedback(e.target.value); }}
                        rows={3}
                        className="w-full bg-muted/30 border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-electric/50 transition-colors resize-none leading-relaxed"
                      />
                      {privateFeedback.length > 0 && (
                        <span className="absolute bottom-2 right-3 text-xs text-muted-foreground">
                          {privateFeedback.length}/400
                        </span>
                      )}
                    </div>
                  </div>

                  {/* ── OPTIONAL: App issues ────────────────────────────── */}
                  <div>
                    <SectionLabel>Any app issues? <span className="text-muted-foreground font-normal text-xs">(optional)</span></SectionLabel>
                    <ChoiceRow
                      selected={appIssue}
                      onSelect={setAppIssue}
                      options={APP_ISSUES.map(i => ({ value: i, label: i }))}
                    />
                  </div>

                  {/* ── Submit ──────────────────────────────────────────── */}
                  <div className="space-y-2 pt-1">
                    <button
                      onClick={handleSubmit}
                      disabled={!canSubmit || isSubmitting}
                      className="w-full py-4 rounded-xl text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                      style={{ background: "linear-gradient(135deg, hsl(7 100% 67%), hsl(345 100% 50%))" }}
                    >
                      {isSubmitting ? "Submitting…" : "Submit Feedback"}
                    </button>
                    {!canSubmit && (
                      <p className="text-center text-xs text-muted-foreground">
                        {rating === 0
                          ? "Tap a star to rate the session"
                          : "Let us know if the session gave you value"}
                      </p>
                    )}
                    {/* No "Skip for now" — feedback matters */}
                  </div>

                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
