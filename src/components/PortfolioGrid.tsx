import { useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, Upload, Trash2, ImageIcon } from "lucide-react";
import { triggerClickHaptic } from "@/lib/haptics";
import { toast } from "@/hooks/use-toast";
import { usePortfolioItems, PortfolioItem } from "@/hooks/usePortfolioItems";
import { useAuth } from "@/contexts/AuthContext";
import { AddArtModal } from "@/components/AddArtModal";
import { supabase } from "@/integrations/supabase/client";
import { useScrollLock } from "@/hooks/useScrollLock";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface PortfolioGridProps {
  userId?: string;
  isOwner?: boolean;
}

export function PortfolioGrid({
  userId,
  isOwner = false
}: PortfolioGridProps) {
  const { user } = useAuth();
  const { items, isLoading, addItem, deleteItem, refetch } = usePortfolioItems(userId);
  const [selectedImage, setSelectedImage] = useState<PortfolioItem | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const canEdit = isOwner && user;

  // Lock background scroll when lightbox is open
  useScrollLock(!!selectedImage);

  const handleImageClick = (item: PortfolioItem) => {
    console.log("[PortfolioGrid] Image clicked:", { 
      id: item.id, 
      hasImageUrl: !!item.image_url,
      title: item.title 
    });
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

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerClickHaptic();
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedImage || !user) return;

    setIsDeleting(true);
    try {
      // Extract file path from URL to delete from storage
      const imageUrl = selectedImage.image_url;
      const storagePathMatch = imageUrl.match(/portfolio\/(.+)$/);
      
      if (storagePathMatch) {
        const filePath = storagePathMatch[1];
        await supabase.storage.from("portfolio").remove([filePath]);
      }

      // Delete from database
      await deleteItem(selectedImage.id);
      
      // Close modals and refresh
      setShowDeleteConfirm(false);
      setSelectedImage(null);
      await refetch();
      
      toast({ title: "Artwork deleted." });
    } catch (error) {
      console.error("Delete error:", error);
      toast({ title: "Delete failed", description: "Please try again", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  // Split items into columns for masonry effect
  const getColumns = (numCols: number) => {
    const cols: PortfolioItem[][] = Array.from({ length: numCols }, () => []);
    items.forEach((item, i) => cols[i % numCols].push(item));
    return cols;
  };
  
  const twoColumns = getColumns(2);
  const threeColumns = getColumns(3);

  // Lightbox modal rendered via portal
  const lightboxModal = selectedImage ? createPortal(
    <AnimatePresence>
      <motion.div
        key="portfolio-lightbox"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center"
        style={{ height: '100dvh' }}
        onClick={handleCloseLightbox}
      >
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-carbon/95 backdrop-blur-xl"
        />

        {/* Delete Button (for owner) - top left */}
        {canEdit && (
          <button
            onClick={handleDeleteClick}
            className="absolute top-4 left-4 w-10 h-10 rounded-full bg-destructive/20 border border-destructive/50 flex items-center justify-center z-20"
            style={{ top: 'max(1rem, env(safe-area-inset-top, 1rem))' }}
          >
            <Trash2 className="w-5 h-5 text-destructive" />
          </button>
        )}

        {/* Close Button - top right */}
        <button
          onClick={handleCloseLightbox}
          className="absolute top-4 right-4 w-10 h-10 rounded-full bg-surface-elevated border border-border/50 flex items-center justify-center z-20"
          style={{ top: 'max(1rem, env(safe-area-inset-top, 1rem))' }}
        >
          <X className="w-5 h-5 text-foreground" />
        </button>

        {/* Content Panel - centered */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="relative z-10 flex flex-col items-center px-4"
          style={{
            maxWidth: "min(92vw, 800px)",
            maxHeight: "calc(80dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Image */}
          {selectedImage.image_url ? (
            <div className="rounded-2xl overflow-hidden">
              <img
                src={selectedImage.image_url}
                alt={selectedImage.title || "Portfolio artwork"}
                className="max-w-full object-contain"
                style={{ maxHeight: "calc(65dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))" }}
                onError={(e) => {
                  console.error("Image failed to load:", selectedImage.image_url);
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          ) : (
            <div className="w-64 h-64 rounded-2xl bg-obsidian flex items-center justify-center">
              <ImageIcon className="w-16 h-16 text-muted-foreground/50" />
            </div>
          )}

          {/* Metadata: Title and Description */}
          {(selectedImage.title || selectedImage.description) && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="mt-4 max-w-lg w-full text-center space-y-2"
            >
              {/* Title */}
              {selectedImage.title && (
                <h3 className="text-xl font-display text-foreground">
                  {selectedImage.title}
                </h3>
              )}

              {/* Description */}
              {selectedImage.description && (
                <p className="text-sm text-muted-foreground leading-relaxed line-clamp-4">
                  {selectedImage.description}
                </p>
              )}
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  ) : null;

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

      {/* Delete Confirmation Modal */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="bg-surface-elevated border-border/50 rounded-2xl max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground font-display">
              Delete artwork?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              This will permanently remove this artwork from your portfolio. This action can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-3 sm:gap-3">
            <AlertDialogCancel 
              className="flex-1 bg-obsidian border-border/50 text-foreground hover:bg-obsidian/80 rounded-xl"
              disabled={isDeleting}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
                    className="w-full rounded-xl overflow-hidden"
                  >
                    <img
                      src={item.image_url}
                      alt={item.title || "Portfolio artwork"}
                      className="w-full h-auto object-cover"
                      loading="lazy"
                    />
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
                    className="w-full rounded-xl overflow-hidden"
                  >
                    <img
                      src={item.image_url}
                      alt={item.title || "Portfolio artwork"}
                      className="w-full h-auto object-cover"
                      loading="lazy"
                    />
                  </motion.button>
                ))}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Lightbox Modal (via Portal) */}
      {lightboxModal}
    </>
  );
}
