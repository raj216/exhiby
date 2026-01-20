import { motion, AnimatePresence } from "framer-motion";
import { X, User, LayoutDashboard, CreditCard, Settings, LogOut, Palette } from "lucide-react";
import { useScrollLock } from "@/hooks/useScrollLock";

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
  onSettings: () => void;
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
  onSettings,
  onLogout,
}: ProfileDrawerProps) {
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
            className="fixed top-0 right-0 z-50 h-full w-full sm:w-[400px] flex flex-col overflow-y-auto"
            style={{
              background: "#0A0A0A",
              borderLeft: "1px solid #333",
              paddingBottom: "env(safe-area-inset-bottom)",
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
                  <h2 className="text-lg font-semibold text-white">{displayName}</h2>
                  {profile?.handle && (
                    <p className="text-sm text-muted-foreground">@{profile.handle}</p>
                  )}
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

            {/* Menu Items */}
            <div className="flex-1 py-4">
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

              <button
                onClick={() => handleAction(onSettings)}
                className="w-full flex items-center gap-4 px-6 py-4 text-white hover:bg-muted/20 transition-colors"
              >
                <CreditCard className="w-5 h-5 text-muted-foreground" />
                <span className="text-base font-medium">Wallet & Earnings</span>
              </button>

              <button
                onClick={() => handleAction(onSettings)}
                className="w-full flex items-center gap-4 px-6 py-4 text-white hover:bg-muted/20 transition-colors"
              >
                <Settings className="w-5 h-5 text-muted-foreground" />
                <span className="text-base font-medium">Settings</span>
              </button>
            </div>

            {/* Footer - Log Out */}
            <div className="p-6 border-t border-border/20">
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
