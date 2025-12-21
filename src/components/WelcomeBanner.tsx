import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";

interface WelcomeBannerProps {
  isVisible: boolean;
  onComplete: () => void;
}

export function WelcomeBanner({ isVisible, onComplete }: WelcomeBannerProps) {
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    if (!isVisible) {
      setCountdown(3);
      return;
    }

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setTimeout(onComplete, 500);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isVisible, onComplete]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 25 }}
          className="fixed top-0 left-0 right-0 z-[100] px-4 pt-4"
        >
          <div className="max-w-2xl mx-auto">
            <div className="relative rounded-2xl overflow-hidden">
              {/* Animated gradient background */}
              <motion.div
                animate={{
                  backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
                }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0"
                style={{
                  background: "linear-gradient(90deg, hsl(345 100% 50%), hsl(7 100% 67%), hsl(345 100% 50%))",
                  backgroundSize: "200% 100%",
                }}
              />
              
              {/* Content */}
              <div className="relative px-6 py-4 flex items-center justify-center gap-3">
                <motion.div
                  animate={{ rotate: [0, 15, -15, 0] }}
                  transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 1 }}
                >
                  <Sparkles className="w-5 h-5 text-white" />
                </motion.div>
                
                <div className="text-center">
                  <p className="text-white font-semibold text-sm sm:text-base">
                    Welcome to the Studio. You are live in{" "}
                    <motion.span
                      key={countdown}
                      initial={{ scale: 1.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="inline-block font-bold"
                    >
                      {countdown === 0 ? "🚀" : `${countdown}...`}
                    </motion.span>
                  </p>
                </div>

                <motion.div
                  animate={{ rotate: [0, -15, 15, 0] }}
                  transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 1 }}
                >
                  <Sparkles className="w-5 h-5 text-white" />
                </motion.div>
              </div>

              {/* Sparkle particles */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {[...Array(8)].map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ 
                      x: Math.random() * 100 + "%", 
                      y: "100%",
                      opacity: 0 
                    }}
                    animate={{ 
                      y: "-100%",
                      opacity: [0, 1, 0]
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      delay: i * 0.2,
                      ease: "easeOut"
                    }}
                    className="absolute w-1 h-1 bg-white rounded-full"
                  />
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
