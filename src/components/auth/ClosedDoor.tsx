import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

interface ClosedDoorProps {
  onGetPass: () => void;
  onHavePass: () => void;
  onHoverStart: () => void;
  onHoverEnd: () => void;
}

export function ClosedDoor({ 
  onGetPass, 
  onHavePass, 
  onHoverStart, 
  onHoverEnd 
}: ClosedDoorProps) {
  return (
    <motion.div
      className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Pulsing Neon Logo */}
      <motion.div
        className="flex flex-col items-center gap-4 mb-20"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
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
          transition={{ delay: 0.5 }}
        >
          The Midnight Studio
        </motion.p>
      </motion.div>

      {/* Action Buttons */}
      <motion.div
        className="flex flex-col gap-4 w-full max-w-xs"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7, duration: 0.5 }}
      >
        {/* Primary: Get a Pass (Sign Up) */}
        <motion.button
          className="relative w-full py-4 px-8 rounded-2xl font-semibold text-lg overflow-hidden group"
          onClick={onGetPass}
          onHoverStart={onHoverStart}
          onHoverEnd={onHoverEnd}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {/* Glow background */}
          <motion.div
            className="absolute inset-0 rounded-2xl"
            style={{
              background: "linear-gradient(135deg, hsl(7 100% 67%), hsl(345 100% 50%))",
              boxShadow: "0 0 40px hsl(7 100% 67% / 0.5)",
            }}
            animate={{
              boxShadow: [
                "0 0 30px hsl(7 100% 67% / 0.4)",
                "0 0 50px hsl(7 100% 67% / 0.6)",
                "0 0 30px hsl(7 100% 67% / 0.4)",
              ],
            }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <span className="relative z-10 text-white">Get a Pass</span>
        </motion.button>

        {/* Secondary: I have a Pass (Log In) */}
        <motion.button
          className="w-full py-4 px-8 rounded-2xl font-medium text-muted-foreground hover:text-foreground transition-colors border border-border/30 hover:border-border/60"
          onClick={onHavePass}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          I have a Pass
        </motion.button>
      </motion.div>

      {/* Subtle floor reflection */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-primary/5 to-transparent pointer-events-none" />
    </motion.div>
  );
}
