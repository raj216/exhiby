import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, Upload } from "lucide-react";
import { triggerClickHaptic } from "@/lib/haptics";
import { toast } from "@/hooks/use-toast";

interface PortfolioItem {
  id: string;
  image: string;
  title: string;
}

interface PortfolioGridProps {
  items: PortfolioItem[];
  onAddArt?: () => void;
}

export function PortfolioGrid({ items, onAddArt }: PortfolioGridProps) {
  const [selectedImage, setSelectedImage] = useState<PortfolioItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageClick = (item: PortfolioItem) => {
    triggerClickHaptic();
    setSelectedImage(item);
  };

  const handleCloseLightbox = () => {
    setSelectedImage(null);
  };

  const handleAddClick = () => {
    triggerClickHaptic();
    if (onAddArt) {
      onAddArt();
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      toast({ title: "Coming Soon", description: "Portfolio uploads will be available soon!" });
    }
  };

  // Split items into two columns for masonry effect
  const leftColumn = items.filter((_, i) => i % 2 === 0);
  const rightColumn = items.filter((_, i) => i % 2 === 1);

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Header with Add Button */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-lg text-foreground">Portfolio</h2>
        <button
          onClick={handleAddClick}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-elevated border border-border/50 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add Art</span>
        </button>
      </div>

      {/* Masonry Grid - 2 columns */}
      {items.length === 0 ? (
        <button
          onClick={handleAddClick}
          className="w-full py-16 rounded-2xl border-2 border-dashed border-border/50 text-muted-foreground flex flex-col items-center justify-center gap-3"
        >
          <Upload className="w-8 h-8" />
          <span className="text-sm">Upload your first artwork</span>
        </button>
      ) : (
        <div className="flex gap-3">
          {/* Left Column */}
          <div className="flex-1 flex flex-col gap-3">
            {leftColumn.map((item) => (
              <motion.button
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => handleImageClick(item)}
                className="w-full rounded-xl overflow-hidden"
              >
                <img
                  src={item.image}
                  alt={item.title}
                  className="w-full h-auto object-cover"
                  loading="lazy"
                />
              </motion.button>
            ))}
          </div>

          {/* Right Column */}
          <div className="flex-1 flex flex-col gap-3">
            {rightColumn.map((item) => (
              <motion.button
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => handleImageClick(item)}
                className="w-full rounded-xl overflow-hidden"
              >
                <img
                  src={item.image}
                  alt={item.title}
                  className="w-full h-auto object-cover"
                  loading="lazy"
                />
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-carbon/95 backdrop-blur-xl flex items-center justify-center p-4"
            onClick={handleCloseLightbox}
          >
            {/* Close Button */}
            <button
              onClick={handleCloseLightbox}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-surface-elevated border border-border/50 flex items-center justify-center z-10"
            >
              <X className="w-5 h-5 text-foreground" />
            </button>

            {/* Image */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="max-w-full max-h-[85vh] rounded-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={selectedImage.image}
                alt={selectedImage.title}
                className="max-w-full max-h-[85vh] object-contain"
              />
            </motion.div>

            {/* Title */}
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="absolute bottom-6 left-0 right-0 text-center text-foreground font-medium"
            >
              {selectedImage.title}
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
