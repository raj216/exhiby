import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ModeSwitchToastProps {
  mode: "creator" | "audience" | null;
  onDone: () => void;
}

export function ModeSwitchToast({ mode, onDone }: ModeSwitchToastProps) {
  useEffect(() => {
    if (!mode) return;
    const t = setTimeout(onDone, 2000);
    return () => clearTimeout(t);
  }, [mode, onDone]);

  return (
    <AnimatePresence>
      {mode && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className="fixed top-16 left-1/2 -translate-x-1/2 z-[100] pointer-events-none"
        >
          <div className="px-5 py-2.5 rounded-full bg-obsidian/90 backdrop-blur-xl border border-border/30 shadow-lg">
            <span className="text-sm font-medium text-foreground/90 whitespace-nowrap">
              Switched to {mode === "creator" ? "Creator" : "Audience"} Mode
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
