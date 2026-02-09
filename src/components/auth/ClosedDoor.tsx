import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";
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
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const handleGoogleSignIn = async () => {
    try {
      setIsGoogleLoading(true);
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin
      });
      if (result.redirected) {
        // User is being redirected to Google, keep loading state
        return;
      }
      if (result.error) {
        toast.error(result.error.message || "Google sign-in failed. Please try again.");
        setIsGoogleLoading(false);
        return;
      }

      // Success - AuthContext will handle the session update
      toast.success("Welcome!");
    } catch (error) {
      toast.error("Something went wrong. Please try again.");
      setIsGoogleLoading(false);
    }
  };
  return <motion.div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6" initial={{
    opacity: 0
  }} animate={{
    opacity: 1
  }} exit={{
    opacity: 0
  }} transition={{
    duration: 0.5
  }}>
      {/* Pulsing Neon Logo */}
      <motion.div className="flex flex-col items-center gap-2 mb-4" initial={{
      scale: 0.9,
      opacity: 0
    }} animate={{
      scale: 1,
      opacity: 1
    }} transition={{
      duration: 0.8,
      ease: "easeOut"
    }}>
        <motion.h1 className="text-6xl md:text-8xl font-bold tracking-tighter font-display" animate={{
        textShadow: ["0 0 20px hsl(7 100% 67% / 0.5), 0 0 40px hsl(7 100% 67% / 0.3), 0 0 60px hsl(7 100% 67% / 0.1)", "0 0 30px hsl(7 100% 67% / 0.7), 0 0 50px hsl(7 100% 67% / 0.5), 0 0 80px hsl(7 100% 67% / 0.2)", "0 0 20px hsl(7 100% 67% / 0.5), 0 0 40px hsl(7 100% 67% / 0.3), 0 0 60px hsl(7 100% 67% / 0.1)"]
      }} transition={{
        duration: 3,
        repeat: Infinity,
        ease: "easeInOut"
      }}>
          <span className="text-gradient-electric">Exhiby</span>
        </motion.h1>
      </motion.div>

      {/* Invitation line */}
      <motion.p className="mt-2 mb-8 max-w-xs text-center text-sm md:text-base font-medium font-sans text-muted-foreground" initial={{
      opacity: 0,
      y: 10
    }} animate={{
      opacity: 1,
      y: 0
    }} transition={{
      delay: 0.85,
      duration: 0.6,
      ease: "easeOut"
    }}>
        Support your favorite artists — live.
      </motion.p>

      {/* Action Buttons */}
      <motion.div className="flex flex-col gap-4 w-full max-w-xs" initial={{
      opacity: 0,
      y: 30
    }} animate={{
      opacity: 1,
      y: 0
    }} transition={{
      delay: 0.95,
      duration: 0.5
    }}>
        {/* Google Sign In - Primary social option */}
        <motion.button className="w-full py-4 px-8 rounded-2xl font-medium flex items-center justify-center gap-3 shadow-lg bg-primary-foreground text-secondary" onClick={handleGoogleSignIn} disabled={isGoogleLoading} whileHover={{
        scale: 1.02
      }} whileTap={{
        scale: 0.98
      }}>
          {isGoogleLoading ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /> : <>
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </>}
        </motion.button>

        {/* Divider */}
        <div className="flex items-center gap-4 my-2">
          <div className="flex-1 h-px bg-border/50" />
          <span className="text-xs text-muted-foreground/60 uppercase tracking-wider">or</span>
          <div className="flex-1 h-px bg-border/50" />
        </div>

        {/* Primary: Create account (Sign Up) */}
        <motion.button className="relative w-full py-4 px-8 rounded-2xl font-semibold text-lg overflow-hidden group" onClick={onGetPass} onHoverStart={onHoverStart} onHoverEnd={onHoverEnd} whileHover={{
        scale: 1.02
      }} whileTap={{
        scale: 0.98
      }}>
          {/* Glow background */}
          <motion.div className="absolute inset-0 rounded-2xl" style={{
          background: "linear-gradient(135deg, hsl(7 100% 67%), hsl(345 100% 50%))",
          boxShadow: "0 0 40px hsl(7 100% 67% / 0.5)"
        }} animate={{
          boxShadow: ["0 0 30px hsl(7 100% 67% / 0.4)", "0 0 50px hsl(7 100% 67% / 0.6)", "0 0 30px hsl(7 100% 67% / 0.4)"]
        }} transition={{
          duration: 2,
          repeat: Infinity
        }} />
          <span className="relative z-10 text-white">Create account</span>
        </motion.button>

        {/* Secondary: Enter Studio (Log In) */}
        <motion.button className="w-full py-4 px-8 rounded-2xl font-medium text-muted-foreground hover:text-foreground transition-colors border border-border/30 hover:border-border/60" onClick={onHavePass} whileHover={{
        scale: 1.02
      }} whileTap={{
        scale: 0.98
      }}>
          Enter Studio
        </motion.button>
      </motion.div>

      {/* Subtle floor reflection */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-primary/5 to-transparent pointer-events-none" />
    </motion.div>;
}