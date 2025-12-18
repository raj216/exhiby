import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { SlideToAction } from "./SlideToAction";
import { triggerSuccessHaptic } from "@/lib/haptics";

interface PaymentDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onPaymentSuccess: () => void;
  price: number;
  eventTitle: string;
  artistName: string;
  coverImage: string;
}

export function PaymentDrawer({
  isOpen,
  onClose,
  onPaymentSuccess,
  price,
  eventTitle,
  artistName,
  coverImage,
}: PaymentDrawerProps) {
  const handlePaymentComplete = () => {
    triggerSuccessHaptic();
    onPaymentSuccess();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70]"
          />
          
          {/* Drawer */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-[71] bg-card rounded-t-3xl max-w-md mx-auto"
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>
            
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full bg-muted/50"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
            
            {/* Content */}
            <div className="px-6 pb-8 pt-2">
              {/* Event Preview */}
              <div className="flex gap-4 mb-6">
                <div className="w-20 h-28 rounded-xl overflow-hidden flex-shrink-0">
                  <img
                    src={coverImage}
                    alt={eventTitle}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex flex-col justify-center">
                  <p className="text-xs text-muted-foreground mb-1">Joining live session</p>
                  <h3 className="font-display text-lg text-foreground line-clamp-2">
                    {eventTitle}
                  </h3>
                  <p className="text-sm text-muted-foreground">{artistName}</p>
                </div>
              </div>
              
              {/* Price breakdown */}
              <div className="bg-muted/30 rounded-xl p-4 mb-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-muted-foreground">Entry ticket</span>
                  <span className="text-sm text-foreground">${price.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-border">
                  <span className="text-sm font-semibold text-foreground">Total</span>
                  <span className="text-lg font-bold text-primary">${price.toFixed(2)}</span>
                </div>
              </div>
              
              {/* Slide to Pay */}
              <SlideToAction
                label={`Swipe to Pay $${price}`}
                onComplete={handlePaymentComplete}
              />
              
              <p className="text-xs text-center text-muted-foreground mt-4">
                Secure payment • Instant access
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
