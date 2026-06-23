import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { HomeScreen } from "@/components/HomeScreen";
import { BottomNavigation } from "@/components/BottomNavigation";

// Sub-screens: never visible on first paint — each gets its own chunk
const LiveSession    = lazy(() => import("@/components/LiveSession").then(m => ({ default: m.LiveSession })));
const CreatorProfile = lazy(() => import("@/components/CreatorProfile").then(m => ({ default: m.CreatorProfile })));
const ProfileScreen  = lazy(() => import("@/components/ProfileScreen").then(m => ({ default: m.ProfileScreen })));
const PassportStamp  = lazy(() => import("@/components/auth/PassportStamp").then(m => ({ default: m.PassportStamp })));
const LogoutOverlay  = lazy(() => import("@/components/auth/LogoutOverlay").then(m => ({ default: m.LogoutOverlay })));
import { PageTransition } from "@/components/PageTransition";
import { useUserMode } from "@/contexts/UserModeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigationHistory, type Screen } from "@/hooks/useNavigationHistory";
import { supabase } from "@/integrations/supabase/client";
import { Seo } from "@/components/Seo";
import { toast } from "sonner";
// Type-only import — stripped at build time, no runtime cost
import type { EventData } from "@/components/GoLiveWizard";

// Heavy modals/overlays — none are visible on first paint, so load them lazily.
// Each gets its own null-fallback Suspense so no spinner flashes on the page.
const GoLiveWizard      = lazy(() => import("@/components/GoLiveWizard").then(m => ({ default: m.GoLiveWizard })));
const ScheduleEventModal = lazy(() => import("@/components/ScheduleEventModal").then(m => ({ default: m.ScheduleEventModal })));
const SearchOverlay     = lazy(() => import("@/components/SearchOverlay").then(m => ({ default: m.SearchOverlay })));
const CategoriesOverlay = lazy(() => import("@/components/CategoriesOverlay").then(m => ({ default: m.CategoriesOverlay })));
const PassportModal     = lazy(() => import("@/components/auth").then(m => ({ default: m.PassportModal })));
const PlanOnboarding    = lazy(() => import("@/components/auth").then(m => ({ default: m.PlanOnboarding })));
const StudioDemo        = lazy(() => import("@/components/StudioDemo").then(m => ({ default: m.StudioDemo })));
const InstallBanner     = lazy(() => import("@/components/InstallBanner").then(m => ({ default: m.InstallBanner })));

function IndexContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading } = useAuth();
  const { mode, setMode, isVerifiedCreator } = useUserMode();
  
  // Restore internal screen from URL on mount (survives page refresh)
  const getInitialScreen = (): Screen => {
    const params = new URLSearchParams(window.location.search);
    const screen = params.get("screen");
    if (screen === "profile" || screen === "creatorProfile" || screen === "search" || screen === "settings") {
      return screen as Screen;
    }
    return "home";
  };

  // Navigation history for proper back button support
  const {
    navigate: navTo,
    goHome,
  } = useNavigationHistory(getInitialScreen());

  const [transitionDirection, setTransitionDirection] = useState<"forward" | "backward">("forward");
  const [showWizard, setShowWizard] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showLiveSession, setShowLiveSession] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const [eventData, setEventData] = useState<EventData | null>(null);
  const [showWelcomeStamp, setShowWelcomeStamp] = useState(false);
  const [userName, setUserName] = useState("Guest");
  const [showLogoutOverlay, setShowLogoutOverlay] = useState(false);
  const [needsPassportSetup, setNeedsPassportSetup] = useState(false);
  const [needsPlanSelection, setNeedsPlanSelection] = useState(false);
  const [needsStudioDemo, setNeedsStudioDemo] = useState(false);
  const [isCheckingProfile, setIsCheckingProfile] = useState(true);
  const [refreshScheduleKey, setRefreshScheduleKey] = useState(0);

  // Derive currentScreen from URL (single source of truth)
  const currentScreen: Screen = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const s = params.get("screen");
    if (s === "profile" || s === "creatorProfile" || s === "search" || s === "settings") {
      return s as Screen;
    }
    return "home";
  }, [location.search]);

  // Derive activeTab from currentScreen + mode (no manual setState needed)
  const activeTab = useMemo(() => {
    if (currentScreen === "profile") return mode === "audience" ? "passport" : "profile";
    return "home";
  }, [currentScreen, mode]);

  // Set backward slide direction when browser back button is pressed
  useEffect(() => {
    const onPop = () => setTransitionDirection("backward");
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Navigate forward to a screen
  const navigateToScreen = useCallback((screen: Screen) => {
    setTransitionDirection("forward");
    navTo(screen);
    const search = screen !== "home" ? `?screen=${screen}` : "";
    navigate({ pathname: "/", search }, { replace: false });
  }, [navTo, navigate]);

  // Handle back navigation
  const handleBack = useCallback(() => {
    setTransitionDirection("backward");
    navigate(-1);
  }, [navigate]);

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
          
          // Route to PassportModal if:
          //   (a) no profile row at all — rare race before trigger fires, or
          //   (b) profile exists but handle is missing.
          // Avatar is optional — never block login over a missing photo.
          if (!profile || !profile.handle) {
            setNeedsPassportSetup(true);
          } else {
            // Passport complete — check if plan selection was shown
            const planDone = user?.user_metadata?.plan_onboarding_done;
            if (!planDone) {
              setNeedsPlanSelection(true);
            } else {
              // Plan done — check for welcome stamp
              const lastStampShown = sessionStorage.getItem("exhiby_stamp_shown");
              if (!lastStampShown) {
                setShowWelcomeStamp(true);
                sessionStorage.setItem("exhiby_stamp_shown", "true");
              }
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
    const state = location.state as {
      openProfile?: boolean;
      openEditProfile?: boolean;
      openSearch?: boolean;
    } | null;

    if (state?.openSearch) {
      console.log("[Index] Re-opening search overlay from navigation state");
      setShowSearch(true);
      // Clear the state to prevent re-triggering
      navigate(location.pathname, { replace: true, state: {} });
      return;
    }

    if (state?.openProfile) {
      console.log("[Index] Opening own profile from navigation state");
      navigateToScreen("profile");
      // Clear the state to prevent re-triggering
      navigate(location.pathname, { replace: true, state: {} });
    }
    if (state?.openEditProfile) {
      console.log("[Index] Opening edit profile from navigation state");
      navigateToScreen("profile");
      // Clear the state
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, mode, navigate, location.pathname, navigateToScreen]);

  const handleStampComplete = () => {
    setShowWelcomeStamp(false);
    // First-run only: show the "Open your Studio" walkthrough once. Tracked in
    // auth metadata (same mechanism as plan_onboarding_done) so it never repeats.
    // Skipped for verified creators — they've already opened their studio.
    if (!user?.user_metadata?.studio_demo_seen && !isVerifiedCreator) {
      setNeedsStudioDemo(true);
    }
  };

  const handleStudioDemoComplete = useCallback(async () => {
    setNeedsStudioDemo(false);
    // Best-effort persist — never block dismissing the demo on a network call.
    try {
      await supabase.auth.updateUser({ data: { studio_demo_seen: true } });
    } catch (error) {
      console.error("[Index] Failed to persist studio_demo_seen:", error);
    }
  }, []);

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
      description: "Thanks for hosting!",
    });
  };

  const handleTabChange = (tab: string) => {
    if (tab === "profile" || tab === "passport") {
      navigateToScreen("profile");
    } else if (tab === "home" || tab === "studio") {
      setTransitionDirection("backward");
      goHome();
      navigate({ pathname: "/", search: "" }, { replace: false });
    } else {
      toast.info("Coming Soon", {
        description: `${tab.charAt(0).toUpperCase() + tab.slice(1)} feature is under development`,
      });
    }
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
      <Suspense fallback={null}>
        <PassportModal
          userName={userName}
          onComplete={() => {
            setNeedsPassportSetup(false);
            setNeedsPlanSelection(true);
          }}
        />
      </Suspense>
    );
  }

  // Plan selection — shown once after passport, before entering the app
  if (needsPlanSelection) {
    return (
      <Suspense fallback={null}>
        <PlanOnboarding
          onComplete={() => {
            setNeedsPlanSelection(false);
            setShowWelcomeStamp(true);
            sessionStorage.setItem("exhiby_stamp_shown", "true");
          }}
        />
      </Suspense>
    );
  }

  // Welcome stamp animation for returning users
  if (showWelcomeStamp) {
    return (
      <Suspense fallback={null}>
        <PassportStamp userName={userName} onComplete={handleStampComplete} />
      </Suspense>
    );
  }

  // First-run Studio walkthrough — shown once, right after the welcome stamp.
  // The extra isVerifiedCreator guard closes the demo if creator status
  // resolves late (e.g. slow network) for an already-verified creator.
  if (needsStudioDemo && !isVerifiedCreator) {
    return (
      <Suspense fallback={null}>
        <StudioDemo onComplete={handleStudioDemoComplete} />
      </Suspense>
    );
  }

  // Render current screen with smooth transitions
  const renderScreen = () => {
    switch (currentScreen) {
      case "creatorProfile":
        return (
          <PageTransition key="creatorProfile" direction={transitionDirection}>
            <Suspense fallback={null}>
              <CreatorProfile onBack={handleBack} />
            </Suspense>
          </PageTransition>
        );

      case "profile":
        return (
          <PageTransition key="profile" direction={transitionDirection}>
            <Suspense fallback={null}>
              <ProfileScreen
                onBack={handleBack}
                onGoLive={() => setShowWizard(true)}
                onSchedule={() => setShowScheduleModal(true)}
                refreshScheduleKey={refreshScheduleKey}
              />
            </Suspense>
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
              }}
              onOpenStudio={() => {
                setMode("creator");
                navigateToScreen("profile");
              }}
              onOpenSearch={() => setShowSearch(true)}
              onLogout={handleLogout}
              onGoHome={() => {
                setTransitionDirection("backward");
                goHome();
                navigate({ pathname: "/", search: "" }, { replace: false });
              }}
            />
          </PageTransition>
        );
    }
  };

  // Premium easing curve for app scale effect
  const isModalOpen = showWizard || showScheduleModal || showLiveSession;

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title="Exhiby — Live Studio Access for Artists & Collectors"
        description="Enter live creative studios. Watch artists work, learn in real time, and join curated ticketed sessions on Exhiby."
        path="/"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Exhiby",
          url: "https://joinexhiby.com",
        }}
      />
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
        <AnimatePresence mode="wait">
          {renderScreen()}
        </AnimatePresence>
      </motion.div>

      {/* Fixed Bottom Navigation - Always visible on mobile/tablet */}
      <BottomNavigation
        mode={mode}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onOpenSearch={() => setShowSearch(true)}
        onOpenCategories={() => setShowCategories(true)}
        onViewProfile={() => {
          navigateToScreen("profile");
        }}
        onOpenStudio={() => {
          setMode("creator");
          navigateToScreen("profile");
        }}
        onGoLive={() => setShowWizard(true)}
        onLogout={handleLogout}
      />

      {/* PWA Install Banner — iOS instructions / Android one-tap install */}
      <Suspense fallback={null}>
        <InstallBanner />
      </Suspense>

      {/* Cinematic Logout Overlay */}
      <Suspense fallback={null}>
        <LogoutOverlay
          isActive={showLogoutOverlay}
          onComplete={handleLogoutComplete}
        />
      </Suspense>

      {/* Search Overlay */}
      <Suspense fallback={null}>
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
          }}
        />
      </Suspense>

      {/* Categories Overlay */}
      <Suspense fallback={null}>
        <CategoriesOverlay
          isOpen={showCategories}
          onClose={() => setShowCategories(false)}
          onSelectCategory={(tag) => {
            setShowCategories(false);
            toast.info(`Filtering by ${tag}`);
          }}
        />
      </Suspense>

      <Suspense fallback={null}>
        <AnimatePresence>
          {showWizard && (
            <GoLiveWizard
              onClose={() => setShowWizard(false)}
              onGoLive={handleGoLive}
            />
          )}
        </AnimatePresence>
      </Suspense>

      <Suspense fallback={null}>
        <AnimatePresence>
          {showScheduleModal && (
            <ScheduleEventModal
              isOpen={showScheduleModal}
              onClose={() => setShowScheduleModal(false)}
              onEventCreated={() => {
                setRefreshScheduleKey(prev => prev + 1);
              }}
            />
          )}
        </AnimatePresence>
      </Suspense>

      <Suspense fallback={null}>
        <AnimatePresence>
          {showLiveSession && eventData && (
            <LiveSession eventData={eventData} onClose={handleCloseLiveSession} />
          )}
        </AnimatePresence>
      </Suspense>
    </div>
  );
}

const Index = () => {
  return <IndexContent />;
};

export default Index;
