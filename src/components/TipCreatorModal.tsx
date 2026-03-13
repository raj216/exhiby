import { useMemo, useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Coins, X, Loader2, CreditCard, ExternalLink, AlertCircle } from "lucide-react";
import { useScrollLock } from "@/hooks/useScrollLock";
import { triggerClickHaptic, triggerSuccessHaptic } from "@/lib/haptics";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SlideToAction } from "./SlideToAction";
import { calculateProcessingFee, calculateBuyerTotal } from "@/lib/processingFee";

interface SavedPaymentMethod {
  id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
}

interface TipCreatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  creatorName: string;
  eventId?: string;
}

const QUICK_AMOUNTS = [5, 10, 20, 50] as const;

export function TipCreatorModal({
  isOpen,
  onClose,
  creatorName,
  eventId,
}: TipCreatorModalProps) {
  const [selectedAmount, setSelectedAmount] = useState<(typeof QUICK_AMOUNTS)[number] | null>(10);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCheckingMethod, setIsCheckingMethod] = useState(false);
  const [savedMethod, setSavedMethod] = useState<SavedPaymentMethod | null>(null);
  const [chargeError, setChargeError] = useState<string | null>(null);

  useScrollLock(isOpen);

  const resolvedAmount = useMemo(() => {
    const custom = Number(customAmount);
    if (!Number.isNaN(custom) && custom > 0) return custom;
    return selectedAmount ?? 0;
  }, [customAmount, selectedAmount]);

  const processingFee = useMemo(() => calculateProcessingFee(resolvedAmount), [resolvedAmount]);
  const buyerTotal = useMemo(() => calculateBuyerTotal(resolvedAmount), [resolvedAmount]);

  // Check for saved payment method
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const check = async () => {
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
    check();
    return () => { cancelled = true; };
  }, [isOpen]);

  const handleClose = () => {
    triggerClickHaptic();
    setChargeError(null);
    onClose();
  };

  const handleSelectQuick = (amt: (typeof QUICK_AMOUNTS)[number]) => {
    triggerClickHaptic();
    setSelectedAmount(amt);
    setCustomAmount("");
  };

  // Charge saved method for tip
  const handleSavedTip = useCallback(async () => {
    if (!savedMethod || resolvedAmount < 1) return;
    setIsProcessing(true);
    setChargeError(null);
    try {
      const { data, error } = await supabase.functions.invoke("create-tip-payment", {
        body: {
          amount: resolvedAmount,
          payment_method_id: savedMethod.id,
          event_id: eventId || "",
        },
      });
      if (error) throw new Error(error.message || "Tip failed");
      if (data?.success) {
        triggerSuccessHaptic();
        toast.success(`$${resolvedAmount} tip sent to ${creatorName}!`);
        onClose();
        return;
      }
      if (data?.card_error) {
        setChargeError(data.error || "Card declined. Please try a different card.");
        setSavedMethod(null);
        return;
      }
      throw new Error(data?.error || "Tip failed");
    } catch (err: any) {
      toast.error("Tip failed", { description: err.message });
    } finally {
      setIsProcessing(false);
    }
  }, [savedMethod, resolvedAmount, eventId, creatorName, onClose]);

  // Redirect to Stripe Checkout for tip (no saved method)
  const handleNewCardTip = async () => {
    if (resolvedAmount < 1) {
      toast.error("Minimum tip is $1");
      return;
    }
    setIsProcessing(true);
    setChargeError(null);
    try {
      const { data, error } = await supabase.functions.invoke("create-tip-payment", {
        body: {
          amount: resolvedAmount,
          event_id: eventId || "",
          origin: window.location.origin,
        },
      });
      if (error) throw new Error(error.message || "Failed to create tip session");
      if (data?.url) {
        toast.info("Redirecting to secure payment...", { duration: 3000 });
        window.location.href = data.url;
        return;
      }
      throw new Error("No checkout URL received");
    } catch (err: any) {
      toast.error("Tip failed", { description: err.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const brandLabel = (brand: string) => {
    const map: Record<string, string> = {
      visa: "Visa",
      mastercard: "Mastercard",
      amex: "Amex",
      discover: "Discover",
    };
    return map[brand] || brand.charAt(0).toUpperCase() + brand.slice(1);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] grid place-items-center bg-black/70 backdrop-blur-sm"
          style={{ height: "100dvh" }}
          onClick={handleClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 6 }}
            transition={{ type: "spring", damping: 26, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
            className="w-[min(92vw,520px)] max-h-[85dvh] overflow-auto bg-obsidian border border-border/40 rounded-2xl shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-start justify-between p-5 pb-3">
              <div>
                <h2 className="font-display text-lg md:text-xl text-foreground font-semibold">
                  Tip {creatorName}
                </h2>
                <p className="text-sm text-muted-foreground mt-0.5">Show your support</p>
              </div>
              <button
                onClick={handleClose}
                className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center hover:bg-muted/70 transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 pb-6">
              {/* Quick amounts */}
              <div className="mt-2">
                <p className="text-xs text-muted-foreground mb-2">Quick amounts</p>
                <div className="flex flex-wrap gap-2">
                  {QUICK_AMOUNTS.map((amt) => {
                    const active = selectedAmount === amt && !customAmount;
                    return (
                      <button
                        key={amt}
                        onClick={() => handleSelectQuick(amt)}
                        className={
                          "px-4 py-2 rounded-full border text-sm font-medium transition-colors " +
                          (active
                            ? "bg-muted border-border text-foreground"
                            : "bg-carbon border-border/30 text-muted-foreground hover:bg-muted/30")
                        }
                      >
                        ${amt}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom amount */}
              <div className="mt-4">
                <label className="text-xs text-muted-foreground">Custom amount</label>
                <input
                  inputMode="decimal"
                  placeholder="Enter amount"
                  value={customAmount}
                  onChange={(e) => {
                    setCustomAmount(e.target.value);
                    setSelectedAmount(null);
                  }}
                  className="premium-input mt-2 w-full"
                />
              </div>

              {/* Error */}
              {chargeError && (
                <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/30 rounded-xl p-3 mt-4">
                  <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-destructive">{chargeError}</p>
                </div>
              )}

              {/* Fee breakdown */}
              {resolvedAmount > 0 && !isCheckingMethod && (
                <div className="mt-4 bg-muted/20 rounded-xl px-4 py-3 space-y-1.5">
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Tip</span>
                    <span>${resolvedAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Processing fee</span>
                    <span>${processingFee.toFixed(2)}</span>
                  </div>
                  <div className="border-t border-border/30 pt-1.5 flex justify-between text-sm font-medium text-foreground">
                    <span>Total</span>
                    <span>${buyerTotal.toFixed(2)}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground/70">
                    Processing fee covers card transaction costs
                  </p>
                </div>
              )}

              {/* Loading */}
              {isCheckingMethod && (
                <div className="flex items-center justify-center gap-2 py-4 mt-4">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Checking payment method...</span>
                </div>
              )}

              {/* Footer - Saved method */}
              {!isCheckingMethod && savedMethod && (
                <div className="mt-6 space-y-3">
                  <div className="flex items-center gap-3 bg-muted/30 rounded-xl px-4 py-3">
                    <CreditCard className="w-5 h-5 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">
                        {brandLabel(savedMethod.brand)} •••• {savedMethod.last4}
                      </p>
                    </div>
                  </div>

                  {isProcessing ? (
                    <div className="w-full py-4 rounded-2xl bg-primary/80 text-primary-foreground font-semibold text-base flex items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Sending tip...
                    </div>
                  ) : (
                    <SlideToAction
                      onComplete={handleSavedTip}
                      label={resolvedAmount > 0 ? `Swipe to Tip $${resolvedAmount}` : "Select amount"}
                      completedLabel="Sent ✓"
                      icon={<Coins className="w-5 h-5 text-white" />}
                    />
                  )}

                  <button
                    onClick={() => setSavedMethod(null)}
                    disabled={isProcessing}
                    className="w-full text-sm text-muted-foreground hover:text-foreground text-center transition-colors"
                  >
                    Use a different card
                  </button>
                </div>
              )}

              {/* Footer - No saved method */}
              {!isCheckingMethod && !savedMethod && (
                <div className="mt-6 flex gap-3">
                  <button
                    onClick={handleNewCardTip}
                    disabled={isProcessing || resolvedAmount < 1}
                    className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition-all hover:opacity-90"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Redirecting...
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-4 h-4" />
                        Pay with Card{resolvedAmount > 0 ? ` • $${resolvedAmount}` : ""}
                        <ExternalLink className="w-3 h-3" />
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleClose}
                    className="px-5 py-3 rounded-xl bg-carbon border border-border/30 text-foreground font-medium hover:bg-muted/30 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}

              <p className="text-xs text-center text-muted-foreground mt-4">
                {savedMethod
                  ? "Charged securely via Stripe"
                  : "Your card will be saved for faster tips next time"}
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
