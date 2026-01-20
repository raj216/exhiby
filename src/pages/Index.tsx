import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { HomeScreen } from "@/components/HomeScreen";
import { GoLiveWizard } from "@/components/GoLiveWizard";
import { LiveSession } from "@/components/LiveSession";
import { CreatorProfile } from "@/components/CreatorProfile";
import { ProfileScreen } from "@/components/ProfileScreen";
import { SearchOverlay } from "@/components/SearchOverlay";
import { PassportStamp, LogoutOverlay, PassportModal } from "@/components/auth";
import { PageTransition } from "@/components/PageTransition";
import { UserModeProvider, useUserMode } from "@/contexts/UserModeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigationHistory, type Screen } from "@/hooks/useNavigationHistory";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

import { EventData } from "@/components/GoLiveWizard";

function IndexContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading } = useAuth();
  const { mode } = useUserMode();
  
  // Navigation history for proper back button support
  const { 
    currentScreen, 
    navigate: navTo, 
    goBack, 
    goHome,
    canGoBack 
  } = useNavigationHistory("home");
  
  const [transitionDirection, setTransitionDirection] = useState<"forward" | "backward">("forward");
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

  // Navigate forward to a screen
  const navigateToScreen = useCallback((screen: Screen) => {
    setTransitionDirection("forward");
    navTo(screen);
  }, [navTo]);

  // Handle back navigation
  const handleBack = useCallback(() => {
    if (canGoBack) {
      setTransitionDirection("backward");
      const previousEntry = goBack();
      if (previousEntry) {
        // Update active tab based on screen
        if (previousEntry.screen === "home") {
          setActiveTab(mode === "audience" ? "home" : "studio");
        } else if (previousEntry.screen === "profile") {
          setActiveTab(mode === "audience" ? "passport" : "profile");
        }
      }
    } else {
      // Already at home, do nothing
      setTransitionDirection("backward");
      goHome();
      setActiveTab(mode === "audience" ? "home" : "studio");
    }
  }, [canGoBack, goBack, goHome, mode]);

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

  // Handle navigation state for opening own profile from search
  useEffect(() => {
    const state = location.state as { openProfile?: boolean; openEditProfile?: boolean } | null;
    if (state?.openProfile) {
      console.log("[Index] Opening own profile from navigation state");
      navigateToScreen("profile");
      setActiveTab(mode === "audience" ? "passport" : "profile");
      // Clear the state to prevent re-triggering
      navigate(location.pathname, { replace: true, state: {} });
    }
    if (state?.openEditProfile) {
      console.log("[Index] Opening edit profile from navigation state");
      navigateToScreen("profile");
      setActiveTab(mode === "audience" ? "passport" : "profile");
      // Clear the state
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, mode, navigate, location.pathname, navigateToScreen]);

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

  const handleTabChange = (tab: string) => {
    if (tab === "profile" || tab === "passport") {
      navigateToScreen("profile");
    } else if (tab === "home" || tab === "studio") {
      setTransitionDirection("backward");
      goHome();
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

  // Render current screen with smooth transitions
  const renderScreen = () => {
    switch (currentScreen) {
      case "creatorProfile":
        return (
          <PageTransition key="creatorProfile" direction={transitionDirection}>
            <CreatorProfile onBack={handleBack} />
          </PageTransition>
        );
      
      case "profile":
        return (
          <PageTransition key="profile" direction={transitionDirection}>
            <ProfileScreen 
              onBack={handleBack} 
              onGoLive={() => setShowWizard(true)}
            />
          </PageTransition>
        );
      
      default:
        return (
          <PageTransition key="home" direction={transitionDirection}>
            <HomeScreen 
              onGoLive={() => setShowWizard(true)} 
              onViewCreatorProfile={() => navigateToScreen("creatorProfile")}
              onViewAudienceProfile={() => {
                navigateToScreen("profile");
                setActiveTab(mode === "audience" ? "passport" : "profile");
              }}
              onOpenStudio={() => {
                navigateToScreen("profile");
                setActiveTab("profile");
              }}
              onOpenSearch={() => setShowSearch(true)}
              onLogout={handleLogout}
            />
          </PageTransition>
        );
    }
  };

  // Premium easing curve for app scale effect
  const isModalOpen = showWizard || showLiveSession;

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      <Toaster position="top-center" />
      
      {/* App content with scale effect when modals open */}
      <motion.div
        animate={{
          scale: isModalOpen ? 0.95 : 1,
          filter: isModalOpen ? "brightness(0.7)" : "brightness(1)",
        }}
        transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] as const }}
        style={{ willChange: "transform, filter", transformOrigin: "center center" }}
        className="min-h-screen"
      >
        <AnimatePresence mode="popLayout">
          {renderScreen()}
        </AnimatePresence>
      </motion.div>

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
          navigateToScreen("creatorProfile");
        }}
        onJoinLive={() => {
          setShowSearch(false);
          toast.success("Joining live room...");
        }}
        onSelectCategory={(tag) => {
          toast.info(`Filtering by ${tag}`);
        }}
        onOpenOwnProfile={() => {
          setShowSearch(false);
          navigateToScreen("profile");
          setActiveTab(mode === "audience" ? "passport" : "profile");
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
