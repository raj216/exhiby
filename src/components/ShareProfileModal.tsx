import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Copy, Share2, Check, ExternalLink, MessageCircle, Mail, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "@/hooks/use-toast";
import { triggerClickHaptic } from "@/lib/haptics";
import { useScrollLock } from "@/hooks/useScrollLock";

interface ShareProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  handle: string | null;
  userId?: string;
}

export function ShareProfileModal({ isOpen, onClose, handle, userId }: ShareProfileModalProps) {
  const [copied, setCopied] = useState(false);
  const [showShareOptions, setShowShareOptions] = useState(false);
  const [showQR, setShowQR] = useState(false);

  // Lock background scroll when modal is open
  useScrollLock(isOpen);

  // Generate profile URL - use handle if available, otherwise fallback to userId
  // Canonical route: /user/:identifier (handles both handles and userIds)
  const getProfileUrl = () => {
    const baseUrl = window.location.origin;
    const identifier = handle || userId;
    if (identifier) {
      const url = `${baseUrl}/user/${identifier}`;
      if (import.meta.env.DEV) {
        console.log("[ShareProfileModal] Generated share URL:", url);
      }
      return url;
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
        // User cancelled or share failed - show fallback options
        if ((err as Error).name !== "AbortError") {
          console.error("Share failed:", err);
        }
        setShowShareOptions(true);
      }
    } else {
      // Desktop fallback - show share options
      setShowShareOptions(!showShareOptions);
    }
  };

  const getShareLinks = () => {
    const encodedUrl = encodeURIComponent(profileUrl);
    const encodedText = encodeURIComponent("Check out my profile on Exhiby");
    const encodedTitle = encodeURIComponent("My Exhiby Profile");
    
    return {
      whatsapp: `https://wa.me/?text=${encodedText}%20${encodedUrl}`,
      twitter: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      instagram: `instagram://story-camera`,
      tiktok: `https://www.tiktok.com/`,
      email: `mailto:?subject=${encodedTitle}&body=${encodedText}%0A%0A${encodedUrl}`,
    };
  };

  const handleSharePlatform = async (platform: keyof ReturnType<typeof getShareLinks>) => {
    triggerClickHaptic();
    const links = getShareLinks();
    
    // For Instagram and TikTok, copy link to clipboard first, then open app
    if ((platform === "instagram" || platform === "tiktok") && profileUrl) {
      try {
        await navigator.clipboard.writeText(profileUrl);
        toast({
          title: "Link copied to clipboard",
          description: platform === "instagram" 
            ? "Paste it in your Instagram Story" 
            : "Paste it in your TikTok video",
        });
      } catch (err) {
        console.error("Clipboard failed:", err);
      }
    }
    
    window.open(links[platform], "_blank", "noopener,noreferrer");
  };

  const handleToggleQR = () => {
    triggerClickHaptic();
    setShowQR(!showQR);
    if (!showQR) setShowShareOptions(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Full-viewport overlay with centering */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm"
            style={{ height: "100dvh" }}
            onClick={onClose}
          >
            {/* Modal Container - stops click propagation */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="w-[min(92vw,520px)] max-h-[85dvh] overflow-auto bg-obsidian border border-border/40 rounded-2xl shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-5 pb-3">
                <div>
                  <h2 className="font-display text-lg md:text-xl text-foreground font-semibold">
                    Share Profile
                  </h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Invite others to view this artist
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center hover:bg-muted/70 transition-colors"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              {/* Content */}
              <div className="px-5 pb-6">
                {/* URL Preview */}
                <div className="mb-5 p-3 rounded-xl bg-carbon border border-border/30 flex items-center gap-3">
                  <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0" />
                  <p className="text-sm text-muted-foreground truncate flex-1">
                    {profileUrl}
                  </p>
                </div>

                {/* Primary CTA */}
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={handleCopyLink}
                  className="w-full py-3.5 rounded-xl btn-electric flex items-center justify-center gap-3"
                >
                  {copied ? (
                    <>
                      <Check className="w-5 h-5 text-white" />
                      <span className="text-sm font-semibold text-white">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-5 h-5 text-white" />
                      <span className="text-sm font-semibold text-white">Copy Profile Link</span>
                    </>
                  )}
                </motion.button>

                {/* Secondary Actions Row */}
                <div className="flex gap-3 mt-4">
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={handleNativeShare}
                    className="flex-1 py-3 rounded-xl bg-muted/50 border border-border/40 flex items-center justify-center gap-2 hover:bg-muted/70 transition-colors"
                  >
                    <Share2 className="w-4 h-4 text-foreground" />
                    <span className="text-sm font-medium text-foreground">Share…</span>
                  </motion.button>
                  
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={handleToggleQR}
                    className={`flex-1 py-3 rounded-xl border flex items-center justify-center gap-2 transition-colors ${
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
                  {showQR && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-5 p-5 rounded-xl bg-carbon border border-border/30">
                        {/* QR Code */}
                        <div className="flex justify-center">
                          <div className="p-3 bg-white rounded-xl">
                            <QRCodeSVG
                              value={profileUrl}
                              size={140}
                              level="H"
                              includeMargin={false}
                              bgColor="#ffffff"
                              fgColor="#0F0F11"
                            />
                          </div>
                        </div>
                        
                        {/* Label */}
                        <p className="text-center text-sm text-muted-foreground mt-3">
                          Scan to view this profile
                        </p>
                        
                        {/* Small Copy Button */}
                        <button
                          onClick={handleCopyLink}
                          className="mt-3 mx-auto flex items-center gap-2 px-4 py-2 rounded-full bg-muted/50 border border-border/40 hover:bg-muted/70 transition-colors"
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

                {/* Share Options Panel */}
                <AnimatePresence>
                  {showShareOptions && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-5 p-4 rounded-xl bg-carbon border border-border/30">
                        <p className="text-xs text-muted-foreground text-center mb-3">
                          Share on your favorite platform
                        </p>
                        
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                          {/* WhatsApp */}
                          <button
                            onClick={() => handleSharePlatform("whatsapp")}
                            className="flex flex-col items-center gap-1.5 p-2 rounded-lg bg-muted/30 border border-border/30 hover:bg-muted/50 transition-colors"
                          >
                            <MessageCircle className="w-4 h-4 text-[#25D366]" />
                            <span className="text-[10px] text-muted-foreground">WhatsApp</span>
                          </button>
                          
                          {/* Instagram */}
                          <button
                            onClick={() => handleSharePlatform("instagram")}
                            className="flex flex-col items-center gap-1.5 p-2 rounded-lg bg-muted/30 border border-border/30 hover:bg-muted/50 transition-colors"
                          >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="url(#instagram-gradient-profile)">
                              <defs>
                                <linearGradient id="instagram-gradient-profile" x1="0%" y1="100%" x2="100%" y2="0%">
                                  <stop offset="0%" stopColor="#FFDC80" />
                                  <stop offset="25%" stopColor="#F77737" />
                                  <stop offset="50%" stopColor="#E1306C" />
                                  <stop offset="75%" stopColor="#C13584" />
                                  <stop offset="100%" stopColor="#833AB4" />
                                </linearGradient>
                              </defs>
                              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                            </svg>
                            <span className="text-[10px] text-muted-foreground">Instagram</span>
                          </button>
                          
                          {/* TikTok */}
                          <button
                            onClick={() => handleSharePlatform("tiktok")}
                            className="flex flex-col items-center gap-1.5 p-2 rounded-lg bg-muted/30 border border-border/30 hover:bg-muted/50 transition-colors"
                          >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
                            </svg>
                            <span className="text-[10px] text-muted-foreground">TikTok</span>
                          </button>
                          
                          {/* X (Twitter) */}
                          <button
                            onClick={() => handleSharePlatform("twitter")}
                            className="flex flex-col items-center gap-1.5 p-2 rounded-lg bg-muted/30 border border-border/30 hover:bg-muted/50 transition-colors"
                          >
                            <svg className="w-4 h-4 text-foreground" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                            </svg>
                            <span className="text-[10px] text-muted-foreground">X</span>
                          </button>
                          
                          {/* LinkedIn */}
                          <button
                            onClick={() => handleSharePlatform("linkedin")}
                            className="flex flex-col items-center gap-1.5 p-2 rounded-lg bg-muted/30 border border-border/30 hover:bg-muted/50 transition-colors"
                          >
                            <svg className="w-4 h-4 text-[#0A66C2]" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                            </svg>
                            <span className="text-[10px] text-muted-foreground">LinkedIn</span>
                          </button>
                          
                          {/* Email */}
                          <button
                            onClick={() => handleSharePlatform("email")}
                            className="flex flex-col items-center gap-1.5 p-2 rounded-lg bg-muted/30 border border-border/30 hover:bg-muted/50 transition-colors"
                          >
                            <Mail className="w-4 h-4 text-muted-foreground" />
                            <span className="text-[10px] text-muted-foreground">Email</span>
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
