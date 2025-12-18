import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ChatMessage {
  id: string;
  username: string;
  message: string;
  timestamp: number;
}

const MOCK_MESSAGES = [
  { username: "artlover23", message: "This is incredible! 🎨" },
  { username: "creativemind", message: "Love the brush technique" },
  { username: "painter_pro", message: "What brush are you using?" },
  { username: "gallery_fan", message: "Beautiful colors!" },
  { username: "newbie_artist", message: "So inspiring ✨" },
];

export function useLiveChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Simulate incoming messages
  useEffect(() => {
    const addRandomMessage = () => {
      const randomMsg = MOCK_MESSAGES[Math.floor(Math.random() * MOCK_MESSAGES.length)];
      const newMessage: ChatMessage = {
        id: `${Date.now()}-${Math.random()}`,
        username: randomMsg.username,
        message: randomMsg.message,
        timestamp: Date.now(),
      };
      
      setMessages((prev) => [...prev.slice(-2), newMessage]); // Keep last 3
    };

    // Add initial message
    setTimeout(addRandomMessage, 2000);
    
    // Add messages periodically
    const interval = setInterval(addRandomMessage, 6000 + Math.random() * 4000);
    
    return () => clearInterval(interval);
  }, []);

  // Auto-remove messages after 5 seconds
  useEffect(() => {
    const cleanup = setInterval(() => {
      const now = Date.now();
      setMessages((prev) => prev.filter((msg) => now - msg.timestamp < 5000));
    }, 1000);
    
    return () => clearInterval(cleanup);
  }, []);

  return { messages };
}

interface LiveChatOverlayProps {
  messages: ChatMessage[];
}

export function LiveChatOverlay({ messages }: LiveChatOverlayProps) {
  return (
    <div className="flex flex-col gap-2 max-w-[70%]">
      <AnimatePresence mode="popLayout">
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, x: -20, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -10, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="flex items-start gap-2 bg-black/40 backdrop-blur-sm rounded-full px-3 py-1.5"
          >
            <span className="text-xs font-semibold text-primary truncate max-w-[80px]">
              {msg.username}
            </span>
            <span className="text-xs text-white/90 line-clamp-1">
              {msg.message}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
