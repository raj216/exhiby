import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, ChevronDown } from "lucide-react";
import { triggerHaptic } from "@/lib/haptics";

interface ChatMessage {
  id: string;
  username: string;
  message: string;
  timestamp: number;
}

interface StudioChatProps {
  roomId: string;
  onClose: () => void;
}

// Mock messages for demo
const mockMessages: ChatMessage[] = [
  { id: "1", username: "ArtLover99", message: "Love the technique!", timestamp: Date.now() - 8000 },
  { id: "2", username: "SketchMaster", message: "What pencil grade is that?", timestamp: Date.now() - 5000 },
  { id: "3", username: "CreativeJen", message: "So calming to watch ✨", timestamp: Date.now() - 2000 },
];

export function StudioChat({ roomId, onClose }: StudioChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(mockMessages);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Simulate incoming messages
  useEffect(() => {
    const interval = setInterval(() => {
      const newMessages = [
        { username: "Watcher42", message: "Amazing work!" },
        { username: "ArtStudent", message: "Taking notes 📝" },
        { username: "PencilPro", message: "Beautiful shading" },
        { username: "CreativeFlow", message: "Inspiring session" },
      ];
      
      const randomMsg = newMessages[Math.floor(Math.random() * newMessages.length)];
      
      setMessages(prev => [
        ...prev,
        {
          id: `msg-${Date.now()}`,
          username: randomMsg.username,
          message: randomMsg.message,
          timestamp: Date.now(),
        }
      ]);
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  // Remove old messages (ephemeral feel)
  useEffect(() => {
    const cleanup = setInterval(() => {
      const fiveSecondsAgo = Date.now() - 5000;
      setMessages(prev => prev.filter(msg => msg.timestamp > fiveSecondsAgo));
    }, 1000);

    return () => clearInterval(cleanup);
  }, []);

  const handleClose = () => {
    triggerHaptic("light");
    inputRef.current?.blur(); // Dismiss keyboard
    onClose();
  };

  const handleSend = () => {
    if (!inputValue.trim()) return;
    
    triggerHaptic("light");
    
    setMessages(prev => [
      ...prev,
      {
        id: `msg-${Date.now()}`,
        username: "You",
        message: inputValue,
        timestamp: Date.now(),
      }
    ]);
    
    setInputValue("");
    
    // Dismiss keyboard and close chat after sending
    inputRef.current?.blur();
    onClose();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Handle background tap to dismiss
  const handleBackgroundTap = (e: React.MouseEvent) => {
    // Only close if tapping the background layer, not the chat content
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  return (
    <>
      {/* Transparent background tap layer - covers entire screen */}
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
          <div className="space-y-2 max-h-[60vh] overflow-hidden">
            <AnimatePresence mode="popLayout">
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, x: -10, y: 10 }}
                  animate={{ opacity: 1, x: 0, y: 0 }}
                  exit={{ opacity: 0, x: -10, transition: { duration: 0.2 } }}
                  layout
                  className="pointer-events-auto"
                >
                  <div className="inline-flex items-baseline gap-2 max-w-[90%]">
                    <span className="text-xs font-semibold text-white/90">
                      {msg.username}
                    </span>
                    <span className="text-sm text-white/80">
                      {msg.message}
                    </span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
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
            
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Say something..."
              className="flex-1 bg-transparent text-sm text-white placeholder:text-white/50 focus:outline-none"
              autoFocus
            />
            <button
              onClick={handleSend}
              disabled={!inputValue.trim()}
              className="p-1.5 rounded-full text-white/70 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}
