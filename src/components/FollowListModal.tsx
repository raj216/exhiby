import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, UserCircle, BadgeCheck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useScrollLock } from "@/hooks/useScrollLock";

interface FollowUser {
  user_id: string;
  name: string;
  handle: string | null;
  avatar_url: string | null;
  is_verified?: boolean;
}

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

  const handleUserClick = (userIdToVisit: string) => {
    onClose();
    navigate(`/profile/${userIdToVisit}`);
  };

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{ height: '100dvh' }}
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />
          
          {/* Modal Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative z-10 bg-obsidian rounded-2xl shadow-2xl border border-border/30 flex flex-col"
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
            <div className="flex-1 overflow-y-auto min-h-0 overscroll-contain">
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
                  {users.map((user) => (
                    <button
                      key={user.user_id}
                      onClick={() => handleUserClick(user.user_id)}
                      className="w-full flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors text-left"
                    >
                      <div className="w-12 h-12 rounded-full overflow-hidden bg-muted flex-shrink-0">
                        {user.avatar_url ? (
                          <img
                            src={user.avatar_url}
                            alt={user.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-muted">
                            <UserCircle className="w-8 h-8 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <p className="text-foreground font-medium truncate">
                            {user.handle || user.name}
                          </p>
                          {user.is_verified === true && (
                            <BadgeCheck className="w-4 h-4 text-gold fill-gold/20 flex-shrink-0" />
                          )}
                        </div>
                        {user.handle && (
                          <p className="text-muted-foreground text-sm truncate">
                            {user.name}
                          </p>
                        )}
                      </div>
                    </button>
                  ))}
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