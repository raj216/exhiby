import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageCircle,
  Hand,
  Palette,
  DollarSign,
  Mic,
  MicOff,
  Video,
  VideoOff,
  SwitchCamera,
  Smartphone,
  Share2,
  LogOut,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface LiveRoomControlsProps {
  isHost: boolean;
  isCameraOn: boolean;
  isMicOn: boolean;
  isUIVisible: boolean;
  isEnding?: boolean;
  onToggleCamera: () => void;
  onSwitchCamera?: () => void;
  onToggleMic: () => void;
  onEndStream: () => void;
  onLeave?: () => void;
  onOpenChat: () => void;
  onRaiseHand: () => void;
  onOpenMaterials: () => void;
  onSwipeToPay: () => void;
  handRaised: boolean;
  unreadChatCount?: number;
  // Hand raises for creator
  handRaiseCount?: number;
  onOpenHandRaises?: () => void;
  // Studio camera (second camera via phone QR)
  onOpenStudioCamera?: () => void;
  studioCameraConnected?: boolean;
  onShare?: () => void;
}

export function LiveRoomControls({
  isHost,
  isCameraOn,
  isMicOn,
  isUIVisible,
  isEnding = false,
  onToggleCamera,
  onSwitchCamera,
  onToggleMic,
  onEndStream,
  onLeave,
  onOpenChat,
  onRaiseHand,
  onOpenMaterials,
  onSwipeToPay,
  handRaised,
  unreadChatCount = 0,
  handRaiseCount = 0,
  onOpenHandRaises,
  onOpenStudioCamera,
  studioCameraConnected = false,
  onShare,
}: LiveRoomControlsProps) {
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    };
  }, []);

  const armEndConfirm = () => {
    setShowEndConfirm(true);
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    // Give more time on mobile/tablet to hit the 2nd tap
    confirmTimerRef.current = setTimeout(() => setShowEndConfirm(false), 5500);
  };

  const handleEndStream = () => {
    if (isEnding) return;

    if (showEndConfirm) {
      setShowEndConfirm(false);
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      onEndStream();
      return;
    }

    armEndConfirm();
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
          {/* End Stream Confirmation (Host) */}
          <AnimatePresence>
            {isHost && showEndConfirm && !isEnding && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="mb-4 flex justify-center"
              >
                <button
                  onClick={handleEndStream}
                  className="px-6 py-3 rounded-full bg-destructive text-white font-semibold hover:bg-destructive/90 transition-colors shadow-lg"
                >
                  Tap again to end stream
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Control Bar - Frosted Glass Pill */}
          <TooltipProvider delayDuration={300}>
            <div className="flex items-center justify-center gap-2">
              <div className="flex items-center gap-1 sm:gap-1.5 px-2.5 py-2 sm:px-4 sm:py-2.5 rounded-full bg-black/40 backdrop-blur-xl border border-white/10">
                {/* HOST Controls */}
                {isHost && (
                  <>
                    {/* Mic Toggle */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={onToggleMic}
                          disabled={isEnding}
                          className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-colors disabled:opacity-60 disabled:pointer-events-none ${
                            isMicOn
                              ? "bg-white/10 text-white hover:bg-white/20"
                              : "bg-destructive/80 text-white hover:bg-destructive"
                          }`}
                        >
                          {isMicOn ? (
                            <Mic className="w-5 h-5" />
                          ) : (
                            <MicOff className="w-5 h-5" />
                          )}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p>{isMicOn ? "Mute" : "Unmute"}</p>
                      </TooltipContent>
                    </Tooltip>

                    {/* Camera Toggle */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={onToggleCamera}
                          disabled={isEnding}
                          className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors disabled:opacity-60 disabled:pointer-events-none ${
                            isCameraOn
                              ? "bg-white/10 text-white hover:bg-white/20"
                              : "bg-destructive/80 text-white hover:bg-destructive"
                          }`}
                        >
                          {isCameraOn ? (
                            <Video className="w-5 h-5" />
                          ) : (
                            <VideoOff className="w-5 h-5" />
                          )}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p>{isCameraOn ? "Turn off camera" : "Turn on camera"}</p>
                      </TooltipContent>
                    </Tooltip>

                    {/* Switch front/back camera (mobile) */}
                    {onSwitchCamera && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={onSwitchCamera}
                            disabled={isEnding}
                            className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors disabled:opacity-60 disabled:pointer-events-none"
                          >
                            <SwitchCamera className="w-5 h-5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          <p>Switch camera</p>
                        </TooltipContent>
                      </Tooltip>
                    )}

                    {/* Studio Camera (phone as second camera) */}
                    {onOpenStudioCamera && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={onOpenStudioCamera}
                            disabled={isEnding}
                            className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-colors disabled:opacity-60 disabled:pointer-events-none ${
                              studioCameraConnected
                                ? "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                                : "bg-white/10 text-white hover:bg-white/20"
                            }`}
                          >
                            <Smartphone className="w-5 h-5" />
                            {studioCameraConnected && (
                              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-green-400 ring-2 ring-black/40" />
                            )}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          <p>{studioCameraConnected ? "Studio camera connected" : "Add studio camera"}</p>
                        </TooltipContent>
                      </Tooltip>
                    )}

                    <div className="w-px h-6 bg-white/20 mx-1" />
                  </>
                )}

                {/* Chat - Both Host and Viewer */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={onOpenChat}
                      disabled={isEnding}
                      className="relative w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors disabled:opacity-60 disabled:pointer-events-none"
                    >
                      <MessageCircle className="w-5 h-5" />
                      {/* Unread badge */}
                      {unreadChatCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white border-2 border-black/40">
                          {unreadChatCount > 9 ? "9+" : unreadChatCount}
                        </span>
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p>Chat</p>
                  </TooltipContent>
                </Tooltip>

                {/* Materials - Both Host and Viewer */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={onOpenMaterials}
                      disabled={isEnding}
                      className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors disabled:opacity-60 disabled:pointer-events-none"
                    >
                      <Palette className="w-5 h-5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p>Materials</p>
                  </TooltipContent>
                </Tooltip>

                {/* Share — Both Host and Viewer */}
                {onShare && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={onShare}
                        disabled={isEnding}
                        className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors disabled:opacity-60 disabled:pointer-events-none"
                      >
                        <Share2 className="w-5 h-5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p>Share live link</p>
                    </TooltipContent>
                  </Tooltip>
                )}

                {/* Hand Raises - Host Only */}
                {isHost && onOpenHandRaises && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={onOpenHandRaises}
                        disabled={isEnding}
                        className="relative w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors disabled:opacity-60 disabled:pointer-events-none"
                      >
                        <Hand className="w-5 h-5" />
                        {/* Badge for raised hands count */}
                        {handRaiseCount > 0 && (
                          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-gold text-[10px] font-bold text-background border-2 border-black/40">
                            {handRaiseCount > 9 ? "9+" : handRaiseCount}
                          </span>
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p>Raised Hands</p>
                    </TooltipContent>
                  </Tooltip>
                )}

                {!isHost && (
                  <>
                    {/* Raise Hand */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={onRaiseHand}
                          disabled={isEnding}
                          className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors disabled:opacity-60 disabled:pointer-events-none ${
                            handRaised
                              ? "bg-gold/80 text-background"
                              : "bg-white/10 text-white hover:bg-white/20"
                          }`}
                        >
                          <Hand className="w-5 h-5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p>{handRaised ? "Lower hand" : "Raise hand"}</p>
                      </TooltipContent>
                    </Tooltip>

                    {/* Tip Button */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={onSwipeToPay}
                          disabled={isEnding}
                          className="w-10 h-10 rounded-full bg-gold/80 flex items-center justify-center text-background hover:bg-gold transition-colors disabled:opacity-60 disabled:pointer-events-none"
                        >
                          <DollarSign className="w-5 h-5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p>Tip</p>
                      </TooltipContent>
                    </Tooltip>

                    <div className="w-px h-6 bg-white/20 mx-1" />

                    {/* Leave Button (Viewer) */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={onLeave || onEndStream}
                          disabled={isEnding}
                          className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors disabled:opacity-60 disabled:pointer-events-none"
                        >
                          <LogOut className="w-5 h-5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p>Leave</p>
                      </TooltipContent>
                    </Tooltip>
                  </>
                )}

                {/* HOST End Stream Button */}
                {isHost && (
                  <>
                    <div className="w-px h-6 bg-white/20 mx-1" />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={handleEndStream}
                          disabled={isEnding}
                          className={`px-4 h-10 rounded-full flex items-center justify-center gap-2 font-medium transition-colors disabled:opacity-70 disabled:pointer-events-none ${
                            isEnding
                              ? "bg-destructive text-white"
                              : showEndConfirm
                                ? "bg-destructive text-white"
                                : "bg-destructive/80 text-white hover:bg-destructive"
                          }`}
                        >
                          <span className="text-sm">{isEnding ? "Ending..." : "End Stream"}</span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p>End Stream</p>
                      </TooltipContent>
                    </Tooltip>
                  </>
                )}
              </div>
            </div>
          </TooltipProvider>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
