import { motion } from "framer-motion";
import { X, Palette } from "lucide-react";
import { triggerHaptic } from "@/lib/haptics";

interface MaterialsDrawerProps {
  materials: string[];
  artistName: string;
  onClose: () => void;
}

export function MaterialsDrawer({ materials, artistName, onClose }: MaterialsDrawerProps) {
  const handleClose = () => {
    triggerHaptic("light");
    onClose();
  };

  return (
    <>
      {/* Backdrop - click to close */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="absolute inset-0 z-15"
        onClick={handleClose}
      />

      {/* Drawer Panel - slides from right */}
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="absolute right-0 top-0 bottom-0 w-full sm:w-80 lg:w-96 z-20"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Frosted glass panel */}
        <div className="h-full bg-black/40 backdrop-blur-2xl border-l border-white/10">
          {/* Header */}
          <div className="flex items-center justify-between p-4 sm:p-6 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-white/10">
                <Palette className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Materials</h2>
                <p className="text-xs text-white/60">Used by {artistName}</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Materials List */}
          <div className="p-4 sm:p-6 space-y-3">
            {materials.length > 0 ? (
              materials.map((material, index) => (
                <motion.div
                  key={material}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors"
                >
                  <span className="w-6 h-6 flex items-center justify-center rounded-full bg-white/10 text-xs font-medium text-white/80">
                    {index + 1}
                  </span>
                  <span className="text-sm text-white/90 leading-relaxed">
                    {material}
                  </span>
                </motion.div>
              ))
            ) : (
              <div className="text-center py-8">
                <Palette className="w-10 h-10 text-white/30 mx-auto mb-3" />
                <p className="text-sm text-white/50">
                  No materials listed for this session.
                </p>
              </div>
            )}
          </div>

          {/* Footer tip */}
          <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 border-t border-white/10 bg-black/20">
            <p className="text-xs text-white/40 text-center">
              Tap outside to close
            </p>
          </div>
        </div>
      </motion.div>
    </>
  );
}
