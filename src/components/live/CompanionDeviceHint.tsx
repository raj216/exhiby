import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Smartphone } from "lucide-react";

interface CompanionDeviceHintProps {
  /** The current live event id — used to remember per-event dismissal. */
  eventId: string;
  /** Show only when the host is actually broadcasting. */
  isLive: boolean;
}

/**
 * A subtle one-time pill shown on the primary device, suggesting the creator
 * open this stream on a second device to manage chat hands-free. Appears
 * 1.5 s after going live, fades out after 6 s or on tap, and is remembered
 * per-event via localStorage so it never nags on refresh.
 */
export function CompanionDeviceHint({ eventId, isLive }: CompanionDeviceHintProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isLive || !eventId) return;

    const key = `exhiby_companion_hint_shown_${eventId}`;
    if (localStorage.getItem(key) === "1") return;

    // Delay entry so the creator can settle into the camera first.
    const showTimer = setTimeout(() => {
      setVisible(true);
      localStorage.setItem(key, "1");
    }, 1500);

    // Auto-dismiss
    const hideTimer = setTimeout(() => setVisible(false), 1500 + 6000);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [eventId, isLive]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          type="button"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          onClick={() => setVisible(false)}
          aria-label="Dismiss tip"
          className="fixed left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-3.5 py-2 rounded-full bg-black/55 backdrop-blur-xl border border-white/15 shadow-lg pointer-events-auto"
          style={{ top: "calc(env(safe-area-inset-top) + 90px)" }}
        >
          <Smartphone className="w-3.5 h-3.5 text-white/80 flex-shrink-0" />
          <span className="text-xs font-medium text-white/90 leading-none whitespace-nowrap">
            Open on a second device to focus on your art
          </span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
