import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Star, MessageSquare } from "lucide-react";
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

  const handleTagToggle = (tag: string) => {
    triggerClickHaptic();
    setSelectedTags((prev) => {
      if (prev.includes(tag)) {
        return prev.filter((t) => t !== tag);
      }
      if (prev.length >= 2) {
        return [...prev.slice(1), tag]; // Replace oldest selection
      }
      return [...prev, tag];
    });
  };

  const handleSubmit = async () => {
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
        rating: rating > 0 ? rating : null,
        public_tags: selectedTags,
        private_feedback_text: privateFeedback || null,
        improvement_category: improvementCategory || null,
        left_early: leftEarly,
        left_early_reason: leftEarlyReason || null,
      });

      if (error) {
        if (error.code === "23505") {
          toast.info("You've already submitted feedback for this session");
        } else {
          console.error("Error submitting feedback:", error);
          toast.error("Failed to submit feedback");
        }
      } else {
        toast.success("Thanks for your feedback!");
      }
      onClose();
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
            {/* Header */}
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
              {/* Public Rating Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Star className="w-5 h-5 text-gold" />
                  <h3 className="font-semibold text-foreground">Rate {creatorName}</h3>
                </div>
                
                {/* Star Rating */}
                <div className="flex justify-center gap-2">
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
                          star <= (hoveredRating || rating)
                            ? "fill-gold text-gold"
                            : "text-muted-foreground/30"
                        }`}
                      />
                    </button>
                  ))}
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

              {/* Divider */}
              <div className="border-t border-border" />

              {/* Private Feedback Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-electric" />
                  <h3 className="font-semibold text-foreground">Private Feedback</h3>
                  <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">
                    Only visible to Exhiby
                  </span>
                </div>

                {/* Improvement Categories */}
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

                {/* Private Text Feedback */}
                <Textarea
                  placeholder="Tell us what felt off or what would make this better (private to Exhiby)..."
                  value={privateFeedback}
                  onChange={(e) => setPrivateFeedback(e.target.value)}
                  className="min-h-[80px] bg-muted/30 border-border resize-none"
                />

                {/* Left Early Section */}
                {leftEarly && (
                  <div className="space-y-2 p-3 rounded-lg bg-muted/30 border border-border">
                    <p className="text-sm text-foreground font-medium">
                      You left early — why?
                    </p>
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

              {/* Submit */}
              <div className="space-y-3 pt-2">
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="w-full py-6 rounded-xl text-white font-semibold"
                  style={{
                    background: "linear-gradient(135deg, hsl(7 100% 67%), hsl(345 100% 50%))",
                  }}
                >
                  {isSubmitting ? "Submitting..." : "Submit Feedback"}
                </Button>
                <button
                  onClick={handleSkip}
                  className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Skip for now
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
