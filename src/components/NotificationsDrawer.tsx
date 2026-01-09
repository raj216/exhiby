import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Bell, BellOff, Check } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useNotifications, Notification } from "@/hooks/useNotifications";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";

interface NotificationsDrawerProps {
  open: boolean;
  onClose: () => void;
}

function getNotificationIcon(type: string) {
  switch (type) {
    case "live":
      return "🔴";
    case "scheduled":
      return "📅";
    case "reminder":
      return "⏰";
    case "ticket":
      return "🎟️";
    case "follow":
      return "👤";
    default:
      return "🔔";
  }
}

function NotificationItem({
  notification,
  onTap,
}: {
  notification: Notification;
  onTap: () => void;
}) {
  const timeAgo = formatDistanceToNow(new Date(notification.created_at), {
    addSuffix: false,
  });

  return (
    <motion.button
      onClick={onTap}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`w-full flex items-start gap-3 p-4 text-left rounded-xl transition-colors ${
        notification.is_read
          ? "bg-transparent hover:bg-muted/20"
          : "bg-muted/10 hover:bg-muted/20"
      }`}
    >
      {/* Icon */}
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-obsidian border border-border/30 flex items-center justify-center text-lg">
        {getNotificationIcon(notification.type)}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p
            className={`text-sm leading-snug ${
              notification.is_read
                ? "text-muted-foreground"
                : "text-foreground font-medium"
            }`}
          >
            {notification.title}
          </p>
          {!notification.is_read && (
            <span className="flex-shrink-0 w-2 h-2 rounded-full bg-crimson mt-1.5" />
          )}
        </div>
        {notification.message && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
            {notification.message}
          </p>
        )}
        <p className="text-[11px] text-muted-foreground/60 mt-1">{timeAgo} ago</p>
      </div>
    </motion.button>
  );
}

export function NotificationsDrawer({ open, onClose }: NotificationsDrawerProps) {
  const navigate = useNavigate();
  const { notifications, loading, unreadCount, markAsRead, markAllAsRead } =
    useNotifications();

  const handleNotificationTap = async (notification: Notification) => {
    // Mark as read
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }

    // Navigate if link exists
    if (notification.link) {
      onClose();
      navigate(notification.link);
    }
  };

  const handleMarkAllRead = () => {
    markAllAsRead();
  };

  return (
    <Drawer open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DrawerContent className="bg-carbon border-t border-border/30 max-h-[85vh]">
        <DrawerHeader className="border-b border-border/20 pb-3">
          <div className="flex items-center justify-between">
            <DrawerTitle className="font-display text-lg text-foreground flex items-center gap-2">
              <Bell className="w-5 h-5 text-muted-foreground" />
              Notifications
              {unreadCount > 0 && (
                <span className="ml-1 px-2 py-0.5 rounded-full bg-crimson/20 text-crimson text-xs font-medium">
                  {unreadCount} new
                </span>
              )}
            </DrawerTitle>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                  Mark all read
                </button>
              )}
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-muted/20 transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
          </div>
        </DrawerHeader>

        <ScrollArea className="flex-1 max-h-[calc(85vh-80px)]">
          <div className="p-2">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-electric/30 border-t-electric rounded-full animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-muted/10 border border-border/20 flex items-center justify-center mb-4">
                  <BellOff className="w-8 h-8 text-muted-foreground/60" />
                </div>
                <p className="text-muted-foreground text-sm">No notifications yet</p>
                <p className="text-muted-foreground/60 text-xs mt-1">
                  We'll notify you when something happens
                </p>
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                <div className="space-y-1">
                  {notifications.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onTap={() => handleNotificationTap(notification)}
                    />
                  ))}
                </div>
              </AnimatePresence>
            )}
          </div>
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  );
}
