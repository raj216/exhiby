import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, Eye, EyeOff, Lock, Check, AtSign } from "lucide-react";
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
const usernameSchema = z
  .string()
  .min(3, "Username must be at least 3 characters")
  .max(20, "Username must be at most 20 characters")
  .regex(/^[a-z0-9_.]+$/, "Use letters, numbers, _ or . only");

function buildSuggestions(base: string): string[] {
  const clean = base.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 15);
  if (!clean || clean.length < 2) return [];

  const yr = String(new Date().getFullYear()).slice(2);
  const r2 = () => String(Math.floor(Math.random() * 89) + 10);
  const r3 = () => String(Math.floor(Math.random() * 899) + 100);

  const candidates = [
    `${clean}${r2()}`,
    `${clean}.${yr}`,
    `${clean}_${r2()}`,
    `${clean}${r3()}`,
    `_${clean}`,
    `${clean}.studio`,
    `real.${clean}`,
    `the.${clean}`,
  ];

  return candidates.filter((s) => /^[a-z0-9_.]{3,20}$/.test(s));
}

async function fetchAvailableSuggestions(base: string): Promise<string[]> {
  const candidates = buildSuggestions(base);
  if (!candidates.length) return [];

  const results = await Promise.all(
    candidates.map(async (s) => {
      try {
        const { data } = await supabase.rpc("check_username_available", { p_username: s });
        return data === true ? s : null;
      } catch {
        return null;
      }
    })
  );

  return results.filter((s): s is string => s !== null).slice(0, 4);
}

export function GlassCard({ mode, onSuccess, onClose }: GlassCardProps) {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [forgotPasswordSent, setForgotPasswordSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [usernameAvailable, setUsernameAvailable] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const isSignup = mode === "signup";

  const handleUsernameChange = (value: string) => {
    const normalized = value.toLowerCase().replace(/\s/g, "").replace(/[^a-z0-9_.]/g, "");
    setUsername(normalized);
    setSuggestions([]);
  };

  const pickSuggestion = useCallback((s: string) => {
    setUsername(s);
    setSuggestions([]);
  }, []);

  // Debounced availability check — uses check_username_available (anon-safe)
  useEffect(() => {
    if (!isSignup) return;

    setUsernameAvailable(false);
    setUsernameError(null);
    setSuggestions([]);

    if (!username || username.length < 3) {
      if (username.length > 0) setUsernameError("Must be at least 3 characters");
      return;
    }

    const schemaResult = usernameSchema.safeParse(username);
    if (!schemaResult.success) {
      setUsernameError(schemaResult.error.errors[0].message);
      return;
    }

    const timer = setTimeout(async () => {
      setIsCheckingUsername(true);
      try {
        const { data, error } = await supabase.rpc("check_username_available", {
          p_username: username,
        });

        if (error) throw error;

        if (data === true) {
          setUsernameAvailable(true);
          setUsernameError(null);
        } else {
          setUsernameAvailable(false);
          setUsernameError("Username already taken");
          const available = await fetchAvailableSuggestions(username);
          setSuggestions(available);
        }
      } catch {
        // Don't block the user — show a soft warning but allow retry on submit
        setUsernameError("Couldn't verify — try a different username");
        setUsernameAvailable(false);
      } finally {
        setIsCheckingUsername(false);
      }
    }, 500);

    return () => clearTimeout(timer);
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
      const redirectUrl = `${window.location.origin}/`;

      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectUrl,
            data: {
              name,
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

        if (data?.user && data.user.identities && data.user.identities.length === 0) {
          toast.error("An account with this email already exists. Please sign in.");
          return;
        }

        toast.success("Account created!");
        onSuccess(name);
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
        <div className="absolute inset-0 backdrop-blur-2xl bg-card/80 border border-border/30" />

        <div className="relative z-10 p-6 md:p-8 max-h-[90vh] overflow-y-auto">
          {/* Close */}
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
              <div className="space-y-4 mb-6">
                {/* Display Name */}
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

                {/* Username */}
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
                      {/* @ prefix */}
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground select-none pointer-events-none">
                        <AtSign className="w-4 h-4" />
                      </span>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => handleUsernameChange(e.target.value)}
                        placeholder="yourhandle"
                        className="premium-input pl-10 pr-10"
                        maxLength={20}
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="none"
                        spellCheck={false}
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {isCheckingUsername && (
                          <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
                        )}
                        {!isCheckingUsername && usernameAvailable && (
                          <Check className="w-4 h-4 text-green-500" />
                        )}
                        {!isCheckingUsername && usernameError && username.length >= 3 && (
                          <X className="w-4 h-4 text-destructive" />
                        )}
                      </div>
                    </div>

                    {/* Status line */}
                    <AnimatePresence mode="wait">
                      {usernameAvailable && !isCheckingUsername && (
                        <motion.p
                          key="available"
                          className="mt-1.5 text-xs text-green-500 font-medium"
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                        >
                          @{username} is available
                        </motion.p>
                      )}
                      {usernameError && !isCheckingUsername && (
                        <motion.p
                          key="error"
                          className="mt-1.5 text-xs text-destructive"
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                        >
                          {usernameError}
                        </motion.p>
                      )}
                    </AnimatePresence>

                    {/* Suggestions */}
                    <AnimatePresence>
                      {suggestions.length > 0 && !usernameAvailable && (
                        <motion.div
                          key="suggestions"
                          className="mt-2"
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                        >
                          <p className="text-xs text-muted-foreground mb-1.5">
                            Try one of these:
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {suggestions.map((s) => (
                              <button
                                key={s}
                                type="button"
                                onClick={() => pickSuggestion(s)}
                                className="text-xs px-3 py-1.5 rounded-full border border-border/60 bg-muted/30 hover:bg-primary/10 hover:border-primary/50 hover:text-primary transition-all duration-150 font-mono"
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

                {/* Email */}
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

                {/* Password */}
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

              {/* Submit */}
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
