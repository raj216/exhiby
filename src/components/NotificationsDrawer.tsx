import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { useNotifications, Notification } from "@/hooks/useNotifications";
import { useIsMobile } from "@/hooks/use-mobile";
import { useScrollLock } from "@/hooks/useScrollLock";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";

interface NotificationsDrawerProps {
  open: boolean;
  onClose: () => void;
}

// Swipe threshold for dismissing notification
const SWIPE_THRESHOLD = 100;

// Notification item component with swipe and dismiss support
function NotificationItem({
  notification,
  onNavigate,
  onDismiss,
  isMobile,
}: {
  notification: Notification;
  onNavigate: (link: string | null, id: string) => void;
  onDismiss: (id: string) => void;
  isMobile: boolean;
}) {
  const [isDismissing, setIsDismissing] = useState(false);
  
  const timeAgo = formatDistanceToNow(new Date(notification.created_at), {
    addSuffix: false,
  });

  // Format time display
  const formatTime = (time: string) => {
    if (time.includes("less than")) return "Just now";
    if (time.includes("minute")) return time.replace(" minutes", "m").replace(" minute", "m");
    if (time.includes("hour")) return time.replace(" hours", "h").replace(" hour", "h");
    if (time.includes("day")) {
      const days = parseInt(time);
      if (days === 1) return "Yesterday";
      return time.replace(" days", "d");
    }
    return time;
  };

  // Format the notification message - handle scheduled time in user's timezone
  const formatMessage = (msg: string | null) => {
    if (!msg) return null;
    
    // Check if message contains a scheduled timestamp
    if (msg.startsWith("scheduled:")) {
      const isoTime = msg.replace("scheduled:", "");
      try {
        const scheduledDate = new Date(isoTime);
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const isToday = scheduledDate.toDateString() === now.toDateString();
        const isTomorrow = scheduledDate.toDateString() === tomorrow.toDateString();
        
        const timeStr = scheduledDate.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });
        
        if (isToday) return `Today at ${timeStr}`;
        if (isTomorrow) return `Tomorrow at ${timeStr}`;
        
        const dateStr = scheduledDate.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        });
        return `${dateStr} at ${timeStr}`;
      } catch {
        return msg;
      }
    }
    
    return msg;
  };

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (Math.abs(info.offset.x) > SWIPE_THRESHOLD) {
      setIsDismissing(true);
      // Wait for exit animation then dismiss
      setTimeout(() => onDismiss(notification.id), 200);
    }
  };

  const handleDismissClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDismissing(true);
    setTimeout(() => onDismiss(notification.id), 200);
  };

  // Mobile: swipeable notification
  if (isMobile) {
    return (
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.5}
        onDragEnd={handleDragEnd}
        animate={isDismissing ? { x: 300, opacity: 0 } : { x: 0, opacity: 1 }}
        exit={{ x: 300, opacity: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="relative"
      >
        <button
          onClick={() => onNavigate(notification.link, notification.id)}
          className="w-full text-left p-4 hover:bg-muted/30 transition-colors duration-200 border-b border-border/10 last:border-b-0 group"
        >
          <div className="flex items-start gap-3">
            {/* Unread indicator */}
            <div className="pt-1.5 w-2 flex-shrink-0">
              {!notification.is_read && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="w-2 h-2 rounded-full bg-crimson"
                />
              )}
            </div>

            <div className="flex-1 min-w-0">
              {/* Title - Creator name + action */}
              <p
                className={`text-sm leading-relaxed ${
                  notification.is_read
                    ? "text-muted-foreground"
                    : "text-foreground font-medium"
                }`}
              >
                {notification.title}
              </p>

              {/* Message if present */}
              {notification.message && (
                <p className="text-xs text-muted-foreground/70 mt-1 line-clamp-2">
                  {formatMessage(notification.message)}
                </p>
              )}

              {/* Timestamp */}
              <p className="text-xs text-muted-foreground/50 mt-1.5">
                {formatTime(timeAgo)} ago
              </p>
            </div>
          </div>
        </button>
      </motion.div>
    );
  }

  // Desktop: hover-reveal dismiss button
  return (
    <button
      onClick={() => onNavigate(notification.link, notification.id)}
      className="w-full text-left p-4 hover:bg-muted/30 transition-colors duration-200 border-b border-border/10 last:border-b-0 group relative"
    >
      <div className="flex items-start gap-3">
        {/* Unread indicator */}
        <div className="pt-1.5 w-2 flex-shrink-0">
          {!notification.is_read && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-2 h-2 rounded-full bg-crimson"
            />
          )}
        </div>

        <div className="flex-1 min-w-0">
          {/* Title - Creator name + action */}
          <p
            className={`text-sm leading-relaxed ${
              notification.is_read
                ? "text-muted-foreground"
                : "text-foreground font-medium"
            }`}
          >
            {notification.title}
          </p>

          {/* Message if present */}
          {notification.message && (
            <p className="text-xs text-muted-foreground/70 mt-1 line-clamp-2">
              {formatMessage(notification.message)}
            </p>
          )}

          {/* Timestamp */}
          <p className="text-xs text-muted-foreground/50 mt-1.5">
            {formatTime(timeAgo)} ago
          </p>
        </div>

        {/* Desktop dismiss button - visible on hover */}
        <button
          onClick={handleDismissClick}
          className="opacity-0 group-hover:opacity-50 hover:!opacity-100 transition-opacity duration-200 p-1.5 rounded-full hover:bg-muted/50 flex-shrink-0"
          aria-label="Dismiss notification"
        >
          <X className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>
    </button>
  );
}

// Empty state component
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-12 h-12 rounded-full bg-muted/30 flex items-center justify-center mb-4">
        <Bell className="w-5 h-5 text-muted-foreground/50" />
      </div>
      <p className="text-foreground font-medium mb-1">Nothing new yet.</p>
      <p className="text-sm text-muted-foreground/60 max-w-[200px]">
        All updates from studios you follow will appear here.
      </p>
    </div>
  );
}

// Shared notification list content
function NotificationListContent({
  notifications,
  loading,
  onNavigate,
  onDismiss,
  onClearAll,
  isMobile,
}: {
  notifications: Notification[];
  loading: boolean;
  onNavigate: (link: string | null, id: string) => void;
  onDismiss: (id: string) => void;
  onClearAll: () => void;
  isMobile: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-5 h-5 border-2 border-muted-foreground/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (notifications.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Clear all bar */}
      <div className="flex items-center justify-end px-4 py-2 border-b border-border/10">
        <button
          onClick={onClearAll}
          className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-full bg-muted/20 hover:bg-muted/40 border border-border/20"
        >
          Clear all
        </button>
      </div>
      {/* Scrollable list */}
      <ScrollArea className="flex-1 h-0 min-h-0">
        <div className="divide-y divide-border/10">
          <AnimatePresence mode="popLayout">
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onNavigate={onNavigate}
                onDismiss={onDismiss}
                isMobile={isMobile}
              />
            ))}
          </AnimatePresence>
        </div>
      </ScrollArea>
    </div>
  );
}

export function NotificationsDrawer({ open, onClose }: NotificationsDrawerProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { notifications, loading, markAsRead, markAllAsRead, refetch } = useNotifications();
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  
  // Lock body scroll when drawer is open
  useScrollLock(open);

  // Filter out dismissed notifications
  const visibleNotifications = notifications.filter(n => !dismissedIds.has(n.id));

  // Refetch notifications when drawer opens to ensure we have the latest
  useEffect(() => {
    if (open) {
      refetch();
      // Reset dismissed IDs when opening
      setDismissedIds(new Set());
    }
  }, [open, refetch]);

  // Mark all as read when drawer opens
  useEffect(() => {
    if (open && notifications.some((n) => !n.is_read)) {
      // Small delay to let the user see the unread state first
      const timer = setTimeout(() => {
        markAllAsRead();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [open, notifications, markAllAsRead]);

  const handleNavigate = (link: string | null, notificationId: string) => {
    markAsRead(notificationId);
    onClose();
    if (link) {
      navigate(link);
    }
  };

  const handleDismiss = async (notificationId: string) => {
    setDismissedIds(prev => new Set([...prev, notificationId]));
    try {
      await supabase.from("notifications").delete().eq("id", notificationId);
    } catch (err) {
      console.error("Error dismissing notification:", err);
      setDismissedIds(prev => {
        const next = new Set(prev);
        next.delete(notificationId);
        return next;
      });
    }
  };

  const handleClearAll = async () => {
    // Optimistically dismiss all visible
    const allIds = new Set(visibleNotifications.map(n => n.id));
    setDismissedIds(prev => new Set([...prev, ...allIds]));
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("notifications").delete().eq("user_id", user.id);
      }
      refetch();
    } catch (err) {
      console.error("Error clearing all notifications:", err);
    }
  };

  // Mobile: Full-screen sheet sliding from left with single close button
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <SheetContent
          side="left"
          className="w-full sm:max-w-full bg-carbon border-r border-border/20 p-0"
          hideCloseButton // Hide default close button on mobile
        >
          <SheetHeader className="px-5 py-4 border-b border-border/10">
            <div className="flex items-center justify-between">
              <SheetTitle className="font-display text-base text-foreground flex items-center gap-2">
                <Bell className="w-4 h-4 text-muted-foreground" />
                Notifications
              </SheetTitle>
              <button
                onClick={onClose}
                className="p-2 -mr-2 rounded-full hover:bg-muted/30 transition-colors"
                aria-label="Close notifications"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
          </SheetHeader>
          <div className="flex-1 h-[calc(100vh-80px)] overflow-hidden">
            <NotificationListContent
              notifications={visibleNotifications}
              loading={loading}
              onNavigate={handleNavigate}
              onDismiss={handleDismiss}
              onClearAll={handleClearAll}
              isMobile={isMobile}
            />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: Right-side sheet with default close button
  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent
        side="right"
        className="w-[380px] sm:max-w-[380px] bg-carbon border-l border-border/20 p-0"
      >
        <SheetHeader className="px-5 py-4 border-b border-border/10">
          <div className="flex items-center justify-between">
            <SheetTitle className="font-display text-base text-foreground flex items-center gap-2">
              <Bell className="w-4 h-4 text-muted-foreground" />
              Notifications
            </SheetTitle>
          </div>
        </SheetHeader>
        <div className="flex-1 h-[calc(100vh-80px)] overflow-hidden">
          <NotificationListContent
            notifications={visibleNotifications}
            loading={loading}
            onNavigate={handleNavigate}
            onDismiss={handleDismiss}
            isMobile={isMobile}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}