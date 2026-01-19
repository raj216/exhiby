import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, MessageCircle, Palette, Camera, Hand, Users } from "lucide-react";
import { triggerHaptic, triggerSuccessHaptic } from "@/lib/haptics";
import { toast } from "@/hooks/use-toast";
import { StudioChat } from "./StudioChat";
import { MaterialsDrawer } from "./MaterialsDrawer";
import { useLiveViewers } from "@/hooks/useLiveViewers";

// Room data model
export interface StudioRoom {
  id: string;
  title: string;
  isLive: boolean;
  artistName: string;
  artistAvatar?: string;
  coverImage: string;
  materials: string[];
  price: number;
  viewers: number;
}

interface LiveStudioViewProps {
  room: StudioRoom;
  onClose: () => void;
}

export function LiveStudioView({ room, onClose }: LiveStudioViewProps) {
  const [isUIVisible, setIsUIVisible] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [showMaterials, setShowMaterials] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const videoRef = useRef<HTMLDivElement>(null);
  
  // Track viewer presence
  const { viewerCount, joinAsViewer, leaveAsViewer, isJoined } = useLiveViewers(room.id);
  
  // Join as viewer when entering
  useEffect(() => {
    joinAsViewer();
    return () => {
      leaveAsViewer();
    };
  }, [joinAsViewer, leaveAsViewer]);

  // Auto-hide UI after 3 seconds of inactivity
  const resetHideTimer = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }
    setIsUIVisible(true);
    hideTimeoutRef.current = setTimeout(() => {
      // Don't hide if chat or materials are open
      if (!showChat && !showMaterials) {
        setIsUIVisible(false);
      }
    }, 3000);
  }, [showChat, showMaterials]);

  // Show UI on interaction
  const handleInteraction = useCallback(() => {
    resetHideTimer();
  }, [resetHideTimer]);

  // Handle tap/click to toggle UI
  const handleScreenTap = useCallback(() => {
    if (!isUIVisible) {
      triggerHaptic("light");
      resetHideTimer();
    }
  }, [isUIVisible, resetHideTimer]);

  // Desktop: mouse move shows UI
  useEffect(() => {
    const handleMouseMove = () => handleInteraction();
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [handleInteraction]);

  // Initial show + auto-hide setup
  useEffect(() => {
    resetHideTimer();
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, [resetHideTimer]);

  // Keep UI visible when overlays are open
  useEffect(() => {
    if (showChat || showMaterials) {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    } else {
      resetHideTimer();
    }
  }, [showChat, showMaterials, resetHideTimer]);

  const handleClose = () => {
    triggerHaptic("medium");
    leaveAsViewer();
    onClose();
  };

  const handleToggleChat = () => {
    triggerHaptic("light");
    setShowChat(!showChat);
    setShowMaterials(false);
  };

  const handleToggleMaterials = () => {
    triggerHaptic("light");
    setShowMaterials(!showMaterials);
    setShowChat(false);
  };

  const handleSnap = async () => {
    triggerSuccessHaptic();
    
    // Hide all UI for clean capture first
    setIsUIVisible(false);
    setShowChat(false);
    setShowMaterials(false);

    // Wait for UI to hide completely
    await new Promise(resolve => setTimeout(resolve, 150));
    
    // Show flash effect
    setIsCapturing(true);

    try {
      // Find the image element and capture it using canvas
      const imgElement = videoRef.current?.querySelector('img') as HTMLImageElement;
      
      if (imgElement && imgElement.complete) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (ctx) {
          // Set canvas size to image natural dimensions for high quality
          canvas.width = imgElement.naturalWidth || imgElement.width;
          canvas.height = imgElement.naturalHeight || imgElement.height;
          
          // Draw the image to canvas
          ctx.drawImage(imgElement, 0, 0, canvas.width, canvas.height);
          
          // Convert canvas to blob and trigger download
          canvas.toBlob((blob) => {
            if (blob) {
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = `exhiby-snap-${room.title.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.png`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(url);
              
              toast({
                title: "📸 Snap saved!",
                description: "Clean artwork captured to your gallery.",
              });
            }
          }, 'image/png', 1.0);
        }
      } else {
        throw new Error('Image not loaded');
      }
    } catch (error) {
      console.error('Capture error:', error);
      toast({
        title: "Capture failed",
        description: "Could not save the image.",
        variant: "destructive",
      });
    }

    // Hide flash and restore UI
    setTimeout(() => {
      setIsCapturing(false);
      setIsUIVisible(true);
    }, 200);
  };

  const handleRaiseHand = () => {
    triggerHaptic("medium");
    const newState = !handRaised;
    setHandRaised(newState);
    
    if (newState) {
      // Emit event/notification to host (mock for now)
      const questionEvent = {
        type: "HAND_RAISED",
        roomId: room.id,
        userId: "current-user-id", // Would come from auth
        userName: "You", // Would come from auth
        timestamp: new Date().toISOString(),
      };
      console.log("Question event sent:", questionEvent);
      
      toast({
        title: "🖐️ Hand raised!",
        description: "The artist will see your question request.",
      });
    } else {
      toast({
        title: "Hand lowered",
        description: "Question request cancelled.",
      });
    }
  };

  const toolbeltButtons = [
    { 
      icon: MessageCircle, 
      label: "Chat", 
      onClick: handleToggleChat, 
      active: showChat 
    },
    { 
      icon: Palette, 
      label: "Materials", 
      onClick: handleToggleMaterials, 
      active: showMaterials 
    },
    { 
      icon: Camera, 
      label: "Snap", 
      onClick: handleSnap, 
      active: false 
    },
    { 
      icon: Hand, 
      label: "Raise Hand", 
      onClick: handleRaiseHand, 
      active: handRaised 
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-50 bg-black"
      onClick={handleScreenTap}
    >
      {/* Video/Stream Container - Full screen immersive */}
      <div 
        ref={videoRef}
        className="absolute inset-0 flex items-center justify-center"
      >
        {/* Simulated live video - would be replaced with actual stream */}
        <img
          src={room.coverImage}
          alt={room.title}
          className="w-full h-full object-cover"
        />
        
        {/* Subtle vignette for depth */}
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.4)_100%)]" />
      </div>

      {/* Chat Overlay - Left side, transparent */}
      <AnimatePresence>
        {showChat && (
          <StudioChat 
            eventId={room.id}
            creatorId={room.id} // TODO: Pass actual creator ID when available
            onClose={() => setShowChat(false)}
          />
        )}
      </AnimatePresence>

      {/* Materials Drawer - Slide from right */}
      <AnimatePresence>
        {showMaterials && (
          <MaterialsDrawer
            materials={room.materials}
            artistName={room.artistName}
            onClose={() => setShowMaterials(false)}
          />
        )}
      </AnimatePresence>

      {/* UI Overlay - Only visible in Active state */}
      {/* Top Bar - Hide when Materials is open */}
      <AnimatePresence>
        {isUIVisible && !isCapturing && !showMaterials && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="absolute top-0 left-0 right-0 p-4 sm:p-6 flex items-center justify-between z-20"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Left: Live Indicator + Viewer Count */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-live opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-live"></span>
                </span>
                <span className="text-xs font-medium text-white uppercase tracking-wider">Live</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10">
                <Users className="w-3.5 h-3.5 text-white/70" />
                <motion.span 
                  key={viewerCount}
                  initial={{ scale: 1.2 }}
                  animate={{ scale: 1 }}
                  className="text-xs font-medium text-white"
                >
                  {viewerCount}
                </motion.span>
              </div>
            </div>

            {/* Center: Title (fades in/out) */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="absolute left-1/2 -translate-x-1/2 max-w-[50%]"
            >
              <h1 className="text-sm sm:text-base font-medium text-white/90 truncate text-center">
                {room.title}
              </h1>
            </motion.div>

            {/* Right: Close Button */}
            <button
              onClick={handleClose}
              className="p-2 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white/80 hover:text-white hover:bg-black/60 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Toolbelt - Hide when Chat is open */}
      <AnimatePresence>
        {isUIVisible && !isCapturing && !showChat && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="absolute bottom-6 sm:bottom-8 left-0 right-0 flex justify-center z-20 px-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 sm:gap-3 px-4 sm:px-5 py-3 sm:py-3.5 rounded-full bg-black/30 backdrop-blur-xl border border-white/10 shadow-2xl">
              {toolbeltButtons.map((button, index) => (
                <button
                  key={button.label}
                  onClick={button.onClick}
                  className={`
                    relative p-3 sm:p-3.5 rounded-full transition-all duration-200
                    ${button.active 
                      ? "bg-white/20 text-white" 
                      : "text-white/70 hover:text-white hover:bg-white/10"
                    }
                  `}
                  title={button.label}
                >
                  <button.icon className="w-5 h-5 sm:w-6 sm:h-6" />
                  
                  {/* Active indicator dot */}
                  {button.active && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white"
                    />
                  )}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Capture flash effect */}
      <AnimatePresence>
        {isCapturing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
            className="absolute inset-0 bg-white z-50 pointer-events-none"
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
