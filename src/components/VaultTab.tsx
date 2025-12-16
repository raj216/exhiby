import { motion, AnimatePresence } from "framer-motion";
import { X, ZoomIn } from "lucide-react";
import { useState } from "react";

interface ArtPiece {
  id: string;
  image: string;
  title: string;
}

interface VaultTabProps {
  artworks: ArtPiece[];
}

export function VaultTab({ artworks }: VaultTabProps) {
  const [selectedArt, setSelectedArt] = useState<ArtPiece | null>(null);

  if (artworks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <ZoomIn className="w-8 h-8 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground text-center">
          No artworks in the vault yet
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="p-4 grid grid-cols-2 gap-3">
        {artworks.map((art, index) => (
          <motion.button
            key={art.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
            onClick={() => setSelectedArt(art)}
            className="relative aspect-square rounded-2xl overflow-hidden group"
          >
            <img
              src={art.image}
              alt={art.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
              <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </motion.button>
        ))}
      </div>

      {/* Zoom Modal */}
      <AnimatePresence>
        {selectedArt && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/95 z-50"
              onClick={() => setSelectedArt(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="fixed inset-4 z-50 flex items-center justify-center"
            >
              <button
                onClick={() => setSelectedArt(null)}
                className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center z-10"
              >
                <X className="w-6 h-6 text-white" />
              </button>
              <img
                src={selectedArt.image}
                alt={selectedArt.title}
                className="max-w-full max-h-full object-contain rounded-lg"
              />
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/60 backdrop-blur-sm rounded-full">
                <p className="text-white font-serif">{selectedArt.title}</p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
