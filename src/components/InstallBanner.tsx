import { motion, AnimatePresence } from "framer-motion";
import { X, Download } from "lucide-react";
import { usePWAInstall } from "@/hooks/usePWAInstall";

// ── iOS Share icon SVG ────────────────────────────────────────────────────────
// Matches the exact Safari toolbar share button so users recognise it instantly.
function IOSShareIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="inline-block"
    >
      {/* Arrow pointing up */}
      <polyline points="12 2 12 15" />
      <polyline points="8 6 12 2 16 6" />
      {/* Box / tray */}
      <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
    </svg>
  );
}

// ── Add to Home Screen icon ───────────────────────────────────────────────────
function AddToHomeIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="inline-block"
    >
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}

// ── Step row ─────────────────────────────────────────────────────────────────
function Step({
  number,
  children,
}: {
  number: number;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-electric/20 border border-electric/40 flex items-center justify-center text-[10px] font-bold text-electric mt-0.5">
        {number}
      </span>
      <p className="text-sm text-foreground/80 leading-relaxed">{children}</p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function InstallBanner() {
  const { showBanner, platform, triggerInstall, dismiss } = usePWAInstall();

  return (
    <AnimatePresence>
      {showBanner && platform !== "unsupported" && (
        <motion.div
          key="install-banner"
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 300 }}
          // Sits above the bottom nav bar (≈76px) with a small gap
          className="fixed left-3 right-3 z-30"
          style={{ bottom: "80px" }}
        >
          <div className="bg-carbon/98 backdrop-blur-xl border border-border/40 rounded-2xl shadow-2xl overflow-hidden max-w-lg mx-auto">

            {/* ── Header ───────────────────────────────────────────────────── */}
            <div className="flex items-center gap-3 px-4 pt-4 pb-3">
              {/* App icon */}
              <div className="w-10 h-10 rounded-xl bg-obsidian border border-border/30 flex-shrink-0 overflow-hidden">
                <img
                  src="/android-chrome-192x192.png"
                  alt="Exhiby"
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground leading-tight">
                  {platform === "ios"
                    ? "Add Exhiby to your Home Screen"
                    : "Install Exhiby"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {platform === "ios"
                    ? "3 quick steps in Safari"
                    : "One tap — works like a real app"}
                </p>
              </div>

              {/* Dismiss */}
              <button
                onClick={dismiss}
                className="flex-shrink-0 w-7 h-7 rounded-full bg-muted/20 flex items-center justify-center hover:bg-muted/40 transition-colors"
                aria-label="Dismiss install prompt"
              >
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </div>

            {/* ── Divider ──────────────────────────────────────────────────── */}
            <div className="h-px bg-border/20 mx-4" />

            {/* ── iOS: 3-step guide ─────────────────────────────────────────── */}
            {platform === "ios" && (
              <div className="px-4 py-4 space-y-3">
                <Step number={1}>
                  Tap the{" "}
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-muted/30 border border-border/30 text-foreground font-medium text-xs">
                    <IOSShareIcon size={13} />
                    Share
                  </span>{" "}
                  button at the bottom of Safari
                </Step>

                <Step number={2}>
                  Scroll down and tap{" "}
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-muted/30 border border-border/30 text-foreground font-medium text-xs">
                    <AddToHomeIcon size={13} />
                    Add to Home Screen
                  </span>
                </Step>

                <Step number={3}>
                  Tap{" "}
                  <span className="px-1.5 py-0.5 rounded-md bg-muted/30 border border-border/30 text-foreground font-medium text-xs">
                    Add
                  </span>{" "}
                  in the top-right corner to confirm
                </Step>

                {/* Visual hint pointing down toward Safari toolbar */}
                <p className="text-[11px] text-muted-foreground/50 text-center pt-1">
                  The Share button is in Safari's toolbar at the bottom of your screen
                </p>
              </div>
            )}

            {/* ── Android: single install button ────────────────────────────── */}
            {platform === "android" && (
              <div className="px-4 py-4">
                <button
                  onClick={triggerInstall}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white transition-opacity active:opacity-80"
                  style={{
                    background:
                      "linear-gradient(135deg, hsl(7 100% 67%), hsl(345 100% 50%))",
                    boxShadow: "0 4px 16px hsla(7, 100%, 67%, 0.30)",
                  }}
                >
                  <Download className="w-4 h-4" />
                  Install App
                </button>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
