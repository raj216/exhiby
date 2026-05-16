import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ArrowRight,
  Palette,
  Clock,
  Camera,
  Link2,
  Loader2,
  Sparkles,
  Image as ImageIcon,
  CheckCircle2,
} from "lucide-react";
import { triggerClickHaptic, triggerSuccessHaptic } from "@/lib/haptics";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface CreatorVerificationFlowProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

type Step = "intro" | "portfolio" | "questions" | "submitted";
type PhotoKey = "creating" | "progress" | "finished";

interface PhotoState {
  preview: string | null; // local object URL for instant display
  url: string | null;     // Supabase Storage public URL after upload
  uploading: boolean;
}

const emptyPhoto = (): PhotoState => ({ preview: null, url: null, uploading: false });

// ── Slot definitions ──────────────────────────────────────────────────────────
const PHOTO_SLOTS: {
  key: PhotoKey;
  label: string;
  hint: string;
  Icon: React.ElementType;
}[] = [
  {
    key: "creating",
    label: "You Creating",
    hint: "Hands + work visible. Mid-process — not a finished piece.",
    Icon: Camera,
  },
  {
    key: "progress",
    label: "Work in Progress",
    hint: "Something unfinished you're currently working on.",
    Icon: ImageIcon,
  },
  {
    key: "finished",
    label: "Finished Piece",
    hint: "Your best completed work.",
    Icon: Palette,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
export function CreatorVerificationFlow({
  isOpen,
  onClose,
  onComplete,
}: CreatorVerificationFlowProps) {
  const { user } = useAuth();
  const [step, setStep]           = useState<Step>("intro");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Portfolio step
  const [photos, setPhotos] = useState<Record<PhotoKey, PhotoState>>({
    creating: emptyPhoto(),
    progress: emptyPhoto(),
    finished: emptyPhoto(),
  });
  const [socialLink, setSocialLink] = useState("");

  // Questions step
  const [answerTeaching,    setAnswerTeaching]    = useState("");
  const [answerBackground,  setAnswerBackground]  = useState("");

  // One hidden file input per slot
  const fileRefs = useRef<Record<PhotoKey, HTMLInputElement | null>>({
    creating: null,
    progress: null,
    finished: null,
  });

  // ── Derived state ────────────────────────────────────────────────────────
  const uploadedCount    = Object.values(photos).filter(p => p.url).length;
  const allPhotosReady   = uploadedCount === 3;
  const anyUploading     = Object.values(photos).some(p => p.uploading);
  const questionsValid   =
    answerTeaching.trim().length >= 30 &&
    answerBackground.trim().length >= 30;

  // ── Upload a single photo to Supabase Storage ────────────────────────────
  const handlePhotoSelect = async (key: PhotoKey, file: File) => {
    if (!user) return;

    // Guard: reject files over 10 MB before any upload attempt
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Photo must be under 10 MB. Please choose a smaller image.");
      return;
    }

    // Show local preview immediately — no waiting for upload
    const preview = URL.createObjectURL(file);
    setPhotos(prev => ({ ...prev, [key]: { preview, url: null, uploading: true } }));

    try {
      // No file extension in path — consistent key regardless of whether the
      // user uploads a .jpg, .jpeg, .png, or .heic. upsert:true overwrites the
      // exact same path on re-upload, preventing orphaned files in storage.
      const path = `${user.id}/${key}`;

      const { error: uploadError } = await supabase.storage
        .from("creator-applications")
        .upload(path, file, { upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("creator-applications")
        .getPublicUrl(path);

      setPhotos(prev => ({ ...prev, [key]: { preview, url: publicUrl, uploading: false } }));
    } catch {
      toast.error("Upload failed — please try again.");
      setPhotos(prev => ({ ...prev, [key]: emptyPhoto() }));
    }
  };

  // ── Submit application to database ───────────────────────────────────────
  const handleSubmit = async () => {
    if (!user || !allPhotosReady || !questionsValid || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("creator_applications")
        .upsert(
          {
            user_id:             user.id,
            photo_creating_url:  photos.creating.url!,
            photo_progress_url:  photos.progress.url!,
            photo_finished_url:  photos.finished.url!,
            social_link:         socialLink.trim() || null,
            answer_teaching:     answerTeaching.trim(),
            answer_background:   answerBackground.trim(),
            status:              "pending",
            submitted_at:        new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );

      if (error) throw error;

      triggerSuccessHaptic();
      setStep("submitted");
    } catch {
      toast.error("Something went wrong — please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Close / complete ─────────────────────────────────────────────────────
  const handleClose = () => {
    if (step === "submitted") onComplete();
    onClose();
  };

  if (!isOpen) return null;

  // ── Step progress dots (portfolio = dot 1, questions = dot 2) ────────────
  const dotActive = (dotStep: "portfolio" | "questions") => {
    if (dotStep === "portfolio") return step === "portfolio" || step === "questions" || step === "submitted";
    return step === "questions" || step === "submitted";
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-carbon/95 backdrop-blur-xl overflow-y-auto"
      >
        {/* ── Sticky header ────────────────────────────────────────────── */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 bg-carbon/80 backdrop-blur-sm">
          <div className="flex gap-2 items-center">
            {(["portfolio", "questions"] as const).map(d => (
              <div
                key={d}
                className={`h-1 rounded-full transition-all duration-300 ${
                  dotActive(d) ? "w-8 bg-electric" : "w-4 bg-border/30"
                }`}
              />
            ))}
          </div>
          <button
            onClick={handleClose}
            className="w-9 h-9 rounded-full bg-obsidian border border-border/50 flex items-center justify-center"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-foreground" />
          </button>
        </div>

        {/* ── Content ──────────────────────────────────────────────────── */}
        <div className="px-5 pb-12 pt-2">
          <AnimatePresence mode="wait">

            {/* ── INTRO ─────────────────────────────────────────────────── */}
            {step === "intro" && (
              <motion.div
                key="intro"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                className="text-center pt-8"
              >
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-electric to-crimson flex items-center justify-center">
                  <Sparkles className="w-9 h-9 text-white" />
                </div>
                <h1 className="font-display text-3xl text-foreground mb-3">
                  Unlock Your Studio
                </h1>
                <p className="text-muted-foreground mb-8 max-w-xs mx-auto leading-relaxed">
                  We review every application personally. We're looking for creators
                  genuinely excited to share their process — not perfection.
                </p>

                <div className="space-y-3 mb-8 text-left">
                  {[
                    "3 photos showing your creative work",
                    "2 short questions about what you'll teach",
                    "Personal review — we'll notify you within 24 hours",
                  ].map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 bg-obsidian/50 rounded-xl px-4 py-3"
                    >
                      <div className="w-6 h-6 rounded-full bg-electric/20 border border-electric/40 flex items-center justify-center flex-shrink-0">
                        <span className="text-[10px] font-bold text-electric">{i + 1}</span>
                      </div>
                      <span className="text-sm text-foreground">{item}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => { triggerClickHaptic(); setStep("portfolio"); }}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-electric to-crimson text-white font-semibold flex items-center justify-center gap-2"
                >
                  Start Application
                  <ArrowRight className="w-5 h-5" />
                </button>
              </motion.div>
            )}

            {/* ── PORTFOLIO ─────────────────────────────────────────────── */}
            {step === "portfolio" && (
              <motion.div
                key="portfolio"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
              >
                <Palette className="w-10 h-10 text-electric mb-3 mt-2" />
                <h2 className="font-display text-2xl text-foreground mb-1">Show Your Work</h2>
                <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
                  Each slot has a specific purpose. Read the label before choosing your photo.
                </p>

                {/* Photo slots */}
                <div className="space-y-3 mb-6">
                  {PHOTO_SLOTS.map(({ key, label, hint, Icon }) => {
                    const photo = photos[key];
                    return (
                      <div key={key}>
                        {/* Hidden real file input */}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          ref={el => { fileRefs.current[key] = el; }}
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) handlePhotoSelect(key, file);
                            // Reset so the same file can be re-selected after error
                            e.target.value = "";
                          }}
                        />

                        <button
                          type="button"
                          onClick={() => { triggerClickHaptic(); fileRefs.current[key]?.click(); }}
                          disabled={photo.uploading}
                          className={`w-full rounded-2xl border-2 overflow-hidden transition-all ${
                            photo.url
                              ? "border-electric"
                              : photo.uploading
                              ? "border-electric/40"
                              : "border-dashed border-border/50 bg-obsidian/50"
                          }`}
                        >
                          {photo.preview ? (
                            /* Thumbnail with overlay during upload */
                            <div className="relative h-32">
                              <img
                                src={photo.preview}
                                alt={label}
                                className="w-full h-full object-cover"
                              />
                              {/* Upload spinner overlay */}
                              {photo.uploading && (
                                <div className="absolute inset-0 bg-carbon/60 flex items-center justify-center">
                                  <Loader2 className="w-8 h-8 text-electric animate-spin" />
                                </div>
                              )}
                              {/* Success badge */}
                              {photo.url && (
                                <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-electric flex items-center justify-center shadow-lg">
                                  <CheckCircle2 className="w-4 h-4 text-white" />
                                </div>
                              )}
                              {/* Slot label overlay */}
                              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-carbon/80 to-transparent px-3 py-2">
                                <span className="text-xs font-semibold text-white">{label}</span>
                              </div>
                            </div>
                          ) : (
                            /* Empty slot */
                            <div className="flex items-center gap-4 px-4 py-4">
                              <div className="w-12 h-12 rounded-xl bg-obsidian border border-border/40 flex items-center justify-center flex-shrink-0">
                                <Icon className="w-5 h-5 text-muted-foreground" />
                              </div>
                              <div className="text-left">
                                <p className="text-sm font-semibold text-foreground">{label}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>
                              </div>
                            </div>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Upload counter */}
                <p className="text-xs text-muted-foreground/60 text-center mb-5">
                  {uploadedCount}/3 photos uploaded
                </p>

                {/* Social link — optional */}
                <div className="mb-6">
                  <p className="text-sm font-semibold text-foreground mb-2">
                    Social or Portfolio Link{" "}
                    <span className="text-muted-foreground font-normal">(Optional)</span>
                  </p>
                  <div className="flex items-center gap-3 bg-obsidian/50 border border-border/40 rounded-xl px-4 py-3">
                    <Link2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <input
                      type="url"
                      inputMode="url"
                      placeholder="Instagram, TikTok, or portfolio URL"
                      value={socialLink}
                      onChange={e => setSocialLink(e.target.value)}
                      className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 outline-none min-w-0"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground/50 mt-1.5 leading-relaxed">
                    Any public post of you creating — Instagram, TikTok, YouTube, Twitter. Helps us verify faster.
                  </p>
                </div>

                <button
                  onClick={() => { triggerClickHaptic(); setStep("questions"); }}
                  disabled={!allPhotosReady || anyUploading}
                  className={`w-full py-4 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all ${
                    allPhotosReady && !anyUploading
                      ? "bg-electric text-carbon"
                      : "bg-obsidian text-muted-foreground cursor-not-allowed"
                  }`}
                >
                  Continue
                  <ArrowRight className="w-5 h-5" />
                </button>
              </motion.div>
            )}

            {/* ── QUESTIONS ─────────────────────────────────────────────── */}
            {step === "questions" && (
              <motion.div
                key="questions"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
              >
                <div className="w-10 h-10 rounded-xl bg-electric/20 border border-electric/30 flex items-center justify-center mb-3 mt-2">
                  <span className="font-display text-electric text-xl font-bold leading-none">?</span>
                </div>
                <h2 className="font-display text-2xl text-foreground mb-1">Two Quick Questions</h2>
                <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
                  This is what we read when reviewing your application. Be real — 2-3 sentences is enough.
                </p>

                <div className="space-y-5 mb-6">
                  {/* Q1 */}
                  <div>
                    <label className="text-sm font-semibold text-foreground block mb-2">
                      What will people experience in your live sessions?
                    </label>
                    <textarea
                      value={answerTeaching}
                      onChange={e => setAnswerTeaching(e.target.value)}
                      placeholder="e.g. I paint abstract watercolors and explain every brushstroke as I go. Viewers can ask questions in real time and I adjust based on what they want to see…"
                      rows={4}
                      className="w-full bg-obsidian/50 border border-border/40 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-electric/60 transition-colors resize-none leading-relaxed"
                    />
                    <p className={`text-xs mt-1.5 text-right transition-colors ${
                      answerTeaching.length >= 30 ? "text-electric" : "text-muted-foreground/40"
                    }`}>
                      {answerTeaching.length >= 30
                        ? "✓ Good"
                        : `${30 - answerTeaching.length} more characters`}
                    </p>
                  </div>

                  {/* Q2 */}
                  <div>
                    <label className="text-sm font-semibold text-foreground block mb-2">
                      Describe your creative background
                    </label>
                    <textarea
                      value={answerBackground}
                      onChange={e => setAnswerBackground(e.target.value)}
                      placeholder="e.g. I've been drawing since I was 12, mostly self-taught. I specialise in charcoal portraits and have been sharing my process on Instagram for 3 years…"
                      rows={4}
                      className="w-full bg-obsidian/50 border border-border/40 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-electric/60 transition-colors resize-none leading-relaxed"
                    />
                    <p className={`text-xs mt-1.5 text-right transition-colors ${
                      answerBackground.length >= 30 ? "text-electric" : "text-muted-foreground/40"
                    }`}>
                      {answerBackground.length >= 30
                        ? "✓ Good"
                        : `${30 - answerBackground.length} more characters`}
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={!questionsValid || isSubmitting}
                  className={`w-full py-4 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all ${
                    questionsValid && !isSubmitting
                      ? "bg-gradient-to-r from-electric to-crimson text-white"
                      : "bg-obsidian text-muted-foreground cursor-not-allowed"
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Submitting…
                    </>
                  ) : (
                    <>
                      Submit Application
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </motion.div>
            )}

            {/* ── SUBMITTED ─────────────────────────────────────────────── */}
            {step === "submitted" && (
              <motion.div
                key="submitted"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center pt-12"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.15, type: "spring", stiffness: 280, damping: 22 }}
                  className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-electric to-crimson flex items-center justify-center"
                >
                  <CheckCircle2 className="w-12 h-12 text-white" />
                </motion.div>

                <h2 className="font-display text-3xl text-foreground mb-3">
                  Application Sent
                </h2>
                <p className="text-muted-foreground mb-8 max-w-xs mx-auto leading-relaxed">
                  We'll personally review your work and reply within 24 hours.
                  You'll be notified the moment you're approved.
                </p>

                <div className="bg-obsidian/50 border border-border/30 rounded-2xl px-5 py-4 mb-8 flex items-start gap-3 text-left">
                  <Clock className="w-5 h-5 text-electric flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-foreground/80 leading-relaxed">
                    Your studio access activates automatically once approved —
                    no action needed on your end.
                  </p>
                </div>

                <button
                  onClick={handleClose}
                  className="w-full py-4 rounded-2xl bg-obsidian border border-border/40 text-foreground font-semibold"
                >
                  Back to Exhiby
                </button>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
