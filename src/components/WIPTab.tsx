import { motion } from "framer-motion";
import { Play, Image as ImageIcon } from "lucide-react";

interface WIPItem {
  id: string;
  type: "image" | "video";
  thumbnail: string;
  title: string;
}

interface WIPTabProps {
  items: WIPItem[];
}

export function WIPTab({ items }: WIPTabProps) {
  const videos = items.filter((item) => item.type === "video");
  const images = items.filter((item) => item.type === "image");

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="w-16 h-16 rounded-full bg-obsidian flex items-center justify-center mb-4">
          <ImageIcon className="w-8 h-8 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground text-center">
          No work in progress yet
        </p>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Stories-like video clips */}
      {videos.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
            Process Clips
          </h3>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
            {videos.map((video, index) => (
              <motion.button
                key={video.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                whileTap={{ scale: 0.95 }}
                className="relative flex-shrink-0 w-20 h-28 rounded-xl overflow-hidden ring-2 ring-electric ring-offset-2 ring-offset-carbon"
              >
                <img
                  src={video.thumbnail}
                  alt={video.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-carbon/30 flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full bg-foreground/90 flex items-center justify-center">
                    <Play className="w-4 h-4 text-carbon fill-carbon ml-0.5" />
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* Sketches grid */}
      {images.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
            Sketches & Process
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {images.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.03 }}
                className="aspect-square rounded-xl overflow-hidden bg-obsidian border border-border/30"
              >
                <img
                  src={item.thumbnail}
                  alt={item.title}
                  className="w-full h-full object-cover"
                />
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}