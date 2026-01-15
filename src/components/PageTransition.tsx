import { motion, type Transition } from "framer-motion";
import { ReactNode } from "react";

interface PageTransitionProps {
  children: ReactNode;
  direction?: "forward" | "backward";
  className?: string;
}

const pageVariants = {
  initial: (direction: "forward" | "backward") => ({
    opacity: 0,
    x: direction === "forward" ? 30 : -30,
    scale: 0.98,
  }),
  animate: {
    opacity: 1,
    x: 0,
    scale: 1,
  },
  exit: (direction: "forward" | "backward") => ({
    opacity: 0,
    x: direction === "forward" ? -30 : 30,
    scale: 0.98,
  }),
};

const pageTransition: Transition = {
  type: "spring" as const,
  stiffness: 300,
  damping: 30,
  mass: 0.8,
};

export function PageTransition({ 
  children, 
  direction = "forward",
  className = "" 
}: PageTransitionProps) {
  return (
    <motion.div
      custom={direction}
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={pageTransition}
      className={`min-h-screen ${className}`}
    >
      {children}
    </motion.div>
  );
}

// Overlay transition for modals and drawers
const overlayVariants = {
  initial: {
    opacity: 0,
    scale: 0.95,
    y: 20,
  },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 20,
  },
};

const overlayTransition: Transition = {
  type: "spring" as const,
  stiffness: 400,
  damping: 30,
  mass: 0.8,
};

interface OverlayTransitionProps {
  children: ReactNode;
  className?: string;
}

export function OverlayTransition({ children, className = "" }: OverlayTransitionProps) {
  return (
    <motion.div
      variants={overlayVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={overlayTransition}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Fade transition for subtle changes
const fadeVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

const fadeTransition: Transition = {
  duration: 0.2,
  ease: "easeInOut" as const,
};

interface FadeTransitionProps {
  children: ReactNode;
  className?: string;
}

export function FadeTransition({ children, className = "" }: FadeTransitionProps) {
  return (
    <motion.div
      variants={fadeVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={fadeTransition}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Slide up transition for bottom sheets
const slideUpVariants = {
  initial: {
    y: "100%",
    opacity: 0.8,
  },
  animate: {
    y: 0,
    opacity: 1,
  },
  exit: {
    y: "100%",
    opacity: 0.8,
  },
};

const slideUpTransition: Transition = {
  type: "spring" as const,
  stiffness: 300,
  damping: 30,
};

interface SlideUpTransitionProps {
  children: ReactNode;
  className?: string;
}

export function SlideUpTransition({ children, className = "" }: SlideUpTransitionProps) {
  return (
    <motion.div
      variants={slideUpVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={slideUpTransition}
      className={className}
    >
      {children}
    </motion.div>
  );
}
