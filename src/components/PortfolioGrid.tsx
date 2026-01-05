import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, Upload, Trash2, ImageIcon } from "lucide-react";
import { triggerClickHaptic } from "@/lib/haptics";
import { toast } from "@/hooks/use-toast";
import { usePortfolioItems, PortfolioItem } from "@/hooks/usePortfolioItems";
import { useAuth } from "@/contexts/AuthContext";
import { AddArtModal } from "@/components/AddArtModal";

interface PortfolioGridProps {
  userId?: string; // If provided, show that user's portfolio (for public profiles)
  isOwner?: boolean; // Whether the current user owns this portfolio
}

export function PortfolioGrid({ userId, isOwner = false }: PortfolioGridProps) {
  const { user } = useAuth();
  const { items, isLoading, addItem, deleteItem } = usePortfolioItems(userId);
  const [selectedImage, setSelectedImage] = useState<PortfolioItem | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const canEdit = isOwner && user;

  const handleImageClick = (item: PortfolioItem) => {
    triggerClickHaptic();
    setSelectedImage(item);
  };

  const handleCloseLightbox = () => {
    setSelectedImage(null);
  };

  const handleAddClick = () => {
    triggerClickHaptic();
    setShowAddModal(true);
  };

  const handleUpload = async (imageBlob: Blob, title: string, description: string): Promise<boolean> => {
    setIsUploading(true);
    try {
      const success = await addItem(imageBlob, title, description);
      return success;
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, itemId: string) => {
    e.stopPropagation();
    triggerClickHaptic();
    
    if (confirm("Delete this artwork from your portfolio?")) {
      await deleteItem(itemId);
      setSelectedImage(null);
    }
  };

  // Split items into columns for masonry effect (2 on mobile, 3 on desktop)
  const getColumns = (numCols: number) => {
    const cols: PortfolioItem[][] = Array.from({ length: numCols }, () => []);
    items.forEach((item, i) => cols[i % numCols].push(item));
    return cols;
  };
  
  const twoColumns = getColumns(2);
  const threeColumns = getColumns(3);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg text-foreground">Portfolio</h2>
        </div>
        <div className="flex gap-3">
          <div className="flex-1 space-y-3">
            <div className="h-32 rounded-xl bg-obsidian/50 animate-pulse" />
            <div className="h-48 rounded-xl bg-obsidian/50 animate-pulse" />
          </div>
          <div className="flex-1 space-y-3">
            <div className="h-48 rounded-xl bg-obsidian/50 animate-pulse" />
            <div className="h-32 rounded-xl bg-obsidian/50 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Add Art Modal */}
      <AddArtModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onUpload={handleUpload}
        isUploading={isUploading}
      />

      {/* Header with Add Button (only for owner) */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-lg text-foreground">Portfolio</h2>
        {canEdit && (
          <button
            onClick={handleAddClick}
            disabled={isUploading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-elevated border border-border/50 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            <span>{isUploading ? "Uploading..." : "Add Art"}</span>
          </button>
        )}
      </div>

      {/* Masonry Grid - 2 columns */}
      {items.length === 0 ? (
        canEdit ? (
          <button
            onClick={handleAddClick}
            disabled={isUploading}
            className="w-full py-16 rounded-2xl border-2 border-dashed border-border/50 text-muted-foreground flex flex-col items-center justify-center gap-3 disabled:opacity-50"
          >
            <Upload className="w-8 h-8" />
            <span className="text-sm">{isUploading ? "Uploading..." : "Upload your first artwork"}</span>
          </button>
        ) : (
          <div className="w-full py-12 rounded-2xl bg-obsidian/50 border border-border/30 flex flex-col items-center justify-center gap-3">
            <ImageIcon className="w-8 h-8 text-muted-foreground/50" />
            <span className="text-sm text-muted-foreground/50">No artwork yet</span>
          </div>
        )
      ) : (
        <>
          {/* Mobile: 2 columns */}
          <div className="flex gap-3 lg:hidden">
            {twoColumns.map((column, colIndex) => (
              <div key={colIndex} className="flex-1 flex flex-col gap-3">
                {column.map((item) => (
                  <motion.button
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => handleImageClick(item)}
                    className="w-full rounded-xl overflow-hidden relative group"
                  >
                    <img
                      src={item.image_url}
                      alt={item.title || "Portfolio artwork"}
                      className="w-full h-auto object-cover"
                      loading="lazy"
                    />
                    {canEdit && (
                      <button
                        onClick={(e) => handleDelete(e, item.id)}
                        className="absolute top-2 right-2 w-8 h-8 rounded-full bg-carbon/80 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </button>
                    )}
                  </motion.button>
                ))}
              </div>
            ))}
          </div>

          {/* Desktop: 3 columns */}
          <div className="hidden lg:flex gap-3">
            {threeColumns.map((column, colIndex) => (
              <div key={colIndex} className="flex-1 flex flex-col gap-3">
                {column.map((item) => (
                  <motion.button
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => handleImageClick(item)}
                    className="w-full rounded-xl overflow-hidden relative group"
                  >
                    <img
                      src={item.image_url}
                      alt={item.title || "Portfolio artwork"}
                      className="w-full h-auto object-cover"
                      loading="lazy"
                    />
                    {canEdit && (
                      <button
                        onClick={(e) => handleDelete(e, item.id)}
                        className="absolute top-2 right-2 w-8 h-8 rounded-full bg-carbon/80 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </button>
                    )}
                  </motion.button>
                ))}
              </div>
            ))}
          </div>
        </>
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

            {/* Delete Button (for owner) */}
            {canEdit && (
              <button
                onClick={(e) => handleDelete(e, selectedImage.id)}
                className="absolute top-4 left-4 w-10 h-10 rounded-full bg-destructive/20 border border-destructive/50 flex items-center justify-center z-10"
              >
                <Trash2 className="w-5 h-5 text-destructive" />
              </button>
            )}

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
                src={selectedImage.image_url}
                alt={selectedImage.title || "Portfolio artwork"}
                className="max-w-full max-h-[85vh] object-contain"
              />
            </motion.div>

            {/* Title */}
            {selectedImage.title && (
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="absolute bottom-6 left-0 right-0 text-center text-foreground font-medium"
              >
                {selectedImage.title}
              </motion.p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
