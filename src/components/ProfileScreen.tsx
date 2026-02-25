import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AudienceProfile } from "./AudienceProfile";
import { StudioDashboard } from "./StudioDashboard";
import { CreatorVerificationFlow } from "./CreatorVerificationFlow";
import { ProfilePageSkeleton } from "./ui/loading-skeletons";
import { useUserMode } from "@/contexts/UserModeContext";
import { triggerClickHaptic } from "@/lib/haptics";
import { useProfile } from "@/hooks/useProfile";
import { ModeSwitchToast } from "./ModeSwitchToast";

interface ProfileScreenProps {
  onBack: () => void;
  onGoLive: () => void;
  onSchedule: () => void;
  refreshScheduleKey?: number;
}

export function ProfileScreen({ onBack, onGoLive, onSchedule, refreshScheduleKey }: ProfileScreenProps) {
  const { mode, isVerifiedCreator, activateCreatorRole, toggleMode, setMode } = useUserMode();
  const [showVerification, setShowVerification] = useState(false);
  const [isFlipping, setIsFlipping] = useState(false);
  const { profile, isLoading: profileLoading } = useProfile();
  const [toastMode, setToastMode] = useState<"creator" | "audience" | null>(null);

  const handleSwitchMode = () => {
    if (mode === "audience" && !isVerifiedCreator) return;

    triggerClickHaptic();
    setIsFlipping(true);

    const nextMode = mode === "creator" ? "audience" : "creator";

    setTimeout(() => {
      toggleMode();
      setToastMode(nextMode);
    }, 150);

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

  // Show skeleton while profile is loading
  if (profileLoading && !profile) {
    return <ProfilePageSkeleton />;
  }

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
            type: "spring",
            stiffness: 400,
            damping: 30,
            mass: 0.8
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
              onSchedule={onSchedule}
              refreshScheduleKey={refreshScheduleKey}
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

      <ModeSwitchToast mode={toastMode} onDone={() => setToastMode(null)} />
    </>
  );
}
