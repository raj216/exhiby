import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { triggerHaptic } from "@/lib/haptics";
import { useScrollLock } from "@/hooks/useScrollLock";
import { CATEGORIES, Category } from "@/lib/categories";

interface CategoriesOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCategory: (tag: string) => void;
}

export function CategoriesOverlay({ isOpen, onClose, onSelectCategory }: CategoriesOverlayProps) {
  const navigate = useNavigate();
  
  // Lock body scroll when overlay is open
  useScrollLock(isOpen);

  const handleCategoryClick = (category: Category) => {
    triggerHaptic("light");
    // Close the modal first
    onClose();
    // Navigate to Browse page - "all" means no filter, others get category param
    if (category.id === "all") {
      navigate("/browse");
    } else {
      navigate(`/browse?category=${category.id}`);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 overflow-hidden flex items-start md:items-center justify-center"
          style={{ height: '100dvh' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Glass backdrop */}
          <motion.div
            className="absolute inset-0 bg-carbon/90 backdrop-blur-xl md:bg-carbon/80"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Categories container */}
          <motion.div
            className="relative z-10 flex flex-col w-full h-full md:h-auto md:max-h-[80vh] md:max-w-md md:mx-4 md:rounded-2xl md:border md:border-border/30 md:bg-carbon/95 md:backdrop-blur-2xl md:shadow-2xl"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
            initial={{ y: -20, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -20, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            {/* Header */}
            <div 
              className="flex-shrink-0 px-4 pb-3 flex items-center justify-between border-b border-border/30"
              style={{ paddingTop: 'max(1rem, env(safe-area-inset-top, 1rem))' }}
            >
              <h2 className="font-display text-lg text-foreground">Categories</h2>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-full bg-obsidian/50 hover:bg-obsidian transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            {/* Categories Grid */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 md:px-6 md:py-6">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <p className="text-sm text-muted-foreground mb-4">
                  Browse studios by medium
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {CATEGORIES.map((cat, index) => (
                    <motion.button
                      key={cat.id}
                      onClick={() => handleCategoryClick(cat)}
                      className={`p-4 rounded-xl border text-left transition-all ${
                        cat.id === "all"
                          ? "bg-primary/10 border-primary/40 hover:bg-primary/20"
                          : "bg-obsidian border-border/30 hover:border-gold/50 hover:bg-obsidian/80"
                      }`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <span className="font-display text-sm text-foreground">{cat.name}</span>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
