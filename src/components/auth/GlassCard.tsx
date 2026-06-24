import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, Eye, EyeOff, Lock, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";

interface GlassCardProps {
  mode: "signup" | "login";
  onSuccess: (name: string) => void;
  onClose: () => void;
  onSwitchToLogin?: () => void;
}

const emailSchema = z.string().email("Please enter a valid email");
const nameSchema = z.string().min(1, "Please enter your name").max(100);
const passwordSchema = z.string().min(6, "Password must be at least 6 characters");

// Matches the DB constraint exactly: letters, numbers, underscore only (no dots)
// DB constraint: handle ~ '^[a-zA-Z0-9_]+$'
const usernameSchema = z
  .string()
  .min(3, "Username must be at least 3 characters")
  .max(20, "Username must be at most 20 characters")
  .regex(/^[a-z0-9_]+$/, "Use letters, numbers, and _ only");

/**
 * Generates Instagram-style handle alternatives for a taken base handle.
 * Checks each candidate against the DB in parallel, returns only available ones.
 */
async function generateSuggestions(base: string): Promise<string[]> {
  const year = new Date().getFullYear().toString().slice(-2);
  const r = () => String(Math.floor(Math.random() * 900) + 100);

  const candidates = [
    `${base}${year}`,
    `${base}${r()}`,
    `${base}_art`,
    `${base}_studio`,
    `${base}_official`,
    `the_${base}`,
  ]
    .map((s) => s.slice(0, 20))
    .filter((s) => s.length >= 3 && /^[a-z0-9_]+$/.test(s));

  const unique = [...new Set(candidates)];

  const settled = await Promise.all(
    unique.map(async (candidate) => {
      try {
        // check_handle_available is granted to anon — safe for signup flow
        const { data } = await supabase.rpc("check_handle_available", {
          target_handle: candidate,
        });
        return data === true ? candidate : null;
      } catch {
        return null;
      }
    })
  );

  return settled.filter(Boolean).slice(0, 4) as string[];
}

export function GlassCard({ mode, onSuccess, onClose, onSwitchToLogin }: GlassCardProps) {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [forgotPasswordSent, setForgotPasswordSent] = useState(false);
  const [signupEmailSent, setSignupEmailSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Username validation state
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [usernameAvailable, setUsernameAvailable] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const isSignup = mode === "signup";

  // Normalize username: lowercase, strip everything not in DB constraint
  const handleUsernameChange = (value: string) => {
    const normalized = value.toLowerCase().replace(/[^a-z0-9_]/g, "");
    setUsername(normalized);
  };

  // Debounced username availability check with race-condition protection
  useEffect(() => {
    if (!isSignup) return;

    // Reset all derived state immediately on every keystroke
    setUsernameAvailable(false);
    setUsernameError(null);
    setSuggestions([]);

    if (!username || username.length < 3) {
      setIsCheckingUsername(false);
      if (username.length > 0) setUsernameError("At least 3 characters required");
      return;
    }

    const result = usernameSchema.safeParse(username);
    if (!result.success) {
      setIsCheckingUsername(false);
      setUsernameError(result.error.errors[0].message);
      return;
    }

    // Show spinner immediately (not after debounce) so user gets instant feedback
    setIsCheckingUsername(true);

    // Cancellation flag prevents stale async results from writing state
    // after the user has already changed the input
    let cancelled = false;

    const timer = setTimeout(async () => {
      if (cancelled) return;

      try {
        const { data, error } = await supabase.rpc("check_handle_available", {
          target_handle: username,
        });

        if (cancelled) return;
        if (error) throw error;

        if (data === false) {
          setUsernameError("Username already taken");
          setUsernameAvailable(false);
          // Fire-and-forget suggestion generation
          generateSuggestions(username).then((s) => {
            if (!cancelled) setSuggestions(s);
          });
        } else {
          setUsernameAvailable(true);
          setUsernameError(null);
        }
      } catch {
        if (!cancelled) setUsernameError("Could not verify username. Try again.");
      } finally {
        if (!cancelled) setIsCheckingUsername(false);
      }
    }, 600);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [username, isSignup]);

  const handleSubmit = async () => {
    setFormError(null);
    try {
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

        const usernameResult = usernameSchema.safeParse(username);
        if (!usernameResult.success) {
          toast.error(usernameResult.error.errors[0].message);
          return;
        }

        if (!usernameAvailable) {
          toast.error("Please choose an available username");
          return;
        }
      }

      setIsLoading(true);

      // VITE_APP_URL must be set to the production domain in Lovable's
      // environment settings so Supabase sends the confirmation link to the
      // real app, not to whatever origin the preview is running on.
      // Trim trailing slash so ${appUrl}/ never produces a double-slash.
      const appUrl = (import.meta.env.VITE_APP_URL || window.location.origin).replace(/\/$/, "");
      const redirectUrl = `${appUrl}/`;

      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectUrl,
            data: {
              name: name,
              full_name: name,
              handle: username,
            },
          },
        });

        if (error) {
          console.error("[GlassCard] Signup error:", error.message, error);
          if (error.message.includes("already registered") || error.message.includes("already_exists")) {
            setFormError("An account with this email already exists. Please sign in.");
          } else {
            setFormError(error.message);
          }
          return;
        }

        // Supabase returns identities: [] for duplicate email with email confirmation enabled
        if (data?.user && data.user.identities && data.user.identities.length === 0) {
          toast.error("An account with this email already exists. Please sign in.");
          return;
        }

        // The handle the user picked here is stored in auth metadata and written
        // to their profile by the handle_new_user trigger — so it's claimed once,
        // at signup. No second "claim your handle" prompt afterwards.
        if (data?.session) {
          // Email confirmation is off → signup returns a live session, so the
          // user is logged in immediately. Proceed straight into the app.
          toast.success("Welcome to Exhiby!");
          onSuccess(name);
        } else {
          // Email confirmation is on → no session yet. Show a clean "check your
          // email" state instead of dead-ending on a step that needs a session.
          setSignupEmailSent(true);
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });

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
    } catch {
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
      const appUrl = (import.meta.env.VITE_APP_URL || window.location.origin).replace(/\/$/, "");
      const redirectUrl = `${appUrl}/auth`;

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      setForgotPasswordSent(true);
      toast.success("Password reset email sent! Check your inbox.");
    } catch {
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
        <div className="relative z-10 p-6 md:p-8 max-h-[90vh] overflow-y-auto">
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
              {isSignup ? "Join the midnight studio" : "Enter the studio"}
            </p>
          </motion.div>

          {signupEmailSent ? (
            <motion.div
              className="text-center py-8"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/20 flex items-center justify-center">
                <Check className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Confirm Your Email</h3>
              <p className="text-muted-foreground text-sm">
                We sent a confirmation link to{" "}
                <span className="text-foreground">{email}</span>. Tap it to
                finish setting up your studio pass.
              </p>
              <button
                onClick={onSwitchToLogin ?? onClose}
                className="mt-6 text-sm text-primary hover:underline"
              >
                Back to Sign In
              </button>
            </motion.div>
          ) : forgotPasswordSent ? (
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
                We sent a password reset link to{" "}
                <span className="text-foreground">{email}</span>
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
                {/* 1. Display Name */}
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

                {/* 2. Username — signup only */}
                {isSignup && (
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.18 }}
                  >
                    <label className="block text-sm text-muted-foreground mb-2">
                      Username
                    </label>
                    <div className="relative">
                      {/* @ prefix — top-1/2 -translate-y-1/2 vertically centers
                          inside the input (py-4 makes it ~52px tall) */}
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none select-none">
                        @
                      </span>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => handleUsernameChange(e.target.value)}
                        placeholder="yourhandle"
                        className="premium-input pl-8 pr-10"
                        maxLength={20}
                        autoComplete="username"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                      />
                      {/* Status indicator */}
                      <div className="absolute right-4 top-1/2 -translate-y-1/2">
                        {isCheckingUsername && (
                          <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
                        )}
                        {!isCheckingUsername && usernameAvailable && (
                          <Check className="w-4 h-4 text-electric" />
                        )}
                        {!isCheckingUsername && usernameError && username.length >= 3 && (
                          <X className="w-4 h-4 text-destructive" />
                        )}
                      </div>
                    </div>

                    {/* Feedback line */}
                    <AnimatePresence mode="wait">
                      {usernameError && (
                        <motion.p
                          key="error"
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          className="mt-1.5 text-xs text-destructive"
                        >
                          {usernameError}
                        </motion.p>
                      )}
                      {usernameAvailable && !isCheckingUsername && (
                        <motion.p
                          key="available"
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          className="mt-1.5 text-xs text-electric"
                        >
                          @{username} is available ✓
                        </motion.p>
                      )}
                    </AnimatePresence>

                    {/* Instagram-style suggestions when handle is taken */}
                    <AnimatePresence>
                      {usernameError === "Username already taken" && suggestions.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="mt-2.5"
                        >
                          <p className="text-xs text-muted-foreground mb-1.5">
                            Try one of these:
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {suggestions.map((s) => (
                              <button
                                key={s}
                                type="button"
                                onClick={() => {
                                  setUsername(s);
                                }}
                                className="px-3 py-1 rounded-full text-xs font-medium bg-muted/40 text-foreground hover:bg-electric/15 hover:text-electric border border-border/40 hover:border-electric/40 transition-all duration-150"
                              >
                                @{s}
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}

                {/* 3. Email */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <label className="block text-sm text-muted-foreground mb-2">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@example.com"
                    className="premium-input"
                    maxLength={255}
                  />
                </motion.div>

                {/* 4. Password */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25 }}
                >
                  <label className="block text-sm text-muted-foreground mb-2">Password</label>
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
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
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
                ) : isSignup ? (
                  "Create Account"
                ) : (
                  "Sign In"
                )}
              </motion.button>

              {/* Inline form error */}
              {formError && (
                <motion.p
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center text-sm text-destructive mt-3"
                >
                  {formError}
                </motion.p>
              )}

              <motion.p
                className="text-center mt-6 text-sm text-muted-foreground"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.45 }}
              >
                {isSignup ? "Already have an account?" : "Don't have an account?"}{" "}
                <button onClick={onClose} className="text-primary hover:underline">
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
