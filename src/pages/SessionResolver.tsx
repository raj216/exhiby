import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Calendar, Clock, AlertCircle, Radio } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { navigateBack } from "@/lib/navigation";

interface SessionData {
  id: string;
  title: string;
  cover_url: string | null;
  is_live: boolean;
  is_free: boolean;
  price: number;
  scheduled_at: string | null;
  live_ended_at: string | null;
  category: string | null;
  creator_id: string;
  creator_name: string | null;
  creator_avatar: string | null;
}

type SessionStatus = "live" | "scheduled" | "ended" | "not_found";

export default function SessionResolver() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const [session, setSession] = useState<SessionData | null>(null);
  const [status, setStatus] = useState<SessionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      // Encode the current path as redirect parameter
      const redirectPath = `/s/${sessionId}`;
      navigate(`/auth?redirect=${encodeURIComponent(redirectPath)}`, { replace: true });
    }
  }, [user, authLoading, sessionId, navigate]);

  // Fetch session data once authenticated
  useEffect(() => {
    if (!user || !sessionId) return;

    const fetchSession = async () => {
      setIsLoading(true);
      
      try {
        // Fetch event (do NOT join profiles; public access is via vetted RPCs)
        const { data, error } = await supabase
          .from("events")
          .select(
            "id, title, cover_url, is_live, is_free, price, scheduled_at, live_ended_at, category, creator_id"
          )
          .eq("id", sessionId)
          .single();

        if (error || !data) {
          setStatus("not_found");
          setIsLoading(false);
          return;
        }

        // Hydrate creator profile using safe RPC (returns only public fields)
        let creatorName: string | null = null;
        let creatorAvatar: string | null = null;

        if (data.creator_id) {
          const { data: creators, error: creatorsError } = await supabase.rpc(
            "get_creator_profiles",
            { user_ids: [data.creator_id] }
          );

          if (creatorsError) {
            console.warn("[SessionResolver] get_creator_profiles error:", creatorsError);
          }

          const creator = creators?.find((c: any) => c.user_id === data.creator_id);
          creatorName = creator?.name ?? null;
          creatorAvatar = creator?.avatar_url ?? null;
        }

        const sessionData: SessionData = {
          id: data.id,
          title: data.title,
          cover_url: data.cover_url,
          is_live: data.is_live ?? false,
          is_free: data.is_free,
          price: data.price ?? 0,
          scheduled_at: data.scheduled_at,
          live_ended_at: data.live_ended_at,
          category: data.category,
          creator_id: data.creator_id,
          creator_name: creatorName,
          creator_avatar: creatorAvatar,
        };

        setSession(sessionData);

        // Determine status
        if (data.is_live) {
          setStatus("live");
        } else if (data.live_ended_at) {
          setStatus("ended");
        } else if (data.scheduled_at) {
          const scheduledDate = new Date(data.scheduled_at);
          const now = new Date();
          // Check if it's past the scheduled time + 60 min buffer and never went live
          const missedWindow = new Date(scheduledDate.getTime() + 60 * 60 * 1000);
          if (now > missedWindow) {
            setStatus("ended");
          } else {
            setStatus("scheduled");
          }
        } else {
          setStatus("not_found");
        }
      } catch (err) {
        console.error("Error fetching session:", err);
        setStatus("not_found");
      }

      setIsLoading(false);
    };

    fetchSession();
  }, [user, sessionId]);

  // Navigate based on status once determined
  useEffect(() => {
    if (!status || isLoading || !session) return;

    if (status === "live") {
      // Go directly to live room
      navigate(`/live/${session.id}`, { replace: true });
    }
    // For scheduled and ended, we show a UI (don't auto-navigate)
  }, [status, isLoading, session, navigate]);

  // SEO meta tags
  useEffect(() => {
    if (!session) return;
    const isLiveSession = status === "live";
    const isScheduledSession = status === "scheduled";
    const creatorLabel = session.creator_name ? ` by ${session.creator_name}` : "";
    const statusLabel = isLiveSession ? " 🔴 Live Now" : isScheduledSession ? " — Upcoming" : "";
    const title = `${session.title}${statusLabel}${creatorLabel} | Exhiby`.slice(0, 60);
    const desc = [
      session.creator_name ? `Join ${session.creator_name}'s` : "Join this",
      isLiveSession ? "live art session" : "upcoming art session",
      "on Exhiby.",
      session.is_free ? "Free to attend." : `$${session.price} ticket.`,
    ].join(" ").slice(0, 160);
    const image = session.cover_url || `${window.location.origin}/og-default.png`;
    const url = `${window.location.origin}/s/${session.id}`;

    const setMeta = (selector: string, attr: string, value: string) => {
      let el = document.querySelector(selector) as HTMLElement | null;
      if (!el) {
        el = document.createElement("meta");
        const match = selector.match(/\[(.*?)="(.*?)"\]/);
        if (match) el.setAttribute(match[1], match[2]);
        document.head.appendChild(el);
      }
      el.setAttribute(attr, value);
    };

    document.title = title;
    setMeta('meta[name="description"]', "content", desc);
    setMeta('meta[property="og:title"]', "content", title);
    setMeta('meta[property="og:description"]', "content", desc);
    setMeta('meta[property="og:image"]', "content", image);
    setMeta('meta[property="og:url"]', "content", url);
    setMeta('meta[property="og:type"]', "content", "website");
    setMeta('meta[property="og:site_name"]', "content", "Exhiby");
    setMeta('meta[name="twitter:card"]', "content", "summary_large_image");
    setMeta('meta[name="twitter:title"]', "content", title);
    setMeta('meta[name="twitter:description"]', "content", desc);
    setMeta('meta[name="twitter:image"]', "content", image);
  }, [session, status]);

  // Loading state
  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading session...</p>
        </div>
      </div>
    );
  }

  // Not found state
  if (status === "not_found") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-sm"
        >
          <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-muted-foreground" />
          </div>
          <h1 className="text-xl font-display font-semibold text-foreground mb-2">
            Session Not Found
          </h1>
          <p className="text-muted-foreground mb-6">
            This session may have been removed or the link is invalid.
          </p>
          <Button
            onClick={() => navigate("/", { replace: true })}
            className="bg-primary hover:bg-primary/90"
          >
            Go to Home
          </Button>
        </motion.div>
      </div>
    );
  }

  // Ended state
  if (status === "ended" && session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-sm"
        >
          {session.cover_url && (
            <div className="w-32 h-32 rounded-2xl overflow-hidden mx-auto mb-6 opacity-60">
              <img
                src={session.cover_url}
                alt={session.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
            <Clock className="w-6 h-6 text-muted-foreground" />
          </div>
          <h1 className="text-xl font-display font-semibold text-foreground mb-2">
            Session Ended
          </h1>
          <p className="text-muted-foreground mb-2">
            "{session.title}" has already ended.
          </p>
          {session.creator_name && (
            <p className="text-sm text-muted-foreground/70 mb-6">
              by {session.creator_name}
            </p>
          )}
          <Button
            onClick={() => navigate("/", { replace: true })}
            className="bg-primary hover:bg-primary/90"
          >
            Explore More Sessions
          </Button>
        </motion.div>
      </div>
    );
  }

  // Scheduled state - show session details with Remind Me
  if (status === "scheduled" && session) {
    const scheduledDate = session.scheduled_at ? new Date(session.scheduled_at) : null;
    
    return (
      <div className="min-h-screen bg-background">
        {/* Cover Image */}
        <div className="relative h-64 sm:h-80">
          {session.cover_url ? (
            <img
              src={session.cover_url}
              alt={session.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/20" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
          
          {/* Back button */}
          <button
            onClick={() => navigateBack(navigate, "/")}
            className="absolute top-4 left-4 w-10 h-10 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m12 19-7-7 7-7" />
              <path d="M19 12H5" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-6 -mt-16 relative z-10"
        >
          {/* Creator info */}
          {session.creator_avatar && (
            <div className="flex items-center gap-3 mb-4">
              <img
                src={session.creator_avatar}
                alt={session.creator_name || "Creator"}
                className="w-12 h-12 rounded-full border-2 border-background object-cover"
              />
              <div>
                <p className="font-medium text-foreground">{session.creator_name}</p>
                <p className="text-sm text-muted-foreground">Creator</p>
              </div>
            </div>
          )}

          {/* Title */}
          <h1 className="text-2xl font-display font-bold text-foreground mb-4">
            {session.title}
          </h1>

          {/* Schedule info */}
          {scheduledDate && (
            <div className="flex items-center gap-4 mb-6">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span className="text-sm">{format(scheduledDate, "EEEE, MMM d")}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span className="text-sm">{format(scheduledDate, "h:mm a")}</span>
              </div>
            </div>
          )}

          {/* Category badge */}
          {session.category && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/50 text-sm text-muted-foreground mb-6">
              {session.category}
            </div>
          )}

          {/* Price info */}
          <div className="mb-8">
            {session.is_free ? (
              <span className="text-lg font-semibold text-accent">Free</span>
            ) : (
              <span className="text-lg font-semibold text-foreground">
                ${session.price}
              </span>
            )}
          </div>

          {/* Status indicator */}
          <div className="flex items-center gap-2 p-4 rounded-xl bg-muted/30 border border-border/50 mb-6">
            <Radio className="w-5 h-5 text-primary animate-pulse" />
            <div>
              <p className="font-medium text-foreground">Scheduled Session</p>
              <p className="text-sm text-muted-foreground">
                This session will go live soon. You'll be able to join when it starts.
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <Button
              onClick={() => navigate(`/live/${session.id}`)}
              className="flex-1 bg-primary hover:bg-primary/90"
            >
              Join When Live
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return null;
}
