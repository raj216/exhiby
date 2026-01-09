import { useState } from "react";
import { Bell } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNotifications } from "@/hooks/useNotifications";
import { NotificationsDrawer } from "./NotificationsDrawer";

interface MobileHeaderProps {
  className?: string;
}

export function MobileHeader({ className = "" }: MobileHeaderProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const { unreadCount } = useNotifications();

  return (
    <>
      <header
        className={`sticky top-0 z-30 flex items-center justify-end px-4 py-3 bg-carbon/95 backdrop-blur-xl border-b border-border/20 lg:hidden ${className}`}
      >
        {/* Notification Bell */}
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
      </header>

      {/* Notifications Drawer */}
      <NotificationsDrawer
        open={showNotifications}
        onClose={() => setShowNotifications(false)}
      />
    </>
  );
}
