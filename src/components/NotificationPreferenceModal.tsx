import { motion, AnimatePresence } from "framer-motion";
import { Bell, Radio, ShoppingBag, X, Sparkles } from "lucide-react";
import { useState } from "react";
import { triggerClickHaptic } from "@/lib/haptics";

interface NotificationPreferenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (preferences: string[]) => void;
  creatorName: string;
}

const preferences = [
  {
    id: "everything",
    label: "Everything",
    description: "All updates, posts, and activities",
    icon: Sparkles,
  },
  {
    id: "live",
    label: "Studio Sessions Only",
    description: "Get notified when they open their studio",
    icon: Radio,
  },
  {
    id: "shop",
    label: "New Work Only",
    description: "New work and releases",
    icon: ShoppingBag,
  },
];

export function NotificationPreferenceModal({
  isOpen,
  onClose,
  onConfirm,
  creatorName,
}: NotificationPreferenceModalProps) {
  const [selected, setSelected] = useState<string[]>(["everything"]);

  const togglePreference = (id: string) => {
    triggerClickHaptic();
    if (id === "everything") {
      setSelected(["everything"]);
    } else {
      const newSelected = selected.filter((s) => s !== "everything");
      if (newSelected.includes(id)) {
        setSelected(newSelected.filter((s) => s !== id));
      } else {
        setSelected([...newSelected, id]);
      }
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-carbon/80 backdrop-blur-xl z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 p-4"
          >
            <div className="glass-card p-6 max-w-md mx-auto">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-electric/20 flex items-center justify-center">
                    <Bell className="w-5 h-5 text-electric" />
                  </div>
                  <div>
                    <h3 className="font-display text-lg text-foreground">
                      Notify Me
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Following {creatorName}
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-obsidian flex items-center justify-center"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              <div className="space-y-3 mb-6">
                {preferences.map((pref) => {
                  const isSelected = selected.includes(pref.id);
                  return (
                    <motion.button
                      key={pref.id}
                      onClick={() => togglePreference(pref.id)}
                      whileTap={{ scale: 0.98 }}
                      className={`w-full p-4 rounded-2xl border-2 transition-all text-left ${
                        isSelected
                          ? "border-electric bg-electric/10"
                          : "border-border bg-obsidian/50 hover:border-muted-foreground/30"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            isSelected ? "bg-electric/20" : "bg-obsidian"
                          }`}
                        >
                          <pref.icon
                            className={`w-5 h-5 ${
                              isSelected
                                ? "text-electric"
                                : "text-muted-foreground"
                            }`}
                          />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-foreground">
                            {pref.label}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {pref.description}
                          </p>
                        </div>
                        <div
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                            isSelected
                              ? "border-electric bg-electric"
                              : "border-muted-foreground/30"
                          }`}
                        >
                          {isSelected && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="w-2 h-2 rounded-full bg-white"
                            />
                          )}
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  triggerClickHaptic();
                  onConfirm(selected);
                  onClose();
                }}
                disabled={selected.length === 0}
                className="w-full py-4 rounded-2xl font-semibold disabled:opacity-50 text-white"
                style={{
                  background: "linear-gradient(135deg, hsl(7 100% 67%), hsl(345 100% 50%))"
                }}
              >
                Confirm & Follow
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}