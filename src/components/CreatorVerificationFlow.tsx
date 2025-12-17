import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, 
  Upload, 
  Image, 
  CreditCard, 
  CheckCircle2, 
  ArrowRight,
  Shield,
  Palette,
  Building2
} from "lucide-react";
import { triggerClickHaptic, triggerSuccessHaptic } from "@/lib/haptics";
import { toast } from "@/hooks/use-toast";

interface CreatorVerificationFlowProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

type Step = "intro" | "id" | "portfolio" | "bank" | "review" | "complete";

const steps: { id: Step; title: string; icon: typeof Shield }[] = [
  { id: "id", title: "Identity", icon: Shield },
  { id: "portfolio", title: "Portfolio", icon: Palette },
  { id: "bank", title: "Payout", icon: Building2 },
];

export function CreatorVerificationFlow({ 
  isOpen, 
  onClose, 
  onComplete 
}: CreatorVerificationFlowProps) {
  const [currentStep, setCurrentStep] = useState<Step>("intro");
  const [idUploaded, setIdUploaded] = useState(false);
  const [portfolioUploaded, setPortfolioUploaded] = useState(false);
  const [bankConnected, setBankConnected] = useState(false);

  const handleNext = () => {
    triggerClickHaptic();
    const stepOrder: Step[] = ["intro", "id", "portfolio", "bank", "review", "complete"];
    const currentIndex = stepOrder.indexOf(currentStep);
    if (currentIndex < stepOrder.length - 1) {
      setCurrentStep(stepOrder[currentIndex + 1]);
    }
  };

  const handleComplete = () => {
    triggerSuccessHaptic();
    toast({
      title: "Verification Submitted!",
      description: "Welcome to the creator community. Your studio is now open.",
    });
    onComplete();
    onClose();
  };

  const getStepIndex = () => {
    const idx = steps.findIndex(s => s.id === currentStep);
    return idx >= 0 ? idx : 0;
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-carbon/95 backdrop-blur-xl"
      >
        {/* Header */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-obsidian border border-border/50 flex items-center justify-center"
          >
            <X className="w-5 h-5 text-foreground" />
          </motion.button>
          
          {currentStep !== "intro" && currentStep !== "complete" && (
            <div className="flex gap-2">
              {steps.map((step, idx) => (
                <div
                  key={step.id}
                  className={`w-16 h-1 rounded-full transition-colors ${
                    idx <= getStepIndex() ? "bg-electric" : "bg-border/50"
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="h-full flex flex-col justify-center px-6 pt-20 pb-10">
          <AnimatePresence mode="wait">
            {/* Intro */}
            {currentStep === "intro" && (
              <motion.div
                key="intro"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="text-center"
              >
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-electric to-crimson flex items-center justify-center">
                  <Palette className="w-10 h-10 text-white" />
                </div>
                <h1 className="font-display text-3xl text-foreground mb-4">
                  Open Your Studio
                </h1>
                <p className="text-muted-foreground mb-8 max-w-sm mx-auto">
                  Join our verified creator community. Host live sessions, 
                  sell your art, and build your collector base.
                </p>
                <div className="space-y-3 mb-8">
                  {[
                    "Host unlimited live sessions",
                    "Sell digital & physical art",
                    "Earn from ticket sales & tips",
                    "Access analytics dashboard",
                  ].map((benefit, idx) => (
                    <div 
                      key={idx}
                      className="flex items-center gap-3 text-left bg-obsidian/50 rounded-xl px-4 py-3"
                    >
                      <CheckCircle2 className="w-5 h-5 text-electric flex-shrink-0" />
                      <span className="text-sm text-foreground">{benefit}</span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={handleNext}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-electric to-crimson text-white font-semibold flex items-center justify-center gap-2"
                >
                  Start Verification
                  <ArrowRight className="w-5 h-5" />
                </button>
              </motion.div>
            )}

            {/* ID Upload */}
            {currentStep === "id" && (
              <motion.div
                key="id"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <Shield className="w-12 h-12 text-electric mb-4" />
                <h2 className="font-display text-2xl text-foreground mb-2">
                  Verify Your Identity
                </h2>
                <p className="text-muted-foreground mb-6">
                  Upload a government-issued ID for verification. 
                  This keeps our community safe.
                </p>
                
                <button
                  onClick={() => {
                    triggerClickHaptic();
                    setIdUploaded(true);
                  }}
                  className={`w-full aspect-video rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-3 transition-all ${
                    idUploaded 
                      ? "border-electric bg-electric/10" 
                      : "border-border/50 bg-obsidian/50"
                  }`}
                >
                  {idUploaded ? (
                    <>
                      <CheckCircle2 className="w-12 h-12 text-electric" />
                      <span className="text-electric font-medium">ID Uploaded</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-12 h-12 text-muted-foreground" />
                      <span className="text-muted-foreground">Tap to upload ID</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleNext}
                  disabled={!idUploaded}
                  className={`w-full mt-6 py-4 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all ${
                    idUploaded
                      ? "bg-electric text-carbon"
                      : "bg-obsidian text-muted-foreground"
                  }`}
                >
                  Continue
                  <ArrowRight className="w-5 h-5" />
                </button>
              </motion.div>
            )}

            {/* Portfolio */}
            {currentStep === "portfolio" && (
              <motion.div
                key="portfolio"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <Palette className="w-12 h-12 text-electric mb-4" />
                <h2 className="font-display text-2xl text-foreground mb-2">
                  Show Your Work
                </h2>
                <p className="text-muted-foreground mb-6">
                  Upload 3-5 samples of your best work. 
                  This helps us verify you're a real artist.
                </p>
                
                <div className="grid grid-cols-3 gap-3 mb-6">
                  {[1, 2, 3].map((i) => (
                    <button
                      key={i}
                      onClick={() => {
                        triggerClickHaptic();
                        setPortfolioUploaded(true);
                      }}
                      className={`aspect-square rounded-xl border-2 border-dashed flex items-center justify-center transition-all ${
                        portfolioUploaded 
                          ? "border-electric bg-electric/10" 
                          : "border-border/50 bg-obsidian/50"
                      }`}
                    >
                      {portfolioUploaded ? (
                        <CheckCircle2 className="w-8 h-8 text-electric" />
                      ) : (
                        <Image className="w-8 h-8 text-muted-foreground" />
                      )}
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleNext}
                  disabled={!portfolioUploaded}
                  className={`w-full py-4 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all ${
                    portfolioUploaded
                      ? "bg-electric text-carbon"
                      : "bg-obsidian text-muted-foreground"
                  }`}
                >
                  Continue
                  <ArrowRight className="w-5 h-5" />
                </button>
              </motion.div>
            )}

            {/* Bank Connection */}
            {currentStep === "bank" && (
              <motion.div
                key="bank"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <Building2 className="w-12 h-12 text-electric mb-4" />
                <h2 className="font-display text-2xl text-foreground mb-2">
                  Connect Payout
                </h2>
                <p className="text-muted-foreground mb-6">
                  Connect your bank account to receive payouts from 
                  ticket sales and tips.
                </p>
                
                <button
                  onClick={() => {
                    triggerClickHaptic();
                    setBankConnected(true);
                  }}
                  className={`w-full py-6 rounded-2xl border-2 flex items-center justify-center gap-3 transition-all ${
                    bankConnected 
                      ? "border-electric bg-electric/10" 
                      : "border-border/50 bg-obsidian/50"
                  }`}
                >
                  {bankConnected ? (
                    <>
                      <CheckCircle2 className="w-6 h-6 text-electric" />
                      <span className="text-electric font-medium">Bank Connected</span>
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-6 h-6 text-muted-foreground" />
                      <span className="text-muted-foreground">Connect via Stripe</span>
                    </>
                  )}
                </button>

                <p className="text-xs text-muted-foreground text-center mt-4 mb-6">
                  Powered by Stripe. Your banking details are encrypted and secure.
                </p>

                <button
                  onClick={handleNext}
                  disabled={!bankConnected}
                  className={`w-full py-4 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all ${
                    bankConnected
                      ? "bg-electric text-carbon"
                      : "bg-obsidian text-muted-foreground"
                  }`}
                >
                  Continue
                  <ArrowRight className="w-5 h-5" />
                </button>
              </motion.div>
            )}

            {/* Review */}
            {currentStep === "review" && (
              <motion.div
                key="review"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="text-center"
              >
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-obsidian border-2 border-electric flex items-center justify-center">
                  <CheckCircle2 className="w-10 h-10 text-electric" />
                </div>
                <h2 className="font-display text-2xl text-foreground mb-2">
                  Ready to Submit
                </h2>
                <p className="text-muted-foreground mb-8">
                  We'll review your application within 24 hours. 
                  You'll be notified once approved.
                </p>

                <div className="space-y-3 mb-8">
                  {[
                    { label: "Identity Verified", done: idUploaded },
                    { label: "Portfolio Uploaded", done: portfolioUploaded },
                    { label: "Payout Connected", done: bankConnected },
                  ].map((item, idx) => (
                    <div 
                      key={idx}
                      className="flex items-center gap-3 bg-obsidian/50 rounded-xl px-4 py-3"
                    >
                      <CheckCircle2 className={`w-5 h-5 ${item.done ? "text-electric" : "text-muted-foreground"}`} />
                      <span className="text-sm text-foreground">{item.label}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleComplete}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-electric to-crimson text-white font-semibold"
                >
                  Submit & Open Studio
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
