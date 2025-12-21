import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ConfettiPiece {
  id: number;
  x: number;
  delay: number;
  rotation: number;
  color: string;
  size: number;
}

interface ConfettiEffectProps {
  isActive: boolean;
  onComplete?: () => void;
}

const COLORS = [
  "hsl(345, 100%, 50%)", // Crimson
  "hsl(7, 100%, 67%)",   // Electric
  "hsl(43, 72%, 52%)",   // Gold
  "hsl(0, 0%, 100%)",    // White
];

export function ConfettiEffect({ isActive, onComplete }: ConfettiEffectProps) {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([]);

  useEffect(() => {
    if (isActive) {
      const newPieces: ConfettiPiece[] = [];
      for (let i = 0; i < 50; i++) {
        newPieces.push({
          id: i,
          x: Math.random() * 100,
          delay: Math.random() * 0.3,
          rotation: Math.random() * 360,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          size: Math.random() * 8 + 4,
        });
      }
      setPieces(newPieces);

      const timer = setTimeout(() => {
        setPieces([]);
        onComplete?.();
      }, 2500);

      return () => clearTimeout(timer);
    }
  }, [isActive, onComplete]);

  return (
    <AnimatePresence>
      {pieces.length > 0 && (
        <div className="fixed inset-0 z-[200] pointer-events-none overflow-hidden">
          {pieces.map((piece) => (
            <motion.div
              key={piece.id}
              initial={{
                x: `${piece.x}vw`,
                y: "-10vh",
                rotate: 0,
                opacity: 1,
              }}
              animate={{
                y: "110vh",
                rotate: piece.rotation + 720,
                opacity: [1, 1, 0],
              }}
              transition={{
                duration: 2.5,
                delay: piece.delay,
                ease: [0.25, 0.46, 0.45, 0.94],
              }}
              style={{
                position: "absolute",
                width: piece.size,
                height: piece.size,
                backgroundColor: piece.color,
                borderRadius: Math.random() > 0.5 ? "50%" : "2px",
              }}
            />
          ))}
        </div>
      )}
    </AnimatePresence>
  );
}
