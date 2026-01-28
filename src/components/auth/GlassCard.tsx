import { useState } from "react";
import { motion } from "framer-motion";
import { X, Loader2, Eye, EyeOff, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
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
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
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

  const handleGoogleSignIn = async () => {
    try {
      setIsGoogleLoading(true);

      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
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
      onSuccess("");
    } catch (error) {
      toast.error("Something went wrong. Please try again.");
      setIsGoogleLoading(false);
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

              {/* Divider */}
              <motion.div
                className="flex items-center gap-4 my-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.35 }}
              >
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground uppercase tracking-wider">or</span>
                <div className="flex-1 h-px bg-border" />
              </motion.div>

              {/* Google Sign In */}
              <motion.button
                className="w-full py-4 rounded-2xl font-medium border border-border hover:bg-muted/30 transition-colors flex items-center justify-center gap-3"
                onClick={handleGoogleSignIn}
                disabled={isGoogleLoading}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                {isGoogleLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="currentColor"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    Enter with Google
                  </>
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
