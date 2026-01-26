import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Hand, Check, Trash2, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNowStrict } from "date-fns";
import type { HandRaise } from "@/hooks/useHandRaises";

interface UserProfile {
  user_id: string;
  name: string;
  avatar_url: string | null;
}

interface HandRaisesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  handRaises: HandRaise[];
  onClearSingle: (id: string) => Promise<{ success: boolean }>;
  onClearAll: () => Promise<{ success: boolean }>;
}

export function HandRaisesDrawer({
  isOpen,
  onClose,
  handRaises,
  onClearSingle,
  onClearAll,
}: HandRaisesDrawerProps) {
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);

  // Fetch user profiles for hand raises
  useEffect(() => {
    const userIds = handRaises.map((r) => r.user_id);
    if (userIds.length === 0) return;

    const fetchProfiles = async () => {
      const { data, error } = await supabase.rpc("get_creator_profiles", {
        user_ids: userIds,
      });

      if (!error && data) {
        const profileMap: Record<string, UserProfile> = {};
        data.forEach((p: UserProfile) => {
          profileMap[p.user_id] = p;
        });
        setProfiles(profileMap);
      }
    };

    fetchProfiles();
  }, [handRaises]);

  const handleClearSingle = async (id: string) => {
    setLoadingId(id);
    await onClearSingle(id);
    setLoadingId(null);
  };

  const handleClearAll = async () => {
    setIsClearing(true);
    await onClearAll();
    setIsClearing(false);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
          />

          {/* Drawer */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-[61] bg-card rounded-t-2xl border-t border-border max-h-[60vh] flex flex-col"
            style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Hand className="w-5 h-5 text-gold" />
                <h3 className="font-semibold text-foreground">
                  Raised Hands ({handRaises.length})
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {handRaises.length > 0 && (
                  <button
                    onClick={handleClearAll}
                    disabled={isClearing}
                    className="text-xs px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground transition-colors disabled:opacity-50"
                  >
                    {isClearing ? "Clearing..." : "Clear All"}
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4">
              {handRaises.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <Hand className="w-10 h-10 mb-3 opacity-40" />
                  <p className="text-sm">No hands raised yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {handRaises.map((raise) => {
                    const profile = profiles[raise.user_id];
                    const timeAgo = formatDistanceToNowStrict(
                      new Date(raise.created_at),
                      { addSuffix: true }
                    );

                    return (
                      <motion.div
                        key={raise.id}
                        layout
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/50"
                      >
                        {/* Avatar */}
                        <div className="w-10 h-10 rounded-full bg-muted overflow-hidden flex-shrink-0">
                          {profile?.avatar_url ? (
                            <img
                              src={profile.avatar_url}
                              alt={profile.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <User className="w-5 h-5 text-muted-foreground" />
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate">
                            {profile?.name || "Anonymous"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {timeAgo}
                          </p>
                        </div>

                        {/* Action */}
                        <button
                          onClick={() => handleClearSingle(raise.id)}
                          disabled={loadingId === raise.id}
                          className="w-9 h-9 rounded-full bg-primary/10 hover:bg-primary/20 flex items-center justify-center transition-colors disabled:opacity-50"
                        >
                          {loadingId === raise.id ? (
                            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Check className="w-4 h-4 text-primary" />
                          )}
                        </button>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
