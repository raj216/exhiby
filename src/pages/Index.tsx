import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { HomeScreen } from "@/components/HomeScreen";
import { GoLiveWizard } from "@/components/GoLiveWizard";
import { LiveSession } from "@/components/LiveSession";
import { CreatorProfile } from "@/components/CreatorProfile";
import { AudienceProfile } from "@/components/AudienceProfile";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

interface EventData {
  coverImage: string | null;
  category: string;
  title: string;
  description: string;
  price: number;
  scheduleType: "now" | "scheduled";
}

type Screen = "home" | "wizard" | "live" | "creatorProfile" | "audienceProfile";

const Index = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>("home");
  const [showWizard, setShowWizard] = useState(false);
  const [showLiveSession, setShowLiveSession] = useState(false);
  const [eventData, setEventData] = useState<EventData | null>(null);

  const handleGoLive = (data: EventData) => {
    setEventData(data);
    setShowWizard(false);

    if (data.scheduleType === "now") {
      setShowLiveSession(true);
      toast.success("You're now live!", {
        description: "Your gallery doors are open",
      });
    } else {
      toast.success("Event scheduled!", {
        description: "We'll notify your followers",
      });
    }
  };

  const handleCloseLiveSession = () => {
    setShowLiveSession(false);
    setEventData(null);
    toast("Session ended", {
      description: "Thanks for streaming!",
    });
  };

  const handleBack = () => {
    setCurrentScreen("home");
  };

  // Show profiles as full screen overlays
  if (currentScreen === "creatorProfile") {
    return (
      <div className="max-w-md mx-auto min-h-screen bg-background">
        <CreatorProfile onBack={handleBack} />
      </div>
    );
  }

  if (currentScreen === "audienceProfile") {
    return (
      <div className="max-w-md mx-auto min-h-screen bg-background">
        <AudienceProfile onBack={handleBack} />
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-background">
      <Toaster position="top-center" />
      
      <HomeScreen 
        onGoLive={() => setShowWizard(true)} 
        onViewCreatorProfile={() => setCurrentScreen("creatorProfile")}
        onViewAudienceProfile={() => setCurrentScreen("audienceProfile")}
      />

      <AnimatePresence>
        {showWizard && (
          <GoLiveWizard
            onClose={() => setShowWizard(false)}
            onGoLive={handleGoLive}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showLiveSession && eventData && (
          <LiveSession eventData={eventData} onClose={handleCloseLiveSession} />
        )}
      </AnimatePresence>
    </div>
  );
};

export default Index;
