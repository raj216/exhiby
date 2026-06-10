import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Users, Palette, AlertTriangle, Loader2, Hand, User, Check, Trash2 } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLiveChat } from "@/hooks/useLiveChat";
import { useHandRaises } from "@/hooks/useHandRaises";
import { useMaterials } from "@/hooks/useMaterials";
import { useLiveViewers } from "@/hooks/useLiveViewers";
import { LiveRoomChat } from "./LiveRoomChat";
import { LiveRoomMaterials } from "./LiveRoomMaterials";
import { triggerHaptic } from "@/lib/haptics";

type Tab = "chat" | "audience" | "materials";

interface CompanionModeViewProps {
  eventId: string;
  creatorId: string;
  eventTitle: string;
  creatorName: string;
  coverUrl?: string | null;
}

export function CompanionModeView({
  eventId,
  creatorId,
  eventTitle,
  creatorName,
  coverUrl,
}: CompanionModeViewProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("chat");
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const confirmTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Viewer presence — companion joins as viewer so chat RLS works
  const { viewerCount, joinAsViewer, leaveAsViewer } = useLiveViewers(eventId);

  useEffect(() => {
    joinAsViewer();
    return () => {
      leaveAsViewer();
    };
  }, [joinAsViewer, leaveAsViewer]);

  // Chat
  const {
    messages,
    status: chatStatus,
    sendMessage,
    retryMessage,
    removeFailedMessage,
    pinnedMessageId,
    pinMessage,
    unpinMessage,
    pinnedMessage,
  } = useLiveChat({ eventId, creatorId, isViewerReady: true });

  // Hand raises
  const { handRaises, clearHandRaise, clearAllHandRaises } = useHandRaises({
    eventId,
    isCreator: true,
  });

  // Materials
  const { materials, addMaterial, updateMaterial, deleteMaterial } = useMaterials({ eventId });

  // Listen for stream ending from the primary device
  useEffect(() => {
    const channel = supabase
      .channel(`companion-event-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "events",
          filter: `id=eq.${eventId}`,
        },
        (payload) => {
          const updated = payload.new as any;
          if (!updated.is_live || updated.live_ended_at) {
            toast.info("Session ended from primary device");
            navigate("/");
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, navigate]);

  // End stream from companion device
  const handleEndStream = useCallback(async () => {
    if (!confirmEnd) {
      triggerHaptic("medium");
      setConfirmEnd(true);
      if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
      confirmTimeoutRef.current = setTimeout(() => setConfirmEnd(false), 4000);
      return;
    }

    triggerHaptic("heavy");
    if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
    setIsEnding(true);

    try {
      // End stream in DB
      await supabase
        .from("events")
        .update({ is_live: false, live_ended_at: new Date().toISOString() })
        .eq("id", eventId);

      // Remove all live viewers
      await supabase.from("live_viewers").delete().eq("event_id", eventId);

      toast.success("Session ended");
      navigate("/");
    } catch (err) {
      console.error("[CompanionMode] Failed to end stream:", err);
      toast.error("Failed to end session");
      setIsEnding(false);
      setConfirmEnd(false);
    }
  }, [confirmEnd, eventId, navigate]);

  const tabs = [
    { id: "chat" as Tab, label: "Chat", icon: MessageSquare },
    { id: "audience" as Tab, label: `Audience${handRaises.length > 0 ? ` (${handRaises.length})` : ""}`, icon: Users },
    { id: "materials" as Tab, label: "Materials", icon: Palette },
  ];

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden">
      {/* ── Full-page cover photo background ── */}
      {coverUrl ? (
        <>
          <img
            src={coverUrl}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover"
            style={{ filter: "blur(48px) brightness(0.18) saturate(1.4)", transform: "scale(1.15)" }}
          />
          <div className="absolute inset-0 bg-black/60" />
        </>
      ) : (
        <div className="absolute inset-0 bg-background" />
      )}

      {/* All UI floats above the background */}
      <div className="relative z-10 flex flex-col flex-1 overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 pb-3 border-b border-white/10" style={{ paddingTop: "max(16px, env(safe-area-inset-top))" }}>
        {/* Content */}
        <div className="flex items-center gap-3 min-w-0">
          {/* LIVE badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-live/20 border border-live/40 flex-shrink-0">
            <span className="relative flex h-2 w-2 flex-shrink-0">
              <span className="absolute inline-flex h-full w-full rounded-full bg-live opacity-75 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-live" />
            </span>
            <span className="text-xs font-semibold text-live uppercase tracking-wide">Live</span>
          </div>

          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{eventTitle}</p>
            <p className="text-xs text-white/60">{viewerCount} watching</p>
          </div>
        </div>

        {/* Companion badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 border border-white/20 flex-shrink-0">
          <span className="text-xs text-white/70 font-medium">Companion</span>
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="flex border-b border-white/10 bg-black/30 backdrop-blur-sm">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium transition-colors ${
                activeTab === tab.id
                  ? "text-white border-b-2 border-electric"
                  : "text-white/40 hover:text-white/70"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          {activeTab === "chat" && (
            <motion.div
              key="chat"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0"
            >
              <LiveRoomChat
                isOpen={true}
                onClose={() => {}}
                messages={messages}
                status={chatStatus}
                onSendMessage={sendMessage}
                onRetryMessage={retryMessage}
                onRemoveFailedMessage={removeFailedMessage}
                isAuthenticated={true}
                isCreator={true}
                pinnedMessage={pinnedMessage}
                pinnedMessageId={pinnedMessageId}
                onPinMessage={pinMessage}
                onUnpinMessage={unpinMessage}
              />
            </motion.div>
          )}

          {activeTab === "audience" && (
            <motion.div
              key="audience"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 overflow-y-auto p-4"
            >
              <InlineHandRaises
                handRaises={handRaises}
                onClearSingle={clearHandRaise}
                onClearAll={clearAllHandRaises}
              />
            </motion.div>
          )}

          {activeTab === "materials" && (
            <motion.div
              key="materials"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 overflow-y-auto"
            >
              <LiveRoomMaterials
                isOpen={true}
                onClose={() => {}}
                materials={materials}
                isHost={true}
                onAddMaterial={addMaterial}
                onUpdateMaterial={updateMaterial}
                onDeleteMaterial={deleteMaterial}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── End Stream button ── */}
      <div className="px-4 py-3 border-t border-white/10 bg-black/30 backdrop-blur-sm" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
        <button
          onClick={handleEndStream}
          disabled={isEnding}
          className={`w-full py-3.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
            confirmEnd
              ? "bg-destructive text-white"
              : "bg-white/10 text-white/70 hover:bg-white/15 border border-white/15"
          }`}
        >
          {isEnding ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : confirmEnd ? (
            <>
              <AlertTriangle className="w-4 h-4" />
              Tap again to end session
            </>
          ) : (
            "End Session"
          )}
        </button>
      </div>

      </div>{/* end z-10 wrapper */}
    </div>
  );
}

// ── Inline hand raises list (no floating overlay) ──────────────────────────
import type { HandRaise } from "@/hooks/useHandRaises";

interface InlineHandRaisesProps {
  handRaises: HandRaise[];
  onClearSingle: (id: string) => Promise<{ success: boolean }>;
  onClearAll: () => Promise<{ success: boolean }>;
}

function InlineHandRaises({ handRaises, onClearSingle, onClearAll }: InlineHandRaisesProps) {
  const [profiles, setProfiles] = useState<Record<string, { name: string; avatar_url: string | null }>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    const ids = handRaises.map((r) => r.user_id);
    if (ids.length === 0) return;
    supabase.rpc("get_creator_profiles", { user_ids: ids }).then(({ data }) => {
      if (!data) return;
      const map: Record<string, { name: string; avatar_url: string | null }> = {};
      data.forEach((p: { user_id: string; name: string; avatar_url: string | null }) => {
        map[p.user_id] = p;
      });
      setProfiles(map);
    });
  }, [handRaises]);

  if (handRaises.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Hand className="w-10 h-10 mb-3 opacity-30" />
        <p className="text-sm">No hands raised yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Hand className="w-4 h-4 text-gold" />
          <span className="text-sm font-semibold text-foreground">
            Raised Hands ({handRaises.length})
          </span>
        </div>
        <button
          onClick={async () => {
            setIsClearing(true);
            await onClearAll();
            setIsClearing(false);
          }}
          disabled={isClearing}
          className="text-xs px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground transition-colors disabled:opacity-50"
        >
          {isClearing ? "Clearing…" : "Clear All"}
        </button>
      </div>

      {handRaises.map((raise) => {
        const profile = profiles[raise.user_id];
        return (
          <motion.div
            key={raise.id}
            layout
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/50"
          >
            <div className="w-9 h-9 rounded-full bg-muted overflow-hidden flex-shrink-0">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <User className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground text-sm truncate">{profile?.name || "Anonymous"}</p>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNowStrict(new Date(raise.created_at), { addSuffix: true })}
              </p>
            </div>
            <button
              onClick={async () => {
                setLoadingId(raise.id);
                await onClearSingle(raise.id);
                setLoadingId(null);
              }}
              disabled={loadingId === raise.id}
              className="w-8 h-8 rounded-full bg-primary/10 hover:bg-primary/20 flex items-center justify-center transition-colors disabled:opacity-50"
            >
              {loadingId === raise.id ? (
                <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5 text-primary" />
              )}
            </button>
          </motion.div>
        );
      })}
    </div>
  );
}
