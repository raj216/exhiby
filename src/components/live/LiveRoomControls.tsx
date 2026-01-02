import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageCircle,
  Hand,
  Palette,
  CreditCard,
  PhoneOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  X,
} from "lucide-react";
import { SlideToAction } from "@/components/SlideToAction";

interface LiveRoomControlsProps {
  isHost: boolean;
  isCameraOn: boolean;
  isMicOn: boolean;
  isUIVisible: boolean;
  onToggleCamera: () => void;
  onToggleMic: () => void;
  onEndStream: () => void;
  onOpenChat: () => void;
  onRaiseHand: () => void;
  onOpenMaterials: () => void;
  onSwipeToPay: () => void;
  handRaised: boolean;
}

export function LiveRoomControls({
  isHost,
  isCameraOn,
  isMicOn,
  isUIVisible,
  onToggleCamera,
  onToggleMic,
  onEndStream,
  onOpenChat,
  onRaiseHand,
  onOpenMaterials,
  onSwipeToPay,
  handRaised,
}: LiveRoomControlsProps) {
  const [showPayCTA, setShowPayCTA] = useState(false);

  const handlePayTrigger = () => {
    setShowPayCTA(true);
  };

  const handlePayComplete = () => {
    onSwipeToPay();
    setShowPayCTA(false);
  };

  return (
    <AnimatePresence>
      {isUIVisible && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.2 }}
          className="absolute bottom-0 left-0 right-0 z-20 p-4 pb-6"
          style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}
        >
          {/* Swipe to Pay CTA */}
          <AnimatePresence>
            {showPayCTA && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="mb-4"
              >
                <div className="relative">
                  <button
                    onClick={() => setShowPayCTA(false)}
                    className="absolute -top-2 -right-2 z-10 w-6 h-6 rounded-full bg-surface flex items-center justify-center"
                  >
                    <X className="w-4 h-4 text-foreground" />
                  </button>
                  <SlideToAction
                    label="Slide to Support"
                    onComplete={handlePayComplete}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Control Bar - Frosted Glass Pill */}
          <div className="flex items-center justify-center gap-2">
            <div className="flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-black/40 backdrop-blur-xl border border-white/10">
              {/* Host Controls */}
              {isHost && (
                <>
                  <button
                    onClick={onToggleMic}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                      isMicOn
                        ? "bg-white/10 text-white hover:bg-white/20"
                        : "bg-destructive/80 text-white hover:bg-destructive"
                    }`}
                  >
                    {isMicOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                  </button>
                  
                  <button
                    onClick={onToggleCamera}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                      isCameraOn
                        ? "bg-white/10 text-white hover:bg-white/20"
                        : "bg-destructive/80 text-white hover:bg-destructive"
                    }`}
                  >
                    {isCameraOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                  </button>

                  <div className="w-px h-6 bg-white/20 mx-1" />
                </>
              )}

              {/* Common Controls */}
              <button
                onClick={onOpenChat}
                className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
              >
                <MessageCircle className="w-5 h-5" />
              </button>

              {!isHost && (
                <button
                  onClick={onRaiseHand}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                    handRaised
                      ? "bg-gold/80 text-background"
                      : "bg-white/10 text-white hover:bg-white/20"
                  }`}
                >
                  <Hand className="w-5 h-5" />
                </button>
              )}

              <button
                onClick={onOpenMaterials}
                className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
              >
                <Palette className="w-5 h-5" />
              </button>

              {!isHost && (
                <button
                  onClick={handlePayTrigger}
                  className="w-10 h-10 rounded-full bg-gold/80 flex items-center justify-center text-background hover:bg-gold transition-colors"
                >
                  <CreditCard className="w-5 h-5" />
                </button>
              )}

              {/* End Stream (Host only) */}
              {isHost && (
                <>
                  <div className="w-px h-6 bg-white/20 mx-1" />
                  <button
                    onClick={onEndStream}
                    className="w-10 h-10 rounded-full bg-destructive flex items-center justify-center text-white hover:bg-destructive/80 transition-colors"
                  >
                    <PhoneOff className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
