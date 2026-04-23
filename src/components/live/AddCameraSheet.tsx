import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { X, Check, Camera, ScanLine, Hand, Tablet } from "lucide-react";
import { triggerHaptic } from "@/lib/haptics";

type SheetTab = "camera" | "companion";

interface AddCameraSheetProps {
  isOpen: boolean;
  onClose: () => void;
  cameraUrl: string;
  companionUrl: string;
  isConnected: boolean;
}

export function AddCameraSheet({
  isOpen,
  onClose,
  cameraUrl,
  companionUrl,
  isConnected,
}: AddCameraSheetProps) {
  const [activeTab, setActiveTab] = useState<SheetTab>("camera");

  // Lock body scroll when open
  useEffect(() => {
    if (!isOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [isOpen]);

  // Reset tab when closed
  useEffect(() => {
    if (!isOpen) setActiveTab("camera");
  }, [isOpen]);

  const handleClose = () => {
    triggerHaptic("light");
    onClose();
  };

  const cameraSteps = [
    {
      icon: Camera,
      title: "Open your phone camera",
      body: "Use the built-in camera app — no install required.",
    },
    {
      icon: ScanLine,
      title: "Scan the QR code",
      body: "Point at this screen until a link appears, then tap it.",
    },
    {
      icon: Hand,
      title: "Log in and go live",
      body: "Sign in if prompted — your phone joins as the studio camera. Keep this screen open to manage chat and materials.",
    },
  ];

  const companionSteps = [
    {
      icon: Tablet,
      title: "Open on your second device",
      body: "Use your phone, tablet, or another laptop.",
    },
    {
      icon: ScanLine,
      title: "Scan the QR code",
      body: "Point your second device camera at this screen and tap the link.",
    },
    {
      icon: Hand,
      title: "Manage your show",
      body: "Chat, handle hand raises, and manage materials — no camera needed.",
    },
  ];

  const steps = activeTab === "camera" ? cameraSteps : companionSteps;
  const qrUrl = activeTab === "camera" ? cameraUrl : companionUrl;
  const title = activeTab === "camera" ? "Add a second camera" : "Open on another device";
  const subtitle =
    activeTab === "camera"
      ? "Point your phone at your work. Manage everything here on your laptop."
      : "Chat, manage your audience, and control your show from any device — no camera required.";

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={handleClose}
            className="fixed inset-0 z-[9998] bg-black/70 backdrop-blur-sm"
            aria-hidden="true"
          />

          {/* Sheet */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
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
            className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg z-[9999] rounded-t-3xl shadow-2xl"
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
            <div className="px-6 pt-3 pb-3 flex items-start justify-between gap-3">
              <div className="flex-1">
                <h2 className="font-display text-xl text-white leading-tight">{title}</h2>
                <p className="text-sm text-white/60 mt-1 leading-snug">{subtitle}</p>
              </div>
              <button
                onClick={handleClose}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors flex-shrink-0"
                aria-label="Close"
              >
                <X className="w-4 h-4 text-white/70" />
              </button>
            </div>

            {/* Tab switcher */}
            <div className="px-6 pb-3">
              <div className="flex rounded-xl bg-white/5 p-1 gap-1">
                <button
                  onClick={() => setActiveTab("camera")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                    activeTab === "camera"
                      ? "bg-white text-black"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  <Camera className="w-3.5 h-3.5" />
                  Second Camera
                </button>
                <button
                  onClick={() => setActiveTab("companion")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                    activeTab === "companion"
                      ? "bg-white text-black"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  <Tablet className="w-3.5 h-3.5" />
                  Companion Device
                </button>
              </div>
            </div>

            {/* QR / Connected state */}
            <div className="px-6 pb-2 flex justify-center">
              <AnimatePresence mode="wait">
                {activeTab === "camera" && isConnected ? (
                  <motion.div
                    key="connected"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="w-56 h-56 rounded-2xl flex flex-col items-center justify-center gap-3"
                    style={{
                      backgroundColor: "rgba(34, 197, 94, 0.08)",
                      border: "1px solid rgba(34, 197, 94, 0.25)",
                    }}
                  >
                    <div className="w-14 h-14 rounded-full bg-green-500/20 flex items-center justify-center">
                      <Check className="w-7 h-7 text-green-400" />
                    </div>
                    <p className="text-green-400 font-semibold text-sm">Studio camera connected</p>
                    <p className="text-xs text-white/50 text-center px-6">
                      Your phone is now streaming as the second camera.
                    </p>
                  </motion.div>
                ) : (
                  <motion.div
                    key={`qr-${activeTab}`}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="p-3 rounded-2xl bg-white"
                  >
                    <QRCodeSVG
                      value={qrUrl}
                      size={208}
                      level="M"
                      bgColor="#ffffff"
                      fgColor="#0e0e0e"
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Steps */}
            <div className="px-6 pt-4 pb-6 space-y-3">
              {steps.map((step, idx) => {
                const Icon = step.icon;
                return (
                  <div
                    key={idx}
                    className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5"
                  >
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/10 text-white text-xs font-semibold flex-shrink-0">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Icon className="w-3.5 h-3.5 text-white/60" />
                        <p className="text-sm font-medium text-white">{step.title}</p>
                      </div>
                      <p className="text-xs text-white/55 mt-0.5 leading-snug">{step.body}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
