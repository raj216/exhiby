import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Copy, Share2, QrCode, Check, ExternalLink } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "@/hooks/use-toast";
import { triggerClickHaptic } from "@/lib/haptics";

interface ShareStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  handle: string | null;
  userId?: string;
}

export function ShareStudioModal({ isOpen, onClose, handle, userId }: ShareStudioModalProps) {
  const [showQR, setShowQR] = useState(false);
  const [copied, setCopied] = useState(false);
  const [studioUrl, setStudioUrl] = useState<string | null>(null);
  const [urlError, setUrlError] = useState(false);

  // Generate studio URL
  useEffect(() => {
    if (!isOpen) {
      setCopied(false);
      setShowQR(false);
      return;
    }

    // Generate the URL based on handle or userId
    const baseUrl = "https://joinexhiby.com";
    
    if (handle) {
      setStudioUrl(`${baseUrl}/studio/${handle}`);
      setUrlError(false);
    } else if (userId) {
      setStudioUrl(`${baseUrl}/studio/id/${userId}`);
      setUrlError(false);
    } else {
      setStudioUrl(null);
      setUrlError(true);
    }
  }, [isOpen, handle, userId]);

  const handleCopyLink = async () => {
    if (!studioUrl) {
      toast({
        title: "Unable to create studio link",
        description: "Please try again.",
        variant: "destructive",
      });
      return;
    }

    triggerClickHaptic();
    
    try {
      await navigator.clipboard.writeText(studioUrl);
      setCopied(true);
      toast({
        title: "Studio link copied",
        description: "Share it with your audience",
      });
      
      // Reset copied state after 2 seconds
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  const handleNativeShare = async () => {
    if (!studioUrl) {
      toast({
        title: "Unable to create studio link",
        description: "Please try again.",
        variant: "destructive",
      });
      return;
    }

    triggerClickHaptic();

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Visit my Studio on Exhiby",
          text: "Check out my creative studio",
          url: studioUrl,
        });
      } catch (err) {
        // User cancelled or share failed silently
        if ((err as Error).name !== "AbortError") {
          console.error("Share failed:", err);
        }
      }
    } else {
      // Fallback to copy
      handleCopyLink();
    }
  };

  const handleToggleQR = () => {
    triggerClickHaptic();
    setShowQR(!showQR);
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
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
          />

          {/* Bottom Sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 max-h-[90vh]"
          >
            <div className="bg-obsidian border-t border-border/30 rounded-t-3xl overflow-hidden">
              {/* Drag Handle */}
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-6 pb-4">
                <div>
                  <h2 className="font-display text-xl text-foreground font-semibold">
                    Share your Studio
                  </h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Invite others into your space
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              {/* Content */}
              <div className="px-6 pb-8">
                {/* URL Preview */}
                {studioUrl && (
                  <div className="mb-6 p-3 rounded-xl bg-carbon border border-border/30 flex items-center gap-3">
                    <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0" />
                    <p className="text-sm text-muted-foreground truncate flex-1">
                      {studioUrl}
                    </p>
                  </div>
                )}

                {/* Primary CTA */}
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={handleCopyLink}
                  disabled={urlError || !studioUrl}
                  className="w-full py-4 rounded-2xl btn-electric flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {copied ? (
                    <>
                      <Check className="w-5 h-5 text-white" />
                      <span className="text-sm font-semibold text-white">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-5 h-5 text-white" />
                      <span className="text-sm font-semibold text-white">Copy Studio Link</span>
                    </>
                  )}
                </motion.button>

                {/* Secondary Actions Row */}
                <div className="flex gap-3 mt-4">
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={handleNativeShare}
                    disabled={urlError || !studioUrl}
                    className="flex-1 py-3.5 rounded-xl bg-muted/50 border border-border/40 flex items-center justify-center gap-2 hover:bg-muted/70 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Share2 className="w-4 h-4 text-foreground" />
                    <span className="text-sm font-medium text-foreground">Share…</span>
                  </motion.button>
                  
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={handleToggleQR}
                    disabled={urlError || !studioUrl}
                    className={`flex-1 py-3.5 rounded-xl border flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      showQR
                        ? "bg-electric/10 border-electric/30 text-electric"
                        : "bg-muted/50 border-border/40 text-foreground hover:bg-muted/70"
                    }`}
                  >
                    <QrCode className="w-4 h-4" />
                    <span className="text-sm font-medium">QR Code</span>
                  </motion.button>
                </div>

                {/* QR Code Section */}
                <AnimatePresence>
                  {showQR && studioUrl && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-6 p-6 rounded-2xl bg-carbon border border-border/30">
                        {/* QR Code */}
                        <div className="flex justify-center">
                          <div className="p-4 bg-white rounded-xl">
                            <QRCodeSVG
                              value={studioUrl}
                              size={180}
                              level="H"
                              includeMargin={false}
                              bgColor="#ffffff"
                              fgColor="#0F0F11"
                            />
                          </div>
                        </div>
                        
                        {/* Label */}
                        <p className="text-center text-sm text-muted-foreground mt-4">
                          Scan to enter this studio
                        </p>
                        
                        {/* Small Copy Button */}
                        <button
                          onClick={handleCopyLink}
                          className="mt-4 mx-auto flex items-center gap-2 px-4 py-2 rounded-full bg-muted/50 border border-border/40 hover:bg-muted/70 transition-colors"
                        >
                          {copied ? (
                            <Check className="w-3.5 h-3.5 text-electric" />
                          ) : (
                            <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                          )}
                          <span className="text-xs font-medium text-muted-foreground">
                            {copied ? "Copied" : "Copy link"}
                          </span>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Error State */}
                {urlError && (
                  <div className="mt-4 p-4 rounded-xl bg-destructive/10 border border-destructive/30">
                    <p className="text-sm text-destructive text-center">
                      Unable to create studio link. Please try again.
                    </p>
                  </div>
                )}
              </div>

              {/* Safe Area Padding */}
              <div className="h-safe-area-inset-bottom" />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
