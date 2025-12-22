import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { HomeScreen } from "@/components/HomeScreen";
import { GoLiveWizard } from "@/components/GoLiveWizard";
import { LiveSession } from "@/components/LiveSession";
import { CreatorProfile } from "@/components/CreatorProfile";
import { ProfileScreen } from "@/components/ProfileScreen";
import { SearchOverlay } from "@/components/SearchOverlay";
import { PassportStamp, LogoutOverlay, PassportModal } from "@/components/auth";
import { UserModeProvider, useUserMode } from "@/contexts/UserModeContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
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
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();
  const { mode } = useUserMode();
  const [currentScreen, setCurrentScreen] = useState<Screen>("home");
  const [showWizard, setShowWizard] = useState(false);
  const [showLiveSession, setShowLiveSession] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [eventData, setEventData] = useState<EventData | null>(null);
  const [activeTab, setActiveTab] = useState(mode === "audience" ? "home" : "studio");
  const [showWelcomeStamp, setShowWelcomeStamp] = useState(false);
  const [userName, setUserName] = useState("Guest");
  const [showLogoutOverlay, setShowLogoutOverlay] = useState(false);
  const [needsPassportSetup, setNeedsPassportSetup] = useState(false);
  const [isCheckingProfile, setIsCheckingProfile] = useState(true);

  // Check if user needs passport setup (first-time users)
  useEffect(() => {
    const checkPassportSetup = async () => {
      if (user && !isLoading) {
        setIsCheckingProfile(true);
        
        try {
          const { data: profile } = await supabase
            .from("profiles")
            .select("name, handle, avatar_url")
            .eq("user_id", user.id)
            .maybeSingle();
          
          // Store userName for later use
          setUserName(profile?.name || user.user_metadata?.name || user.email?.split("@")[0] || "Guest");
          
          // Check if passport is incomplete (no handle or avatar)
          if (profile && (!profile.handle || !profile.avatar_url)) {
            setNeedsPassportSetup(true);
          } else if (profile) {
            // Passport complete - check for welcome stamp
            const lastStampShown = sessionStorage.getItem("exhiby_stamp_shown");
            if (!lastStampShown) {
              setShowWelcomeStamp(true);
              sessionStorage.setItem("exhiby_stamp_shown", "true");
            }
          }
        } catch (error) {
          console.error("Profile check error:", error);
        } finally {
          setIsCheckingProfile(false);
        }
      } else if (!isLoading && !user) {
        setIsCheckingProfile(false);
      }
    };

    checkPassportSetup();
  }, [user, isLoading]);

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/auth", { replace: true });
    }
  }, [user, isLoading, navigate]);

  const handleStampComplete = () => {
    setShowWelcomeStamp(false);
  };

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
      toast.info("Coming Soon", {
        description: `${tab.charAt(0).toUpperCase() + tab.slice(1)} feature is under development`,
      });
    }
    setActiveTab(tab);
  };

  const handleLogout = () => {
    setShowLogoutOverlay(true);
  };

  const handleLogoutComplete = () => {
    setShowLogoutOverlay(false);
  };

  // Show loading state
  if (isLoading || isCheckingProfile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Redirect handled by useEffect
  if (!user) {
    return null;
  }

  // Passport setup for first-time users (mandatory, non-skippable)
  if (needsPassportSetup) {
    return (
      <PassportModal 
        userName={userName} 
        onComplete={() => {
          setNeedsPassportSetup(false);
          setShowWelcomeStamp(true);
          sessionStorage.setItem("exhiby_stamp_shown", "true");
        }} 
      />
    );
  }

  // Welcome stamp animation for returning users
  if (showWelcomeStamp) {
    return <PassportStamp userName={userName} onComplete={handleStampComplete} />;
  }

  // Creator Profile (viewing another creator)
  if (currentScreen === "creatorProfile") {
    return (
      <div className="min-h-screen bg-background">
        <CreatorProfile onBack={handleBack} />
      </div>
    );
  }

  // User's own Profile (Audience Passport or Creator Studio Dashboard)
  if (currentScreen === "profile") {
    return (
      <div className="min-h-screen bg-background">
        <ProfileScreen 
          onBack={() => {
            setCurrentScreen("home");
            setActiveTab(mode === "audience" ? "home" : "studio");
          }} 
          onGoLive={() => setShowWizard(true)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-center" />
      
      <HomeScreen 
        onGoLive={() => setShowWizard(true)} 
        onViewCreatorProfile={() => setCurrentScreen("creatorProfile")}
        onViewAudienceProfile={() => {
          setCurrentScreen("profile");
          setActiveTab(mode === "audience" ? "passport" : "profile");
        }}
        onOpenStudio={() => {
          setCurrentScreen("profile");
          setActiveTab("profile");
        }}
        onOpenSearch={() => setShowSearch(true)}
        onLogout={handleLogout}
      />

      {/* Cinematic Logout Overlay */}
      <LogoutOverlay 
        isActive={showLogoutOverlay} 
        onComplete={handleLogoutComplete} 
      />

      {/* Search Overlay */}
      <SearchOverlay
        isOpen={showSearch}
        onClose={() => setShowSearch(false)}
        onSelectArtist={() => {
          setShowSearch(false);
          setCurrentScreen("creatorProfile");
        }}
        onJoinLive={() => {
          setShowSearch(false);
          toast.success("Joining live room...");
        }}
        onSelectCategory={(tag) => {
          toast.info(`Filtering by ${tag}`);
        }}
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
}

const Index = () => {
  return (
    <UserModeProvider>
      <IndexContent />
    </UserModeProvider>
  );
};

export default Index;
