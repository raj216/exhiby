import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Coins, X } from "lucide-react";
import { useScrollLock } from "@/hooks/useScrollLock";
import { triggerClickHaptic } from "@/lib/haptics";

interface TipCreatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  creatorName: string;
  onComingSoon?: () => void;
}

const QUICK_AMOUNTS = [5, 10, 20, 50] as const;

export function TipCreatorModal({
  isOpen,
  onClose,
  creatorName,
  onComingSoon,
}: TipCreatorModalProps) {
  const [selectedAmount, setSelectedAmount] = useState<(typeof QUICK_AMOUNTS)[number] | null>(10);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [message, setMessage] = useState<string>("");

  useScrollLock(isOpen);

  const resolvedAmount = useMemo(() => {
    const custom = Number(customAmount);
    if (!Number.isNaN(custom) && custom > 0) return custom;
    return selectedAmount ?? 0;
  }, [customAmount, selectedAmount]);

  const handleClose = () => {
    triggerClickHaptic();
    onClose();
  };

  const handleSelectQuick = (amt: (typeof QUICK_AMOUNTS)[number]) => {
    triggerClickHaptic();
    setSelectedAmount(amt);
    setCustomAmount("");
  };

  const handleSend = () => {
    triggerClickHaptic();
    onComingSoon?.();
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
                <p className="text-sm text-muted-foreground mt-0.5">Tips will be enabled soon.</p>
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

              {/* Message */}
              <div className="mt-4">
                <label className="text-xs text-muted-foreground">Message (optional)</label>
                <textarea
                  placeholder="Say something kind…"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  className="mt-2 w-full rounded-xl bg-carbon border border-border/30 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {/* Footer */}
              <div className="mt-6 flex gap-3">
                <button
                  onClick={handleSend}
                  disabled
                  className="flex-1 py-3 rounded-xl bg-muted/60 border border-border/50 text-foreground/60 font-semibold flex items-center justify-center gap-2 cursor-not-allowed"
                >
                  <Coins className="w-4 h-4" />
                  Send Tip{resolvedAmount > 0 ? ` • $${resolvedAmount}` : ""}
                </button>
                <button
                  onClick={handleClose}
                  className="px-5 py-3 rounded-xl bg-carbon border border-border/30 text-foreground font-medium hover:bg-muted/30 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
