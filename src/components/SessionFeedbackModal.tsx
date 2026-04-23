import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Star, MessageSquare, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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

const PUBLIC_TAGS = [
  "Clear teaching",
  "Great pace",
  "Loved the process",
  "Would join again",
  "Audio/Video issues",
];

const IMPROVEMENT_CATEGORIES = [
  "Audio",
  "Video",
  "Chat",
  "Payments",
  "Scheduling",
  "Discovery / finding studios",
  "Other",
];

const LEFT_EARLY_REASONS = [
  "Too long",
  "Not what I expected",
  "Technical issues",
  "Ran out of time",
  "Other",
];

const STAR_LABELS = ["", "Poor", "Fair", "Good", "Great", "Excellent"];

export function SessionFeedbackModal({
  isOpen,
  onClose,
  eventId,
  creatorId,
  creatorName,
  sessionTitle,
  leftEarly,
}: SessionFeedbackModalProps) {
  const [rating, setRating] = useState<number>(0);
  const [hoveredRating, setHoveredRating] = useState<number>(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [improvementCategory, setImprovementCategory] = useState<string>("");
  const [privateFeedback, setPrivateFeedback] = useState("");
  const [leftEarlyReason, setLeftEarlyReason] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleTagToggle = (tag: string) => {
    triggerClickHaptic();
    setSelectedTags((prev) => {
      if (prev.includes(tag)) {
        return prev.filter((t) => t !== tag);
      }
      if (prev.length >= 2) {
        return [...prev.slice(1), tag];
      }
      return [...prev, tag];
    });
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error("Please select a star rating before submitting");
      return;
    }

    setIsSubmitting(true);
    triggerClickHaptic();

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        toast.error("Please log in to submit feedback");
        return;
      }

      const { error } = await supabase.from("session_feedback").insert({
        event_id: eventId,
        creator_id: creatorId,
        audience_user_id: userData.user.id,
        rating,
        public_tags: selectedTags,
        private_feedback_text: privateFeedback || null,
        improvement_category: improvementCategory || null,
        left_early: leftEarly,
        left_early_reason: leftEarlyReason || null,
      });

      if (error) {
        if (error.code === "23505") {
          toast.info("You've already submitted feedback for this session");
          onClose();
        } else {
          console.error("Error submitting feedback:", error);
          toast.error("Failed to submit feedback");
        }
        return;
      }

      // Notify the creator via email (fire and forget — don't block the UI)
      supabase.functions
        .invoke("notify-creator-rating", {
          body: { event_id: eventId, creator_id: creatorId, rating },
        })
        .catch((err) => console.error("Failed to send creator rating notification:", err));

      setSubmitted(true);
    } catch (err) {
      console.error("Error submitting feedback:", err);
      toast.error("Failed to submit feedback");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    triggerClickHaptic();
    onClose();
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
              /* ── Thank-you screen ── */
              <div className="flex flex-col items-center justify-center px-8 py-14 text-center gap-5">
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", damping: 15 }}
                >
                  <CheckCircle className="w-16 h-16 text-green-500" />
                </motion.div>
                <div className="space-y-2">
                  <h2 className="font-display text-2xl text-foreground font-semibold">
                    Thank you!
                  </h2>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Your feedback helps {creatorName} grow and helps us make Exhiby better for everyone.
                  </p>
                </div>
                {/* Show the submitted star rating */}
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-7 h-7 ${star <= rating ? "fill-gold text-gold" : "text-muted-foreground/20"}`}
                    />
                  ))}
                </div>
                <Button
                  onClick={onClose}
                  className="w-full py-6 rounded-xl text-white font-semibold mt-2"
                  style={{
                    background: "linear-gradient(135deg, hsl(7 100% 67%), hsl(345 100% 50%))",
                  }}
                >
                  Done
                </Button>
              </div>
            ) : (
              <>
                {/* ── Header ── */}
                <div className="sticky top-0 bg-card/95 backdrop-blur-sm border-b border-border p-4 flex items-center justify-between z-10">
                  <div>
                    <h2 className="font-display text-lg text-foreground">How was the session?</h2>
                    <p className="text-sm text-muted-foreground mt-0.5">{sessionTitle}</p>
                  </div>
                  <button
                    onClick={handleSkip}
                    className="p-2 rounded-full hover:bg-muted/50 transition-colors"
                  >
                    <X className="w-5 h-5 text-muted-foreground" />
                  </button>
                </div>

                <div className="p-4 space-y-6">
                  {/* ── Public Rating ── */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Star className="w-5 h-5 text-gold" />
                      <h3 className="font-semibold text-foreground">
                        Rate {creatorName}
                        <span className="text-destructive ml-1">*</span>
                      </h3>
                    </div>

                    {/* Stars */}
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            onClick={() => {
                              triggerClickHaptic();
                              setRating(star);
                            }}
                            onMouseEnter={() => setHoveredRating(star)}
                            onMouseLeave={() => setHoveredRating(0)}
                            className="p-1 transition-transform hover:scale-110"
                          >
                            <Star
                              className={`w-10 h-10 transition-colors ${
                                star <= displayRating
                                  ? "fill-gold text-gold"
                                  : "text-muted-foreground/30"
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                      {/* Label under stars */}
                      <p
                        className={`text-sm font-medium transition-colors h-5 ${
                          displayRating > 0 ? "text-gold" : "text-muted-foreground/50"
                        }`}
                      >
                        {displayRating > 0 ? STAR_LABELS[displayRating] : "Tap to rate"}
                      </p>
                    </div>

                    {/* Public Tags */}
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">What stood out? (pick up to 2)</p>
                      <div className="flex flex-wrap gap-2">
                        {PUBLIC_TAGS.map((tag) => (
                          <button
                            key={tag}
                            onClick={() => handleTagToggle(tag)}
                            className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                              selectedTags.includes(tag)
                                ? "bg-electric text-white"
                                : "bg-muted/50 text-muted-foreground hover:bg-muted"
                            }`}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-border" />

                  {/* ── Private Feedback ── */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-5 h-5 text-electric" />
                      <h3 className="font-semibold text-foreground">Private Feedback</h3>
                      <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">
                        Only visible to Exhiby
                      </span>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">What should we improve?</p>
                      <div className="flex flex-wrap gap-2">
                        {IMPROVEMENT_CATEGORIES.map((cat) => (
                          <button
                            key={cat}
                            onClick={() => {
                              triggerClickHaptic();
                              setImprovementCategory(cat === improvementCategory ? "" : cat);
                            }}
                            className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                              improvementCategory === cat
                                ? "bg-electric text-white"
                                : "bg-muted/50 text-muted-foreground hover:bg-muted"
                            }`}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="relative">
                      <Textarea
                        placeholder="Tell us what felt off or what would make this better (private to Exhiby)..."
                        value={privateFeedback}
                        onChange={(e) => {
                          if (e.target.value.length <= 500) setPrivateFeedback(e.target.value);
                        }}
                        maxLength={500}
                        className="min-h-[80px] bg-muted/30 border-border resize-none"
                      />
                      {privateFeedback.length > 0 && (
                        <span className="absolute bottom-2 right-2 text-xs text-muted-foreground">
                          {privateFeedback.length}/500
                        </span>
                      )}
                    </div>

                    {leftEarly && (
                      <div className="space-y-2 p-3 rounded-lg bg-muted/30 border border-border">
                        <p className="text-sm text-foreground font-medium">You left early — why?</p>
                        <div className="flex flex-wrap gap-2">
                          {LEFT_EARLY_REASONS.map((reason) => (
                            <button
                              key={reason}
                              onClick={() => {
                                triggerClickHaptic();
                                setLeftEarlyReason(reason === leftEarlyReason ? "" : reason);
                              }}
                              className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                                leftEarlyReason === reason
                                  ? "bg-destructive text-white"
                                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
                              }`}
                            >
                              {reason}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ── Submit ── */}
                  <div className="space-y-3 pt-2">
                    <Button
                      onClick={handleSubmit}
                      disabled={isSubmitting || rating === 0}
                      className="w-full py-6 rounded-xl text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{
                        background: "linear-gradient(135deg, hsl(7 100% 67%), hsl(345 100% 50%))",
                      }}
                    >
                      {isSubmitting ? "Submitting..." : "Submit Feedback"}
                    </Button>
                    {rating === 0 && (
                      <p className="text-center text-xs text-muted-foreground">
                        A star rating is required
                      </p>
                    )}
                    <button
                      onClick={handleSkip}
                      className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Skip for now
                    </button>
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
