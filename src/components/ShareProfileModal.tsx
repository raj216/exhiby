import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Copy, Share2, Check } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { triggerClickHaptic } from "@/lib/haptics";

interface ShareProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  handle: string | null;
  userId?: string;
}

export function ShareProfileModal({ isOpen, onClose, handle, userId }: ShareProfileModalProps) {
  const [copied, setCopied] = useState(false);

  // Generate profile URL - use handle if available, otherwise fallback to userId
  const getProfileUrl = () => {
    const baseUrl = window.location.origin;
    if (handle) {
      return `${baseUrl}/user/${handle}`;
    }
    if (userId) {
      return `${baseUrl}/user/id/${userId}`;
    }
    return baseUrl;
  };

  const profileUrl = getProfileUrl();

  const handleCopyLink = async () => {
    triggerClickHaptic();
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      toast({
        title: "Link copied",
        description: "Profile link copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
      toast({
        title: "Failed to copy",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  const handleNativeShare = async () => {
    triggerClickHaptic();
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Check out my profile on Exhiby",
          url: profileUrl,
        });
      } catch (err) {
        // User cancelled or share failed
        if ((err as Error).name !== "AbortError") {
          console.error("Share failed:", err);
        }
      }
    } else {
      // Fallback to copy
      handleCopyLink();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 max-w-sm mx-auto"
          >
            <div className="bg-obsidian border border-border/40 rounded-2xl overflow-hidden shadow-2xl">
              {/* Header */}
              <div className="relative px-6 pt-5 pb-4 border-b border-border/30">
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center hover:bg-muted/70 transition-colors"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
                <h2 className="font-display text-lg text-foreground font-semibold">
                  Share Profile
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Your identity on Exhiby
                </p>
              </div>

              {/* Content */}
              <div className="p-6 space-y-4">
                {/* URL Preview */}
                <div className="bg-carbon rounded-xl p-3 border border-border/30">
                  <p className="text-xs text-muted-foreground/70 mb-1">Profile Link</p>
                  <p className="text-sm text-foreground/80 truncate font-mono">
                    {profileUrl}
                  </p>
                </div>

                {/* Primary Action - Copy Link (Neutral/Muted styling) */}
                <button
                  onClick={handleCopyLink}
                  className="w-full py-3 px-4 rounded-xl bg-muted/60 border border-border/40 text-foreground font-medium flex items-center justify-center gap-2 hover:bg-muted/80 transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-green-400" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy Profile Link
                    </>
                  )}
                </button>

                {/* Secondary Action - Native Share (if available) */}
                {typeof navigator !== "undefined" && navigator.share && (
                  <button
                    onClick={handleNativeShare}
                    className="w-full py-3 px-4 rounded-xl bg-carbon border border-border/30 text-muted-foreground font-medium flex items-center justify-center gap-2 hover:bg-muted/30 transition-colors"
                  >
                    <Share2 className="w-4 h-4" />
                    Share via...
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
