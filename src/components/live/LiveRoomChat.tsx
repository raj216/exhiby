import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, X, Wifi, WifiOff, Loader2 } from "lucide-react";
import { format } from "date-fns";
import type { LiveMessage } from "@/hooks/useLiveChat";

// Legacy type for backwards compatibility
export interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  message: string;
  timestamp: Date;
  isHost: boolean;
}

interface LiveRoomChatProps {
  isOpen: boolean;
  onClose: () => void;
  // New realtime chat props
  messages?: LiveMessage[];
  status?: "disconnected" | "connecting" | "connected";
  messageCount?: number;
  onSendMessage: (message: string) => void | Promise<boolean>;
  isAuthenticated?: boolean;
}

export function LiveRoomChat({
  isOpen,
  onClose,
  messages = [],
  status = "disconnected",
  messageCount = 0,
  onSendMessage,
  isAuthenticated = true,
}: LiveRoomChatProps) {
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);

  // Check if user is near bottom of chat
  const checkIfNearBottom = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return true;
    const threshold = 100; // pixels from bottom
    return container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
  }, []);

  // Handle scroll to update isNearBottom
  const handleScroll = useCallback(() => {
    setIsNearBottom(checkIfNearBottom());
  }, [checkIfNearBottom]);

  // Auto-scroll to bottom when new messages arrive (only if near bottom)
  useEffect(() => {
    if (isNearBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isNearBottom]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSend = async () => {
    if (!inputValue.trim() || isSending) return;

    setIsSending(true);
    const result = await onSendMessage(inputValue.trim());
    setIsSending(false);

    if (result !== false) {
      setInputValue("");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Status indicator component
  const StatusIndicator = () => {
    if (status === "connected") {
      return (
        <div className="flex items-center gap-1.5 text-emerald-400">
          <Wifi className="w-3 h-3" />
          <span className="text-[10px] uppercase tracking-wider font-medium">Live</span>
          <span className="text-white/40 text-[10px]">• {messageCount}</span>
        </div>
      );
    }
    if (status === "connecting") {
      return (
        <div className="flex items-center gap-1.5 text-amber-400">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span className="text-[10px] uppercase tracking-wider">Connecting…</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5 text-red-400">
        <WifiOff className="w-3 h-3" />
        <span className="text-[10px] uppercase tracking-wider">Disconnected</span>
      </div>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          className="absolute left-0 top-0 bottom-0 z-30 w-full max-w-sm lg:max-w-md flex flex-col"
          style={{
            background:
              "linear-gradient(to right, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.6) 70%, transparent 100%)",
            paddingTop: "max(80px, env(safe-area-inset-top) + 60px)",
            paddingBottom: "max(100px, env(safe-area-inset-bottom) + 80px)",
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 pb-3 border-b border-white/10">
            <div className="flex items-center gap-3">
              <h3 className="text-white font-semibold">Live Chat</h3>
              <StatusIndicator />
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>

          {/* Messages */}
          <div
            ref={messagesContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
          >
            {messages.length === 0 ? (
              <div className="text-center text-white/40 text-sm py-8">
                No messages yet. Be the first to say something!
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col gap-0.5"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-electric font-medium text-sm shrink-0">
                        {msg.display_name || "Viewer"}
                      </span>
                      {msg.role === "creator" && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-gold/20 text-gold border border-gold/30">
                          Host
                        </span>
                      )}
                      <span className="text-white/30 text-[10px] ml-auto">
                        {format(new Date(msg.created_at), "HH:mm")}
                      </span>
                    </div>
                    <span className="text-white/90 text-sm break-words">{msg.message}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-4 pt-3 border-t border-white/10">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value.slice(0, 200))}
                onKeyPress={handleKeyPress}
                placeholder={isAuthenticated ? "Say something…" : "Sign in to chat"}
                disabled={!isAuthenticated || isSending}
                maxLength={200}
                className="flex-1 h-10 px-4 rounded-full bg-white/10 border border-white/10 text-white placeholder:text-white/50 text-sm focus:outline-none focus:border-electric/50 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <button
                onClick={handleSend}
                disabled={!inputValue.trim() || isSending || !isAuthenticated}
                className="w-10 h-10 rounded-full bg-electric flex items-center justify-center text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-electric/90 transition-colors"
              >
                {isSending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
            {inputValue.length > 150 && (
              <div className="text-right text-[10px] text-white/40 mt-1">
                {inputValue.length}/200
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
