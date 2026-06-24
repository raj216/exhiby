import { motion, AnimatePresence } from "framer-motion";
import { X, Download, Loader2 } from "lucide-react";
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
// Reusable one-tap install button — same flow for Android and desktop Chrome/Edge.
function InstallButton({
  onClick,
  isInstalling,
}: {
  onClick: () => void;
  isInstalling: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={isInstalling}
      aria-busy={isInstalling}
      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white transition-opacity active:opacity-80 disabled:opacity-60 disabled:cursor-not-allowed"
      style={{
        background: "linear-gradient(135deg, hsl(7 100% 67%), hsl(345 100% 50%))",
        boxShadow: isInstalling ? "none" : "0 4px 16px hsla(7, 100%, 67%, 0.30)",
      }}
    >
      {isInstalling ? (
        <><Loader2 className="w-4 h-4 animate-spin" />Installing…</>
      ) : (
        <><Download className="w-4 h-4" />Install App</>
      )}
    </button>
  );
}

export function InstallBanner() {
  const { showBanner, platform, isInstalling, triggerInstall, dismiss } = usePWAInstall();

  const isIOS = platform === "ios" || platform === "ios-ipad";

  return (
    <AnimatePresence>
      {showBanner && platform !== "unsupported" && (
        <motion.div
          key="install-banner"
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 300 }}
          // Mobile: full-width toast floating above the bottom nav (≈80px),
          //   with env(safe-area-inset-bottom) so it clears the iPhone home
          //   indicator. z-[50] keeps it above the nav (z-40) + Go Live button.
          // Desktop: there is no bottom nav, so anchor it as a conventional
          //   bottom-right toast instead of floating mid-screen.
          className={
            platform === "desktop"
              ? "fixed right-4 z-[50] w-[calc(100%-2rem)] max-w-sm"
              : "fixed left-3 right-3 z-[50]"
          }
          style={{
            bottom:
              platform === "desktop"
                ? "1.5rem"
                : "calc(80px + env(safe-area-inset-bottom, 0px))",
          }}
        >
          <div className="bg-carbon/98 backdrop-blur-xl border border-border/40 rounded-2xl shadow-2xl overflow-hidden max-w-lg mx-auto">

            {/* ── Header ───────────────────────────────────────────────────── */}
            <div className="flex items-center gap-3 px-4 pt-4 pb-3">
              {/* App icon */}
              <div className="w-10 h-10 rounded-xl bg-obsidian border border-border/30 flex-shrink-0 overflow-hidden">
                <img
                  src={isIOS ? "/apple-touch-icon.png" : "/android-chrome-192x192.png"}
                  alt="Exhiby"
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground leading-tight">
                  {isIOS ? "Add Exhiby to your Home Screen" : "Install Exhiby"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isIOS
                    ? "3 quick steps in Safari"
                    : platform === "desktop"
                    ? "One click — adds Exhiby to your dock or taskbar"
                    : "One tap — adds Exhiby to your home screen"}
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

            {/* ── iPhone: 3-step guide (Share button is at the BOTTOM) ──────── */}
            {platform === "ios" && (
              <div className="px-4 py-4 space-y-3">
                <Step number={1}>
                  Tap the{" "}
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-muted/30 border border-border/30 text-foreground font-medium text-xs">
                    <IOSShareIcon size={13} />
                    Share
                  </span>{" "}
                  button at the <strong>bottom</strong> of Safari
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
                <p className="text-[11px] text-muted-foreground/50 text-center pt-1">
                  The Share button is in Safari's toolbar at the bottom of your screen
                </p>
              </div>
            )}

            {/* ── iPad: 3-step guide (Share button is at the TOP) ───────────── */}
            {platform === "ios-ipad" && (
              <div className="px-4 py-4 space-y-3">
                <Step number={1}>
                  Tap the{" "}
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-muted/30 border border-border/30 text-foreground font-medium text-xs">
                    <IOSShareIcon size={13} />
                    Share
                  </span>{" "}
                  button in the <strong>top</strong> toolbar of Safari
                </Step>
                <Step number={2}>
                  Tap{" "}
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
                <p className="text-[11px] text-muted-foreground/50 text-center pt-1">
                  The Share button is in Safari's address bar area at the top
                </p>
              </div>
            )}

            {/* ── Android / Desktop Chrome & Edge: one-tap install ──────────── */}
            {(platform === "android" || platform === "desktop") && (
              <div className="px-4 py-4">
                <InstallButton onClick={triggerInstall} isInstalling={isInstalling} />
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
