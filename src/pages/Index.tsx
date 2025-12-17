import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { HomeScreen } from "@/components/HomeScreen";
import { GoLiveWizard } from "@/components/GoLiveWizard";
import { LiveSession } from "@/components/LiveSession";
import { CreatorProfile } from "@/components/CreatorProfile";
import { ProfileScreen } from "@/components/ProfileScreen";
import { BottomNavigation } from "@/components/BottomNavigation";
import { LiveRoomTest } from "@/components/LiveRoomTest";
import { UserModeProvider, useUserMode } from "@/contexts/UserModeContext";
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

type Screen = "home" | "wizard" | "live" | "creatorProfile" | "profile";

function IndexContent() {
  const { mode } = useUserMode();
  const [currentScreen, setCurrentScreen] = useState<Screen>("home");
  const [showWizard, setShowWizard] = useState(false);
  const [showLiveSession, setShowLiveSession] = useState(false);
  const [eventData, setEventData] = useState<EventData | null>(null);
  const [activeTab, setActiveTab] = useState(mode === "audience" ? "home" : "studio");

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

  const handleTabChange = (tab: string) => {
    if (tab === "profile" || tab === "passport") {
      setCurrentScreen("profile");
    } else if (tab === "home" || tab === "studio") {
      setCurrentScreen("home");
    } else {
      // For search, insights, menu - show toast for now
      toast.info("Coming Soon", {
        description: `${tab.charAt(0).toUpperCase() + tab.slice(1)} feature is under development`,
      });
    }
    setActiveTab(tab);
  };

  // Creator Profile (viewing another creator)
  if (currentScreen === "creatorProfile") {
    return (
      <div className="max-w-md mx-auto min-h-screen bg-background">
        <CreatorProfile onBack={handleBack} />
      </div>
    );
  }

  // User's own Profile (Audience Passport or Creator Studio Dashboard)
  if (currentScreen === "profile") {
    return (
      <div className="max-w-md mx-auto min-h-screen bg-background">
        <ProfileScreen 
          onBack={() => {
            setCurrentScreen("home");
            setActiveTab(mode === "audience" ? "home" : "studio");
          }} 
          onGoLive={() => setShowWizard(true)}
        />
        <BottomNavigation
          mode={mode}
          activeTab={activeTab}
          onTabChange={handleTabChange}
        />
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-background">
      <Toaster position="top-center" />
      
      <HomeScreen 
        onGoLive={() => setShowWizard(true)} 
        onViewCreatorProfile={() => setCurrentScreen("creatorProfile")}
        onViewAudienceProfile={() => {
          setCurrentScreen("profile");
          setActiveTab(mode === "audience" ? "passport" : "profile");
        }}
      />

      <BottomNavigation
        mode={mode}
        activeTab={activeTab}
        onTabChange={handleTabChange}
      />

      {/* Test Button for Daily.co Live Room */}
      <LiveRoomTest />

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
}

const Index = () => {
  return (
    <UserModeProvider>
      <IndexContent />
    </UserModeProvider>
  );
};

export default Index;
