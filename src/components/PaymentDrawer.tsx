import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, ExternalLink } from "lucide-react";
import { triggerSuccessHaptic } from "@/lib/haptics";
import { useScrollLock } from "@/hooks/useScrollLock";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PaymentDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onPaymentSuccess: () => void;
  price: number;
  eventTitle: string;
  artistName: string;
  coverImage: string;
  eventId: string;
  isFree?: boolean;
}

export function PaymentDrawer({
  isOpen,
  onClose,
  onPaymentSuccess,
  price,
  eventTitle,
  artistName,
  coverImage,
  eventId,
  isFree,
}: PaymentDrawerProps) {
  useScrollLock(isOpen);
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePayment = async () => {
    setIsProcessing(true);
    try {
      // Call create-checkout-session for both free and paid events
      const { data, error } = await supabase.functions.invoke("create-checkout-session", {
        body: { event_id: eventId, origin: window.location.origin },
      });

      if (error) {
        console.error("[PaymentDrawer] Edge function error:", error);
        throw new Error(error.message || "Failed to create checkout session");
      }

      const response = data as { url?: string; free?: boolean; ticket_id?: string } | null;

      if (!response) {
        throw new Error("Empty response from server");
      }

      // Free event — ticket created directly by backend
      if (response.free) {
        console.log("[PaymentDrawer] Free ticket created:", response.ticket_id);
        triggerSuccessHaptic();
        onPaymentSuccess();
        return;
      }

      // Paid event — redirect to Stripe Checkout
      if (response.url) {
        console.log("[PaymentDrawer] Redirecting to Stripe Checkout...");
        toast.info("Redirecting to secure payment...", { duration: 3000 });
        window.location.href = response.url;
        // Don't setIsProcessing(false) — page will redirect
        return;
      }

      throw new Error("No checkout URL received from server");
    } catch (err: any) {
      console.error("[PaymentDrawer] Payment error:", err);
      toast.error("Payment failed", {
        description: err.message || "Please try again",
      });
      setIsProcessing(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70]"
          />
          
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-[71] bg-card rounded-t-3xl max-w-md mx-auto"
          >
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>
            
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="absolute top-4 right-4 p-2 rounded-full bg-muted/50"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
            
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
                  <p className="text-xs text-muted-foreground mb-1">Joining studio session</p>
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
                  <span className="text-sm text-foreground">
                    {isFree || price <= 0 ? "Free" : `$${price.toFixed(2)}`}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-border">
                  <span className="text-sm font-semibold text-foreground">Total</span>
                  <span className="text-lg font-bold text-primary">
                    {isFree || price <= 0 ? "Free" : `$${price.toFixed(2)}`}
                  </span>
                </div>
              </div>
              
              {/* Payment Button */}
              <button
                onClick={handlePayment}
                disabled={isProcessing}
                className="w-full py-4 rounded-2xl bg-primary text-primary-foreground font-semibold text-base flex items-center justify-center gap-2 disabled:opacity-50 transition-all hover:opacity-90"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {isFree || price <= 0 ? "Processing..." : "Redirecting to Stripe..."}
                  </>
                ) : isFree || price <= 0 ? (
                  "Enter Free"
                ) : (
                  <>
                    Pay ${price.toFixed(2)}
                    <ExternalLink className="w-4 h-4" />
                  </>
                )}
              </button>
              
              <p className="text-xs text-center text-muted-foreground mt-4">
                {isFree || price <= 0
                  ? "Free entry • Instant access"
                  : "You'll be redirected to Stripe for secure card payment"}
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
