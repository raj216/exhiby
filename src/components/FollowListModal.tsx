import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, UserCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useLocation, useNavigate } from "react-router-dom";
import { useScrollLock } from "@/hooks/useScrollLock";
import { FollowListRow, type FollowUser } from "@/components/follow/FollowListRow";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { navigateToPublicProfile } from "@/lib/publicProfileNavigation";

interface FollowListModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  type: "followers" | "following";
}

export function FollowListModal({ isOpen, onClose, userId, type }: FollowListModalProps) {
  const [users, setUsers] = useState<FollowUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const { user: authUser } = useAuth();

  const resolveProfileId = (u: FollowUser | null | undefined) =>
    u?.id ??
    u?.user_id ??
    u?.profile_id ??
    u?.profiles?.id ??
    u?.profiles?.user_id ??
    u?.profile?.id ??
    u?.profile?.user_id ??
    null;

  // Lock background scroll when modal is open
  useScrollLock(isOpen);

  useEffect(() => {
    if (isOpen && userId) {
      fetchUsers();
    }
  }, [isOpen, userId, type]);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const rpcName = type === "followers" ? "get_followers_list" : "get_following_list";
      const { data, error } = await supabase.rpc(rpcName, { target_user_id: userId });

      console.log(`[FollowListModal] ${rpcName} response:`, { data, error });
      
      if (error) {
        console.error(`Error fetching ${type}:`, error);
        setUsers([]);
      } else {
        setUsers(data || []);
      }
    } catch (error) {
      console.error(`Error fetching ${type}:`, error);
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUserClick = (followUser: FollowUser) => {
    const targetId = resolveProfileId(followUser);

    if (import.meta.env.DEV) {
      // Temporary debugging aid (requested). Remove once confirmed stable.
      console.log("[FOLLOW ROW CLICK]", followUser);
      console.log("[FOLLOW TARGET ID]", targetId);
    }

    if (!targetId) {
      toast.error("Profile unavailable (missing id)");
      return;
    }

    // If the user taps the profile they're already viewing, don't re-navigate.
    // (On some devices this can look like a flash/blank because the route doesn't change.)
    if (location.pathname === `/profile/${targetId}`) {
      onClose();
      return;
    }

    const isSelf = authUser && targetId === authUser.id;

    // IMPORTANT: Navigate first, then close modal (closing first can swallow navigation).
    if (isSelf) {
      if (import.meta.env.DEV) console.log("[FOLLOW NAV PATH]", "/ (openProfile: true)");
      navigate("/", { state: { openProfile: true } });
    } else {
      if (import.meta.env.DEV) console.log("[FOLLOW NAV PATH]", `/profile/${targetId}`);

      // Reuse the exact same navigation helper used by Search results.
      navigateToPublicProfile(navigate, location, targetId, {
        overlayState: { openFollowList: type },
        persistReturnToKey: "exhiby_return_to",
      });
    }

    requestAnimationFrame(() => onClose());
  };

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-auto"
          style={{ height: '100dvh' }}
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
              className="absolute inset-0 z-0 bg-black/70 backdrop-blur-sm pointer-events-auto"
          />
          
          {/* Modal Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
              className="relative z-10 bg-obsidian rounded-2xl shadow-2xl border border-border/30 flex flex-col pointer-events-auto"
            style={{ 
              width: "min(92vw, 420px)",
              maxHeight: "calc(70dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))",
            }}
          >
            {/* Header - fixed height, no scroll */}
            <div className="flex items-center justify-between p-4 border-b border-border/30 flex-shrink-0">
              <h2 className="text-lg font-semibold text-foreground capitalize">
                {type}
              </h2>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5 text-foreground" />
              </button>
            </div>

            {/* User List - only this scrolls if content exceeds */}
            <div className="flex-1 overflow-y-auto min-h-0 overscroll-contain pointer-events-auto">
              {isLoading ? (
                <div className="p-8 text-center">
                  <div className="w-8 h-8 border-2 border-muted-foreground border-t-foreground rounded-full animate-spin mx-auto" />
                </div>
              ) : users.length === 0 ? (
                <div className="p-8 text-center">
                  <UserCircle className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">
                    {type === "followers" ? "No followers yet" : "Not following anyone"}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border/20">
                  {users.map((user, idx) => {
                    const key = user.user_id || user.id || user.profile_id || `${user.name}-${idx}`;
                    return <FollowListRow key={key} user={user} onActivate={handleUserClick} />;
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
}