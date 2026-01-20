import { motion, type Transition, type Variants } from "framer-motion";
import { ReactNode } from "react";

interface PageTransitionProps {
  children: ReactNode;
  direction?: "forward" | "backward";
  className?: string;
}

// Premium "Heavy" easing curve - snappy start, graceful deceleration (luxury car door feel)
const premiumEasing = [0.2, 0.8, 0.2, 1] as const;
const premiumDuration = 0.5; // Deliberate, expensive feel

// Parallax Stack effect for page navigation
const parallaxVariants: Variants = {
  // Entering from right (forward navigation)
  initial: (direction: "forward" | "backward") => ({
    x: direction === "forward" ? "100%" : "-20%",
    opacity: direction === "forward" ? 1 : 0.5,
    scale: 1,
  }),
  // Centered, fully visible
  animate: {
    x: 0,
    opacity: 1,
    scale: 1,
  },
  // Exiting (forward = slide left and dim, backward = slide right)
  exit: (direction: "forward" | "backward") => ({
    x: direction === "forward" ? "-20%" : "100%",
    opacity: direction === "forward" ? 0.5 : 1,
    scale: 1,
  }),
};

const parallaxTransition: Transition = {
  duration: premiumDuration,
  ease: premiumEasing,
};

export function PageTransition({ 
  children, 
  direction = "forward",
  className = "" 
}: PageTransitionProps) {
  return (
    <motion.div
      custom={direction}
      variants={parallaxVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={parallaxTransition}
      className={`min-h-screen ${className}`}
      style={{ willChange: "transform, opacity" }}
    >
      {children}
    </motion.div>
  );
}

// Modal/Action Sheet transition - slides up with spring physics
const modalVariants: Variants = {
  initial: {
    y: "100%",
    opacity: 1,
  },
  animate: {
    y: 0,
    opacity: 1,
  },
  exit: {
    y: "100%",
    opacity: 1,
  },
};

// Spring physics: high stiffness (300) and damping (30) - solid snap-to-place, no bounce
const modalTransition: Transition = {
  type: "spring",
  stiffness: 300,
  damping: 30,
  mass: 1,
};

interface ModalTransitionProps {
  children: ReactNode;
  className?: string;
}

export function ModalTransition({ children, className = "" }: ModalTransitionProps) {
  return (
    <motion.div
      variants={modalVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={modalTransition}
      className={className}
      style={{ willChange: "transform" }}
    >
      {children}
    </motion.div>
  );
}

// Modal backdrop - scales and darkens the background
const backdropVariants: Variants = {
  initial: {
    opacity: 0,
  },
  animate: {
    opacity: 1,
  },
  exit: {
    opacity: 0,
  },
};

const backdropTransition: Transition = {
  duration: 0.3,
  ease: premiumEasing,
};

interface ModalBackdropProps {
  children?: ReactNode;
  onClick?: () => void;
  className?: string;
}

export function ModalBackdrop({ children, onClick, className = "" }: ModalBackdropProps) {
  return (
    <motion.div
      variants={backdropVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={backdropTransition}
      onClick={onClick}
      className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 ${className}`}
      style={{ willChange: "opacity" }}
    >
      {children}
    </motion.div>
  );
}

// App scale effect when modal opens (pushes content into background)
const appScaleVariants: Variants = {
  initial: {
    scale: 1,
    filter: "brightness(1)",
  },
  scaled: {
    scale: 0.95,
    filter: "brightness(0.7)",
  },
};

const appScaleTransition: Transition = {
  duration: 0.4,
  ease: premiumEasing,
};

interface AppScaleWrapperProps {
  children: ReactNode;
  isScaled: boolean;
  className?: string;
}

export function AppScaleWrapper({ children, isScaled, className = "" }: AppScaleWrapperProps) {
  return (
    <motion.div
      variants={appScaleVariants}
      initial="initial"
      animate={isScaled ? "scaled" : "initial"}
      transition={appScaleTransition}
      className={`origin-center ${className}`}
      style={{ willChange: "transform, filter" }}
    >
      {children}
    </motion.div>
  );
}

// Overlay transition for modals and drawers (legacy - kept for compatibility)
const overlayVariants: Variants = {
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
  type: "spring",
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
const fadeVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

const fadeTransition: Transition = {
  duration: 0.2,
  ease: "easeInOut",
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
const slideUpVariants: Variants = {
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
  type: "spring",
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
