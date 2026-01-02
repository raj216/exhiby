import { motion, AnimatePresence } from "framer-motion";
import { X, Users } from "lucide-react";

interface LiveRoomHeaderProps {
  creatorName: string;
  creatorAvatar: string | null;
  eventTitle: string;
  viewerCount: number;
  isUIVisible: boolean;
  onClose: () => void;
}

export function LiveRoomHeader({
  creatorName,
  creatorAvatar,
  eventTitle,
  viewerCount,
  isUIVisible,
  onClose,
}: LiveRoomHeaderProps) {
  return (
    <AnimatePresence>
      {isUIVisible && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2 }}
          className="absolute top-0 left-0 right-0 z-20 p-4"
          style={{
            background: "linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 70%, transparent 100%)",
            paddingTop: "max(16px, env(safe-area-inset-top))",
          }}
        >
          <div className="flex items-center justify-between">
            {/* Artist Info */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-electric/50 bg-muted">
                {creatorAvatar ? (
                  <img
                    src={creatorAvatar}
                    alt={creatorName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-sm font-medium text-foreground">
                    {creatorName?.[0] || "?"}
                  </div>
                )}
              </div>
              <div>
                <p className="text-white font-semibold text-sm">{creatorName}</p>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <div className="relative">
                      <div className="w-2 h-2 rounded-full bg-live" />
                      <div className="absolute inset-0 w-2 h-2 rounded-full bg-live animate-ping" />
                    </div>
                    <span className="text-xs font-bold text-white">LIVE</span>
                  </div>
                  <div className="flex items-center gap-1 text-white/70">
                    <Users className="w-3 h-3" />
                    <motion.span
                      key={viewerCount}
                      initial={{ scale: 1.2 }}
                      animate={{ scale: 1 }}
                      className="text-xs"
                    >
                      {viewerCount}
                    </motion.span>
                  </div>
                </div>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center hover:bg-black/70 transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Event Title */}
          <h2 className="text-white font-display text-lg mt-3 line-clamp-1">{eventTitle}</h2>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
