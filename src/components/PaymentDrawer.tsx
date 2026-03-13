import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, ExternalLink, CreditCard, AlertCircle } from "lucide-react";
import { triggerSuccessHaptic } from "@/lib/haptics";
import { useScrollLock } from "@/hooks/useScrollLock";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SlideToAction } from "./SlideToAction";
import { calculateProcessingFee } from "@/lib/processingFee";

interface SavedPaymentMethod {
  id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
}

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
  const [isCheckingMethod, setIsCheckingMethod] = useState(false);
  const [savedMethod, setSavedMethod] = useState<SavedPaymentMethod | null>(null);
  const [chargeError, setChargeError] = useState<string | null>(null);

  const effectivelyFree = isFree || price <= 0;
  const processingFee = effectivelyFree ? 0 : calculateProcessingFee(price);
  const buyerTotal = effectivelyFree ? 0 : price + processingFee;

  // Check for saved payment method when drawer opens (paid events only)
  useEffect(() => {
    if (!isOpen || effectivelyFree) return;

    let cancelled = false;
    const checkMethod = async () => {
      setIsCheckingMethod(true);
      setChargeError(null);
      try {
        const { data, error } = await supabase.functions.invoke("check-payment-method");
        if (!cancelled && !error && data?.has_payment_method && data.payment_method) {
          setSavedMethod(data.payment_method);
        } else if (!cancelled) {
          setSavedMethod(null);
        }
      } catch {
        if (!cancelled) setSavedMethod(null);
      } finally {
        if (!cancelled) setIsCheckingMethod(false);
      }
    };
    checkMethod();
    return () => { cancelled = true; };
  }, [isOpen, effectivelyFree]);

  // Handle free event entry
  const handleFreeEntry = async () => {
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout-session", {
        body: { event_id: eventId, origin: window.location.origin },
      });
      if (error) throw new Error(error.message || "Failed to create ticket");
      const response = data as { free?: boolean; ticket_id?: string } | null;
      if (!response) throw new Error("Empty response");
      if (response.free) {
        triggerSuccessHaptic();
        onPaymentSuccess();
        return;
      }
      throw new Error("Unexpected response for free event");
    } catch (err: any) {
      console.error("[PaymentDrawer] Free entry error:", err);
      toast.error("Failed to get access", { description: err.message });
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle first-time payment (redirect to Stripe Checkout)
  const handleNewCardPayment = async () => {
    setIsProcessing(true);
    setChargeError(null);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout-session", {
        body: { event_id: eventId, origin: window.location.origin },
      });
      if (error) throw new Error(error.message || "Failed to create checkout session");
      const response = data as { url?: string; free?: boolean; ticket_id?: string } | null;
      if (!response) throw new Error("Empty response from server");

      if (response.free) {
        triggerSuccessHaptic();
        onPaymentSuccess();
        return;
      }

      if (response.url) {
        toast.info("Redirecting to secure payment...", { duration: 3000 });
        window.location.href = response.url;
        return;
      }

      throw new Error("No checkout URL received");
    } catch (err: any) {
      console.error("[PaymentDrawer] Payment error:", err);
      toast.error("Payment failed", { description: err.message });
      setIsProcessing(false);
    }
  };

  // Handle swipe-to-pay with saved method
  const handleSavedMethodCharge = useCallback(async () => {
    if (!savedMethod) return;
    setIsProcessing(true);
    setChargeError(null);
    try {
      const { data, error } = await supabase.functions.invoke("charge-saved-method", {
        body: {
          event_id: eventId,
          payment_method_id: savedMethod.id,
        },
      });

      if (error) throw new Error(error.message || "Payment failed");
      const response = data as {
        success?: boolean;
        ticket_id?: string;
        card_error?: boolean;
        error?: string;
        requires_action?: boolean;
      } | null;

      if (!response) throw new Error("Empty response");

      if (response.success) {
        triggerSuccessHaptic();
        toast.success("Payment successful!");
        onPaymentSuccess();
        return;
      }

      if (response.card_error) {
        setChargeError(response.error || "Your card was declined. Please update your payment method.");
        setSavedMethod(null); // Force new card entry
        return;
      }

      if (response.requires_action) {
        // 3D Secure needed — fall back to Checkout
        toast.info("Additional verification needed. Redirecting...");
        await handleNewCardPayment();
        return;
      }

      throw new Error(response.error || "Payment failed");
    } catch (err: any) {
      console.error("[PaymentDrawer] Saved method charge error:", err);
      toast.error("Payment failed", { description: err.message });
    } finally {
      setIsProcessing(false);
    }
  }, [savedMethod, eventId, onPaymentSuccess]);

  const brandLabel = (brand: string) => {
    const map: Record<string, string> = {
      visa: "Visa",
      mastercard: "Mastercard",
      amex: "Amex",
      discover: "Discover",
    };
    return map[brand] || brand.charAt(0).toUpperCase() + brand.slice(1);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed top-0 left-0 w-full h-[100vh] z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-0 m-0"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="relative bg-card rounded-3xl w-[90%] max-w-[420px]"
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
                    {effectivelyFree ? "Free" : `$${price.toFixed(2)}`}
                  </span>
                </div>
                {!effectivelyFree && (
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-muted-foreground">Processing fee</span>
                    <span className="text-sm text-foreground">
                      ${processingFee.toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 border-t border-border">
                  <span className="text-sm font-semibold text-foreground">Total</span>
                  <span className="text-lg font-bold text-primary">
                    {effectivelyFree ? "Free" : `$${buyerTotal.toFixed(2)}`}
                  </span>
                </div>
                {!effectivelyFree && (
                  <p className="text-[11px] text-muted-foreground/70 mt-2">
                    Processing fee supports secure card payments via Stripe.
                  </p>
                )}
              </div>

              {/* Card error message */}
              {chargeError && (
                <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/30 rounded-xl p-3 mb-4">
                  <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-destructive">{chargeError}</p>
                </div>
              )}

              {/* Loading saved method check */}
              {!effectivelyFree && isCheckingMethod && (
                <div className="flex items-center justify-center gap-2 py-4 mb-4">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Checking payment method...</span>
                </div>
              )}

              {/* Free Entry */}
              {effectivelyFree && (
                <>
                  <button
                    onClick={handleFreeEntry}
                    disabled={isProcessing}
                    className="w-full py-4 rounded-2xl bg-primary text-primary-foreground font-semibold text-base flex items-center justify-center gap-2 disabled:opacity-50 transition-all hover:opacity-90"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      "Enter Free"
                    )}
                  </button>
                  <p className="text-xs text-center text-muted-foreground mt-4">
                    Free entry • Instant access
                  </p>
                </>
              )}

              {/* Paid: Saved method → Swipe to Pay */}
              {!effectivelyFree && !isCheckingMethod && savedMethod && (
                <>
                  <div className="flex items-center gap-3 bg-muted/30 rounded-xl px-4 py-3 mb-4">
                    <CreditCard className="w-5 h-5 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">
                        {brandLabel(savedMethod.brand)} •••• {savedMethod.last4}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Expires {savedMethod.exp_month}/{savedMethod.exp_year}
                      </p>
                    </div>
                  </div>

                  {isProcessing ? (
                    <div className="w-full py-4 rounded-2xl bg-primary/80 text-primary-foreground font-semibold text-base flex items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Charging...
                    </div>
                  ) : (
                    <SlideToAction
                      onComplete={handleSavedMethodCharge}
                      label={`Swipe to Pay $${buyerTotal.toFixed(2)}`}
                      completedLabel="Paid ✓"
                    />
                  )}

                  <button
                    onClick={() => {
                      setSavedMethod(null);
                      setChargeError(null);
                    }}
                    disabled={isProcessing}
                    className="w-full mt-3 text-sm text-muted-foreground hover:text-foreground text-center transition-colors"
                  >
                    Use a different card
                  </button>

                  <p className="text-xs text-center text-muted-foreground mt-3">
                    Charged securely via Stripe
                  </p>
                </>
              )}

              {/* Paid: No saved method → Redirect to Stripe Checkout */}
              {!effectivelyFree && !isCheckingMethod && !savedMethod && (
                <>
                  <button
                    onClick={handleNewCardPayment}
                    disabled={isProcessing}
                    className="w-full py-4 rounded-2xl bg-primary text-primary-foreground font-semibold text-base flex items-center justify-center gap-2 disabled:opacity-50 transition-all hover:opacity-90"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Redirecting to Stripe...
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-5 h-5" />
                        Pay with Card — ${buyerTotal.toFixed(2)}
                        <ExternalLink className="w-4 h-4" />
                      </>
                    )}
                  </button>
                  <p className="text-xs text-center text-muted-foreground mt-4">
                    You'll be redirected to Stripe for secure payment.
                    Your card will be saved for faster checkout next time.
                  </p>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
