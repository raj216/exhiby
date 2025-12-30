import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AudienceProfile } from "./AudienceProfile";
import { StudioDashboard } from "./StudioDashboard";
import { CreatorVerificationFlow } from "./CreatorVerificationFlow";
import { useUserMode } from "@/contexts/UserModeContext";
import { triggerClickHaptic } from "@/lib/haptics";
import { useProfile } from "@/hooks/useProfile";

interface ProfileScreenProps {
  onBack: () => void;
  onGoLive: () => void;
}

export function ProfileScreen({ onBack, onGoLive }: ProfileScreenProps) {
  const { mode, isVerifiedCreator, activateCreatorRole, toggleMode, setMode } = useUserMode();
  const [showVerification, setShowVerification] = useState(false);
  const [isFlipping, setIsFlipping] = useState(false);
  const { profile } = useProfile();

  const handleSwitchMode = () => {
    // Always allow switching back to Audience. Only gate switching *into* Creator.
    if (mode === "audience" && !isVerifiedCreator) return;

    triggerClickHaptic();
    setIsFlipping(true);

    // Start flip animation
    setTimeout(() => {
      toggleMode();
    }, 150); // Switch at midpoint of flip

    setTimeout(() => {
      setIsFlipping(false);
    }, 300);
  };

  const handleOpenStudio = () => {
    triggerClickHaptic();
    setShowVerification(true);
  };

  const handleVerificationComplete = async () => {
    await activateCreatorRole();
  };

  return (
    <>
      <AnimatePresence mode="wait">
        <motion.div
          key={mode}
          initial={{ 
            rotateY: isFlipping ? -90 : 0,
            opacity: isFlipping ? 0 : 1 
          }}
          animate={{ 
            rotateY: 0,
            opacity: 1 
          }}
          exit={{ 
            rotateY: 90,
            opacity: 0 
          }}
          transition={{ 
            duration: 0.15,
            ease: "easeInOut"
          }}
          style={{ 
            transformStyle: "preserve-3d",
            perspective: 1000 
          }}
          className="min-h-screen"
        >
          {mode === "audience" ? (
            <AudienceProfile
              onBack={onBack}
              onSwitchMode={isVerifiedCreator ? handleSwitchMode : undefined}
              isVerifiedCreator={isVerifiedCreator}
              onOpenStudio={handleOpenStudio}
              profile={profile}
            />
          ) : (
            <StudioDashboard
              onBack={onBack}
              onSwitchMode={handleSwitchMode}
              onGoLive={onGoLive}
              profile={profile}
            />
          )}
        </motion.div>
      </AnimatePresence>

      <CreatorVerificationFlow
        isOpen={showVerification}
        onClose={() => setShowVerification(false)}
        onComplete={handleVerificationComplete}
      />
    </>
  );
}
