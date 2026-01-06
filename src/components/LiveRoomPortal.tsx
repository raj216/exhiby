import { useState, useRef, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { X, Users, Send, Gift, MessageCircle } from "lucide-react";
import { triggerClickHaptic } from "@/lib/haptics";
import { FloatingHearts, useFloatingHearts } from "./FloatingHearts";
import { LiveChatOverlay, useLiveChat } from "./LiveChatOverlay";
import { useLiveViewers } from "@/hooks/useLiveViewers";

interface LiveRoomPortalProps {
  eventId: string;
  coverImage: string;
  title: string;
  artistName: string;
  artistAvatar?: string;
  onClose: () => void;
}

export function LiveRoomPortal({
  eventId,
  coverImage,
  title,
  artistName,
  artistAvatar,
  onClose,
}: LiveRoomPortalProps) {
  const [showVideo, setShowVideo] = useState(false);
  const [showTipMenu, setShowTipMenu] = useState(false);
  const lastTapRef = useRef<number>(0);
  const { hearts, triggerHeart } = useFloatingHearts();
  const { messages } = useLiveChat();
  
  // Use real-time viewer count with join/leave logic
  const { viewerCount, joinAsViewer, leaveAsViewer } = useLiveViewers(eventId);

  // Join as viewer when component mounts
  useEffect(() => {
    console.log("[LiveRoomPortal] Mounting, joining as viewer...");
    joinAsViewer();

    return () => {
      console.log("[LiveRoomPortal] Unmounting, leaving as viewer...");
      leaveAsViewer();
    };
  }, [joinAsViewer, leaveAsViewer]);

  // Start video fade-in after portal animation
  useEffect(() => {
    const timer = setTimeout(() => setShowVideo(true), 400);
    return () => clearTimeout(timer);
  }, []);

  const handleDoubleTap = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    
    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
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

  const handleClose = useCallback(async () => {
    triggerClickHaptic();
    await leaveAsViewer();
    onClose();
  }, [leaveAsViewer, onClose]);

  return (
    <motion.div
      layoutId={`room-card-${eventId}`}
      className="fixed inset-0 z-50 bg-background overflow-hidden"
      style={{ borderRadius: 0 }}
      transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
    >
      {/* Responsive layout: mobile=full screen, desktop=side-by-side */}
      <div className="h-full w-full flex flex-col lg:flex-row">
        {/* Video Section - full width mobile, 2/3 desktop */}
        <div 
          className="relative flex-1 lg:flex-[2]"
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
            <img
              src={coverImage}
              alt={title}
              className="w-full h-full object-cover"
              style={{ filter: "brightness(1.1) contrast(1.05)" }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-black/20" />
          </motion.div>

          {/* Floating Hearts */}
          <FloatingHearts hearts={hearts} />

          {/* Top HUD - Mobile & Desktop */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.3 }}
            className="absolute top-0 left-0 right-0 z-50 p-4 lg:p-6"
            style={{ 
              background: "linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)",
              paddingTop: "max(16px, env(safe-area-inset-top))"
            }}
          >
            <div className="flex items-center justify-between">
              {/* Artist Info */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-full overflow-hidden border-2 border-primary/50">
                  <img
                    src={artistAvatar || coverImage}
                    alt={artistName}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm lg:text-base">{artistName}</p>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <div className="relative">
                        <div className="w-2 h-2 rounded-full bg-live" />
                        <div className="absolute inset-0 w-2 h-2 rounded-full bg-live animate-ping" />
                      </div>
                      <span className="text-xs font-bold text-white">LIVE</span>
                    </div>
                    <div className="flex items-center gap-1 text-white/70">
                      <Users className="w-3 h-3" />
                      <motion.span 
                        key={viewerCount}
                        initial={{ scale: 1.2 }}
                        animate={{ scale: 1 }}
                        className="text-xs"
                      >
                        {viewerCount}
                      </motion.span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Close Button */}
              <button
                onClick={handleClose}
                className="w-9 h-9 lg:w-10 lg:h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center mr-1 hover:bg-black/70 transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
          </motion.div>

          {/* Bottom Control Deck - Mobile Only */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.3 }}
            className="absolute bottom-0 left-0 right-0 z-50 lg:hidden"
            style={{ 
              height: "15%",
              minHeight: "100px",
              paddingBottom: "max(16px, env(safe-area-inset-bottom))"
            }}
          >
            <div 
              className="absolute inset-0 backdrop-blur-xl"
              style={{ background: "linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 100%)" }}
            />
            <div className="relative h-full px-4 py-3 flex items-end">
              <div className="flex-1">
                <LiveChatOverlay messages={messages} />
              </div>
              <div className="flex items-center gap-3">
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
                <button
                  onClick={() => triggerClickHaptic()}
                  className="w-11 h-11 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center"
                >
                  <Send className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Sidebar Panel - Desktop Only */}
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5, duration: 0.3 }}
          className="hidden lg:flex lg:flex-1 lg:flex-col bg-card border-l border-border"
        >
          {/* Event Info */}
          <div className="p-6 border-b border-border">
            <h2 className="font-display text-xl text-foreground mb-2">{title}</h2>
            <p className="text-sm text-muted-foreground">Studio session with {artistName}</p>
            <div className="flex items-center gap-2 mt-2 text-muted-foreground">
              <Users className="w-4 h-4" />
              <motion.span 
                key={viewerCount}
                initial={{ scale: 1.1 }}
                animate={{ scale: 1 }}
                className="text-sm"
              >
                {viewerCount} watching
              </motion.span>
            </div>
          </div>

          {/* Chat Messages - Scrollable */}
          <div className="flex-1 p-4 overflow-y-auto">
            <h3 className="text-sm font-semibold text-muted-foreground mb-4">Live Chat</h3>
            <div className="space-y-3">
              {messages.map((msg) => (
                <div key={msg.id} className="flex gap-2">
                  <div className="w-6 h-6 rounded-full bg-muted flex-shrink-0" />
                  <div>
                    <span className="text-xs font-semibold text-primary">{msg.username}</span>
                    <p className="text-sm text-foreground">{msg.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons - Desktop */}
          <div className="p-4 border-t border-border space-y-3">
            <button
              onClick={() => {
                triggerClickHaptic();
                setShowTipMenu(!showTipMenu);
              }}
              className="w-full py-3 rounded-xl bg-gradient-gold text-primary-foreground font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
            >
              <Gift className="w-5 h-5" />
              Send a Tip
            </button>
            <button
              onClick={() => triggerClickHaptic()}
              className="w-full py-3 rounded-xl bg-muted text-foreground font-semibold flex items-center justify-center gap-2 hover:bg-muted/80 transition-colors"
            >
              <Send className="w-5 h-5" />
              Share
            </button>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
