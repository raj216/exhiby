import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, X } from "lucide-react";

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
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
}

export function LiveRoomChat({
  isOpen,
  onClose,
  messages,
  onSendMessage,
}: LiveRoomChatProps) {
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSend = () => {
    if (inputValue.trim()) {
      onSendMessage(inputValue.trim());
      setInputValue("");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
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
            background: "linear-gradient(to right, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.6) 70%, transparent 100%)",
            paddingTop: "max(80px, env(safe-area-inset-top) + 60px)",
            paddingBottom: "max(100px, env(safe-area-inset-bottom) + 80px)",
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 pb-3 border-b border-white/10">
            <h3 className="text-white font-semibold">Live Chat</h3>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-wrap items-baseline gap-1.5"
                >
                  <span className="text-electric font-medium text-sm shrink-0">
                    {msg.username}
                  </span>
                  {msg.isHost && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-gold/20 text-gold border border-gold/30">
                      Host
                    </span>
                  )}
                  <span className="text-white/50 text-sm">:</span>
                  <span className="text-white/90 text-sm break-words">
                    {msg.message}
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-4 pt-3 border-t border-white/10">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Say something..."
                className="flex-1 h-10 px-4 rounded-full bg-white/10 border border-white/10 text-white placeholder:text-white/50 text-sm focus:outline-none focus:border-electric/50"
              />
              <button
                onClick={handleSend}
                disabled={!inputValue.trim()}
                className="w-10 h-10 rounded-full bg-electric flex items-center justify-center text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-electric/90 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
