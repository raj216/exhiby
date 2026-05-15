import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Loader2, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface PassportModalProps {
  userName: string;
  onComplete: () => void;
}

// Matches DB constraint exactly: '^[a-zA-Z0-9_]+$'  (no dots)
const HANDLE_REGEX = /^[a-z0-9_]+$/;

/**
 * Generates Instagram-style handle alternatives for a taken base handle.
 * Runs all candidate checks in parallel, returns only available ones.
 * userId is used to exclude the current user's own existing handle.
 */
async function generateSuggestions(base: string, userId?: string): Promise<string[]> {
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
    .filter((s) => s.length >= 3 && HANDLE_REGEX.test(s));

  const unique = [...new Set(candidates)];

  const settled = await Promise.all(
    unique.map(async (candidate) => {
      try {
        const { data } = await supabase.rpc("get_public_profile_by_handle", {
          target_handle: candidate,
        });
        // Available if no row returned, or the only row belongs to the current user
        if (!data || data.length === 0) return candidate;
        if (userId && data[0].user_id === userId) return candidate;
        return null;
      } catch {
        return null;
      }
    })
  );

  return settled.filter(Boolean).slice(0, 4) as string[];
}

export function PassportModal({ userName, onComplete }: PassportModalProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [handle, setHandle] = useState("");
  const [isCheckingHandle, setIsCheckingHandle] = useState(false);
  const [handleError, setHandleError] = useState<string | null>(null);
  const [handleAvailable, setHandleAvailable] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Pre-fill handle from user metadata or derive from name
  useEffect(() => {
    if (user?.user_metadata?.handle) {
      setHandle(
        String(user.user_metadata.handle)
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, "")
          .slice(0, 20)
      );
    } else if (userName) {
      setHandle(
        userName
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, "") // strip chars not in DB constraint
          .slice(0, 20)
      );
    }
  }, [userName, user]);

  // Debounced handle validation with race-condition protection
  useEffect(() => {
    // Reset ALL derived state immediately on every keystroke
    setHandleAvailable(false);
    setHandleError(null);
    setSuggestions([]);

    if (!handle || handle.length < 3) {
      setIsCheckingHandle(false);
      if (handle.length > 0) setHandleError("At least 3 characters required");
      return;
    }

    if (!HANDLE_REGEX.test(handle)) {
      setIsCheckingHandle(false);
      setHandleError("Letters, numbers, and _ only");
      return;
    }

    if (handle.length > 20) {
      setIsCheckingHandle(false);
      setHandleError("Max 20 characters");
      return;
    }

    // Valid format: show spinner immediately (before debounce fires)
    setIsCheckingHandle(true);

    // Cancellation flag — prevents stale async results from updating state
    // after the user has already typed something new
    let cancelled = false;

    const timer = setTimeout(async () => {
      if (cancelled) return;

      try {
        const { data, error } = await supabase.rpc("get_public_profile_by_handle", {
          target_handle: handle,
        });

        if (cancelled) return;
        if (error) throw error;

        const takenByOther =
          data && data.length > 0 && data[0].user_id !== user?.id;

        if (takenByOther) {
          setHandleError("Handle not available");
          setHandleAvailable(false);
          // Generate suggestions in the background
          generateSuggestions(handle, user?.id).then((s) => {
            if (!cancelled) setSuggestions(s);
          });
        } else {
          setHandleAvailable(true);
          setHandleError(null);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Handle check error:", err);
          setHandleError("Could not verify handle. Try again.");
        }
      } finally {
        if (!cancelled) setIsCheckingHandle(false);
      }
    }, 600);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [handle, user?.id]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }

    setAvatarFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!handleAvailable || !user) return;

    setIsSubmitting(true);

    try {
      let avatarUrl: string | undefined;

      if (avatarFile) {
        const fileExt = avatarFile.name.split(".").pop();
        const fileName = `${user.id}/avatar.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(fileName, avatarFile, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("avatars")
          .getPublicUrl(fileName);

        avatarUrl = urlData.publicUrl;
      }

      const updateData: Record<string, string> = { handle };
      if (avatarUrl) updateData.avatar_url = avatarUrl;

      const { error: updateError } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("user_id", user.id);

      if (updateError) throw updateError;

      setShowSuccess(true);
      setTimeout(() => onComplete(), 1500);
    } catch (error: unknown) {
      console.error("Passport error:", error);
      const msg = error instanceof Error ? error.message : "Failed to complete passport";
      toast.error(msg);
      setIsSubmitting(false);
    }
  };

  const canSubmit = handleAvailable && !isCheckingHandle && !isSubmitting;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Dark backdrop */}
      <motion.div
        className="absolute inset-0 bg-background/90 backdrop-blur-md"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      />

      <AnimatePresence mode="wait">
        {showSuccess ? (
          <motion.div
            key="success"
            className="relative z-10 flex flex-col items-center"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
          >
            <motion.div
              className="w-32 h-32 rounded-full border-4 border-primary flex items-center justify-center"
              initial={{ rotate: -20, scale: 0 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: "spring", damping: 12, stiffness: 200 }}
              style={{ boxShadow: "0 0 40px hsl(var(--primary) / 0.5)" }}
            >
              <Check className="w-16 h-16 text-primary" />
            </motion.div>
            <motion.p
              className="mt-6 text-xl font-semibold text-foreground"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              Welcome to Exhiby
            </motion.p>
          </motion.div>
        ) : (
          <motion.div
            key="form"
            className="relative w-full max-w-md rounded-3xl overflow-hidden"
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            {/* Frosted glass */}
            <div className="absolute inset-0 backdrop-blur-2xl bg-card/80 border border-border/30" />

            <div className="relative z-10 p-6 md:p-8">
              {/* Header */}
              <motion.div
                className="text-center mb-8"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  Finish Your Passport
                </h2>
                <p className="text-muted-foreground text-sm">
                  Add a photo and claim your handle.
                </p>
              </motion.div>

              {/* Photo Upload (Optional) */}
              <motion.div
                className="flex flex-col items-center mb-8"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.15 }}
              >
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="relative w-28 h-28 rounded-full border-2 border-dashed border-border hover:border-primary transition-colors overflow-hidden group"
                  style={{
                    background: avatarPreview
                      ? `url(${avatarPreview}) center/cover`
                      : "hsl(var(--muted) / 0.3)",
                  }}
                >
                  {!avatarPreview && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Camera className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  )}
                  {avatarPreview && (
                    <div className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Camera className="w-8 h-8 text-foreground" />
                    </div>
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <p className="mt-3 text-sm text-muted-foreground">
                  {avatarPreview ? "Tap to change" : "Tap to add photo (optional)"}
                </p>
              </motion.div>

              {/* Handle Input */}
              <motion.div
                className="mb-8"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
              >
                <label className="block text-sm text-muted-foreground mb-2">
                  Claim your Handle
                </label>
                <div className="relative">
                  {/* @ prefix — top-1/2 -translate-y-1/2 vertically centers
                      inside the input (py-4 makes it ~52px tall) */}
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none select-none">
                    @
                  </span>
                  <input
                    type="text"
                    value={handle}
                    onChange={(e) =>
                      setHandle(
                        e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "")
                      )
                    }
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
                    {isCheckingHandle && (
                      <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
                    )}
                    {!isCheckingHandle && handleAvailable && (
                      <Check className="w-4 h-4 text-electric" />
                    )}
                    {!isCheckingHandle && handleError && handle.length >= 3 && (
                      <X className="w-4 h-4 text-destructive" />
                    )}
                  </div>
                </div>

                {/* Feedback line */}
                <AnimatePresence mode="wait">
                  {handleError && (
                    <motion.p
                      key="error"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="mt-1.5 text-xs text-destructive"
                    >
                      {handleError}
                    </motion.p>
                  )}
                  {handleAvailable && !isCheckingHandle && (
                    <motion.p
                      key="available"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="mt-1.5 text-xs text-electric"
                    >
                      @{handle} is available ✓
                    </motion.p>
                  )}
                </AnimatePresence>

                {/* Instagram-style suggestions when handle is taken */}
                <AnimatePresence>
                  {handleError === "Handle not available" && suggestions.length > 0 && (
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
                            onClick={() => setHandle(s)}
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

              {/* Submit Button */}
              <motion.button
                className="w-full py-4 rounded-2xl font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: canSubmit
                    ? "linear-gradient(135deg, hsl(7 100% 67%), hsl(345 100% 50%))"
                    : "hsl(var(--muted))",
                  boxShadow: canSubmit ? "0 0 30px hsl(7 100% 67% / 0.4)" : "none",
                }}
                onClick={handleSubmit}
                disabled={!canSubmit}
                whileHover={canSubmit ? { scale: 1.02 } : {}}
                whileTap={canSubmit ? { scale: 0.98 } : {}}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Enter"}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
