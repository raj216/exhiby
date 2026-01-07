import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Copy, Share2, QrCode, Check, ExternalLink, MessageCircle, Mail } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "@/hooks/use-toast";
import { triggerClickHaptic } from "@/lib/haptics";

interface ShareStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  handle: string | null;
  userId?: string;
  creatorName?: string;
}

export function ShareStudioModal({ isOpen, onClose, handle, userId, creatorName }: ShareStudioModalProps) {
  const [showQR, setShowQR] = useState(false);
  const [showShareOptions, setShowShareOptions] = useState(false);
  const [copied, setCopied] = useState(false);
  const [studioUrl, setStudioUrl] = useState<string | null>(null);
  const [urlError, setUrlError] = useState(false);

  const shareTitle = `Exhiby Studio — ${creatorName || handle || "Artist"}`;
  const shareText = "Step into my studio on Exhiby. Live sessions + scheduled drops.";

  // Generate studio URL
  useEffect(() => {
    if (!isOpen) {
      setCopied(false);
      setShowQR(false);
      setShowShareOptions(false);
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

    // Check if native share is available
    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: studioUrl,
        });
        return; // Success - exit early
      } catch (err) {
        // User cancelled or share failed
        if ((err as Error).name === "AbortError") {
          return; // User cancelled, do nothing
        }
        console.error("Native share failed, falling back to options:", err);
      }
    }
    
    // Fallback: Copy link + show share options panel
    try {
      await navigator.clipboard.writeText(studioUrl);
      toast({
        title: "Studio link copied",
        description: "Choose a platform to share",
      });
    } catch (err) {
      console.error("Clipboard failed:", err);
    }
    
    setShowShareOptions(true);
  };

  const getShareLinks = () => {
    if (!studioUrl) return null;
    
    const encodedUrl = encodeURIComponent(studioUrl);
    const encodedText = encodeURIComponent(shareText);
    const encodedTitle = encodeURIComponent(shareTitle);
    
    return {
      whatsapp: `https://wa.me/?text=${encodedText}%20${encodedUrl}`,
      twitter: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      email: `mailto:?subject=${encodedTitle}&body=${encodedText}%0A%0A${encodedUrl}`,
    };
  };

  const handleSharePlatform = (platform: string) => {
    triggerClickHaptic();
    const links = getShareLinks();
    if (!links) return;
    
    const url = links[platform as keyof typeof links];
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const handleToggleQR = () => {
    triggerClickHaptic();
    setShowQR(!showQR);
    if (!showQR) setShowShareOptions(false);
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

                {/* Share Options Panel (Desktop Fallback) */}
                <AnimatePresence>
                  {showShareOptions && studioUrl && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-6 p-4 rounded-2xl bg-carbon border border-border/30">
                        <p className="text-xs text-muted-foreground text-center mb-4">
                          Share on your favorite platform
                        </p>
                        
                        <div className="grid grid-cols-4 gap-3">
                          {/* WhatsApp */}
                          <button
                            onClick={() => handleSharePlatform("whatsapp")}
                            className="flex flex-col items-center gap-2 p-3 rounded-xl bg-muted/30 border border-border/30 hover:bg-muted/50 transition-colors"
                          >
                            <MessageCircle className="w-5 h-5 text-[#25D366]" />
                            <span className="text-xs text-muted-foreground">WhatsApp</span>
                          </button>
                          
                          {/* X (Twitter) */}
                          <button
                            onClick={() => handleSharePlatform("twitter")}
                            className="flex flex-col items-center gap-2 p-3 rounded-xl bg-muted/30 border border-border/30 hover:bg-muted/50 transition-colors"
                          >
                            <svg className="w-5 h-5 text-foreground" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                            </svg>
                            <span className="text-xs text-muted-foreground">X</span>
                          </button>
                          
                          {/* LinkedIn */}
                          <button
                            onClick={() => handleSharePlatform("linkedin")}
                            className="flex flex-col items-center gap-2 p-3 rounded-xl bg-muted/30 border border-border/30 hover:bg-muted/50 transition-colors"
                          >
                            <svg className="w-5 h-5 text-[#0A66C2]" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                            </svg>
                            <span className="text-xs text-muted-foreground">LinkedIn</span>
                          </button>
                          
                          {/* Email */}
                          <button
                            onClick={() => handleSharePlatform("email")}
                            className="flex flex-col items-center gap-2 p-3 rounded-xl bg-muted/30 border border-border/30 hover:bg-muted/50 transition-colors"
                          >
                            <Mail className="w-5 h-5 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">Email</span>
                          </button>
                        </div>
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
