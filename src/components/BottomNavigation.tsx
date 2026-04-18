import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Home, Search, User, Compass, Video } from "lucide-react";
import { triggerClickHaptic } from "@/lib/haptics";
import { useUserMode } from "@/contexts/UserModeContext";
import { useProfile } from "@/hooks/useProfile";
import { CreatorActivationModal } from "./CreatorActivationModal";
import { WelcomeBanner } from "./WelcomeBanner";
import { ConfettiEffect } from "./ConfettiEffect";
import { ProfileDrawer } from "./ProfileDrawer";
type AudienceTab = "home" | "search" | "passport" | "profile";
type CreatorTab = "home" | "search" | "profile";

interface BottomNavigationProps {
  mode: "audience" | "creator";
  activeTab: string;
  onTabChange: (tab: string) => void;
  onOpenSearch?: () => void;
  onOpenCategories?: () => void;
  onViewProfile?: () => void;
  onOpenStudio?: () => void;
  onGoLive?: () => void;
  onLogout?: () => void;
}

const audienceTabs: { id: AudienceTab; label: string; icon: typeof Home }[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "search", label: "Categories", icon: Search },
  { id: "passport", label: "Passport", icon: Compass },
  { id: "profile", label: "Profile", icon: User },
];

// Creator tabs: Home, Search on left side | FAB center | Profile on right side
const creatorTabsLeft: { id: CreatorTab; label: string; icon: typeof Home }[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "search", label: "Categories", icon: Search },
];

const creatorTabsRight: { id: CreatorTab; label: string; icon: typeof User }[] = [
  { id: "profile", label: "Profile", icon: User },
];

export function BottomNavigation({ 
  mode, 
  activeTab, 
  onTabChange, 
  onOpenSearch,
  onOpenCategories,
  onViewProfile,
  onOpenStudio,
  onGoLive,
  onLogout 
}: BottomNavigationProps) {
  const { isVerifiedCreator, setMode } = useUserMode();
  const { profile } = useProfile();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showActivationModal, setShowActivationModal] = useState(false);
  const [showWelcomeBanner, setShowWelcomeBanner] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  const location = useLocation();
  useEffect(() => {
    setShowProfileMenu(false);
  }, [location.key]);

  const accentColor = mode === "creator" ? "text-electric" : "text-foreground";

  // Get initials from user's name
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const displayName = profile?.name || "Guest";
  const initials = getInitials(displayName);

  const handleTabClick = (tabId: string) => {
    triggerClickHaptic();
    
    if (tabId === "search") {
      // Open categories overlay (bottom nav "Categories" tab)
      onOpenCategories?.();
      return;
    }
    
    if (tabId === "profile") {
      // Toggle profile menu
      setShowProfileMenu(!showProfileMenu);
      return;
    }
    
    // Close menu if clicking other tabs
    setShowProfileMenu(false);
    onTabChange(tabId);
  };

  const handleViewProfile = () => {
    setShowProfileMenu(false);
    onViewProfile?.();
  };

  const handleOpenStudio = () => {
    setShowProfileMenu(false);
    if (isVerifiedCreator) {
      // Set mode to creator before navigating to studio
      setMode("creator");
      onOpenStudio?.();
    } else {
      setShowActivationModal(true);
    }
  };

  const handleLogout = () => {
    setShowProfileMenu(false);
    onLogout?.();
  };

  const handleActivationSuccess = () => {
    setShowConfetti(true);
    setTimeout(() => {
      setShowWelcomeBanner(true);
    }, 300);
  };

  const handleBannerComplete = () => {
    setShowWelcomeBanner(false);
  };

  return (
    <>
      {/* Profile Drawer - Premium Slide-Over */}
      <ProfileDrawer
        isOpen={showProfileMenu}
        onClose={() => setShowProfileMenu(false)}
        profile={profile}
        mode={mode}
        isVerifiedCreator={isVerifiedCreator}
        onViewProfile={handleViewProfile}
        onOpenStudio={handleOpenStudio}
        onLogout={handleLogout}
      />

      <motion.div
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        className="fixed bottom-0 left-0 right-0 z-40 lg:hidden"
      >

        {/* Bottom Navigation Bar */}
        <div className="bg-carbon/95 backdrop-blur-xl border-t border-border/30 pb-6 pt-2 max-w-lg mx-auto">
          {/* Unified 4-column grid for both modes */}
          <div className="grid grid-cols-4 items-end">
            {mode === "audience" ? (
              // Audience Mode: Home, Search, Passport, Profile
              <>
                {audienceTabs.map((tab) => {
                  const isActive = activeTab === tab.id || (tab.id === "profile" && showProfileMenu);
                  const isProfileTab = tab.id === "profile";
                  
                  return (
                    <button
                      key={tab.id}
                      onClick={() => handleTabClick(tab.id)}
                      className="flex flex-col items-center justify-center gap-1 py-2 relative"
                    >
                      <motion.div
                        animate={{
                          scale: isActive ? 1.1 : 1,
                        }}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      >
                        {isProfileTab ? (
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-electric to-crimson p-0.5">
                            <div className="w-full h-full rounded-full bg-obsidian flex items-center justify-center overflow-hidden">
                              {profile?.avatarUrl ? (
                                <img 
                                  src={profile.avatarUrl} 
                                  alt={displayName} 
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="text-foreground font-bold text-[10px]">{initials}</span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <tab.icon
                            className={`w-5 h-5 transition-colors ${
                              isActive ? accentColor : "text-muted-foreground"
                            }`}
                          />
                        )}
                      </motion.div>
                      <span
                        className={`text-[10px] font-medium transition-colors ${
                          isActive ? accentColor : "text-muted-foreground"
                        }`}
                      >
                        {tab.label}
                      </span>
                      {isActive && (
                        <motion.div
                          layoutId="navIndicator"
                          className="absolute -top-1 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-foreground"
                        />
                      )}
                    </button>
                  );
                })}
              </>
            ) : (
              // Creator Mode: Home, Search, Go Live, Profile
              <>
                {/* Home */}
                <button
                  onClick={() => handleTabClick("home")}
                  className="flex flex-col items-center justify-center gap-1 py-2 relative"
                >
                  <motion.div
                    animate={{ scale: activeTab === "home" ? 1.1 : 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  >
                    <Home
                      className={`w-5 h-5 transition-colors ${
                        activeTab === "home" ? "text-electric" : "text-muted-foreground"
                      }`}
                    />
                  </motion.div>
                  <span
                    className={`text-[10px] font-medium transition-colors ${
                      activeTab === "home" ? "text-electric" : "text-muted-foreground"
                    }`}
                  >
                    Home
                  </span>
                  {activeTab === "home" && (
                    <motion.div
                      layoutId="creatorNavIndicator"
                      className="absolute -top-1 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-electric"
                    />
                  )}
                </button>

                {/* Search */}
                <button
                  onClick={() => handleTabClick("search")}
                  className="flex flex-col items-center justify-center gap-1 py-2 relative"
                >
                  <motion.div
                    animate={{ scale: activeTab === "search" ? 1.1 : 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  >
                    <Search
                      className={`w-5 h-5 transition-colors ${
                        activeTab === "search" ? "text-electric" : "text-muted-foreground"
                      }`}
                    />
                  </motion.div>
                  <span
                    className={`text-[10px] font-medium transition-colors ${
                      activeTab === "search" ? "text-electric" : "text-muted-foreground"
                    }`}
                  >
                    Categories
                  </span>
                  {activeTab === "search" && (
                    <motion.div
                      layoutId="creatorNavIndicator"
                      className="absolute -top-1 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-electric"
                    />
                  )}
                </button>

                {/* Open Studio - Center FAB (inside grid column) */}
                <div className="flex flex-col items-center justify-end">
                  <motion.button
                    onClick={() => {
                      triggerClickHaptic();
                      onGoLive?.();
                    }}
                    className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg mb-1"
                    style={{
                      background: "linear-gradient(135deg, hsl(7 100% 67%), hsl(345 100% 50%))",
                      boxShadow: "0 4px 20px hsla(7, 100%, 60%, 0.4)",
                    }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Video className="w-5 h-5 text-primary-foreground" />
                  </motion.button>
                </div>

                {/* Profile */}
                <button
                  onClick={() => handleTabClick("profile")}
                  className="flex flex-col items-center justify-center gap-1 py-2 relative"
                >
                  <motion.div
                    animate={{ scale: (activeTab === "profile" || showProfileMenu) ? 1.1 : 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  >
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-electric to-crimson p-0.5">
                      <div className="w-full h-full rounded-full bg-obsidian flex items-center justify-center overflow-hidden">
                        {profile?.avatarUrl ? (
                          <img 
                            src={profile.avatarUrl} 
                            alt={displayName} 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-foreground font-bold text-[10px]">{initials}</span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                  <span
                    className={`text-[10px] font-medium transition-colors ${
                      (activeTab === "profile" || showProfileMenu) ? "text-electric" : "text-muted-foreground"
                    }`}
                  >
                    Profile
                  </span>
                  {(activeTab === "profile" || showProfileMenu) && (
                    <motion.div
                      layoutId="creatorNavIndicator"
                      className="absolute -top-1 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-electric"
                    />
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </motion.div>

      {/* Creator Activation Modal */}
      <CreatorActivationModal
        isOpen={showActivationModal}
        onClose={() => setShowActivationModal(false)}
        onSuccess={handleActivationSuccess}
      />

      {/* Welcome Banner */}
      <WelcomeBanner
        isVisible={showWelcomeBanner}
        onComplete={handleBannerComplete}
      />

      {/* Confetti Effect */}
      <ConfettiEffect
        isActive={showConfetti}
        onComplete={() => setShowConfetti(false)}
      />
    </>
  );
}