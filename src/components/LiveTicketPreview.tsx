import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { SlideToAction } from "./SlideToAction";
import { triggerHaptic } from "@/lib/haptics";
import featureFlags from "@/lib/featureFlags";
import { calculateProcessingFee } from "@/lib/processingFee";

interface LiveTicketPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  onEnterRoom: () => void;
  artistName: string;
  eventTitle: string;
  price: number;
  coverImage: string;
}

export function LiveTicketPreview({
  isOpen,
  onClose,
  onEnterRoom,
  artistName,
  eventTitle,
  price,
  coverImage,
}: LiveTicketPreviewProps) {
  const handleComplete = () => {
    triggerHaptic("medium");
    onEnterRoom();
  };

  // When payments disabled, treat all events as free
  const effectivePrice = featureFlags.paymentsEnabled ? price : 0;
  const isFree = effectivePrice === 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-carbon/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Ticket Preview Card - 50% of screen */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 h-[50vh] z-50 glass-card rounded-t-3xl overflow-hidden"
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full bg-obsidian/50 z-10"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>

            {/* Content */}
            <div className="h-full flex flex-col">
              {/* Top Section - Image Preview */}
              <div className="relative h-32 overflow-hidden">
                <img
                  src={coverImage}
                  alt={eventTitle}
                  className="w-full h-full object-cover opacity-60"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-obsidian" />
                
                {/* Live Indicator */}
                <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-crimson/20 border border-crimson/50">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-crimson opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-crimson" />
                  </span>
                  <span className="text-xs font-semibold text-crimson uppercase">
                    Live Now
                  </span>
                </div>
              </div>

              {/* Info Section */}
              <div className="flex-1 p-6 flex flex-col">
                <div className="flex-1">
                  <p className="text-sm text-electric font-medium mb-1">
                    {artistName} is live
                  </p>
                  <h3 className="font-display text-2xl text-foreground mb-4">
                    {eventTitle}
                  </h3>

                  {/* Price Tag */}
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-obsidian border border-gold/30">
                    <span className="text-gold font-semibold">
                      {isFree ? "Free Entry" : `$${effectivePrice}`}
                    </span>
                  </div>
                </div>

                {/* Slide to Enter */}
                <div className="mt-auto">
                  <SlideToAction
                    onComplete={handleComplete}
                    label={isFree ? "Slide to Enter" : "Slide to Pay & Enter"}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
