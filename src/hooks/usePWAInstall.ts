import { useState, useEffect, useCallback, useRef } from "react";

export type PWAPlatform = "android" | "ios" | "ios-ipad" | "desktop" | "unsupported";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface UsePWAInstallReturn {
  showBanner: boolean;
  platform: PWAPlatform;
  isInstalling: boolean;
  triggerInstall: () => Promise<void>;
  dismiss: () => void;
}

const DISMISS_KEY    = "exhiby_pwa_dismiss_until";
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000;         // 7 days
const INSTALL_TTL_MS = 365 * 24 * 60 * 60 * 1000;        // 1 year (post-install)
const SHOW_DELAY_MS  = 25_000;                            // 25 seconds after page load

export function usePWAInstall(): UsePWAInstallReturn {
  const [showBanner, setShowBanner]   = useState(false);
  const [platform, setPlatform]       = useState<PWAPlatform>("unsupported");
  const [isInstalling, setIsInstalling] = useState(false);

  // Ref so the 25-second timer closure always sees the latest prompt,
  // even if beforeinstallprompt fires after the timer starts.
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // ── Guard 1: already running as an installed PWA ─────────────────────────
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true; // iOS Safari proprietary flag
    if (isStandalone) return;

    // ── Guard 2: user already dismissed (or installed) within TTL ────────────
    const raw = localStorage.getItem(DISMISS_KEY);
    if (raw && Date.now() < parseInt(raw, 10)) return;

    const ua = navigator.userAgent;

    // iPad OS 13+ reports as "MacIntel" with touch points — maxTouchPoints alone
    // is the correct modern check. navigator.platform is deprecated.
    const isIPad    = /ipad/i.test(ua) || (navigator.maxTouchPoints > 1 && /macintosh/i.test(ua));
    const isIPhone  = /iphone|ipod/i.test(ua);
    const isAndroid = /android/i.test(ua);

    // ── Detect iOS Safari ─────────────────────────────────────────────────────
    // Must be Safari specifically — Chrome/Firefox on iOS cannot install PWAs.
    // CriOS / FxiOS / OPiOS / EdgiOS / mercury = third-party iOS browsers.
    const isIOSSafari =
      (isIPhone || isIPad) &&
      /safari/i.test(ua) &&
      !/CriOS|FxiOS|OPiOS|EdgiOS|mercury/i.test(ua);

    if (isIOSSafari) {
      // Differentiate iPad vs iPhone — Safari's Share button is at the top on
      // iPad and at the bottom on iPhone, so the instructions differ.
      setPlatform(isIPad ? "ios-ipad" : "ios");
    }

    // ── Capture native install prompt (Android Chrome + desktop Chrome/Edge) ──
    // beforeinstallprompt fires on Android Chrome AND on desktop Chrome/Edge.
    // preventDefault() stops the browser's own mini-infobar so we control timing.
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      deferredPromptRef.current = e as BeforeInstallPromptEvent;
      // On Android → "android"; on desktop (MacBook, Windows, Linux) → "desktop"
      setPlatform(isAndroid ? "android" : "desktop");
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    // ── Show banner after 25 seconds ─────────────────────────────────────────
    const timer = setTimeout(() => {
      const canShowPrompt = deferredPromptRef.current !== null; // Android Chrome OR desktop Chrome/Edge
      const canShowIOS    = isIOSSafari;
      if (canShowPrompt || canShowIOS) {
        setShowBanner(true);
      }
    }, SHOW_DELAY_MS);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []); // runs once on mount

  // ── Trigger native install (Android Chrome + desktop Chrome/Edge) ────────
  const triggerInstall = useCallback(async () => {
    const prompt = deferredPromptRef.current;
    if (!prompt || isInstalling) return;

    setIsInstalling(true);
    try {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;

      // Prompt is consumed after one use regardless of outcome.
      setShowBanner(false);
      deferredPromptRef.current = null;

      if (outcome === "accepted") {
        // Installed — suppress banner for a year (effectively forever).
        localStorage.setItem(DISMISS_KEY, String(Date.now() + INSTALL_TTL_MS));
      } else {
        // Dismissed native dialog — treat same as banner dismiss so we don't
        // immediately re-show on the next page load.
        localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_TTL_MS));
      }
    } catch {
      // prompt() throws if called twice or in an unsupported context.
      // Fail silently — don't crash the app over a non-critical feature.
      setShowBanner(false);
      deferredPromptRef.current = null;
    } finally {
      setIsInstalling(false);
    }
  }, [isInstalling]);

  // ── Dismiss for 7 days ───────────────────────────────────────────────────
  const dismiss = useCallback(() => {
    setShowBanner(false);
    localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_TTL_MS));
  }, []);

  return { showBanner, platform, isInstalling, triggerInstall, dismiss };
}
