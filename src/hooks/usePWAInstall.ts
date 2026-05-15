import { useState, useEffect, useCallback, useRef } from "react";

export type PWAPlatform = "android" | "ios" | "unsupported";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface UsePWAInstallReturn {
  showBanner: boolean;
  platform: PWAPlatform;
  triggerInstall: () => Promise<void>;
  dismiss: () => void;
}

const DISMISS_KEY    = "exhiby_pwa_dismiss_until";
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const SHOW_DELAY_MS  = 25_000;                    // 25 seconds after page load

export function usePWAInstall(): UsePWAInstallReturn {
  const [showBanner, setShowBanner]   = useState(false);
  const [platform, setPlatform]       = useState<PWAPlatform>("unsupported");

  // Ref so the 25-second timer closure always sees the latest prompt,
  // even if beforeinstallprompt fires after the timer starts.
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // ── Guard 1: already running as an installed PWA ─────────────────────────
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true; // iOS Safari flag
    if (isStandalone) return;

    // ── Guard 2: user already dismissed within 7 days ────────────────────────
    const raw = localStorage.getItem(DISMISS_KEY);
    if (raw && Date.now() < parseInt(raw, 10)) return;

    // ── Guard 3: only show on mobile — no home screen concept on desktop ─────
    const ua = navigator.userAgent;
    const isMobile =
      /android|iphone|ipad|ipod/i.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    if (!isMobile) return;

    // ── Detect iOS Safari ─────────────────────────────────────────────────────
    // Must be Safari specifically — Chrome/Firefox on iOS cannot install PWAs
    // and there's no point showing instructions that won't work.
    const isIOS =
      /iphone|ipad|ipod/i.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isIOSSafari =
      isIOS &&
      /safari/i.test(ua) &&
      !/CriOS|FxiOS|OPiOS|EdgiOS|mercury/i.test(ua);

    if (isIOSSafari) {
      setPlatform("ios");
    }

    // ── Capture Android Chrome's native install prompt ────────────────────────
    // preventDefault() stops Chrome from showing its own mini-infobar so we
    // control when the prompt appears.
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      deferredPromptRef.current = e as BeforeInstallPromptEvent;
      setPlatform("android");
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    // ── Show banner after 25 seconds ─────────────────────────────────────────
    // At this point we check the ref (Android) or the platform flag (iOS).
    const timer = setTimeout(() => {
      const canShowAndroid = deferredPromptRef.current !== null;
      const canShowIOS     = isIOSSafari;

      if (canShowAndroid || canShowIOS) {
        setShowBanner(true);
      }
    }, SHOW_DELAY_MS);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []); // runs once on mount

  // ── Trigger native Android install ───────────────────────────────────────
  const triggerInstall = useCallback(async () => {
    const prompt = deferredPromptRef.current;
    if (!prompt) return;

    await prompt.prompt();
    const { outcome } = await prompt.userChoice;

    // Accepted or dismissed — either way the prompt is consumed and can't be
    // re-used. Hide the banner and clear the ref.
    setShowBanner(false);
    deferredPromptRef.current = null;

    if (outcome === "accepted") {
      // User installed — record so we never show the banner again
      localStorage.setItem(DISMISS_KEY, String(Date.now() + 365 * 24 * 60 * 60 * 1000));
    }
  }, []);

  // ── Dismiss for 7 days ───────────────────────────────────────────────────
  const dismiss = useCallback(() => {
    setShowBanner(false);
    localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_TTL_MS));
  }, []);

  return { showBanner, platform, triggerInstall, dismiss };
}
