import { useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { X, Users, Send, Gift, MessageCircle } from "lucide-react";
import { triggerClickHaptic } from "@/lib/haptics";
import { FloatingHearts, useFloatingHearts } from "./FloatingHearts";
import { LiveChatOverlay, useLiveChat } from "./LiveChatOverlay";

interface LiveRoomPortalProps {
  eventId: string;
  coverImage: string;
  title: string;
  artistName: string;
  artistAvatar?: string;
  viewers: number;
  onClose: () => void;
}

export function LiveRoomPortal({
  eventId,
  coverImage,
  title,
  artistName,
  artistAvatar,
  viewers,
  onClose,
}: LiveRoomPortalProps) {
  const [showVideo, setShowVideo] = useState(false);
  const [showTipMenu, setShowTipMenu] = useState(false);
  const lastTapRef = useRef<number>(0);
  const { hearts, triggerHeart } = useFloatingHearts();
  const { messages } = useLiveChat();

  // Start video fade-in after portal animation
  useState(() => {
    const timer = setTimeout(() => setShowVideo(true), 400);
    return () => clearTimeout(timer);
  });

  const handleDoubleTap = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    
    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      // Double tap detected
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      let clientX: number, clientY: number;
      
      if ('touches' in e) {
        clientX = e.touches[0]?.clientX || rect.width / 2;
        clientY = e.touches[0]?.clientY || rect.height / 2;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }
      
      triggerHeart(clientX, clientY);
      triggerClickHaptic();
    }
    lastTapRef.current = now;
  }, [triggerHeart]);

  const handleClose = () => {
    triggerClickHaptic();
    onClose();
  };

  return (
    <motion.div
      layoutId={`room-card-${eventId}`}
      className="fixed inset-0 z-50 bg-background overflow-hidden"
      style={{ 
        borderRadius: 0,
        maxWidth: "448px",
        margin: "0 auto"
      }}
      transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
    >
      {/* Video/Image Layer */}
      <div 
        className="absolute inset-0"
        onClick={handleDoubleTap}
        onTouchEnd={handleDoubleTap}
      >
        {/* Cover Image (fades out) */}
        <motion.img
          src={coverImage}
          alt={title}
          className="w-full h-full object-cover"
          initial={{ opacity: 1 }}
          animate={{ opacity: showVideo ? 0 : 1 }}
          transition={{ duration: 0.5 }}
        />
        
        {/* Video Placeholder (fades in) */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-b from-obsidian/20 to-carbon/40"
          initial={{ opacity: 0 }}
          animate={{ opacity: showVideo ? 1 : 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Simulated live video feed - replace with Daily.co when ready */}
          <img
            src={coverImage}
            alt={title}
            className="w-full h-full object-cover"
            style={{ filter: "brightness(1.1) contrast(1.05)" }}
          />
          
          {/* Subtle video shimmer effect */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-black/20" />
        </motion.div>
      </div>

      {/* Floating Hearts */}
      <FloatingHearts hearts={hearts} />

      {/* Top HUD */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.3 }}
        className="absolute top-0 left-0 right-0 z-50 p-4 pt-safe"
        style={{ 
          background: "linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)",
          paddingTop: "max(16px, env(safe-area-inset-top))"
        }}
      >
        <div className="flex items-center justify-between">
          {/* Artist Info */}
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-primary/50">
              <img
                src={artistAvatar || coverImage}
                alt={artistName}
                className="w-full h-full object-cover"
              />
            </div>
            
            {/* Name & Status */}
            <div>
              <p className="text-white font-semibold text-sm">{artistName}</p>
              <div className="flex items-center gap-2">
                {/* LIVE Badge */}
                <div className="flex items-center gap-1.5">
                  <div className="relative">
                    <div className="w-2 h-2 rounded-full bg-live" />
                    <div className="absolute inset-0 w-2 h-2 rounded-full bg-live animate-ping" />
                  </div>
                  <span className="text-xs font-bold text-white">LIVE</span>
                </div>
                
                {/* Viewers */}
                <div className="flex items-center gap-1 text-white/70">
                  <Users className="w-3 h-3" />
                  <span className="text-xs">{viewers}</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Close Button - offset from corner for reachability */}
          <button
            onClick={handleClose}
            className="w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center mr-1"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
      </motion.div>

      {/* Bottom Control Deck - Glassmorphism */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.3 }}
        className="absolute bottom-0 left-0 right-0 z-50"
        style={{ 
          height: "15%",
          minHeight: "100px",
          paddingBottom: "max(16px, env(safe-area-inset-bottom))"
        }}
      >
        {/* Glass background */}
        <div 
          className="absolute inset-0 backdrop-blur-xl"
          style={{ 
            background: "linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 100%)"
          }}
        />
        
        {/* Content */}
        <div className="relative h-full px-4 py-3 flex items-end">
          {/* Chat Messages - Left */}
          <div className="flex-1">
            <LiveChatOverlay messages={messages} />
          </div>
          
          {/* Action Buttons - Right */}
          <div className="flex items-center gap-3">
            {/* Tip/Shop Button - Gold */}
            <div className="relative">
              <button
                onClick={() => {
                  triggerClickHaptic();
                  setShowTipMenu(!showTipMenu);
                }}
                className="w-11 h-11 rounded-full bg-gradient-gold flex items-center justify-center shadow-gold"
              >
                <Gift className="w-5 h-5 text-primary-foreground" />
              </button>
              
              {/* Tip Menu */}
              {showTipMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  className="absolute bottom-14 right-0 bg-card rounded-xl shadow-deep overflow-hidden min-w-[140px]"
                >
                  <button 
                    className="w-full px-4 py-3 text-left text-sm text-foreground hover:bg-muted/50 transition-colors"
                    onClick={() => {
                      triggerClickHaptic();
                      setShowTipMenu(false);
                    }}
                  >
                    💰 Tip $5
                  </button>
                  <button 
                    className="w-full px-4 py-3 text-left text-sm text-foreground hover:bg-muted/50 transition-colors border-t border-border"
                    onClick={() => {
                      triggerClickHaptic();
                      setShowTipMenu(false);
                    }}
                  >
                    🎨 Buy Artwork
                  </button>
                </motion.div>
              )}
            </div>
            
            {/* Share Button */}
            <button
              onClick={() => triggerClickHaptic()}
              className="w-11 h-11 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center"
            >
              <Send className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
