import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart } from "lucide-react";

interface FloatingHeart {
  id: number;
  x: number;
  y: number;
}

export function useFloatingHearts() {
  const [hearts, setHearts] = useState<FloatingHeart[]>([]);

  const triggerHeart = useCallback((x: number, y: number) => {
    const id = Date.now() + Math.random();
    setHearts((prev) => [...prev, { id, x, y }]);
    
    // Remove heart after animation
    setTimeout(() => {
      setHearts((prev) => prev.filter((h) => h.id !== id));
    }, 1500);
  }, []);

  return { hearts, triggerHeart };
}

interface FloatingHeartsProps {
  hearts: FloatingHeart[];
}

export function FloatingHearts({ hearts }: FloatingHeartsProps) {
  return (
    <AnimatePresence>
      {hearts.map((heart) => (
        <motion.div
          key={heart.id}
          initial={{ 
            opacity: 1, 
            scale: 0.5, 
            x: heart.x - 20, 
            y: heart.y - 20 
          }}
          animate={{ 
            opacity: 0, 
            scale: 1.5, 
            y: heart.y - 150,
            x: heart.x - 20 + (Math.random() - 0.5) * 60
          }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          className="fixed pointer-events-none z-[60]"
        >
          <Heart className="w-10 h-10 fill-rose-500 text-rose-500" />
        </motion.div>
      ))}
    </AnimatePresence>
  );
}
