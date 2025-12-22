import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface LogoutOverlayProps {
  isActive: boolean;
  onComplete: () => void;
}

export function LogoutOverlay({ isActive, onComplete }: LogoutOverlayProps) {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [phase, setPhase] = useState<"fade" | "hold" | "reveal" | "done">("fade");

  useEffect(() => {
    if (!isActive) {
      setPhase("fade");
      return;
    }

    // Phase 1: Fade to black (500ms)
    const fadeTimer = setTimeout(() => {
      setPhase("hold");
    }, 500);

    // Phase 2: Hold black (150ms)
    const holdTimer = setTimeout(async () => {
      // Sign out during the black screen
      await signOut();
      // Clear session stamp flag so it shows again on next login
      sessionStorage.removeItem("exhiby_stamp_shown");
      setPhase("reveal");
    }, 650);

    // Phase 3: Reveal logo and navigate (after 300ms more)
    const revealTimer = setTimeout(() => {
      setPhase("done");
      navigate("/auth", { replace: true });
      onComplete();
    }, 1200);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(holdTimer);
      clearTimeout(revealTimer);
    };
  }, [isActive, signOut, navigate, onComplete]);

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
        >
          {/* Solid black overlay */}
          <motion.div
            className="absolute inset-0 bg-background"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
          />

          {/* Pulsing neon logo - appears after fade */}
          <AnimatePresence>
            {(phase === "reveal" || phase === "done") && (
              <motion.div
                className="relative z-10 flex flex-col items-center gap-4"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              >
                <motion.h1
                  className="text-6xl md:text-8xl font-bold tracking-tighter"
                  style={{ fontFamily: "'Clash Display', sans-serif" }}
                  animate={{
                    textShadow: [
                      "0 0 20px hsl(7 100% 67% / 0.5), 0 0 40px hsl(7 100% 67% / 0.3), 0 0 60px hsl(7 100% 67% / 0.1)",
                      "0 0 30px hsl(7 100% 67% / 0.7), 0 0 50px hsl(7 100% 67% / 0.5), 0 0 80px hsl(7 100% 67% / 0.2)",
                      "0 0 20px hsl(7 100% 67% / 0.5), 0 0 40px hsl(7 100% 67% / 0.3), 0 0 60px hsl(7 100% 67% / 0.1)",
                    ],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                >
                  <span className="text-gradient-electric">EXHIBY</span>
                </motion.h1>
                <motion.p
                  className="text-muted-foreground text-sm tracking-[0.3em] uppercase"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  The Midnight Studio
                </motion.p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
