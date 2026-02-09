import React from "react";
import { toast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { triggerClickHaptic } from "@/lib/haptics";

export const SUPPORT_EMAIL = "support@joinexhiby.com";
const SUPPORT_SUBJECT = "Exhiby Support Request";
const SUPPORT_BODY = "Hi Exhiby team, I need help with: ";

export function getSupportMailtoLink(): string {
  const subject = encodeURIComponent(SUPPORT_SUBJECT);
  const body = encodeURIComponent(SUPPORT_BODY);
  return `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
}

function showEmailFallbackToast(email: string) {
  toast({
    title: "Couldn't open email app",
    description: `Email us at ${email}`,
    duration: 8000,
    action: (
      <ToastAction
        altText="Copy support email"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(email);
            toast({ title: "Copied", description: email, duration: 2000 });
          } catch {
            toast({
              title: "Copy failed",
              description: email,
              duration: 6000,
            });
          }
        }}
      >
        Copy email
      </ToastAction>
    ),
  });
}

/**
 * Attempts to open the OS/default email client using a mailto: link.
 * We avoid any https://outlook... fallbacks and only show a toast if the app didn't background.
 */
export function openSupportEmail() {
  triggerClickHaptic();

  const mailtoLink = getSupportMailtoLink();

  let didBackground = false;
  let timeoutId: number | undefined;

  const cleanup = () => {
    if (timeoutId) window.clearTimeout(timeoutId);
    window.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("pagehide", onPageHide);
    window.removeEventListener("blur", onBlur);
  };

  const markBackgrounded = () => {
    didBackground = true;
    cleanup();
  };

  const onVisibilityChange = () => {
    if (document.visibilityState === "hidden") markBackgrounded();
  };

  const onPageHide = () => markBackgrounded();
  const onBlur = () => markBackgrounded();

  window.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("pagehide", onPageHide);
  window.addEventListener("blur", onBlur);

  // Try opening externally (no iframes, no webmail URLs)
  try {
    window.open(mailtoLink, "_self");
  } catch {
    // ignore
  }

  try {
    window.location.href = mailtoLink;
  } catch {
    // ignore
  }

  timeoutId = window.setTimeout(() => {
    cleanup();
    if (!didBackground) showEmailFallbackToast(SUPPORT_EMAIL);
  }, 1500);
}
