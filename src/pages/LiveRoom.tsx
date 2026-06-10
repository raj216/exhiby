import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { AlertCircle, Loader2, MicOff, VideoOff, Clock, Calendar, Radio, Bell, BellRing, Users, Palette } from "lucide-react";
import { format, isPast, formatDistanceToNowStrict } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useLiveViewers } from "@/hooks/useLiveViewers";
import { useMaterials } from "@/hooks/useMaterials";
import { useLiveRoomRealtime } from "@/hooks/useLiveRoomRealtime";
import { useHandRaises } from "@/hooks/useHandRaises";
import { useDaily, DailyJoinStatus } from "@/hooks/useDaily";
import { useLiveChat } from "@/hooks/useLiveChat";
import { useEventTicket } from "@/hooks/useEventTicket";
import { useSavedSessions } from "@/hooks/useSavedSessions";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { triggerClickHaptic } from "@/lib/haptics";
import featureFlags from "@/lib/featureFlags";
import { navigateBack } from "@/lib/navigation";
import {
  DailyVideoTile,
  LiveRoomControls,
  LiveRoomHeader,
  LiveRoomChat,
  LiveRoomMaterials,
  ChatNotificationToast,
  StreamEndedScreen,
  ReconnectingBanner,
  LiveCountdown,
  StudioCameraView,
  STUDIO_CAM_PREFIX,
} from "@/components/live";
import { CompanionDeviceHint } from "@/components/live/CompanionDeviceHint";
import { HandRaisesDrawer } from "@/components/live/HandRaisesDrawer";
import { DebugPanel } from "@/components/live/DebugPanel";
import { VideoQualityBadge } from "@/components/live/VideoQualityBadge";
import { SessionFeedbackModal } from "@/components/SessionFeedbackModal";
import { PaymentDrawer } from "@/components/PaymentDrawer";
import { TipCreatorModal } from "@/components/TipCreatorModal";
import { LiveRoomSkeleton } from "@/components/ui/loading-skeletons";
import { CompanionModeView } from "@/components/live/CompanionModeView";
import { useCreatorDeviceRole } from "@/hooks/useCreatorDeviceRole";

interface EventData {
  id: string;
  title: string;
  cover_url: string | null;
  room_url: string | null; // Fetched via secure RPC, not from events table
  creator_id: string;
  is_live: boolean | null;
  scheduled_at: string;
  live_ended_at: string | null;
  category: string | null;
  price: number;
  is_free: boolean;
  creator?: {
    name: string;
    avatar_url: string | null;
  };
}

export default function LiveRoom() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, session } = useAuth();
  const { profile } = useProfile();
  const isMobile = useIsMobile();

  const [event, setEvent] = useState<EventData | null>(null);
  const [fastCreatorId, setFastCreatorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [permissionError, setPermissionError] = useState(false);
  const [isRecreatingRoom, setIsRecreatingRoom] = useState(false);
  const [isRetryingDaily, setIsRetryingDaily] = useState(false);
  const [isEnding, setIsEnding] = useState(false);

  // UI State
  const [isUIVisible, setIsUIVisible] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [showMaterials, setShowMaterials] = useState(false);
  const [showHandRaises, setShowHandRaises] = useState(false);
  
  // Feedback modal state
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackLeftEarly, setFeedbackLeftEarly] = useState(false);
  const feedbackShownRef = useRef(false);
  
  // Stream ended state (for viewers when creator ends)
  const [streamEndedByHost, setStreamEndedByHost] = useState(false);
  
  // Payment state for paid events
  const [showPaymentDrawer, setShowPaymentDrawer] = useState(false);
  const [isAwaitingPaymentConfirmation, setIsAwaitingPaymentConfirmation] = useState(false);

  // Capacity gate state — set when the session is full
  const [isSessionFull, setIsSessionFull] = useState(false);
  const [sessionFullMax, setSessionFullMax] = useState<number | null>(null);
  
  // Debug state
  const [dailyStatus, setDailyStatus] = useState<DailyJoinStatus>("idle");
  
  // UX Polish: Track join timing for "still connecting" message
  const [joinStartTime, setJoinStartTime] = useState<number | null>(null);
  const [isSlowConnection, setIsSlowConnection] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tracks whether we already hold the room_url. The realtime go-live handler
  // uses this to fetch the room_url exactly once when a studio opens — host
  // heartbeat updates also land in that handler every ~45s and must be ignored.
  const roomUrlReadyRef = useRef(false);

  const { viewerCount, isJoined: isViewerJoined, joinAsViewer, leaveAsViewer } = useLiveViewers(eventId || null);
  
  // Saved sessions for "Notify Me" button
  const { isEventSaved, saveSession, removeSession: removeSavedSession } = useSavedSessions();
  
  const isCreator = user?.id === event?.creator_id;

  // Detect whether this device is the primary (camera) or companion (chat-only) device.
  // Source of truth is the events.primary_device_id column — claimed atomically
  // on page load. Companion devices never join Daily.co (see roomUrl gate below).
  const { role: deviceRole, releasePrimary } =
    useCreatorDeviceRole(event?.id || null, isCreator);

  // A creator device that lost the primary-claim race must NOT broadcast. We
  // pass null roomUrl to useDaily, which short-circuits the Daily.co join
  // entirely. Non-creator viewers always pass the real room url.
  // dailyDetectedSecondary is a SECOND defence: even if events.primary_device_id
  // is missing (migration not applied) or the claim raced, we re-check after
  // Daily.co joins. If another owner-flagged participant is already in the
  // room and joined before us, we leave and render the companion view.
  const [dailyDetectedSecondary, setDailyDetectedSecondary] = useState(false);
  const shouldJoinDaily = !isCreator
    || (deviceRole === "primary" && !dailyDetectedSecondary);

  // Ticket check for paid events - prevents double charging on rejoin
  const { 
    hasValidTicket, 
    isLoading: ticketLoading, 
    purchaseTicket,
    markAttended,
    refetch: refetchTicket,
    pollForConfirmation,
  } = useEventTicket(eventId || null, user?.id);
  
  // Check if event requires payment and user doesn't have ticket
  // When payments are disabled via feature flag, no event requires payment
  // Also catch edge case where price might be 0/null but is_free is false
  // CRITICAL: Don't show paywall when we're awaiting payment confirmation after Stripe redirect
  const requiresPayment = featureFlags.paymentsEnabled && event && !event.is_free && !isCreator && !hasValidTicket && !isAwaitingPaymentConfirmation;

  // Handle Stripe redirect query params
  useEffect(() => {
    const paymentParam = searchParams.get("payment");
    if (paymentParam === "success") {
      setIsAwaitingPaymentConfirmation(true);
      toast.success("Payment successful!", { description: "Confirming your ticket..." });
      // Start polling for webhook confirmation (ticket status: pending → paid)
      pollForConfirmation();
      setSearchParams({}, { replace: true });
    } else if (paymentParam === "canceled") {
      toast.error("Payment canceled", { description: "You can try again when ready." });
      setIsAwaitingPaymentConfirmation(false);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, pollForConfirmation]);

  // Handle tip Stripe redirect (?tip=success / ?tip=canceled)
  useEffect(() => {
    const tipParam = searchParams.get("tip");
    if (tipParam === "success") {
      toast.custom((t) => (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          onClick={() => toast.dismiss(t)}
          className="flex items-center gap-3 bg-obsidian/95 backdrop-blur-xl border border-primary/30 rounded-2xl px-4 py-3.5 shadow-2xl cursor-pointer min-w-[260px] max-w-[340px]"
        >
          <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 text-base text-primary">
            ♡
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground leading-snug">
              Thank you for your support
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Your tip has been sent to the creator
            </p>
          </div>
        </motion.div>
      ), { duration: 6000 });
      setSearchParams({}, { replace: true });
    } else if (tipParam === "canceled") {
      toast.info("Tip canceled", { description: "No charge was made." });
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Clear awaiting flag once ticket is confirmed
  useEffect(() => {
    if (hasValidTicket && isAwaitingPaymentConfirmation) {
      setIsAwaitingPaymentConfirmation(false);
    }
  }, [hasValidTicket, isAwaitingPaymentConfirmation]);

  // Listen for capacity-gate event from useLiveViewers.
  // Filter on eventId so a dispatch for some other room can never flip this view.
  useEffect(() => {
    const handleSessionFull = (e: Event) => {
      const detail = (e as CustomEvent).detail as { eventId?: string; maxViewers?: number };
      if (detail.eventId && detail.eventId !== eventId) return;
      setIsSessionFull(true);
      setSessionFullMax(detail.maxViewers ?? null);
    };
    window.addEventListener("exhiby:session-full", handleSessionFull);
    return () => window.removeEventListener("exhiby:session-full", handleSessionFull);
  }, [eventId]);

  // Live chat from database with realtime
  // CRITICAL: Pass isViewerReady so chat waits for the live_viewers record (needed for RLS)
  const {
    messages: chatMessages,
    status: chatStatus,
    messageCount: chatMessageCount,
    sendMessage: sendChatMessage,
    unreadCount: chatUnreadCount,
    latestUnreadMessage,
    isChatOpen,
    openChat,
    closeChat,
    clearLatestUnread,
    pinnedMessage,
    pinnedMessageId,
    pinMessage,
    unpinMessage,
    reloadMessages,
  } = useLiveChat({
    eventId: eventId || null,
    creatorId: event?.creator_id || null,
    isViewerReady: isViewerJoined, // Audience chat waits until their viewer record exists
  });

  // Unified realtime connection manager
  const {
    status: realtimeStatus,
    isConnected: isRealtimeConnected,
    justReconnected,
    clearReconnectedFlag,
    reconnect: reconnectRealtime,
  } = useLiveRoomRealtime({
    eventId: eventId || null,
    isViewerReady: isViewerJoined,
    isCreator: isCreator,
  });

  // Materials from database with reconnect sync
  const {
    materials,
    addMaterial,
    updateMaterial,
    deleteMaterial,
    refetch: refetchMaterials,
  } = useMaterials({
    eventId: eventId || null,
    justReconnected,
    onReconnectHandled: clearReconnectedFlag,
  });

  // Hand raises from database with realtime
  const {
    handRaises,
    handRaiseCount,
    myHandRaised,
    raiseHand,
    lowerHand,
    clearHandRaise,
    clearAllHandRaises,
  } = useHandRaises({
    eventId: eventId || null,
    isCreator: isCreator,
  });

  // Daily SDK integration
  const {
    localParticipant,
    remoteParticipants,
    isJoined,
    isJoining,
    isCameraOn,
    isMicOn,
    error: dailyError,
    errorStack: dailyErrorStack,
    status,
    qualityStats,
    join,
    leave,
    reset,
    toggleCamera,
    switchCamera,
    toggleMic,
  } = useDaily({
    roomUrl: shouldJoinDaily ? (event?.room_url || null) : null,
    isHost: isCreator,
    userName: profile?.name || profile?.handle || user?.email?.split("@")[0] || "Guest",
    joinTimeoutMs: 12000,
    onJoined: () => {
      console.log("[LiveRoom] Successfully joined Daily room");
      toast.success("Connected to session");
    },
    onLeft: () => {
      console.log("[LiveRoom] Left Daily room");
    },
    onError: (err) => {
      console.error("[LiveRoom] Daily error:", err);
      if (err.includes("NotAllowedError") || err.includes("permission")) {
        setPermissionError(true);
      }
    },
    onStatusChange: (newStatus) => {
      console.log("[LiveRoom] Daily status changed:", newStatus);
      setDailyStatus(newStatus);
      
      // Track joining timing for slow connection UX
      if (newStatus === "joining") {
        setJoinStartTime(Date.now());
        setIsSlowConnection(false);
        setIsReconnecting(false);
      } else if (newStatus === "joined") {
        setJoinStartTime(null);
        setIsSlowConnection(false);
        setIsReconnecting(false);
      }
    },
    // When host ends the stream, show end screen to viewers
    onHostLeft: () => {
      if (!isCreator) {
        console.log("[LiveRoom] Host left - showing end screen for viewer");
        setStreamEndedByHost(true);
      }
    },
    onMeetingEnded: () => {
      if (!isCreator) {
        console.log("[LiveRoom] Meeting ended - showing end screen for viewer");
        setStreamEndedByHost(true);
      }
    },
    onNetworkQualityChange: (quality) => {
      if (quality === 'low' || quality === 'very-low') {
        setIsReconnecting(true);
      } else if (quality === 'good') {
        setIsReconnecting(false);
      }
    },
  });

  // Safety net for primary/companion role detection.
  //
  // After Daily.co successfully joins, check whether another creator-host
  // participant is already in the room and joined before us. If so, we are
  // the SECOND broadcaster — leave immediately and render the companion view.
  //
  // This fires whenever events.primary_device_id could not do its job (e.g.
  // the column is missing from the DB, or the claim raced). We detect other
  // creator devices via the custom `isCreatorHost: true` flag injected into
  // Daily.co userData at join time — this is more reliable than Daily.co's
  // built-in `owner` flag which requires an owner token we don't always use.
  //
  // The effect re-runs whenever remoteParticipants changes, so even if the
  // phone's participant info arrives slightly after joined-meeting fires, we
  // catch it on the next update.
  useEffect(() => {
    if (!isCreator) return;
    if (!isJoined) return;
    if (dailyDetectedSecondary) return;

    // Use the local participant's join timestamp if available, otherwise fall
    // back to now (we JUST joined, so any remote with an earlier stamp is older).
    const myJoinedAt = localParticipant?.joinedAt ?? Date.now();

    // Look for another creator-host who joined before us.
    const olderCreatorDevice = remoteParticipants.find(
      (p) => p.isCreatorHost && p.joinedAt != null && p.joinedAt < myJoinedAt
    );

    if (olderCreatorDevice) {
      console.log(
        "[LiveRoom] Daily safety net: another creator-host device joined first " +
          `(session ${olderCreatorDevice.sessionId}, joinedAt ${olderCreatorDevice.joinedAt} vs mine ${myJoinedAt}). ` +
          "Leaving Daily and switching to companion view."
      );
      setDailyDetectedSecondary(true);
      leave().catch((err) => console.warn("[LiveRoom] leave() failed:", err));
    }
  }, [
    isCreator,
    isJoined,
    dailyDetectedSecondary,
    localParticipant,
    remoteParticipants,
    leave,
  ]);

  // Auto-hide UI after inactivity
  const resetHideTimer = useCallback(() => {
    setIsUIVisible(true);
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }
    hideTimerRef.current = setTimeout(() => {
      if (!showChat && !showMaterials) {
        setIsUIVisible(false);
      }
    }, 3000);
  }, [showChat, showMaterials]);

  // Show UI on interaction
  useEffect(() => {
    const handleInteraction = () => resetHideTimer();
    
    window.addEventListener("mousemove", handleInteraction);
    window.addEventListener("touchstart", handleInteraction);
    
    resetHideTimer();
    
    return () => {
      window.removeEventListener("mousemove", handleInteraction);
      window.removeEventListener("touchstart", handleInteraction);
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, [resetHideTimer]);

  // Fetch event data
  useEffect(() => {
    if (!eventId) {
      console.error("[LiveRoom] No event ID in URL params");
      setError("No event ID provided");
      setLoading(false);
      return;
    }

    const fetchEvent = async () => {
      console.log("[LiveRoom] Fetching event:", eventId);

      try {
        // Fetch event metadata (room_url is now in separate protected table)
        const { data, error: fetchError } = await supabase
          .from("events")
          .select("id, title, cover_url, creator_id, is_live, scheduled_at, live_ended_at, category, price, is_free")
          .eq("id", eventId)
          .maybeSingle();

        if (fetchError) {
          console.error("[LiveRoom] Error fetching event:", fetchError);
          setError("Event not found");
          setLoading(false);
          return;
        }

        if (!data) {
          console.error("[LiveRoom] No event data returned for ID:", eventId);
          setError("Event not found");
          setLoading(false);
          return;
        }

        console.log("[LiveRoom] Event data:", JSON.stringify(data, null, 2));
        console.log("[LiveRoom] is_live:", data.is_live);
        console.log("[LiveRoom] creator_id:", data.creator_id);

        // Set creator_id immediately so joinAsViewer can start before room_url / profile RPCs complete
        setFastCreatorId(data.creator_id);

        // Securely fetch room_url via RPC (checks creator/ticket/free access)
        const { data: roomUrl } = await supabase.rpc("get_event_room_url", {
          event_id: eventId,
        });
        console.log("[LiveRoom] room_url (via RPC):", roomUrl);

        // Fetch creator profile
        const { data: creatorProfiles } = await supabase.rpc("get_creator_profiles", { user_ids: [data.creator_id] });
        const creatorProfile = creatorProfiles?.[0] ?? null;

        setEvent({
          id: data.id,
          title: data.title,
          cover_url: data.cover_url,
          room_url: roomUrl || null,
          creator_id: data.creator_id,
          is_live: data.is_live,
          scheduled_at: data.scheduled_at,
          live_ended_at: data.live_ended_at,
          category: data.category,
          price: data.price ?? 0,
          is_free: data.is_free,
          creator: creatorProfile
            ? { name: creatorProfile.name, avatar_url: creatorProfile.avatar_url }
            : { name: "Unknown Artist", avatar_url: null },
        });
        roomUrlReadyRef.current = !!roomUrl;
      } catch (err) {
        console.error("[LiveRoom] Unexpected error:", err);
        setError("Failed to load event");
      } finally {
        setLoading(false);
      }
    };

    fetchEvent();
  }, [eventId]);

  // Join as viewer EARLY (for non-creators) — don't wait for full event load.
  // fastCreatorId is set as soon as the events query returns (before room_url/profile RPCs),
  // saving 200-600 ms on mobile and unblocking the chat RLS record sooner.
  // Guard: skip join while paywall is showing so unpaid users don't consume a seat.
  // When requiresPayment flips to false (payment confirmed), this effect re-runs and joins.
  useEffect(() => {
    if (eventId && user && fastCreatorId && user.id !== fastCreatorId && !requiresPayment) {
      console.log("[LiveRoom] Joining as viewer early (for chat RLS)...");
      joinAsViewer();
    }

    return () => {
      if (user && fastCreatorId && user.id !== fastCreatorId) {
        console.log("[LiveRoom] Leaving as viewer...");
        leaveAsViewer();
      }
    };
  }, [eventId, user, fastCreatorId, joinAsViewer, leaveAsViewer, requiresPayment]);
  
  // Re-fetch room_url when ticket becomes valid (after payment)
  useEffect(() => {
    if (!eventId || !hasValidTicket || isCreator || event?.room_url) return;
    
    const refetchRoomUrl = async () => {
      console.log("[LiveRoom] Ticket confirmed — re-fetching room_url...");
      const { data: roomUrl } = await supabase.rpc("get_event_room_url", {
        event_id: eventId,
      });
      if (roomUrl) {
        console.log("[LiveRoom] Got room_url after payment:", roomUrl);
        roomUrlReadyRef.current = true;
        setEvent((prev) => prev ? { ...prev, room_url: roomUrl } : null);
      }
    };
    refetchRoomUrl();
  }, [eventId, hasValidTicket, isCreator, event?.room_url]);

  // Mark ticket as attended when video joins (separate from viewer record)
  useEffect(() => {
    if (event && user && !isCreator && isJoined && hasValidTicket) {
      console.log("[LiveRoom] Marking ticket as attended");
      markAttended();
    }
  }, [event, user, isCreator, isJoined, hasValidTicket, markAttended]);

  // Realtime subscription to detect when stream ends (backup for Daily events)
  useEffect(() => {
    if (!eventId || isCreator) return;

    const channel = supabase
      .channel(`event-live-status-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "events",
          filter: `id=eq.${eventId}`,
        },
        (payload) => {
          console.log("[LiveRoom] Realtime event update:", payload);
          const newData = payload.new as any;

          // If stream just ended (is_live changed to false or live_ended_at was set)
          if (newData.is_live === false || newData.live_ended_at) {
            console.log("[LiveRoom] Stream ended detected via realtime");
            roomUrlReadyRef.current = false;
            if (!streamEndedByHost && !feedbackShownRef.current) {
              setStreamEndedByHost(true);
            }
            return;
          }

          // If the studio just went LIVE while the audience was on the waiting
          // screen, the room_url (stored in a protected table) is now available.
          // Re-fetch it and transition into the live view automatically. Without
          // this, viewers stay stuck on "Studio Opens Soon" until a manual
          // refresh. The ref guard ensures we fetch only once — host heartbeat
          // updates also fire this handler every ~45s and must be ignored.
          if (newData.is_live === true && !newData.live_ended_at && !roomUrlReadyRef.current) {
            (async () => {
              const { data: roomUrl } = await supabase.rpc("get_event_room_url", {
                event_id: eventId,
              });
              if (roomUrl) {
                console.log("[LiveRoom] Studio went live — transitioning audience into the room");
                roomUrlReadyRef.current = true;
                setEvent((prev) =>
                  prev ? { ...prev, is_live: true, live_ended_at: null, room_url: roomUrl } : prev
                );
              }
            })();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, isCreator, streamEndedByHost]);

  // Host-liveness heartbeat. While the creator is broadcasting, beat every 45s
  // so the server-side reaper (end_abandoned_sessions) can tell an active
  // session apart from one the host abandoned (tab close / crash / lost power)
  // without pressing End — preventing studios that show as LIVE forever. The
  // RPC is a no-op unless the caller is the creator and the event is live.
  useEffect(() => {
    if (!isCreator || !eventId || !event?.is_live || event?.live_ended_at || streamEndedByHost) {
      return;
    }
    let cancelled = false;
    const beat = () => {
      (supabase.rpc as any)("touch_live_heartbeat", { p_event_id: eventId }).then(
        ({ error }: { error: { message: string } | null }) => {
          if (error && !cancelled) {
            console.warn("[LiveRoom] heartbeat failed (non-fatal):", error.message);
          }
        }
      );
    };
    beat();
    const interval = setInterval(beat, 45_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isCreator, eventId, event?.is_live, event?.live_ended_at, streamEndedByHost]);

  // Notify the creator when a tip lands. Listens on the per-creator private
  // Broadcast topic emitted by the broadcast_creator_earning DB trigger (the
  // creator viewing their own room has auth.uid() === creator_id, which the
  // realtime.messages topic policy authorises). The payload is sanitized — it
  // carries amount_gross (cents) and ticket_id only, no buyer/stripe data.
  useEffect(() => {
    if (!isCreator || !event?.creator_id || !eventId) return;

    const channel = supabase
      .channel(`creator-earnings-${event.creator_id}`, { config: { private: true } })
      .on("broadcast", { event: "earning" }, (payload) => {
        const earning = (payload.payload ?? {}) as {
          amount_gross?: number;
          ticket_id?: string | null;
          event_id?: string;
        };
        // ticket_id is set for session ticket purchases — only fire for actual tips
        if (earning.ticket_id != null) return;
        // The creator topic spans all their sessions; only toast for THIS room.
        if (earning.event_id && earning.event_id !== eventId) return;
        // amount_gross is in cents — convert to dollars for display.
        const amountStr =
          earning.amount_gross != null
            ? `$${(earning.amount_gross / 100).toFixed(2)}`
            : null;
        toast.custom((t) => (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            onClick={() => toast.dismiss(t)}
            className="flex items-center gap-3 bg-obsidian/95 backdrop-blur-xl border border-accent/30 rounded-2xl px-4 py-3.5 shadow-2xl cursor-pointer min-w-[260px] max-w-[340px]"
          >
            <div className="w-9 h-9 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center flex-shrink-0 text-base text-accent">
              ✦
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground leading-snug">
                {amountStr ? `${amountStr} tip just landed` : "New tip received"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                A fan is showing their love
              </p>
            </div>
          </motion.div>
        ), { duration: 8000 });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isCreator, event?.creator_id, eventId]);

  // Handle recreating the room
  const handleRecreateRoom = useCallback(async () => {
    if (!eventId || !session?.access_token) {
      toast.error("You must be logged in to create a room");
      return;
    }

    console.log("[LiveRoom] Recreating room for event:", eventId);
    setIsRecreatingRoom(true);

    try {
      const response = await supabase.functions.invoke("create-live-room", {
        body: { event_id: eventId },
      });

      console.log("[LiveRoom] create-live-room response:", response);

      if (response.error) {
        console.error("[LiveRoom] Error from edge function:", response.error);
        toast.error(response.error.message || "Failed to create room");
        return;
      }

      const { room_url } = response.data;
      console.log("[LiveRoom] Room created:", room_url);

      if (room_url) {
        // Update local state
        setEvent((prev) => (prev ? { ...prev, room_url, is_live: true } : null));
        toast.success("Room created! Connecting...");
      } else {
        toast.error("No room URL returned");
      }
    } catch (err: any) {
      console.error("[LiveRoom] Error recreating room:", err);
      toast.error(err.message || "Failed to create room");
    } finally {
      setIsRecreatingRoom(false);
    }
  }, [eventId, session?.access_token]);

  const handleRetryDaily = useCallback(async () => {
    console.log("[LiveRoom] Retry Daily requested");
    setIsRetryingDaily(true);
    setPermissionError(false);

    try {
      await reset();
    } finally {
      setIsRetryingDaily(false);
    }
  }, [reset]);

  // Handle closing the live room (host = end stream, viewer = leave with feedback)
  const handleClose = useCallback(async () => {
    if (isEnding) return;
    setIsEnding(true);

    // Start leaving immediately for a snappier UX
    const leavePromise = leave();

    try {
      if (isCreator && event) {
        console.log("[LiveRoom] Creator ending stream...");

        // CRITICAL: end-of-stream must succeed even if the
        // primary_device_id column does not exist yet (migration not
        // applied). PostgREST rejects the whole UPDATE if any column in
        // the payload is unknown, so we send the required fields first
        // and clear primary_device_id as a separate best-effort call.
        const [updateRes] = await Promise.all([
          supabase
            .from("events")
            .update({
              is_live: false,
              live_ended_at: new Date().toISOString(),
            })
            .eq("id", event.id),

          // Clean up all viewers (doesn't need to block UI)
          supabase.from("live_viewers").delete().eq("event_id", event.id),
        ]);

        // Free the primary-device slot. This is best-effort: if the column
        // doesn't exist yet we just swallow the error — the main UPDATE
        // above has already ended the stream successfully.
        releasePrimary().catch((err) =>
          console.warn(
            "[LiveRoom] releasePrimary failed (non-fatal — column may be missing):",
            err
          )
        );

        if (updateRes?.error) {
          console.error("[LiveRoom] Error ending stream:", updateRes.error);
          toast.error("Failed to end session");
        } else {
          toast.success("Session ended");
        }
        
        // Creator goes home without feedback modal
        await Promise.race([leavePromise, new Promise((r) => setTimeout(r, 1200))]);
        navigateBack(navigate, "/");
      } else {
        // Viewer leaving - show feedback modal
        await leaveAsViewer();
        await Promise.race([leavePromise, new Promise((r) => setTimeout(r, 1200))]);
        
        // Show feedback modal for viewers (session ended normally)
        if (!feedbackShownRef.current && event) {
          feedbackShownRef.current = true;
          setFeedbackLeftEarly(false);
          setShowFeedbackModal(true);
        } else {
          navigateBack(navigate, "/");
        }
      }
    } catch (err) {
      console.error("[LiveRoom] Error in handleClose:", err);
      navigateBack(navigate, "/");
    }
  }, [isEnding, isCreator, event, leaveAsViewer, leave, navigate]);

  // Viewer leave handler (early leave)
  const handleLeave = useCallback(async () => {
    await leaveAsViewer();
    await leave();
    
    // Show feedback modal for viewers who left early
    if (!feedbackShownRef.current && event && !isCreator) {
      feedbackShownRef.current = true;
      setFeedbackLeftEarly(true);
      setShowFeedbackModal(true);
    } else {
      navigateBack(navigate, "/");
    }
  }, [leaveAsViewer, leave, navigate, event, isCreator]);

  // Handle feedback modal close - use replace to prevent back button reopening ended stream
  const handleFeedbackClose = useCallback(() => {
    setShowFeedbackModal(false);
    navigate("/", { replace: true });
  }, [navigate]);

  // Handle stream ended actions (for viewers)
  const handleStreamEndedBackToCreator = useCallback(() => {
    // First trigger feedback modal, then navigate to creator
    if (!feedbackShownRef.current && event) {
      feedbackShownRef.current = true;
      setFeedbackLeftEarly(false);
      setShowFeedbackModal(true);
    }
  }, [event]);

  const handleStreamEndedExploreStudios = useCallback(() => {
    // First trigger feedback modal, then navigate home
    if (!feedbackShownRef.current && event) {
      feedbackShownRef.current = true;
      setFeedbackLeftEarly(false);
      setShowFeedbackModal(true);
    }
  }, [event]);

  // When stream ends by host, automatically trigger feedback modal after short delay
  useEffect(() => {
    if (streamEndedByHost && !isCreator && !feedbackShownRef.current && event) {
      // Clean up viewer status
      leaveAsViewer();
      
      // Small delay to let the end screen show first, then trigger feedback
      const timer = setTimeout(() => {
        if (!feedbackShownRef.current) {
          feedbackShownRef.current = true;
          setFeedbackLeftEarly(false);
          setShowFeedbackModal(true);
        }
      }, 1500);
      
      return () => clearTimeout(timer);
    }
  }, [streamEndedByHost, isCreator, event, leaveAsViewer]);

  // UX: Check for slow connection (> 3 seconds)
  useEffect(() => {
    if (!joinStartTime) return;
    
    const timer = setTimeout(() => {
      if (joinStartTime && (isJoining || status === "joining")) {
        setIsSlowConnection(true);
      }
    }, 3000);
    
    return () => clearTimeout(timer);
  }, [joinStartTime, isJoining, status]);

  // Chat handlers - use the hook's open/close methods for proper unread tracking
  const handleOpenChat = () => {
    openChat();
    setShowChat(true);
    setShowMaterials(false);
  };

  const handleCloseChat = () => {
    closeChat();
    setShowChat(false);
  };

  const handleChatNotificationView = () => {
    handleOpenChat();
  };

  const handleSendMessage = async (message: string) => {
    return await sendChatMessage(message);
  };

  // Materials handlers
  const handleOpenMaterials = () => {
    setShowMaterials(true);
    setShowChat(false);
  };

  const handleCloseMaterials = () => {
    setShowMaterials(false);
  };

  const handleShare = useCallback(async () => {
    if (!event) return;
    const shareUrl = `${window.location.origin}/s/${event.id}`;
    const shareData = {
      title: event.title,
      text: "I'm live on Exhiby — join me now!",
      url: shareUrl,
    };
    if (navigator.share && navigator.canShare?.(shareData)) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Live link copied — share it with your audience");
    } catch {
      toast.error("Couldn't copy link");
    }
  }, [event]);

  const handleAddMaterial = async (name: string, brand?: string, spec?: string) => {
    return await addMaterial(name, brand, spec);
  };

  const handleUpdateMaterial = async (id: string, name: string, brand?: string, spec?: string) => {
    return await updateMaterial(id, name, brand, spec);
  };

  const handleDeleteMaterial = async (id: string) => {
    return await deleteMaterial(id);
  };

  // Other handlers
  const handleRaiseHand = useCallback(async () => {
    triggerClickHaptic();
    
    if (myHandRaised) {
      // Lower hand
      const { success, error } = await lowerHand();
      if (success) {
        toast.success("Hand lowered");
      } else if (error) {
        toast.error(error);
      }
    } else {
      // Raise hand
      const { success, error } = await raiseHand();
      if (success) {
        toast.success("🖐️ Hand raised!");
      } else if (error) {
        toast.error(error);
      }
    }
  }, [myHandRaised, raiseHand, lowerHand]);

  const handleOpenHandRaises = useCallback(() => {
    triggerClickHaptic();
    setShowHandRaises(true);
  }, []);

  // Tip button state
  const [showTipModal, setShowTipModal] = useState(false);
  
  const handleSwipeToPay = () => {
    setShowTipModal(true);
  };

  // Studio Camera mode (phone as second camera) — opt in via ?mode=studio-cam
  const isStudioCameraMode = searchParams.get("mode") === "studio-cam";

  // Detect a phone-camera participant joined as the second camera
  const studioCamParticipant =
    remoteParticipants.find((p) => p.userName?.startsWith(STUDIO_CAM_PREFIX)) ?? null;
  const studioCameraConnected = !!studioCamParticipant;

  // Get the host participant (for viewers to see)
  // Prefer the dedicated studio-camera feed when available — for both creator and audience.
  const hostParticipant =
    studioCamParticipant ?? (isCreator ? localParticipant : remoteParticipants[0]);

  // Debug data for panel
  const debugEventData = event ? {
    id: event.id,
    room_url: event.room_url,
    is_live: event.is_live,
    creator_id: event.creator_id,
  } : null;

  // Show skeleton while event data loads OR while detecting device role (creator only)
  if (loading || ticketLoading || (isCreator && deviceRole === "checking")) {
    return (
      <>
        <LiveRoomSkeleton />
        <DebugPanel
          eventId={eventId}
          eventData={null}
          dailyStatus={dailyStatus}
          errorMessage={null}
          errorStack={null}
          isRecreatingRoom={isRecreatingRoom}
          onRecreateRoom={handleRecreateRoom}
        />
      </>
    );
  }

  // ── COMPANION MODE ───────────────────────────────────────────────────────────
  // Another device the same creator opened is already the primary broadcaster.
  // We trust either signal: events.primary_device_id (fast, pre-Daily.co) or
  // the Daily.co participants safety net (works even if the DB column is
  // missing). Either way, render the chat/audience management UI on top of a
  // blurred cover-photo background — no camera.
  if (
    isCreator &&
    (deviceRole === "companion" || dailyDetectedSecondary) &&
    event?.is_live
  ) {
    return (
      <CompanionModeView
        eventId={event.id}
        creatorId={event.creator_id}
        eventTitle={event.title}
        creatorName={profile?.name || profile?.handle || "Studio"}
        coverUrl={event.cover_url}
      />
    );
  }

  // Studio Camera mode: phone-only camera UI for the creator.
  // Render the dedicated full-screen camera view instead of the full LiveRoom.
  if (isStudioCameraMode && isCreator && event?.room_url) {
    return (
      <StudioCameraView
        roomUrl={event.room_url}
        eventTitle={event.title}
        creatorName={profile?.name || profile?.handle || "Studio"}
        onDisconnect={() => navigate(`/live/${event.id}`)}
      />
    );
  }

  // Handle payment success for paid events
  const handlePaymentSuccess = async () => {
    console.log("[LiveRoom] Payment success callback");
    setShowPaymentDrawer(false);
    // For free events, the ticket was created by create-checkout-session
    // Refetch to pick it up
    await refetchTicket();
    toast.success("Access granted! Joining session...");
  };

  // Show "confirming payment" UI when awaiting webhook/verify confirmation
  if (isAwaitingPaymentConfirmation && event && !hasValidTicket) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
        <div className="text-center max-w-md px-6">
          {event.cover_url && (
            <div className="w-32 h-32 rounded-2xl overflow-hidden mx-auto mb-6 shadow-lg">
              <img src={event.cover_url} alt={event.title} className="w-full h-full object-cover" />
            </div>
          )}
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <h2 className="text-xl font-display text-foreground mb-2">Confirming Payment</h2>
          <p className="text-sm text-muted-foreground">
            Your payment was successful. Verifying your ticket...
          </p>
        </div>
      </div>
    );
  }

  // Show paywall for paid events if user doesn't have ticket (and event hasn't ended)
  if (requiresPayment && event && !event.live_ended_at) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
        <div className="text-center max-w-md px-6">
          {event.cover_url && (
            <div className="w-32 h-32 rounded-2xl overflow-hidden mx-auto mb-6 shadow-lg">
              <img src={event.cover_url} alt={event.title} className="w-full h-full object-cover" />
            </div>
          )}
          <h2 className="text-xl font-display text-foreground mb-2">{event.title}</h2>
          {event.creator && (
            <p className="text-sm text-muted-foreground mb-4">
              by {event.creator.name}
            </p>
          )}
          <div className="bg-muted/30 rounded-xl px-4 py-3 mb-6">
            <p className="text-sm text-foreground">This is a paid session</p>
            <p className="text-lg font-bold text-primary mt-1">${event.price.toFixed(2)}</p>
          </div>
          <button
            onClick={() => setShowPaymentDrawer(true)}
            className="w-full px-6 py-3 rounded-xl bg-electric text-white font-medium hover:bg-electric/90 transition-colors mb-3"
          >
            Pay to Enter
          </button>
          <button
            onClick={() => navigate("/")}
            className="px-6 py-3 rounded-xl bg-muted text-foreground font-medium hover:bg-muted/80 transition-colors"
          >
            Back to Home
          </button>
        </div>
        
        {/* Payment Drawer */}
        <PaymentDrawer
          isOpen={showPaymentDrawer}
          onClose={() => setShowPaymentDrawer(false)}
          onPaymentSuccess={handlePaymentSuccess}
          price={event.price}
          eventTitle={event.title}
          artistName={event.creator?.name || "Unknown Artist"}
          coverImage={event.cover_url || "/placeholder.svg"}
          eventId={event.id}
          isFree={event.is_free}
        />
      </div>
    );
  }

  // Show "studio is full" when capacity gate blocks entry
  if (isSessionFull && event) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
        <div className="text-center max-w-md px-6">
          {event.cover_url && (
            <div className="w-28 h-28 rounded-2xl overflow-hidden mx-auto mb-6 shadow-lg opacity-80">
              <img src={event.cover_url} alt={event.title} className="w-full h-full object-cover" />
            </div>
          )}
          <div className="w-14 h-14 rounded-full bg-muted/40 border border-border/40 flex items-center justify-center mx-auto mb-4">
            <Users className="w-7 h-7 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-display text-foreground mb-2">Studio Is Full</h2>
          <p className="text-muted-foreground mb-2">{event.title}</p>
          {sessionFullMax && (
            <p className="text-sm text-muted-foreground/70 mb-6">
              This studio has reached its {sessionFullMax}-seat limit.
              <br />A spot may open up soon — check back shortly.
            </p>
          )}
          {!sessionFullMax && (
            <p className="text-sm text-muted-foreground/70 mb-6">
              All seats are taken. A spot may open up soon — check back shortly.
            </p>
          )}
          <button
            onClick={() => { setIsSessionFull(false); navigate("/"); }}
            className="px-6 py-3 rounded-xl bg-electric text-white font-medium hover:bg-electric/90 transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // Helper to check if event has truly ended
  const isEventEnded = event?.live_ended_at != null;
  
  // Helper to check if event is scheduled but not started
  const isScheduledNotStarted = event && !event.is_live && !event.live_ended_at && !event.room_url;
  
  // Helper to format scheduled time with short timezone abbreviation.
  // formatToParts is used so we read the timeZoneName part explicitly rather than
  // string-splitting (which could mistake "PM" for the zone if it were omitted).
  const formatScheduledTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const base = format(date, "EEEE, MMMM d 'at' h:mm a");
    let tzAbbr = "";
    try {
      // hour is included so the timeZoneName part is reliably emitted across
      // engines; we still only read the zone, so the visible output is unchanged.
      const parts = new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        timeZoneName: "short",
      }).formatToParts(date);
      tzAbbr = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
    } catch {
      tzAbbr = "";
    }
    return tzAbbr ? `${base} ${tzAbbr}` : base;
  };

  // Show "Stream Unavailable" only for ended events or truly not found
  if (error || !event) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
        <DebugPanel
          eventId={eventId}
          eventData={debugEventData}
          dailyStatus={dailyStatus}
          errorMessage={error}
          errorStack={null}
          isRecreatingRoom={isRecreatingRoom}
          onRecreateRoom={handleRecreateRoom}
        />
        <div className="text-center max-w-md px-6">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-display text-foreground mb-2">Session Unavailable</h2>
          <p className="text-muted-foreground mb-6">{error || "This live session is not available."}</p>
          <button
            onClick={() => navigate("/")}
            className="px-6 py-3 rounded-xl bg-electric text-white font-medium hover:bg-electric/90 transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // Show "Stream Ended" for ended events
  if (isEventEnded) {
    const canTip = !isCreator && hasValidTicket;
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
        <div className="text-center max-w-md px-6">
          {event.cover_url && (
            <div className="w-24 h-24 rounded-2xl overflow-hidden mx-auto mb-6 opacity-60">
              <img src={event.cover_url} alt={event.title} className="w-full h-full object-cover" />
            </div>
          )}
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-display text-foreground mb-2">Studio Session Ended</h2>
          <p className="text-muted-foreground mb-2">{event.title}</p>
          <p className="text-sm text-muted-foreground/70 mb-6">
            This studio session has concluded.
          </p>
          {/* Post-session appreciation button — Feature 7 */}
          {canTip && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4"
            >
              <button
                onClick={() => setShowTipModal(true)}
                className="w-full py-3 rounded-2xl border border-gold/30 bg-gold/5 text-sm font-semibold text-gold hover:bg-gold/10 transition-colors flex items-center justify-center gap-2"
              >
                ♡ Enjoyed the session? Support {event.creator?.name || "the artist"}
              </button>
            </motion.div>
          )}
          <button
            onClick={() => navigate("/")}
            className="px-6 py-3 rounded-xl bg-electric text-white font-medium hover:bg-electric/90 transition-colors"
          >
            Back to Home
          </button>
        </div>
        {/* Tip modal for post-session */}
        {canTip && (
          <TipCreatorModal
            isOpen={showTipModal}
            onClose={() => setShowTipModal(false)}
            creatorName={event.creator?.name || "the creator"}
            eventId={event.id}
          />
        )}
      </div>
    );
  }

  // Show waiting state for scheduled but not-yet-live events (for audience)
  if (!event.room_url) {
    const scheduledPast = isPast(new Date(event.scheduled_at));
    const scheduledDate = new Date(event.scheduled_at);
    const now = new Date();
    const msUntilStart = scheduledDate.getTime() - now.getTime();
    const minutesUntilStart = msUntilStart / (1000 * 60);
    const isStartingSoon = minutesUntilStart <= 15 && minutesUntilStart > 0;
    const isWaitingForCreator = scheduledPast && minutesUntilStart <= 0;
    
    // Format countdown
    const countdownText = msUntilStart > 0 
      ? formatDistanceToNowStrict(scheduledDate, { addSuffix: true })
      : "Starting soon...";
    
    const isSessionSaved = eventId ? isEventSaved(eventId) : false;
    
    const handleNotifyMe = async () => {
      if (!user) {
        toast.error("Please sign in to get reminders");
        return;
      }
      if (!eventId || !event.creator_id) return;
      
      triggerClickHaptic();
      
      if (isSessionSaved) {
        const success = await removeSavedSession(eventId);
        if (success) {
          toast.success("Removed from My Sessions");
        }
      } else {
        const success = await saveSession(eventId, event.creator_id);
        if (success) {
          toast.success("You'll be notified when this session starts!");
        }
      }
    };
    
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
        <DebugPanel
          eventId={eventId}
          eventData={debugEventData}
          dailyStatus={dailyStatus}
          errorMessage="Missing room_url for this event"
          errorStack={null}
          isRecreatingRoom={isRecreatingRoom}
          onRecreateRoom={handleRecreateRoom}
        />
        <div className="text-center max-w-md px-6">
          {/* Cover Image */}
          {event.cover_url ? (
            <div className="w-32 h-32 rounded-2xl overflow-hidden mx-auto mb-6 shadow-lg">
              <img src={event.cover_url} alt={event.title} className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-electric/10 flex items-center justify-center mx-auto mb-6">
              <Palette className="w-10 h-10 text-electric" />
            </div>
          )}
          
          {isCreator ? (
            // Creator view - Go Live CTA
            <>
              {scheduledPast ? (
                <div className="flex items-center justify-center gap-2 mb-4">
                  <Clock className="w-5 h-5 text-destructive" />
                  <span className="text-sm text-destructive font-medium">Ready to Go Live</span>
                </div>
              ) : (
                <Calendar className="w-10 h-10 text-electric mx-auto mb-4" />
              )}
              <h2 className="text-xl font-display text-foreground mb-2">{event.title}</h2>
              {event.category && (
                <p className="text-sm text-muted-foreground mb-2">{event.category}</p>
              )}
              <p className="text-muted-foreground mb-2">
                {scheduledPast 
                  ? `Scheduled for ${formatScheduledTime(event.scheduled_at)}`
                  : `Starts ${formatScheduledTime(event.scheduled_at)}`
                }
              </p>
              <p className="text-sm text-muted-foreground/70 mb-6">
                {scheduledPast 
                  ? "Your audience is waiting! Click below to start the session."
                  : "Click below when you're ready to go live."
                }
              </p>
              <button
                onClick={handleRecreateRoom}
                disabled={isRecreatingRoom}
                className="px-6 py-3 rounded-xl bg-destructive text-white font-medium hover:bg-destructive/90 transition-colors disabled:opacity-50 flex items-center gap-2 mx-auto"
              >
                {isRecreatingRoom ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Going Live...
                  </>
                ) : (
                  <>
                    <Radio className="w-4 h-4" />
                    Go Live Now
                  </>
                )}
              </button>
            </>
          ) : (
            // Audience view - Enhanced "Starting Soon" screen
            <>
              {/* Header badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-electric/15 border border-electric/30 mb-4">
                {isStartingSoon ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-electric animate-pulse" />
                    <span className="text-xs font-medium text-electric">Starting soon</span>
                  </>
                ) : isWaitingForCreator ? (
                  <>
                    <Clock className="w-3 h-3 text-gold" />
                    <span className="text-xs font-medium text-gold">Waiting for creator</span>
                  </>
                ) : (
                  <>
                    <Calendar className="w-3 h-3 text-electric" />
                    <span className="text-xs font-medium text-electric">Scheduled</span>
                  </>
                )}
              </div>
              
              <h2 className="text-xl font-display text-foreground mb-2">Studio Opens Soon</h2>
              <h3 className="text-lg text-foreground/80 font-medium mb-1">{event.title}</h3>
              
              {event.creator && (
                <p className="text-sm text-muted-foreground mb-4">
                  by {event.creator.name}
                </p>
              )}
              
              {/* Time card */}
              <div className="bg-muted/30 rounded-xl px-4 py-4 mb-5">
                {isWaitingForCreator ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      The creator hasn't started yet
                    </p>
                    <p className="text-lg text-foreground font-semibold mt-1">
                      Waiting for {event.creator?.name || "creator"}...
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground mb-3">
                      {isStartingSoon ? "Starting in" : "Starts in"}
                    </p>
                    <LiveCountdown targetDate={scheduledDate} />
                    <p className="text-xs text-muted-foreground/70 mt-3">
                      {formatScheduledTime(event.scheduled_at)}
                    </p>
                  </>
                )}
              </div>
              
              {/* Notify Me button */}
              {user && !isSessionSaved && (
                <motion.button
                  onClick={handleNotifyMe}
                  whileTap={{ scale: 0.95 }}
                  className="w-full px-6 py-3 rounded-xl bg-electric text-white font-medium hover:bg-electric/90 transition-colors flex items-center justify-center gap-2 mb-3"
                >
                  <Bell className="w-4 h-4" />
                  Notify Me
                </motion.button>
              )}
              
              {user && isSessionSaved && (
                <motion.button
                  onClick={handleNotifyMe}
                  whileTap={{ scale: 0.95 }}
                  className="w-full px-6 py-3 rounded-xl bg-electric/15 text-electric border border-electric/40 font-medium hover:bg-electric/25 transition-colors flex items-center justify-center gap-2 mb-3"
                >
                  <BellRing className="w-4 h-4" />
                  Notification Set ✓
                </motion.button>
              )}
              
              <button
                onClick={() => navigate("/")}
                className="px-6 py-3 rounded-xl bg-muted text-foreground font-medium hover:bg-muted/80 transition-colors"
              >
                Back to Home
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // Only show permission error for hosts (viewers don't need camera/mic)
  if (permissionError && isCreator) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
        <DebugPanel
          eventId={eventId}
          eventData={debugEventData}
          dailyStatus={dailyStatus}
          errorMessage="Camera/Mic permission denied"
          errorStack={null}
          isRecreatingRoom={isRecreatingRoom}
          onRecreateRoom={handleRecreateRoom}
        />
        <div className="text-center max-w-md px-6">
          <div className="flex items-center justify-center gap-2 mb-4">
            <MicOff className="w-8 h-8 text-destructive" />
            <VideoOff className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="text-xl font-display text-foreground mb-2">Camera/Mic Blocked</h2>
          <p className="text-muted-foreground mb-6">
            Please allow camera and microphone permissions in your browser settings, then refresh the page.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 rounded-xl bg-electric text-white font-medium hover:bg-electric/90 transition-colors"
            >
              Refresh Page
            </button>
            <button
              onClick={() => navigate("/")}
              className="px-6 py-3 rounded-xl bg-muted text-foreground font-medium hover:bg-muted/80 transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Error or timeout state from Daily - Enhanced Exhiby-style error card
  if (dailyStatus === "error" || dailyStatus === "timeout") {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 bg-background flex items-center justify-center z-50"
      >
        <DebugPanel
          eventId={eventId}
          eventData={debugEventData}
          dailyStatus={dailyStatus}
          errorMessage={dailyError}
          errorStack={dailyErrorStack}
          isRecreatingRoom={isRecreatingRoom}
          onRecreateRoom={handleRecreateRoom}
        />
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-center max-w-md px-6"
        >
          {/* Error icon with subtle animation */}
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
          >
            <AlertCircle className="w-14 h-14 text-destructive/80 mx-auto mb-5" />
          </motion.div>
          
          <h2 className="text-xl font-display text-foreground mb-2">
            Couldn't Connect
          </h2>
          <p className="text-muted-foreground mb-6 text-sm">
            {dailyStatus === "timeout" 
              ? "The connection took too long. Check your internet and try again."
              : dailyError || "Something went wrong. Please try again."
            }
          </p>
          
          <div className="flex flex-col gap-3">
            <button
              onClick={handleRetryDaily}
              disabled={isJoining || isRetryingDaily}
              className="w-full px-6 py-3.5 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isJoining || isRetryingDaily ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Retrying…
                </>
              ) : (
                "Retry"
              )}
            </button>
            <button
              onClick={() => navigate("/")}
              className="w-full px-6 py-3.5 rounded-xl bg-muted text-foreground font-medium hover:bg-muted/80 transition-colors"
            >
              Back
            </button>
          </div>
        </motion.div>
      </motion.div>
    );
  }

  // NOTE: Slow connection effect was moved to the hooks section above

  // Connecting state - Enhanced "Entering the Studio" experience
  if (isJoining || status === "joining" || status === "creating") {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 bg-background flex items-center justify-center z-50"
      >
        <DebugPanel
          eventId={eventId}
          eventData={debugEventData}
          dailyStatus={dailyStatus}
          errorMessage={dailyError}
          errorStack={dailyErrorStack}
          isRecreatingRoom={isRecreatingRoom}
          onRecreateRoom={handleRecreateRoom}
        />
        
        {/* Background with subtle artwork */}
        {event?.cover_url && (
          <div className="absolute inset-0 overflow-hidden">
            <img
              src={event.cover_url}
              alt=""
              className="w-full h-full object-cover opacity-5 blur-2xl scale-110"
            />
          </div>
        )}
        
        <div className="relative z-10 text-center max-w-md px-6">
          {/* Creator Avatar */}
          {event?.creator?.avatar_url && (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="mb-6"
            >
              <img
                src={event.creator.avatar_url}
                alt={event.creator.name}
                className="w-16 h-16 rounded-full mx-auto border-2 border-border/50 shadow-lg"
              />
            </motion.div>
          )}
          
          {/* Spinner */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mb-4"
          >
            <div className="w-10 h-10 mx-auto border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </motion.div>
          
          {/* Title */}
          <motion.h2
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="text-xl font-display text-foreground mb-2"
          >
            Entering the Studio…
          </motion.h2>
          
          {/* Dynamic subtext */}
          <motion.p
            key={isSlowConnection ? "slow" : "normal"}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-sm text-muted-foreground"
          >
            {isSlowConnection 
              ? "Still connecting… hang tight"
              : "Setting up your session"
            }
          </motion.p>
          
          {/* Event info */}
          {event && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-xs text-muted-foreground/60 mt-4"
            >
              {event.title}
            </motion.p>
          )}
        </div>
      </motion.div>
    );
  }

  // Stream ended by host - show end screen for viewers
  if (streamEndedByHost && !isCreator && event) {
    return (
      <>
        <StreamEndedScreen
          creatorName={event.creator?.name || "the creator"}
          creatorAvatar={event.creator?.avatar_url || null}
          sessionTitle={event.title}
          coverUrl={event.cover_url}
          onBackToCreator={handleStreamEndedBackToCreator}
          onExploreStudios={handleStreamEndedExploreStudios}
        />
        {/* Feedback Modal overlay */}
        <SessionFeedbackModal
          isOpen={showFeedbackModal}
          onClose={handleFeedbackClose}
          eventId={event.id}
          creatorId={event.creator_id}
          creatorName={event.creator?.name || "the creator"}
          sessionTitle={event.title}
          leftEarly={feedbackLeftEarly}
        />
      </>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-background z-50"
      onClick={resetHideTimer}
    >
      {/* Debug Panel */}
      <DebugPanel
        eventId={eventId}
        eventData={debugEventData}
        dailyStatus={dailyStatus}
        errorMessage={dailyError}
        errorStack={dailyErrorStack}
        isRecreatingRoom={isRecreatingRoom}
        onRecreateRoom={handleRecreateRoom}
      />

      {/* Video Container - Responsive Layout */}
      <div
        className={`w-full h-full flex ${
          isMobile
            ? "flex-col" // Mobile/Tablet: fullscreen like FaceTime
            : "flex-row" // Desktop: horizontal layout
        } bg-black`}
      >
        {/* Main Video (Host or Self) */}
        <div className="relative flex-1 bg-black overflow-hidden">
          {hostParticipant ? (
            <DailyVideoTile
              participant={hostParticipant}
              className="w-full h-full"
              // Correct mirrored front camera for BOTH creator + audience
              isMirrored={hostParticipant.facingMode === "user"}
              useContain={!isMobile} // Mobile: cover (FaceTime style), Desktop: contain (no crop)
              fallbackImageUrl={event.cover_url || event.creator?.avatar_url || null}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-black">
              {event.cover_url ? (
                <img
                  src={event.cover_url}
                  alt={event.title}
                  className="w-full h-full object-cover opacity-50"
                />
              ) : (
                <p className="text-muted-foreground">Waiting for host...</p>
              )}
            </div>
          )}

          {/* Reconnecting Banner */}
          <ReconnectingBanner isVisible={isReconnecting} />

          {/* Dev-only Quality Badge */}
          {!isCreator && (
            <VideoQualityBadge 
              qualityStats={qualityStats} 
              className="absolute top-16 right-4 z-30"
            />
          )}

          {/* Header Overlay */}
          <LiveRoomHeader
            creatorName={event.creator?.name || "Unknown Artist"}
            creatorAvatar={event.creator?.avatar_url || null}
            eventTitle={event.title}
            viewerCount={viewerCount}
            isUIVisible={isUIVisible && !showMaterials}
            isHost={isCreator}
            onSwitchCamera={isCreator && isMobile ? switchCamera : undefined}
          />

          {/* Chat Overlay - uses unified realtime status */}
          <LiveRoomChat
            isOpen={showChat}
            onClose={handleCloseChat}
            messages={chatMessages}
            status={realtimeStatus}
            messageCount={chatMessageCount}
            onSendMessage={handleSendMessage}
            onReload={() => { reloadMessages(); reconnectRealtime(); }}
            isAuthenticated={!!user}
            isCreator={isCreator}
            pinnedMessage={pinnedMessage}
            pinnedMessageId={pinnedMessageId}
            onPinMessage={pinMessage}
            onUnpinMessage={unpinMessage}
          />

          {/* Materials Panel */}
          <LiveRoomMaterials
            isOpen={showMaterials}
            onClose={handleCloseMaterials}
            materials={materials}
            isHost={isCreator}
            onAddMaterial={handleAddMaterial}
            onUpdateMaterial={handleUpdateMaterial}
            onDeleteMaterial={handleDeleteMaterial}
            onRefresh={!isCreator ? refetchMaterials : undefined}
          />

          {/* Controls */}
          <LiveRoomControls
            isHost={isCreator}
            isCameraOn={isCameraOn}
            isMicOn={isMicOn}
            isUIVisible={isUIVisible && !showChat}
            isEnding={isEnding}
            onToggleCamera={toggleCamera}
            onSwitchCamera={isMobile ? switchCamera : undefined}
            onToggleMic={toggleMic}
            onEndStream={handleClose}
            onLeave={handleLeave}
            onOpenChat={handleOpenChat}
            onRaiseHand={handleRaiseHand}
            onOpenMaterials={handleOpenMaterials}
            onSwipeToPay={handleSwipeToPay}
            handRaised={myHandRaised}
            unreadChatCount={showChat ? 0 : chatUnreadCount}
            handRaiseCount={handRaiseCount}
            onOpenHandRaises={handleOpenHandRaises}
            studioCameraConnected={studioCameraConnected}
            onShare={handleShare}
          />

          {/* Subtle one-time hint nudging the creator toward a second device.
              Only shown on the actual primary device (the one broadcasting).
              The companion device renders CompanionModeView instead and never
              reaches this branch. */}
          {isCreator && event && deviceRole === "primary" && !dailyDetectedSecondary && (
            <CompanionDeviceHint
              eventId={event.id}
              isLive={dailyStatus === "joined" && !!event.is_live}
            />
          )}

          {/* Hand Raises Drawer (Creator Only) */}
          {isCreator && (
            <HandRaisesDrawer
              isOpen={showHandRaises}
              onClose={() => setShowHandRaises(false)}
              handRaises={handRaises}
              onClearSingle={clearHandRaise}
              onClearAll={clearAllHandRaises}
            />
          )}

          {/* Chat Notification Toast */}
          <ChatNotificationToast
            message={latestUnreadMessage}
            isChatOpen={showChat}
            onView={handleChatNotificationView}
            onDismiss={clearLatestUnread}
          />

          {/* Send Appreciation button — Feature 7: outside video room controls, ticket holders only */}
          {!isCreator && hasValidTicket && isUIVisible && !showChat && (
            <motion.button
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              onClick={() => { triggerClickHaptic(); setShowTipModal(true); }}
              className="absolute left-4 bottom-20 z-30 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-sm border border-white/10 text-xs font-medium text-white/80 hover:text-white hover:bg-black/80 transition-all"
            >
              ♡ Support {event.creator?.name?.split(" ")[0] || "Artist"}
            </motion.button>
          )}
        </div>

        {/* Desktop: optional self-view pip for host (avoid duplicating the same tile) */}
        {!isMobile &&
          isCreator &&
          localParticipant &&
          hostParticipant &&
          hostParticipant.sessionId !== localParticipant.sessionId && (
            <div className="absolute bottom-24 right-4 w-48 h-32 rounded-xl overflow-hidden border-2 border-white/20 shadow-2xl z-10">
              <DailyVideoTile
                participant={localParticipant}
                className="w-full h-full"
                // Correct mirrored front camera for creator PIP
                isMirrored={localParticipant.facingMode === "user"}
                showName
              />
            </div>
          )}
      </div>
      
      {/* Session Feedback Modal */}
      {event && (
        <SessionFeedbackModal
          isOpen={showFeedbackModal}
          onClose={handleFeedbackClose}
          eventId={event.id}
          creatorId={event.creator_id}
          creatorName={event.creator?.name || "the creator"}
          sessionTitle={event.title}
          leftEarly={feedbackLeftEarly}
        />
      )}
      
      {/* Tip Creator Modal */}
      {event && !isCreator && (
        <TipCreatorModal
          isOpen={showTipModal}
          onClose={() => setShowTipModal(false)}
          creatorName={event.creator?.name || "the creator"}
          eventId={event.id}
        />
      )}
    </motion.div>
  );
}
