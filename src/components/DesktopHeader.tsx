import { useState, useEffect } from "react";
import { Bell, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/contexts/AuthContext";
import { useUserMode } from "@/contexts/UserModeContext";
import { useNotifications } from "@/hooks/useNotifications";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SettingsDrawer } from "./SettingsDrawer";
import { CreatorActivationModal } from "./CreatorActivationModal";
import { WelcomeBanner } from "./WelcomeBanner";
import { ConfettiEffect } from "./ConfettiEffect";
import { NotificationsDrawer } from "./NotificationsDrawer";

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
  const [showSettings, setShowSettings] = useState(false);
  const [showActivationModal, setShowActivationModal] = useState(false);
  const [showWelcomeBanner, setShowWelcomeBanner] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

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

          {/* Profile Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 p-1 rounded-full hover:bg-muted/30 transition-colors duration-200">
                <Avatar className="h-9 w-9 border border-border/30">
                  <AvatarImage src={profile?.avatarUrl || ""} />
                  <AvatarFallback className="bg-obsidian text-foreground text-sm">
                    {profile?.name ? getInitials(profile.name) : "?"}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-56 bg-carbon border-border/30"
            >
              <div className="px-3 py-2 border-b border-border/20">
                <p className="text-sm font-medium text-foreground">
                  {profile?.name || "User"}
                </p>
                <p className="text-xs text-muted-foreground">
                  @{profile?.handle || "handle"}
                </p>
              </div>

              <DropdownMenuItem
                onClick={onViewProfile}
                className="cursor-pointer"
              >
                View Profile
              </DropdownMenuItem>

              {isVerifiedCreator && (
                <DropdownMenuItem
                  onClick={onOpenStudio}
                  className="cursor-pointer"
                >
                  Studio Dashboard
                </DropdownMenuItem>
              )}

              <DropdownMenuItem
                onClick={() => setShowSettings(true)}
                className="cursor-pointer"
              >
                Settings
              </DropdownMenuItem>

              <DropdownMenuSeparator className="bg-border/20" />

              {!isVerifiedCreator && (
                <DropdownMenuItem
                  onClick={() => setShowActivationModal(true)}
                  className="cursor-pointer text-primary"
                >
                  Become a Creator
                </DropdownMenuItem>
              )}

              <DropdownMenuItem
                onClick={onLogout}
                className="cursor-pointer text-destructive"
              >
                Log Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Notifications Drawer */}
      <NotificationsDrawer
        open={showNotifications}
        onClose={() => setShowNotifications(false)}
      />

      {/* Settings Drawer */}
      <SettingsDrawer
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onOpenStudio={onOpenStudio}
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
