import { useState } from "react";
import { motion } from "framer-motion";
import { X, Loader2, Eye, EyeOff, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";

interface GlassCardProps {
  mode: "signup" | "login";
  onSuccess: (name: string) => void;
  onClose: () => void;
}

const emailSchema = z.string().email("Please enter a valid email");
const nameSchema = z.string().min(1, "Please enter your name").max(100);
const passwordSchema = z.string().min(6, "Password must be at least 6 characters");

export function GlassCard({ mode, onSuccess, onClose }: GlassCardProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [forgotPasswordSent, setForgotPasswordSent] = useState(false);

  const isSignup = mode === "signup";

  const handleSubmit = async () => {
    try {
      // Validate inputs
      const emailResult = emailSchema.safeParse(email);
      if (!emailResult.success) {
        toast.error(emailResult.error.errors[0].message);
        return;
      }

      const passwordResult = passwordSchema.safeParse(password);
      if (!passwordResult.success) {
        toast.error(passwordResult.error.errors[0].message);
        return;
      }

      if (isSignup) {
        const nameResult = nameSchema.safeParse(name);
        if (!nameResult.success) {
          toast.error(nameResult.error.errors[0].message);
          return;
        }
      }

      setIsLoading(true);

      const redirectUrl = `${window.location.origin}/`;

      if (isSignup) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectUrl,
            data: {
              name: name,
              full_name: name,
            },
          },
        });

        if (error) {
          if (error.message.includes("already registered")) {
            toast.error("This email is already registered. Try signing in instead.");
          } else {
            toast.error(error.message);
          }
          return;
        }

        toast.success("Account created! You can now sign in.");
        onSuccess(name);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            toast.error("Invalid email or password. Please try again.");
          } else {
            toast.error(error.message);
          }
          return;
        }

        toast.success("Welcome back!");
        onSuccess("");
      }
    } catch (error) {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    try {
      const emailResult = emailSchema.safeParse(email);
      if (!emailResult.success) {
        toast.error("Please enter your email address first");
        return;
      }

      setIsLoading(true);
      // Redirect to /auth for password reset flow
      const redirectUrl = `${window.location.origin}/auth`;

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      setForgotPasswordSent(true);
      toast.success("Password reset email sent! Check your inbox.");
    } catch (error) {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-20 flex items-end justify-center p-4 md:items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0 bg-background/60 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />

      {/* Glass Card */}
      <motion.div
        className="relative w-full max-w-md rounded-t-3xl md:rounded-3xl overflow-hidden"
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
      >
        {/* Frosted glass effect */}
        <div className="absolute inset-0 backdrop-blur-2xl bg-card/80 border border-border/30" />
        
        {/* Content */}
        <div className="relative z-10 p-6 md:p-8">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-muted/50 transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>

          {/* Header */}
          <motion.div
            className="text-center mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <h2 className="text-2xl font-bold text-foreground mb-2">
              {isSignup ? "Create Account" : "Welcome Back"}
            </h2>
            <p className="text-muted-foreground text-sm">
              {isSignup 
                ? "Join the midnight studio" 
                : "Enter the studio"
              }
            </p>
          </motion.div>

          {forgotPasswordSent ? (
            <motion.div
              className="text-center py-8"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/20 flex items-center justify-center">
                <Lock className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Check Your Email</h3>
              <p className="text-muted-foreground text-sm">
                We sent a password reset link to <span className="text-foreground">{email}</span>
              </p>
              <button
                onClick={() => setForgotPasswordSent(false)}
                className="mt-6 text-sm text-primary hover:underline"
              >
                Back to Sign In
              </button>
            </motion.div>
          ) : (
            <>
              {/* Form Fields */}
              <div className="space-y-4 mb-6">
                {isSignup && (
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15 }}
                  >
                    <label className="block text-sm text-muted-foreground mb-2">
                      What should we call you?
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                      className="premium-input"
                      maxLength={100}
                    />
                  </motion.div>
                )}

                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <label className="block text-sm text-muted-foreground mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@example.com"
                    className="premium-input"
                    maxLength={255}
                  />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25 }}
                >
                  <label className="block text-sm text-muted-foreground mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="premium-input pr-12"
                      maxLength={128}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                  {!isSignup && (
                    <button
                      onClick={handleForgotPassword}
                      className="mt-2 text-xs text-primary hover:underline"
                    >
                      Forgot Password?
                    </button>
                  )}
                </motion.div>
              </div>

              {/* Submit Button */}
              <motion.button
                className="w-full py-4 rounded-2xl font-semibold text-white mb-4 flex items-center justify-center gap-2"
                style={{
                  background: "linear-gradient(135deg, hsl(7 100% 67%), hsl(345 100% 50%))",
                  boxShadow: "0 0 30px hsl(7 100% 67% / 0.4)",
                }}
                onClick={handleSubmit}
                disabled={isLoading}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  isSignup ? "Create Account" : "Sign In"
                )}
              </motion.button>

              {/* Switch mode */}
              <motion.p
                className="text-center mt-6 text-sm text-muted-foreground"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.45 }}
              >
                {isSignup ? "Already have an account?" : "Don't have an account?"}
                {" "}
                <button
                  onClick={onClose}
                  className="text-primary hover:underline"
                >
                  {isSignup ? "Sign In" : "Sign Up"}
                </button>
              </motion.p>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
