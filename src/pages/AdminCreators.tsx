import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Link2,
  Loader2,
  ExternalLink,
  User,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface Application {
  id: string;
  user_id: string;
  photo_creating_url: string;
  photo_progress_url: string;
  photo_finished_url: string;
  social_link: string | null;
  answer_teaching: string;
  answer_background: string;
  status: "pending" | "approved" | "rejected";
  submitted_at: string;
  reviewed_at: string | null;
  // joined from profiles
  applicant_name: string | null;
  applicant_handle: string | null;
  applicant_avatar: string | null;
}

type FilterStatus = "pending" | "approved" | "rejected" | "all";

// ── Single application card ───────────────────────────────────────────────────
function ApplicationCard({
  app,
  onDecision,
}: {
  app: Application;
  onDecision: (id: string, status: "approved" | "rejected") => Promise<void>;
}) {
  const [acting, setActing] = useState<"approved" | "rejected" | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const handleDecision = async (status: "approved" | "rejected") => {
    setActing(status);
    await onDecision(app.id, status);
    setActing(null);
  };

  const photos = [
    { label: "You Creating",      url: app.photo_creating_url },
    { label: "Work in Progress",  url: app.photo_progress_url },
    { label: "Finished Piece",    url: app.photo_finished_url },
  ];

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        className="bg-obsidian/60 border border-border/30 rounded-2xl overflow-hidden"
      >
        {/* ── Header: applicant identity ───────────────────────────────── */}
        <div className="flex items-center gap-3 px-4 pt-4 pb-3">
          <div className="w-10 h-10 rounded-full bg-carbon border border-border/40 overflow-hidden flex-shrink-0">
            {app.applicant_avatar ? (
              <img src={app.applicant_avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <User className="w-5 h-5 text-muted-foreground" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">
              {app.applicant_name ?? "Unknown"}
            </p>
            <p className="text-xs text-muted-foreground">
              @{app.applicant_handle ?? "—"} ·{" "}
              {formatDistanceToNow(new Date(app.submitted_at), { addSuffix: true })}
            </p>
          </div>
          {/* Status pill */}
          <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${
            app.status === "pending"
              ? "bg-gold/15 text-gold"
              : app.status === "approved"
              ? "bg-electric/15 text-electric"
              : "bg-crimson/15 text-crimson"
          }`}>
            {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
          </span>
        </div>

        <div className="h-px bg-border/20 mx-4" />

        {/* ── 3 photos ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-2 px-4 py-3">
          {photos.map(({ label, url }) => (
            <button
              key={label}
              onClick={() => setLightbox(url)}
              className="relative aspect-square rounded-xl overflow-hidden bg-carbon border border-border/30 group"
            >
              <img
                src={url}
                alt={label}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-carbon/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="absolute bottom-1 left-0 right-0 text-center">
                <span className="text-[9px] font-semibold text-white/80 leading-tight">{label}</span>
              </div>
            </button>
          ))}
        </div>

        {/* ── Written answers ───────────────────────────────────────────── */}
        <div className="px-4 space-y-3 pb-3">
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              What they'll teach
            </p>
            <p className="text-sm text-foreground/90 leading-relaxed">{app.answer_teaching}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              Creative background
            </p>
            <p className="text-sm text-foreground/90 leading-relaxed">{app.answer_background}</p>
          </div>
          {app.social_link && (
            <a
              href={app.social_link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-electric hover:underline"
            >
              <Link2 className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{app.social_link}</span>
              <ExternalLink className="w-3 h-3 flex-shrink-0" />
            </a>
          )}
        </div>

        {/* ── Approve / Reject — only shown on pending ─────────────────── */}
        {app.status === "pending" && (
          <>
            <div className="h-px bg-border/20 mx-4" />
            <div className="flex gap-2 px-4 py-3">
              <button
                onClick={() => handleDecision("rejected")}
                disabled={acting !== null}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-crimson/40 text-crimson text-sm font-semibold hover:bg-crimson/10 transition-colors disabled:opacity-50"
              >
                {acting === "rejected" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <XCircle className="w-4 h-4" />
                )}
                Reject
              </button>
              <button
                onClick={() => handleDecision("approved")}
                disabled={acting !== null}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-electric text-carbon text-sm font-semibold hover:bg-electric/90 transition-colors disabled:opacity-50"
              >
                {acting === "approved" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                Approve
              </button>
            </div>
          </>
        )}
      </motion.div>

      {/* ── Photo lightbox ────────────────────────────────────────────── */}
      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightbox(null)}
            className="fixed inset-0 z-[60] bg-carbon/90 backdrop-blur-xl flex items-center justify-center p-4"
          >
            <motion.img
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              src={lightbox}
              alt="Preview"
              className="max-w-full max-h-full rounded-2xl object-contain shadow-2xl"
              onClick={e => e.stopPropagation()}
            />
            <button
              onClick={() => setLightbox(null)}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-obsidian border border-border/50 flex items-center justify-center"
            >
              <XCircle className="w-5 h-5 text-foreground" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AdminCreators() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [applications, setApplications] = useState<Application[]>([]);
  const [filter, setFilter] = useState<FilterStatus>("pending");

  // ── Admin check (same pattern as AdminFeedback) ─────────────────────────
  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) { setIsLoading(false); return; }
      const { data } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });
      setIsAdmin(data === true);
      if (!data) setIsLoading(false);
    };
    checkAdmin();
  }, [user]);

  // ── Fetch applications + join profile data ───────────────────────────────
  const fetchApplications = useCallback(async () => {
    if (!isAdmin) return;
    setIsLoading(true);
    try {
      const { data: apps, error } = await supabase
        .from("creator_applications")
        .select("*")
        .order("submitted_at", { ascending: false });

      if (error) throw error;
      if (!apps?.length) { setApplications([]); setIsLoading(false); return; }

      // Fetch profiles for each applicant
      const userIds = apps.map(a => a.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, name, handle, avatar_url")
        .in("user_id", userIds);

      // Bucket is private — turn stored storage paths into short-lived signed
      // URLs (1h, ample for a review session). Legacy rows that stored a full
      // http URL are passed through unchanged so nothing hard-breaks.
      const signPath = async (val: string): Promise<string> => {
        if (!val || val.startsWith("http")) return val;
        const { data } = await supabase.storage
          .from("creator-applications")
          .createSignedUrl(val, 3600);
        return data?.signedUrl ?? val;
      };

      const enriched: Application[] = await Promise.all(
        apps.map(async a => {
          const p = profiles?.find(pr => pr.user_id === a.user_id);
          const [creating, progress, finished] = await Promise.all([
            signPath(a.photo_creating_url),
            signPath(a.photo_progress_url),
            signPath(a.photo_finished_url),
          ]);
          return {
            ...a,
            photo_creating_url: creating,
            photo_progress_url: progress,
            photo_finished_url: finished,
            status: a.status as "pending" | "approved" | "rejected",
            applicant_name:   p?.name   ?? null,
            applicant_handle: p?.handle ?? null,
            applicant_avatar: p?.avatar_url ?? null,
          };
        })
      );

      setApplications(enriched);
    } catch {
      toast.error("Failed to load applications");
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => { fetchApplications(); }, [fetchApplications]);

  // ── Approve or reject ────────────────────────────────────────────────────
  const handleDecision = useCallback(async (id: string, status: "approved" | "rejected") => {
    try {
      // Return user_id from the authoritative DB write — avoids any stale
      // closure over `applications` state.
      const { data: updated, error } = await supabase
        .from("creator_applications")
        .update({ status })
        .eq("id", id)
        .select("user_id")
        .single();

      if (error) throw error;

      // On approval: notify the creator (in-app bell + email) via edge
      // function. Fire-and-forget — a notification failure must never block
      // or undo the approval itself. The function re-verifies admin + that
      // the application is genuinely approved server-side.
      if (status === "approved" && updated?.user_id) {
        supabase.functions
          .invoke("notify-creator-approved", { body: { user_id: updated.user_id } })
          .catch(() => {});
      }

      // Update local state so the card re-renders immediately
      setApplications(prev =>
        prev.map(a => a.id === id ? { ...a, status } : a)
      );

      toast.success(
        status === "approved"
          ? "Approved — creator notified; badge & Studio access granted."
          : "Rejected — applicant can resubmit."
      );
    } catch {
      toast.error("Action failed — please try again.");
    }
  }, []);

  // ── Filtered list ────────────────────────────────────────────────────────
  const visible = filter === "all"
    ? applications
    : applications.filter(a => a.status === filter);

  const counts = {
    pending:  applications.filter(a => a.status === "pending").length,
    approved: applications.filter(a => a.status === "approved").length,
    rejected: applications.filter(a => a.status === "rejected").length,
  };

  // ── Not admin ────────────────────────────────────────────────────────────
  if (!isLoading && !isAdmin) {
    return (
      <div className="min-h-screen bg-carbon flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-2xl mb-2">🔒</p>
          <p className="text-foreground font-semibold mb-1">Admin access only</p>
          <p className="text-muted-foreground text-sm">You don't have permission to view this page.</p>
          <button
            onClick={() => navigate("/")}
            className="mt-6 px-5 py-2.5 rounded-xl bg-obsidian border border-border/40 text-sm text-foreground"
          >
            Go home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-carbon">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-carbon/90 backdrop-blur-md border-b border-border/20 px-4 py-4 flex items-center gap-3">
        <button
          onClick={() => navigate("/admin")}
          className="w-9 h-9 rounded-full bg-obsidian border border-border/40 flex items-center justify-center flex-shrink-0"
        >
          <ArrowLeft className="w-4 h-4 text-foreground" />
        </button>
        <div className="flex-1">
          <h1 className="font-display text-lg text-foreground leading-tight">Creator Applications</h1>
          <p className="text-xs text-muted-foreground">{counts.pending} pending review</p>
        </div>
      </div>

      <div className="px-4 py-4">
        {/* Filter tabs */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
          {(["pending", "all", "approved", "rejected"] as FilterStatus[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors ${
                filter === f
                  ? "bg-electric text-carbon"
                  : "bg-obsidian border border-border/30 text-muted-foreground"
              }`}
            >
              {f === "pending" && <Clock className="w-3 h-3" />}
              {f === "approved" && <CheckCircle2 className="w-3 h-3" />}
              {f === "rejected" && <XCircle className="w-3 h-3" />}
              <span className="capitalize">{f}</span>
              {f !== "all" && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  filter === f ? "bg-carbon/30 text-carbon" : "bg-border/30 text-muted-foreground"
                }`}>
                  {counts[f as keyof typeof counts]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-electric animate-spin" />
          </div>
        )}

        {/* Empty state */}
        {!isLoading && visible.length === 0 && (
          <div className="text-center py-20">
            <p className="text-4xl mb-3">
              {filter === "pending" ? "🎉" : "📭"}
            </p>
            <p className="text-foreground font-semibold">
              {filter === "pending" ? "All caught up" : "Nothing here yet"}
            </p>
            <p className="text-muted-foreground text-sm mt-1">
              {filter === "pending"
                ? "No pending applications right now."
                : `No ${filter} applications.`}
            </p>
          </div>
        )}

        {/* Application cards */}
        <AnimatePresence mode="popLayout">
          <div className="space-y-4">
            {visible.map(app => (
              <ApplicationCard
                key={app.id}
                app={app}
                onDecision={handleDecision}
              />
            ))}
          </div>
        </AnimatePresence>
      </div>
    </div>
  );
}
