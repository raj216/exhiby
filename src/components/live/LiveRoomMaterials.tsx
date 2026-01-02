import { motion, AnimatePresence } from "framer-motion";
import { X, Palette } from "lucide-react";

export interface Material {
  id: string;
  name: string;
  brand?: string;
  description?: string;
}

interface LiveRoomMaterialsProps {
  isOpen: boolean;
  onClose: () => void;
  materials: Material[];
}

export function LiveRoomMaterials({
  isOpen,
  onClose,
  materials,
}: LiveRoomMaterialsProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.2 }}
          className="absolute right-0 top-0 bottom-0 z-30 w-full max-w-sm flex flex-col"
          style={{
            background: "linear-gradient(to left, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.7) 70%, transparent 100%)",
            paddingTop: "max(80px, env(safe-area-inset-top) + 60px)",
            paddingBottom: "max(100px, env(safe-area-inset-bottom) + 80px)",
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 pb-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Palette className="w-5 h-5 text-gold" />
              <h3 className="text-white font-semibold">Materials</h3>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>

          {/* Materials List */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {materials.length === 0 ? (
              <p className="text-white/50 text-sm text-center py-8">
                No materials listed yet
              </p>
            ) : (
              materials.map((material) => (
                <motion.div
                  key={material.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 rounded-xl bg-white/5 border border-white/10"
                >
                  <h4 className="text-white font-medium text-sm">{material.name}</h4>
                  {material.brand && (
                    <p className="text-gold text-xs mt-0.5">{material.brand}</p>
                  )}
                  {material.description && (
                    <p className="text-white/60 text-xs mt-1">{material.description}</p>
                  )}
                </motion.div>
              ))
            )}
          </div>

          {/* Footer hint */}
          <div className="px-4 py-3 border-t border-white/10">
            <p className="text-white/40 text-xs text-center">
              Materials the artist is using in this session
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
