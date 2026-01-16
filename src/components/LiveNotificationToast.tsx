import { useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Radio } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast as sonnerToast } from "sonner";

interface NotificationPayload {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

// Track shown notification IDs to prevent duplicates
const shownNotifications = new Set<string>();

export function LiveNotificationToast() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const handleNotification = useCallback(
    (notification: NotificationPayload) => {
      // Prevent duplicate pop-ups
      if (shownNotifications.has(notification.id)) {
        return;
      }
      shownNotifications.add(notification.id);

      // Clean up old entries (keep last 100)
      if (shownNotifications.size > 100) {
        const entries = Array.from(shownNotifications);
        entries.slice(0, 50).forEach((id) => shownNotifications.delete(id));
      }

      const isLive = notification.type === "studio_live";
      const isStartingSoon = notification.type === "studio_starting_soon";
      const isScheduled = notification.type === "studio_scheduled";

      // Determine icon and styling based on type
      let icon = "📅";
      if (isLive) icon = "🔴";
      if (isStartingSoon) icon = "⏰";

      // Show sonner toast with custom styling
      sonnerToast.custom(
        (t) => (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={`
              relative flex items-start gap-3 p-4 rounded-2xl shadow-2xl
              backdrop-blur-xl border max-w-sm w-full cursor-pointer
              ${isLive 
                ? "bg-crimson/95 border-crimson/50 text-white" 
                : "bg-obsidian/95 border-border/50 text-foreground"
              }
            `}
            onClick={() => {
              sonnerToast.dismiss(t);
              if (notification.link) {
                navigate(notification.link);
              }
            }}
          >
            {/* Live pulse indicator */}
            {isLive && (
              <div className="absolute top-4 left-4 w-2 h-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-white opacity-75 animate-ping" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
              </div>
            )}

            <div className={`flex-shrink-0 text-xl ${isLive ? "ml-4" : ""}`}>
              {icon}
            </div>

            <div className="flex-1 min-w-0">
              <p className={`font-medium text-sm leading-snug ${isLive ? "text-white" : "text-foreground"}`}>
                {notification.title}
              </p>
              {notification.message && (
                <p className={`text-xs mt-1 truncate ${isLive ? "text-white/80" : "text-muted-foreground"}`}>
                  {notification.message}
                </p>
              )}
              {notification.link && (
                <p className={`text-xs mt-2 font-medium ${isLive ? "text-white/90" : "text-electric"}`}>
                  {isLive ? "Enter the Studio →" : "View →"}
                </p>
              )}
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                sonnerToast.dismiss(t);
              }}
              className={`
                flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center
                transition-colors
                ${isLive 
                  ? "hover:bg-white/20 text-white/80" 
                  : "hover:bg-muted text-muted-foreground"
                }
              `}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        ),
        {
          duration: isLive ? 8000 : 5000, // Live notifications stay longer
          position: "top-center",
        }
      );
    },
    [navigate]
  );

  useEffect(() => {
    if (!user) return;

    // Subscribe to real-time notifications
    channelRef.current = supabase
      .channel("live-notification-toasts")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const notification = payload.new as NotificationPayload;
          handleNotification(notification);
        }
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [user, handleNotification]);

  // This component doesn't render anything - it just listens and shows toasts
  return null;
}
