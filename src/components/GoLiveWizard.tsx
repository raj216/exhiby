import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Image as ImageIcon, ChevronRight, X, Clock, Zap } from "lucide-react";
import { SlideToAction } from "./SlideToAction";
import { PriceSlider } from "./PriceSlider";
import { triggerClickHaptic } from "@/lib/haptics";

interface GoLiveWizardProps {
  onClose: () => void;
  onGoLive: (data: EventData) => void;
}

interface EventData {
  coverImage: string | null;
  category: string;
  title: string;
  description: string;
  price: number;
  scheduleType: "now" | "scheduled";
}

const categories = [
  { id: "reveal", emoji: "🛑", label: "The Reveal", description: "Unveiling a finished piece" },
  { id: "workshop", emoji: "🎓", label: "The Workshop", description: "Teaching a technique" },
  { id: "hangout", emoji: "☕", label: "Studio Hangout", description: "Casual sketching/chatting" },
];

export function GoLiveWizard({ onClose, onGoLive }: GoLiveWizardProps) {
  const [step, setStep] = useState(1);
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [category, setCategory] = useState<string>("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState(0);
  const [scheduleType, setScheduleType] = useState<"now" | "scheduled">("now");

  const canProceedStep1 = coverImage !== null;
  const canProceedStep2 = category !== "" && title.trim().length > 0;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCoverImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGoLive = () => {
    triggerClickHaptic();
    onGoLive({
      coverImage,
      category,
      title,
      description,
      price,
      scheduleType,
    });
  };

  const stepVariants = {
    enter: { x: 50, opacity: 0 },
    center: { x: 0, opacity: 1 },
    exit: { x: -50, opacity: 0 },
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-carbon z-50 flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/50">
        <button onClick={onClose} className="p-2 -ml-2">
          <X className="w-6 h-6 text-foreground" />
        </button>
        <div className="flex gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1 w-8 rounded-full transition-colors ${
                s <= step ? "bg-electric" : "bg-muted"
              }`}
            />
          ))}
        </div>
        <div className="w-10" />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3 }}
              className="p-6"
            >
              <h1 className="text-3xl font-display text-center mb-2">Set the Stage</h1>
              <p className="text-muted-foreground text-center mb-8">
                Your cover image is the first impression
              </p>

              {/* Ticket Preview */}
              <div className="flex justify-center mb-8">
                <div
                  className="relative w-56 rounded-2xl overflow-hidden border-2 border-dashed border-border transition-colors bg-obsidian"
                  style={{ aspectRatio: "2/3" }}
                >
                  {coverImage ? (
                    <>
                      <img
                        src={coverImage}
                        alt="Cover preview"
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={() => setCoverImage(null)}
                        className="absolute top-2 right-2 p-1.5 bg-carbon/80 rounded-full"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer hover:bg-obsidian/80 transition-colors">
                      <div className="w-16 h-16 rounded-full bg-obsidian flex items-center justify-center mb-4 border border-border/50">
                        <ImageIcon className="w-8 h-8 text-muted-foreground" />
                      </div>
                      <span className="text-muted-foreground text-sm">Tap to upload</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Upload Button */}
              <label className="block">
                <div className="flex items-center justify-center gap-3 py-4 px-6 bg-obsidian rounded-xl cursor-pointer hover:bg-muted transition-colors border border-border/30">
                  <Upload className="w-5 h-5 text-electric" />
                  <span className="font-medium">
                    {coverImage ? "Change Cover Image" : "Upload Cover Image"}
                  </span>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>

              {!canProceedStep1 && (
                <p className="text-center text-muted-foreground text-sm mt-4">
                  Upload an image to continue
                </p>
              )}
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3 }}
              className="p-6"
            >
              <h1 className="text-3xl font-display text-center mb-2">
                Define the Experience
              </h1>
              <p className="text-muted-foreground text-center mb-8">
                What are we doing today?
              </p>

              {/* Category Selection */}
              <div className="space-y-3 mb-8">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => {
                      triggerClickHaptic();
                      setCategory(cat.id);
                    }}
                    className={`category-btn w-full text-left ${
                      category === cat.id ? "selected" : ""
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-3xl">{cat.emoji}</span>
                      <div>
                        <div className="font-semibold text-foreground">
                          {cat.label}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {cat.description}
                        </div>
                      </div>
                    </div>
                    {category === cat.id && (
                      <motion.div
                        layoutId="categoryCheck"
                        className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-electric flex items-center justify-center"
                      >
                        <ChevronRight className="w-4 h-4 text-white" />
                      </motion.div>
                    )}
                  </button>
                ))}
              </div>

              {/* Title Input */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Room Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value.slice(0, 40))}
                    placeholder="Drawing Realistic Hair"
                    className="premium-input"
                  />
                  <div className="text-right text-xs text-muted-foreground mt-1">
                    {title.length}/40
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Description{" "}
                    <span className="text-muted-foreground">(optional)</span>
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What will viewers learn or experience?"
                    rows={3}
                    className="premium-input resize-none"
                  />
                </div>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3 }}
              className="p-6"
            >
              <h1 className="text-3xl font-display text-center mb-2">
                The Velvet Rope
              </h1>
              <p className="text-muted-foreground text-center mb-8">
                Set your ticket price
              </p>

              {/* Price Slider */}
              <div className="mb-8">
                <PriceSlider value={price} onChange={setPrice} />
              </div>

              {/* Schedule Options */}
              <div className="mb-8">
                <label className="block text-sm font-medium mb-4">
                  When do doors open?
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => {
                      triggerClickHaptic();
                      setScheduleType("now");
                    }}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      scheduleType === "now"
                        ? "border-electric bg-electric/10"
                        : "border-border bg-obsidian"
                    }`}
                  >
                    <Zap
                      className={`w-6 h-6 mx-auto mb-2 ${
                        scheduleType === "now"
                          ? "text-electric"
                          : "text-muted-foreground"
                      }`}
                    />
                    <div className="font-medium">Open Now</div>
                    <div className="text-xs text-muted-foreground">
                      Go live instantly
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      triggerClickHaptic();
                      setScheduleType("scheduled");
                    }}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      scheduleType === "scheduled"
                        ? "border-electric bg-electric/10"
                        : "border-border bg-obsidian"
                    }`}
                  >
                    <Clock
                      className={`w-6 h-6 mx-auto mb-2 ${
                        scheduleType === "scheduled"
                          ? "text-electric"
                          : "text-muted-foreground"
                      }`}
                    />
                    <div className="font-medium">Schedule</div>
                    <div className="text-xs text-muted-foreground">
                      Set a countdown
                    </div>
                  </button>
                </div>
              </div>

              {/* Slide to Open Doors */}
              <div className="mt-auto">
                <SlideToAction
                  label="Slide to Open Doors"
                  completedLabel="Doors Opening..."
                  onComplete={handleGoLive}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Navigation */}
      {step < 3 && (
        <div className="p-4 border-t border-border/50">
          <div className="flex gap-3">
            {step > 1 && (
              <button
                onClick={() => setStep(step - 1)}
                className="flex-1 py-4 rounded-xl bg-obsidian text-foreground font-medium border border-border/30"
              >
                Back
              </button>
            )}
            <button
              onClick={() => setStep(step + 1)}
              disabled={
                (step === 1 && !canProceedStep1) ||
                (step === 2 && !canProceedStep2)
              }
              className="flex-1 py-4 rounded-xl font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-opacity text-white"
              style={{
                background: "linear-gradient(135deg, hsl(7 100% 67%), hsl(345 100% 50%))"
              }}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}