import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Users, Palette, AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLiveChat } from "@/hooks/useLiveChat";
import { useHandRaises } from "@/hooks/useHandRaises";
import { useMaterials } from "@/hooks/useMaterials";
import { useLiveViewers } from "@/hooks/useLiveViewers";
import { LiveRoomChat } from "./LiveRoomChat";
import { HandRaisesDrawer } from "./HandRaisesDrawer";
import { LiveRoomMaterials } from "./LiveRoomMaterials";
import { triggerHaptic } from "@/lib/haptics";

type Tab = "chat" | "audience" | "materials";

interface CompanionModeViewProps {
  eventId: string;
  creatorId: string;
  eventTitle: string;
  creatorName: string;
}

export function CompanionModeView({
  eventId,
  creatorId,
  eventTitle,
  creatorName,
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
            toast.info("Stream ended from primary device");
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

      toast.success("Stream ended");
      navigate("/");
    } catch (err) {
      console.error("[CompanionMode] Failed to end stream:", err);
      toast.error("Failed to end stream");
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
    <div className="fixed inset-0 bg-background flex flex-col overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 pt-safe pt-4 pb-3 border-b border-border bg-card">
        <div className="flex items-center gap-3 min-w-0">
          {/* LIVE badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-live/10 border border-live/30 flex-shrink-0">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-live opacity-75 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-live" />
            </span>
            <span className="text-xs font-semibold text-live uppercase tracking-wide">Live</span>
          </div>

          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{eventTitle}</p>
            <p className="text-xs text-muted-foreground">{viewerCount} watching</p>
          </div>
        </div>

        {/* Companion badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/50 border border-border flex-shrink-0">
          <span className="text-xs text-muted-foreground font-medium">Companion</span>
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="flex border-b border-border bg-card">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium transition-colors ${
                activeTab === tab.id
                  ? "text-foreground border-b-2 border-electric"
                  : "text-muted-foreground hover:text-foreground"
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
              className="absolute inset-0 overflow-y-auto"
            >
              <HandRaisesDrawer
                isOpen={true}
                onClose={() => {}}
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
      <div className="px-4 py-3 pb-safe border-t border-border bg-card">
        <button
          onClick={handleEndStream}
          disabled={isEnding}
          className={`w-full py-3.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
            confirmEnd
              ? "bg-destructive text-white"
              : "bg-muted/50 text-muted-foreground hover:bg-muted border border-border"
          }`}
        >
          {isEnding ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : confirmEnd ? (
            <>
              <AlertTriangle className="w-4 h-4" />
              Tap again to end stream
            </>
          ) : (
            "End Stream"
          )}
        </button>
      </div>
    </div>
  );
}
