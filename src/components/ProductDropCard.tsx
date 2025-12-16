import { motion, AnimatePresence } from "framer-motion";
import { X, Fingerprint, Apple } from "lucide-react";
import { SlideToAction } from "./SlideToAction";
import { triggerClickHaptic } from "@/lib/haptics";

interface ProductDropCardProps {
  isOpen: boolean;
  onClose: () => void;
  productTitle: string;
  price: number;
  onPurchase: () => void;
}

export function ProductDropCard({
  isOpen,
  onClose,
  productTitle,
  price,
  onPurchase,
}: ProductDropCardProps) {
  const handlePurchase = () => {
    triggerClickHaptic();
    onPurchase();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop - Frosted */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-carbon/60 backdrop-blur-xl z-40"
          />

          {/* Card - Premium Frosted Glass */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 glass-purchase p-6 pb-10"
          >
            {/* Handle */}
            <div className="w-12 h-1.5 bg-muted/50 rounded-full mx-auto mb-6" />

            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-6 right-6 p-2 rounded-full bg-obsidian/80"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>

            {/* Product Info */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-electric/15 text-electric text-sm font-medium mb-4">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-electric opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-electric"></span>
                </span>
                New Drop
              </div>

              <h2 className="font-display text-2xl text-foreground mb-2">
                {productTitle}
              </h2>

              <div className="text-4xl font-display text-gold">
                ${price}
              </div>
            </div>

            {/* Payment Options */}
            <div className="space-y-3">
              {/* Apple Pay / Google Pay */}
              <button 
                onClick={handlePurchase}
                className="w-full py-4 rounded-xl bg-foreground text-carbon font-semibold flex items-center justify-center gap-3 hover:opacity-90 transition-opacity"
              >
                <Apple className="w-5 h-5" />
                Pay with Apple Pay
              </button>

              {/* Biometric / Slide to Pay - Hot Metal Gradient */}
              <div className="relative">
                <SlideToAction
                  label="Slide to Pay"
                  completedLabel="Payment Complete!"
                  icon={<Fingerprint className="w-6 h-6 text-white" />}
                  onComplete={handlePurchase}
                />
              </div>
            </div>

            {/* Security Note */}
            <p className="text-center text-xs text-muted-foreground mt-4">
              Secured by Stripe • Instant delivery
            </p>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}