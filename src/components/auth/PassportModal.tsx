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

export function PassportModal({ userName, onComplete }: PassportModalProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [handle, setHandle] = useState("");
  const [isCheckingHandle, setIsCheckingHandle] = useState(false);
  const [handleError, setHandleError] = useState<string | null>(null);
  const [handleAvailable, setHandleAvailable] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Auto-generate handle from userName on mount, or use handle from user metadata
  useEffect(() => {
    if (user?.user_metadata?.handle) {
      setHandle(user.user_metadata.handle);
    } else if (userName) {
      const generatedHandle = userName
        .toLowerCase()
        .replace(/[^a-z0-9_.]/g, "")
        .slice(0, 20);
      setHandle(generatedHandle);
    }
  }, [userName, user]);

  // Debounced handle validation
  useEffect(() => {
    if (!handle || handle.length < 3) {
      setHandleError(handle.length > 0 ? "Handle must be at least 3 characters" : null);
      setHandleAvailable(false);
      return;
    }

    if (!/^[a-z0-9_.]+$/.test(handle)) {
      setHandleError("Use letters, numbers, _ or . only");
      setHandleAvailable(false);
      return;
    }

    if (handle.length > 20) {
      setHandleError("Handle must be at most 20 characters");
      setHandleAvailable(false);
      return;
    }

    const checkHandle = async () => {
      setIsCheckingHandle(true);
      setHandleError(null);
      
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("handle")
          .ilike("handle", handle)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setHandleError("Handle not available");
          setHandleAvailable(false);
        } else {
          setHandleAvailable(true);
        }
      } catch (error) {
        console.error("Handle check error:", error);
        setHandleError("Could not verify handle");
        setHandleAvailable(false);
      } finally {
        setIsCheckingHandle(false);
      }
    };

    const timer = setTimeout(checkHandle, 500);
    return () => clearTimeout(timer);
  }, [handle]);

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
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!handleAvailable || !user) return;

    setIsSubmitting(true);

    try {
      let avatarUrl: string | undefined;

      // Upload avatar only if a file was selected (optional)
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

      // Update profile with handle and optionally avatar
      const updateData: Record<string, string> = { handle };
      if (avatarUrl) {
        updateData.avatar_url = avatarUrl;
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("user_id", user.id);

      if (updateError) throw updateError;

      // Show success animation
      setShowSuccess(true);
      
      setTimeout(() => {
        onComplete();
      }, 1500);
    } catch (error: any) {
      console.error("Passport error:", error);
      toast.error(error.message || "Failed to complete passport");
      setIsSubmitting(false);
    }
  };

  // Photo is now optional - only handle availability is required
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
              style={{
                boxShadow: "0 0 40px hsl(var(--primary) / 0.5)",
              }}
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
            {/* Frosted glass effect */}
            <div className="absolute inset-0 backdrop-blur-2xl bg-card/80 border border-border/30" />

            {/* Content */}
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
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                    @
                  </span>
                  <input
                    type="text"
                    value={handle}
                    onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ""))}
                    placeholder="yourhandle"
                    className="premium-input pl-8"
                    maxLength={20}
                  />
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
                {handleError && (
                  <p className="mt-2 text-xs text-destructive">{handleError}</p>
                )}
                {handleAvailable && !isCheckingHandle && (
                  <p className="mt-2 text-xs text-electric">Handle available!</p>
                )}
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
                {isSubmitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  "Enter"
                )}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
