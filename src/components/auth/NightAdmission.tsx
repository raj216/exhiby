import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ClosedDoor } from "./ClosedDoor";
import { GlassCard } from "./GlassCard";
import { PassportStamp } from "./PassportStamp";

export type AuthStep = "door" | "signup" | "login" | "stamping";

interface NightAdmissionProps {
  onComplete: () => void;
}

export function NightAdmission({ onComplete }: NightAdmissionProps) {
  const [step, setStep] = useState<AuthStep>("door");
  const [userName, setUserName] = useState("");
  const [isDimmed, setIsDimmed] = useState(false);

  const handleGetPass = () => {
    setStep("signup");
  };

  const handleHavePass = () => {
    setStep("login");
  };

  const handleAuthSuccess = (name: string) => {
    setUserName(name);
    setStep("stamping");
  };

  const handleStampComplete = () => {
    onComplete();
  };

  const handleCloseCard = () => {
    setStep("door");
  };

  return (
    <motion.div 
      className="fixed inset-0 bg-background overflow-hidden"
      animate={{ 
        filter: isDimmed ? "brightness(0.7)" : "brightness(1)" 
      }}
      transition={{ duration: 0.3 }}
    >
      {/* Subtle ink drop video background would go here - using gradient fallback */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-radial from-primary/5 via-transparent to-transparent opacity-50" />
        <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-background via-background/80 to-transparent" />
      </div>

      <AnimatePresence mode="wait">
        {step === "door" && (
          <ClosedDoor 
            key="door"
            onGetPass={handleGetPass}
            onHavePass={handleHavePass}
            onHoverStart={() => setIsDimmed(true)}
            onHoverEnd={() => setIsDimmed(false)}
          />
        )}

        {(step === "signup" || step === "login") && (
          <GlassCard
            key="glass-card"
            mode={step}
            onSuccess={handleAuthSuccess}
            onClose={handleCloseCard}
          />
        )}

        {step === "stamping" && (
          <PassportStamp
            key="passport"
            userName={userName}
            onComplete={handleStampComplete}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
