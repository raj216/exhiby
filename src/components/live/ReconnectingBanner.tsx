import { motion, AnimatePresence } from "framer-motion";
import { Wifi, WifiOff } from "lucide-react";

interface ReconnectingBannerProps {
  isVisible: boolean;
  isReconnected?: boolean;
}

export function ReconnectingBanner({ isVisible, isReconnected }: ReconnectingBannerProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -50, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="absolute top-0 left-0 right-0 z-40 flex justify-center pt-safe-top"
        >
          <div 
            className={`mx-4 mt-2 px-4 py-2 rounded-full backdrop-blur-md flex items-center gap-2 text-sm font-medium shadow-lg ${
              isReconnected 
                ? "bg-green-500/20 text-green-400 border border-green-500/30"
                : "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
            }`}
          >
            {isReconnected ? (
              <>
                <Wifi className="w-4 h-4" />
                <span>Reconnected</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 animate-pulse" />
                <span>Reconnecting…</span>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
