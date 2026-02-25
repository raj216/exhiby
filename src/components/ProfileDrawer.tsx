import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { X, User, LayoutDashboard, CreditCard, Settings, LogOut, Palette } from "lucide-react";
import { useScrollLock } from "@/hooks/useScrollLock";
import featureFlags from "@/lib/featureFlags";

interface ProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  profile: {
    avatarUrl?: string | null;
    name?: string;
    handle?: string | null;
  } | null;
  mode: "audience" | "creator";
  isVerifiedCreator: boolean;
  onViewProfile: () => void;
  onOpenStudio: () => void;
  onLogout: () => void;
}

export function ProfileDrawer({
  isOpen,
  onClose,
  profile,
  mode,
  isVerifiedCreator,
  onViewProfile,
  onOpenStudio,
  onLogout,
}: ProfileDrawerProps) {
  const navigate = useNavigate();
  useScrollLock(isOpen);

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

  const handleAction = (action: () => void) => {
    onClose();
    action();
  };

  const handleSettings = () => {
    console.log("[ProfileDrawer] Settings clicked - navigating first");
    // Navigate FIRST, then close drawer with slight delay to ensure navigation completes
    navigate("/settings");
    // Delay close to prevent race condition
    setTimeout(() => {
      onClose();
    }, 50);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ 
              type: "spring", 
              stiffness: 300, 
              damping: 30,
              mass: 0.8
            }}
            className="fixed top-0 right-0 z-50 h-full w-full sm:w-[400px] flex flex-col"
            style={{
              background: "#0A0A0A",
              borderLeft: "1px solid #333",
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border/20">
              <div className="flex items-center gap-4">
                {/* Large Avatar */}
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-electric to-crimson p-0.5">
                  <div className="w-full h-full rounded-full bg-obsidian flex items-center justify-center overflow-hidden">
                    {profile?.avatarUrl ? (
                      <img 
                        src={profile.avatarUrl} 
                        alt={displayName} 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-foreground font-semibold text-lg">{initials}</span>
                    )}
                  </div>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    {profile?.handle ? `@${profile.handle}` : displayName}
                  </h2>
                  <p className="text-sm text-muted-foreground">{displayName}</p>
                  <p className="text-xs text-muted-foreground capitalize mt-0.5">{mode} Mode</p>
                </div>
              </div>

              {/* Close Button */}
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground hover:text-white hover:bg-muted/30 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Menu Items - scrollable */}
            <div className="flex-1 py-4 overflow-y-auto" style={{ paddingBottom: "80px" }}>
              <button
                onClick={() => handleAction(onViewProfile)}
                className="w-full flex items-center gap-4 px-6 py-4 text-white hover:bg-muted/20 transition-colors"
              >
                <User className="w-5 h-5 text-muted-foreground" />
                <span className="text-base font-medium">View Profile</span>
              </button>

              {isVerifiedCreator ? (
                <button
                  onClick={() => handleAction(onOpenStudio)}
                  className="w-full flex items-center gap-4 px-6 py-4 text-white hover:bg-muted/20 transition-colors"
                >
                  <LayoutDashboard className="w-5 h-5 text-muted-foreground" />
                  <span className="text-base font-medium">Studio Dashboard</span>
                </button>
              ) : (
                <button
                  onClick={() => handleAction(onOpenStudio)}
                  className="w-full flex items-center gap-4 px-6 py-4 text-white bg-gradient-to-r from-crimson/20 to-crimson/10 hover:from-crimson/30 hover:to-crimson/20 transition-colors"
                >
                  <Palette className="w-5 h-5 text-crimson" />
                  <span className="text-base font-medium">Open Your Studio</span>
                </button>
              )}

              {featureFlags.paymentsEnabled ? (
                <button
                  onClick={() => {
                    console.log("[ProfileDrawer] Wallet clicked - navigating first");
                    navigate("/settings");
                    setTimeout(() => onClose(), 50);
                  }}
                  className="w-full flex items-center gap-4 px-6 py-4 text-white hover:bg-muted/20 transition-colors"
                >
                  <CreditCard className="w-5 h-5 text-muted-foreground" />
                  <span className="text-base font-medium">Wallet & Earnings</span>
                </button>
              ) : (
                <div className="w-full flex items-center gap-4 px-6 py-4 text-muted-foreground/60 cursor-not-allowed">
                  <CreditCard className="w-5 h-5" />
                  <span className="text-base font-medium">Wallet & Earnings</span>
                  <span className="ml-auto text-xs bg-muted/30 px-2 py-0.5 rounded">Coming Soon</span>
                </div>
              )}

              <button
                onClick={handleSettings}
                className="w-full flex items-center gap-4 px-6 py-4 text-white hover:bg-muted/20 transition-colors"
              >
                <Settings className="w-5 h-5 text-muted-foreground" />
                <span className="text-base font-medium">Settings</span>
              </button>
            </div>

            {/* Footer - Log Out (sticky at bottom) */}
            <div 
              className="sticky bottom-0 p-6 border-t border-border/20"
              style={{ 
                background: "#0A0A0A",
                paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)"
              }}
            >
              <button
                onClick={() => handleAction(onLogout)}
                className="w-full flex items-center gap-4 px-4 py-3 text-crimson hover:bg-crimson/10 rounded-lg transition-colors"
              >
                <LogOut className="w-5 h-5" />
                <span className="text-base font-medium">Log Out</span>
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
