import { useEffect } from "react";
import { Bell, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { useNotifications, Notification } from "@/hooks/useNotifications";
import { useIsMobile } from "@/hooks/use-mobile";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

interface NotificationsDrawerProps {
  open: boolean;
  onClose: () => void;
}

// Notification item component
function NotificationItem({
  notification,
  onNavigate,
}: {
  notification: Notification;
  onNavigate: (link: string | null, id: string) => void;
}) {
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

  return (
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
}: {
  notifications: Notification[];
  loading: boolean;
  onNavigate: (link: string | null, id: string) => void;
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
    <ScrollArea className="flex-1">
      <div className="divide-y divide-border/10">
        {notifications.map((notification) => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </ScrollArea>
  );
}

export function NotificationsDrawer({ open, onClose }: NotificationsDrawerProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { notifications, loading, markAsRead, markAllAsRead, refetch } = useNotifications();

  // Refetch notifications when drawer opens to ensure we have the latest
  useEffect(() => {
    if (open) {
      refetch();
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

  // Mobile: Full-screen sheet sliding from left
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <SheetContent
          side="left"
          className="w-full sm:max-w-full bg-carbon border-r border-border/20 p-0"
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
              notifications={notifications}
              loading={loading}
              onNavigate={handleNavigate}
            />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: Right-side sheet
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
            notifications={notifications}
            loading={loading}
            onNavigate={handleNavigate}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
