import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X } from "lucide-react";
import type { UnreadMessageInfo } from "@/hooks/useLiveChat";

interface ChatNotificationToastProps {
  message: UnreadMessageInfo | null;
  isChatOpen: boolean;
  onView: () => void;
  onDismiss: () => void;
}

export function ChatNotificationToast({
  message,
  isChatOpen,
  onView,
  onDismiss,
}: ChatNotificationToastProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (message && !isChatOpen) {
      setIsVisible(true);
      
      // Auto-dismiss after 2.5 seconds
      const timer = setTimeout(() => {
        setIsVisible(false);
        onDismiss();
      }, 2500);

      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [message, isChatOpen, onDismiss]);

  const handleView = () => {
    setIsVisible(false);
    onView();
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsVisible(false);
    onDismiss();
  };

  // Truncate message preview
  const previewText = message?.message
    ? message.message.length > 35
      ? message.message.slice(0, 35) + "…"
      : message.message
    : "";

  return (
    <AnimatePresence>
      {isVisible && message && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
          className="fixed top-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-xs z-50"
          style={{ 
            paddingTop: "max(0px, env(safe-area-inset-top))",
          }}
        >
          <div
            onClick={handleView}
            className="flex items-start gap-3 p-3 rounded-xl bg-black/60 backdrop-blur-xl border border-white/10 shadow-2xl cursor-pointer hover:bg-black/70 transition-colors"
          >
            {/* Icon */}
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
              <MessageCircle className="w-4 h-4 text-primary" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                New message from{" "}
                <span className="text-electric">
                  {message.display_name || "Viewer"}
                </span>
              </p>
              {previewText && (
                <p className="text-xs text-white/50 mt-0.5 truncate">
                  {previewText}
                </p>
              )}
            </div>

            {/* View action */}
            <button
              onClick={handleView}
              className="flex-shrink-0 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-primary hover:text-primary/80 transition-colors"
            >
              View
            </button>

            {/* Dismiss button */}
            <button
              onClick={handleDismiss}
              className="flex-shrink-0 p-1 rounded-full text-white/40 hover:text-white/60 hover:bg-white/10 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
