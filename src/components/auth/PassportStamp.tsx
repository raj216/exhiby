import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface PassportStampProps {
  userName: string;
  onComplete: () => void;
}

export function PassportStamp({ userName, onComplete }: PassportStampProps) {
  const [showStamp, setShowStamp] = useState(false);
  const [dissolving, setDissolving] = useState(false);

  useEffect(() => {
    // Show passport first, then stamp
    const stampTimer = setTimeout(() => setShowStamp(true), 600);
    
    // Start dissolving after stamp animation
    const dissolveTimer = setTimeout(() => setDissolving(true), 2200);
    
    // Complete and transition to home
    const completeTimer = setTimeout(() => onComplete(), 3000);

    return () => {
      clearTimeout(stampTimer);
      clearTimeout(dissolveTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  const currentYear = new Date().getFullYear();

  return (
    <motion.div
      className="fixed inset-0 z-30 flex items-center justify-center bg-background"
      initial={{ opacity: 0 }}
      animate={{ opacity: dissolving ? 0 : 1 }}
      transition={{ duration: 0.8 }}
    >
      {/* Passport Card */}
      <motion.div
        className="relative w-80 md:w-96 aspect-[3/4] rounded-2xl overflow-hidden"
        initial={{ scale: 0.8, opacity: 0, rotateY: -20 }}
        animate={{ 
          scale: dissolving ? 1.1 : 1, 
          opacity: dissolving ? 0 : 1, 
          rotateY: 0 
        }}
        transition={{ 
          type: "spring", 
          damping: 20, 
          stiffness: 200,
          opacity: { duration: dissolving ? 0.6 : 0.4 }
        }}
      >
        {/* Card background with subtle texture */}
        <div className="absolute inset-0 bg-card border border-border/50">
          {/* Subtle noise texture */}
          <div 
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.4'/%3E%3C/svg%3E")`,
            }}
          />
        </div>

        {/* Card content */}
        <div className="relative z-10 h-full flex flex-col items-center justify-center p-8">
          {/* Logo at top */}
          <motion.div
            className="mb-8"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h3 className="font-cinzel text-3xl font-bold text-gradient-electric tracking-tight">
              EXHIBY
            </h3>
            <p className="font-sans text-xs text-muted-foreground tracking-[0.2em] text-center mt-1">
              STUDIO PASS
            </p>
          </motion.div>

          {/* Stamp area */}
          <div className="relative w-48 h-48 flex items-center justify-center">
            <AnimatePresence>
              {showStamp && (
                <motion.div
                  className="absolute inset-0 flex items-center justify-center"
                  initial={{ scale: 3, opacity: 0, rotate: -15 }}
                  animate={{ scale: 1, opacity: 1, rotate: 0 }}
                  transition={{ 
                    type: "spring", 
                    damping: 12, 
                    stiffness: 300,
                    duration: 0.4
                  }}
                >
                  {/* Stamp container */}
                  <motion.div
                    className="relative p-6 rounded-xl border-4 border-primary"
                    animate={{ 
                      x: [0, -2, 2, -1, 1, 0],
                      y: [0, -2, 2, -1, 1, 0],
                    }}
                    transition={{ duration: 0.3, delay: 0.1 }}
                    style={{
                      boxShadow: "0 0 30px hsl(7 100% 67% / 0.4)",
                    }}
                  >
                    {/* Inner stamp content */}
                    <div className="text-center">
                      <motion.p 
                        className="text-xs text-primary uppercase tracking-[0.15em] mb-1"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                      >
                        Welcome
                      </motion.p>
                      <motion.h4 
                        className="font-display text-xl font-bold text-foreground mb-2 max-w-32 truncate tracking-tight"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.25 }}
                      >
                        {userName || "Guest"}
                      </motion.h4>
                      <motion.div 
                        className="w-full h-px bg-primary/50 mb-2"
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ delay: 0.3, duration: 0.3 }}
                      />
                      <motion.p 
                        className="text-xs text-muted-foreground"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.35 }}
                      >
                        Member Since {currentYear}
                      </motion.p>
                    </div>

                    {/* Corner decorations */}
                    <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-primary" />
                    <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-primary" />
                    <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-primary" />
                    <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-primary" />
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Placeholder before stamp */}
            {!showStamp && (
              <motion.div
                className="w-32 h-32 rounded-xl border-2 border-dashed border-border flex items-center justify-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
              >
                <p className="text-xs text-muted-foreground">STAMP</p>
              </motion.div>
            )}
          </div>

          {/* Bottom text */}
          <motion.p
            className="mt-auto text-xs text-muted-foreground tracking-wider"
            initial={{ opacity: 0 }}
            animate={{ opacity: showStamp ? 1 : 0.3 }}
            transition={{ delay: 0.5 }}
          >
            {showStamp ? "Access Granted" : "Validating..."}
          </motion.p>
        </div>
      </motion.div>
    </motion.div>
  );
}
