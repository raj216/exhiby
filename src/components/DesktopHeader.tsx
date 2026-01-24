import { useState, useEffect } from "react";
import { Bell, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/contexts/AuthContext";
import { useUserMode } from "@/contexts/UserModeContext";
import { useNotifications } from "@/hooks/useNotifications";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CreatorActivationModal } from "./CreatorActivationModal";
import { WelcomeBanner } from "./WelcomeBanner";
import { ConfettiEffect } from "./ConfettiEffect";
import { NotificationsDrawer } from "./NotificationsDrawer";
import { ProfileDrawer } from "./ProfileDrawer";

interface DesktopHeaderProps {
  onOpenSearch?: () => void;
  onViewProfile?: () => void;
  onGoLive?: () => void;
  onGoHome?: () => void;
  hideLogo?: boolean;
  onOpenStudio?: () => void;
  onLogout?: () => void;
}

export function DesktopHeader({
  onOpenSearch,
  onViewProfile,
  onGoLive,
  onGoHome,
  hideLogo = false,
  onOpenStudio,
  onLogout,
}: DesktopHeaderProps) {
  const { profile } = useProfile();
  const { user } = useAuth();
  const { isVerifiedCreator } = useUserMode();
  const { unreadCount } = useNotifications();
  const [showActivationModal, setShowActivationModal] = useState(false);
  const [showWelcomeBanner, setShowWelcomeBanner] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileDrawer, setShowProfileDrawer] = useState(false);
  const { mode } = useUserMode();

  // Check for welcome banner on mount
  useEffect(() => {
    const shouldShowWelcome = localStorage.getItem("showCreatorWelcome");
    if (shouldShowWelcome === "true") {
      setShowWelcomeBanner(true);
      setShowConfetti(true);
      localStorage.removeItem("showCreatorWelcome");
    }
  }, []);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleActivationSuccess = () => {
    setShowActivationModal(false);
    // Set flag to show welcome banner after page refresh
    localStorage.setItem("showCreatorWelcome", "true");
    window.location.reload();
  };

  return (
    <>
      <header className="sticky top-0 z-40 flex items-center justify-between px-6 py-3 bg-carbon/95 backdrop-blur-xl border-b border-border/20">
        {/* Left: Logo (optional) - Clickable to go home */}
        {!hideLogo && (
          <button onClick={onGoHome} className="flex items-center">
            <span className="font-display text-xl font-bold text-primary">
              Exhiby
            </span>
          </button>
        )}

        {/* Center: Search */}
        <div className="flex-1 max-w-md mx-auto px-4">
          <button
            onClick={onOpenSearch}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-full bg-obsidian border border-border/30 hover:border-border/50 transition-colors duration-200 group"
          >
            <Search className="w-4 h-4 text-muted-foreground group-hover:text-foreground/70 transition-colors" />
            <span className="text-sm text-muted-foreground group-hover:text-foreground/70 transition-colors">
              Explore studios, artists, and process...
            </span>
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-3">
          {/* Open Studio Button - only for creators */}
          {isVerifiedCreator && (
            <button
              onClick={onGoLive}
              className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors duration-200"
            >
              Open Studio
            </button>
          )}

          {/* Notifications Bell */}
          <button
            onClick={() => setShowNotifications(true)}
            className="relative p-2 rounded-full bg-obsidian border border-border/30 hover:bg-muted/50 transition-colors duration-200"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5 text-muted-foreground" />
            <AnimatePresence>
              {unreadCount > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-crimson text-[10px] font-bold text-white"
                >
                  {unreadCount > 99 ? "99+" : unreadCount}
                </motion.span>
              )}
            </AnimatePresence>
          </button>

          {/* Profile Button - Opens Drawer */}
          <button 
            onClick={() => setShowProfileDrawer(true)}
            className="flex items-center gap-2 p-1 rounded-full hover:bg-muted/30 transition-colors duration-200"
          >
            <Avatar className="h-9 w-9 border border-border/30">
              <AvatarImage src={profile?.avatarUrl || ""} />
              <AvatarFallback className="bg-obsidian text-foreground text-sm">
                {profile?.name ? getInitials(profile.name) : "?"}
              </AvatarFallback>
            </Avatar>
          </button>
        </div>
      </header>

      {/* Profile Drawer - slides in from right */}
      <ProfileDrawer
        isOpen={showProfileDrawer}
        onClose={() => setShowProfileDrawer(false)}
        profile={profile ? { avatarUrl: profile.avatarUrl, name: profile.name, handle: profile.handle } : null}
        mode={mode}
        isVerifiedCreator={isVerifiedCreator}
        onViewProfile={() => {
          setShowProfileDrawer(false);
          onViewProfile?.();
        }}
        onOpenStudio={() => {
          setShowProfileDrawer(false);
          if (isVerifiedCreator) {
            onOpenStudio?.();
          } else {
            setShowActivationModal(true);
          }
        }}
        onLogout={() => {
          setShowProfileDrawer(false);
          onLogout?.();
        }}
      />

      {/* Notifications Drawer */}
      <NotificationsDrawer
        open={showNotifications}
        onClose={() => setShowNotifications(false)}
      />

      {/* Creator Activation Modal */}
      <CreatorActivationModal
        isOpen={showActivationModal}
        onClose={() => setShowActivationModal(false)}
        onSuccess={handleActivationSuccess}
      />

      {/* Welcome Banner */}
      <WelcomeBanner
        isVisible={showWelcomeBanner}
        onComplete={() => setShowWelcomeBanner(false)}
      />

      {/* Confetti Effect */}
      <ConfettiEffect
        isActive={showConfetti}
        onComplete={() => setShowConfetti(false)}
      />
    </>
  );
}
