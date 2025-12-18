import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { triggerClickHaptic } from "@/lib/haptics";

interface FloatingActionButtonProps {
  onClick: () => void;
}

export function FloatingActionButton({ onClick }: FloatingActionButtonProps) {
  return (
    <motion.button
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: 0.3, type: "spring", stiffness: 400 }}
      onClick={() => {
        triggerClickHaptic();
        onClick();
      }}
      className="fixed z-50 lg:hidden w-14 h-14 rounded-full shadow-electric flex items-center justify-center"
      style={{
        bottom: "max(6rem, calc(env(safe-area-inset-bottom, 0px) + 5.5rem))",
        right: "max(1rem, env(safe-area-inset-right, 1rem))",
        background: "linear-gradient(135deg, hsl(var(--electric-clay)), hsl(var(--hyper-crimson)))",
      }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <Plus className="w-6 h-6 text-white" />
    </motion.button>
  );
}
