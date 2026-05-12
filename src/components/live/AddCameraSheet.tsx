/**
 * AddCameraSheet — Studio Companion
 *
 * Lets the creator open their live studio on a second device (phone, tablet,
 * another laptop) to manage chat, hand-raises, and materials without needing
 * a camera on that device. The creator stays focused on their work; their
 * assistant screen handles the audience.
 *
 * The "Second Camera" tab has been removed — the companion mode is the
 * meaningful pro workflow and the one we want to present.
 */

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { X, Tablet, ScanLine, Hand, MessageSquare } from "lucide-react";
import { triggerHaptic } from "@/lib/haptics";

interface AddCameraSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** URL that opens the companion manage-view on the second device */
  companionUrl: string;
  /** Kept for backward-compat; no longer rendered */
  cameraUrl?: string;
  /** Kept for backward-compat; no longer rendered */
  isConnected?: boolean;
}

const STEPS = [
  {
    Icon: Tablet,
    title: "Open on your second device",
    body: "Any phone, tablet, or laptop — no app install needed.",
  },
  {
    Icon: ScanLine,
    title: "Scan the QR code",
    body: "Point your second device camera at this screen, then tap the link.",
  },
  {
    Icon: Hand,
    title: "Manage your show",
    body: "Chat, handle hand-raises, and manage materials — your camera stays here.",
  },
];

export function AddCameraSheet({
  isOpen,
  onClose,
  companionUrl,
}: AddCameraSheetProps) {
  // Lock body scroll while open
  useEffect(() => {
    if (!isOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = original; };
  }, [isOpen]);

  const handleClose = () => {
    triggerHaptic("light");
    onClose();
  };

  // Render through a portal so Framer Motion parent transforms don't
  // misposition the fixed backdrop/sheet on mobile.
  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={handleClose}
            className="fixed inset-0 z-[9998] bg-black/75 backdrop-blur-sm"
            aria-hidden="true"
          />

          {/* Sheet */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Studio Companion"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 32, mass: 1 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) handleClose();
            }}
            className="fixed bottom-0 left-0 right-0 z-[9999] rounded-t-3xl shadow-2xl overflow-hidden"
            style={{
              backgroundColor: "#0e0e0e",
              paddingBottom: "env(safe-area-inset-bottom)",
            }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            {/* Header */}
            <div className="px-6 pt-3 pb-4 flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <MessageSquare className="w-4 h-4 text-white/50" />
                  <h2 className="font-display text-xl text-white leading-tight tracking-tight">
                    Studio Companion
                  </h2>
                </div>
                <p className="text-sm text-white/55 leading-snug">
                  Control your show from a second device — chat, questions, and
                  materials — while you stay focused on your art.
                </p>
              </div>
              <button
                onClick={handleClose}
                className="w-8 h-8 rounded-full bg-white/8 hover:bg-white/15 flex items-center justify-center transition-colors flex-shrink-0 mt-0.5"
                aria-label="Close"
              >
                <X className="w-4 h-4 text-white/60" />
              </button>
            </div>

            {/* QR Code */}
            <div className="px-6 pb-5 flex flex-col items-center gap-3">
              <div className="p-3 rounded-2xl bg-white shadow-xl">
                <QRCodeSVG
                  value={companionUrl}
                  size={200}
                  level="M"
                  bgColor="#ffffff"
                  fgColor="#0e0e0e"
                />
              </div>
              <p className="text-[11px] text-white/35 tracking-wide">
                Scan with any camera app
              </p>
            </div>

            {/* Divider */}
            <div className="mx-6 border-t border-white/[0.06] mb-4" />

            {/* Steps */}
            <div className="px-6 pb-7 space-y-2.5">
              {STEPS.map((step, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 px-3.5 py-3 rounded-2xl"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <div className="flex items-center justify-center w-7 h-7 rounded-full bg-white/8 text-white/70 text-xs font-semibold flex-shrink-0 mt-0.5">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <step.Icon className="w-3.5 h-3.5 text-white/40" />
                      <p className="text-sm font-semibold text-white/90">{step.title}</p>
                    </div>
                    <p className="text-xs text-white/45 leading-snug">{step.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
