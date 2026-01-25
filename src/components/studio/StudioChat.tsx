import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, ChevronDown, Loader2, AlertCircle, Wifi, WifiOff } from "lucide-react";
import { format } from "date-fns";
import { triggerHaptic } from "@/lib/haptics";
import { useLiveChat, type LiveMessage } from "@/hooks/useLiveChat";
import { useAuth } from "@/contexts/AuthContext";

interface StudioChatProps {
  eventId: string;
  creatorId: string;
  onClose: () => void;
  /** For audience: pass true once they have joined as a viewer (live_viewers record exists) */
  isViewerReady?: boolean;
}

export function StudioChat({ eventId, creatorId, onClose, isViewerReady = false }: StudioChatProps) {
  const { user } = useAuth();
  const {
    messages,
    status,
    isSending,
    sendMessage,
    retryMessage,
    removeFailedMessage,
    openChat,
    closeChat,
  } = useLiveChat({ eventId, creatorId, isViewerReady });
  
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);

  // Mark chat as open when component mounts
  useEffect(() => {
    openChat();
    return () => closeChat();
  }, [openChat, closeChat]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (isNearBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isNearBottom]);

  const handleClose = () => {
    triggerHaptic("light");
    inputRef.current?.blur();
    onClose();
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isSending) return;
    
    triggerHaptic("light");
    const messageToSend = inputValue.trim();
    setInputValue(""); // Clear immediately for snappy UX
    
    const success = await sendMessage(messageToSend);
    if (!success) {
      // Restore input if send failed
      setInputValue(messageToSend);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleRetry = async (clientId: string) => {
    triggerHaptic("light");
    await retryMessage(clientId);
  };

  const handleRemove = (clientId: string) => {
    triggerHaptic("light");
    removeFailedMessage(clientId);
  };

  // Handle background tap to dismiss
  const handleBackgroundTap = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  // Connection status indicator
  const ConnectionIndicator = () => {
    if (status === "connected") {
      return (
        <div className="flex items-center gap-1 text-emerald-400/80">
          <Wifi className="w-3 h-3" />
        </div>
      );
    }
    if (status === "connecting") {
      return (
        <div className="flex items-center gap-1 text-amber-400/80">
          <Loader2 className="w-3 h-3 animate-spin" />
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1 text-red-400/80">
        <WifiOff className="w-3 h-3" />
      </div>
    );
  };

  return (
    <>
      {/* Transparent background tap layer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 z-5"
        onClick={handleBackgroundTap}
      />
      
      {/* Chat overlay */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="absolute left-0 top-0 bottom-0 w-full sm:w-80 lg:w-96 z-10 pointer-events-none"
      >
        {/* Gradient overlay for readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent pointer-events-none" />

        {/* Chat messages container */}
        <div className="relative h-full flex flex-col justify-end p-4 pb-24">
          <div className="space-y-2 max-h-[60vh] overflow-y-auto scrollbar-hide">
            <AnimatePresence mode="popLayout">
              {messages.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-white/40 text-sm text-center py-4 pointer-events-auto"
                >
                  No messages yet
                </motion.div>
              ) : (
                messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, x: -10, y: 10 }}
                    animate={{ 
                      opacity: msg._status === "sending" ? 0.6 : 1, 
                      x: 0, 
                      y: 0 
                    }}
                    exit={{ opacity: 0, x: -10, transition: { duration: 0.2 } }}
                    layout
                    className="pointer-events-auto"
                  >
                    <div className={`inline-flex flex-col max-w-[90%] ${
                      msg._status === "failed" ? "opacity-60" : ""
                    }`}>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-semibold ${
                          msg.role === "creator" ? "text-gold" : "text-white/90"
                        }`}>
                          {msg.display_name || "Viewer"}
                          {msg.role === "creator" && " ★"}
                        </span>
                        <span className="text-[10px] text-white/30">
                          {format(new Date(msg.created_at), "HH:mm")}
                        </span>
                        {msg._status === "sending" && (
                          <Loader2 className="w-2.5 h-2.5 text-white/40 animate-spin" />
                        )}
                        {msg._status === "failed" && (
                          <div className="flex items-center gap-1 text-red-400 text-[10px]">
                            <AlertCircle className="w-2.5 h-2.5" />
                            <button
                              onClick={() => msg._clientId && handleRetry(msg._clientId)}
                              className="underline hover:text-red-300"
                            >
                              Retry
                            </button>
                            <button
                              onClick={() => msg._clientId && handleRemove(msg._clientId)}
                              className="underline hover:text-red-300"
                            >
                              ×
                            </button>
                          </div>
                        )}
                      </div>
                      <span className="text-sm text-white/80">
                        {msg.message}
                      </span>
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input bar - fixed at bottom */}
        <div className="absolute bottom-4 left-4 right-4 sm:right-auto sm:w-72 lg:w-80 pointer-events-auto">
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-full bg-black/40 backdrop-blur-xl border border-white/10">
            {/* Close chat button */}
            <button
              onClick={handleClose}
              className="p-1.5 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              title="Close chat"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
            
            <ConnectionIndicator />
            
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value.slice(0, 200))}
              onKeyDown={handleKeyPress}
              placeholder={user ? "Say something..." : "Sign in to chat"}
              disabled={!user || isSending}
              maxLength={200}
              className="flex-1 bg-transparent text-sm text-white placeholder:text-white/50 focus:outline-none disabled:opacity-50"
              autoFocus
            />
            <button
              onClick={handleSend}
              disabled={!inputValue.trim() || isSending || !user}
              className="p-1.5 rounded-full text-white/70 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {isSending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
          {inputValue.length > 150 && (
            <div className="text-right text-[10px] text-white/40 mt-1 pr-2">
              {inputValue.length}/200
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}
