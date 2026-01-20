import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNotifications } from "@/hooks/useNotifications";
import { NotificationsDrawer } from "./NotificationsDrawer";

interface MobileHeaderProps {
  className?: string;
  onOpenSearch?: () => void;
  onGoHome?: () => void;
}

export function MobileHeader({
  className = "",
  onOpenSearch,
  onGoHome,
}: MobileHeaderProps) {
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const { unreadCount } = useNotifications();

  return (
    <>
      <header
        className={`sticky top-0 z-30 flex items-center gap-3 px-4 py-3 bg-carbon/95 backdrop-blur-xl border-b border-border/20 lg:hidden ${className}`}
      >
        {/* Logo - Clickable to go home */}
        <button 
          onClick={() => {
            if (onGoHome) {
              onGoHome();
            } else {
              navigate("/");
            }
          }}
          className="shrink-0 whitespace-nowrap"
        >
          <span className="font-display text-xl font-bold text-primary">
            Exhiby
          </span>
        </button>

        {/* Search */}
        <div className="flex-1 min-w-0">
          <button
            onClick={onOpenSearch}
            className="w-full min-w-0 flex items-center gap-3 px-4 py-2.5 rounded-full bg-obsidian border border-border/30 hover:border-border/50 transition-colors duration-200 group"
            aria-label="Search"
          >
            <Search className="w-4 h-4 shrink-0 text-muted-foreground group-hover:text-foreground/70 transition-colors" />
            <span className="min-w-0 truncate text-sm text-muted-foreground group-hover:text-foreground/70 transition-colors">
              Explore studios, artists, and process...
            </span>
          </button>
        </div>

        {/* Notification Bell */}
        <button
          onClick={() => setShowNotifications(true)}
          className="relative shrink-0 p-2 rounded-full bg-obsidian border border-border/30 hover:bg-muted/50 transition-colors duration-200"
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
      </header>

      {/* Notifications Drawer */}
      <NotificationsDrawer
        open={showNotifications}
        onClose={() => setShowNotifications(false)}
      />
    </>
  );
}
