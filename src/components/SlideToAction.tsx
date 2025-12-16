import { useState, useRef } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { triggerSuccessHaptic, triggerClickHaptic } from "@/lib/haptics";

interface SlideToActionProps {
  onComplete: () => void;
  label: string;
  completedLabel?: string;
  icon?: React.ReactNode;
}

export function SlideToAction({ 
  onComplete, 
  label, 
  completedLabel = "Done!",
  icon 
}: SlideToActionProps) {
  const [completed, setCompleted] = useState(false);
  const constraintsRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const [trackWidth, setTrackWidth] = useState(0);

  const thumbWidth = 56;
  const maxSlide = trackWidth - thumbWidth - 8;

  const backgroundOpacity = useTransform(x, [0, maxSlide], [0, 1]);
  const textOpacity = useTransform(x, [0, maxSlide * 0.5], [1, 0]);

  const handleDragEnd = () => {
    const currentX = x.get();
    if (currentX >= maxSlide * 0.85) {
      animate(x, maxSlide, { type: "spring", stiffness: 400, damping: 30 });
      setCompleted(true);
      triggerSuccessHaptic();
      onComplete();
    } else {
      animate(x, 0, { type: "spring", stiffness: 400, damping: 30 });
    }
  };

  const handleDragStart = () => {
    triggerClickHaptic();
  };

  return (
    <div
      ref={constraintsRef}
      className="relative h-16 rounded-full overflow-hidden bg-obsidian"
      onLoad={() => {
        if (constraintsRef.current) {
          setTrackWidth(constraintsRef.current.offsetWidth);
        }
      }}
      style={{ touchAction: "none" }}
    >
      {/* Track background - Hot Metal Gradient */}
      <motion.div
        className="absolute inset-0 bg-gradient-electric"
        style={{ opacity: backgroundOpacity }}
      />

      {/* Label text */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center text-muted-foreground font-medium"
        style={{ opacity: textOpacity }}
      >
        {label}
      </motion.div>

      {/* Completed text */}
      {completed && (
        <div className="absolute inset-0 flex items-center justify-center text-white font-semibold">
          {completedLabel}
        </div>
      )}

      {/* Draggable thumb - Electric Clay to Hyper Crimson */}
      {!completed && (
        <motion.div
          className="absolute left-1 top-1 bottom-1 w-14 rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing"
          style={{ 
            x,
            background: "linear-gradient(135deg, hsl(7 100% 67%), hsl(345 100% 50%))",
            boxShadow: "0 4px 25px hsl(7 100% 67% / 0.5)"
          }}
          drag="x"
          dragConstraints={{ left: 0, right: maxSlide }}
          dragElastic={0}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onViewportEnter={() => {
            if (constraintsRef.current) {
              setTrackWidth(constraintsRef.current.offsetWidth);
            }
          }}
        >
          {icon || <ChevronRight className="w-6 h-6 text-white" />}
        </motion.div>
      )}
    </div>
  );
}