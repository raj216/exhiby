import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Filter,
  Star,
  Clock,
  User,
  MessageSquare,
  AlertTriangle,
  LogOut,
  Tag,
  Wrench,
  Download,
  TrendingUp,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { triggerHaptic } from "@/lib/haptics";
import { toast } from "sonner";
import { format } from "date-fns";

interface FeedbackItem {
  id: string;
  event_id: string;
  creator_id: string;
  audience_user_id: string;
  rating: number | null;
  public_tags: string[];
  private_feedback_text: string | null;
  improvement_category: string | null;
  left_early: boolean;
  left_early_reason: string | null;
  created_at: string;
  event_title?: string;
  creator_name?: string;
}

const STAR_LABELS = ["", "Poor", "Fair", "Good", "Great", "Excellent"];
const STAR_COLORS = ["", "text-red-400", "text-orange-400", "text-yellow-400", "text-lime-400", "text-green-400"];

function StarDisplay({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`w-4 h-4 ${s <= rating ? "fill-gold text-gold" : "text-muted-foreground/20"}`}
        />
      ))}
      <span className={`text-sm font-medium ml-1 ${STAR_COLORS[rating]}`}>
        {STAR_LABELS[rating]}
      </span>
    </div>
  );
}

function RatingBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-16 text-muted-foreground text-right text-xs">{label}</span>
      <div className="flex-1 bg-muted/30 rounded-full h-2 overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, delay: 0.1 }}
        />
      </div>
      <span className="w-6 text-xs text-muted-foreground text-right">{count}</span>
    </div>
  );
}

function FeedbackCard({ item }: { item: FeedbackItem }) {
  const [expanded, setExpanded] = useState(false);
  const hasExtra =
    (item.public_tags?.length > 0) ||
    item.improvement_category ||
    item.private_feedback_text ||
    (item.left_early && item.left_early_reason);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-xl border border-border overflow-hidden"
    >
      {/* Always-visible top row */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground text-sm truncate">{item.event_title}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
              <User className="w-3 h-3" />
              <span>{item.creator_name}</span>
              <span>·</span>
              <Clock className="w-3 h-3" />
              <span>{format(new Date(item.created_at), "MMM d, yyyy · h:mm a")}</span>
            </div>
          </div>
          {item.left_early && (
            <Badge variant="destructive" className="text-xs gap-1 flex-shrink-0">
              <LogOut className="w-3 h-3" />
              Left Early
            </Badge>
          )}
        </div>

        {/* Star rating — always visible */}
        <div className="mt-3">
          {item.rating ? (
            <StarDisplay rating={item.rating} />
          ) : (
            <span className="text-xs text-muted-foreground italic">No rating given</span>
          )}
        </div>

        {/* Expand toggle */}
        {hasExtra && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="mt-3 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {expanded ? "Hide details" : "Show full response"}
          </button>
        )}
      </div>

      {/* Expandable details */}
      {expanded && hasExtra && (
        <div className="border-t border-border bg-muted/10 px-4 py-4 space-y-3">

          {item.public_tags?.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Tag className="w-3.5 h-3.5" />
                <span>What stood out (public tags)</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {item.public_tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs px-2.5 py-1 rounded-full bg-electric/10 text-electric border border-electric/20"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {item.improvement_category && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Wrench className="w-3.5 h-3.5" />
                <span>What should we improve?</span>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 inline-block">
                {item.improvement_category}
              </span>
            </div>
          )}

          {item.private_feedback_text && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Private note to Exhiby</span>
              </div>
              <div className="bg-background/60 border border-border rounded-lg p-3">
                <p className="text-sm text-foreground leading-relaxed">
                  "{item.private_feedback_text}"
                </p>
              </div>
            </div>
          )}

          {item.left_early && item.left_early_reason && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-destructive/70">
                <LogOut className="w-3.5 h-3.5" />
                <span>Why they left early</span>
              </div>
              <div className="bg-destructive/5 border border-destructive/15 rounded-lg p-3">
                <p className="text-sm text-destructive">{item.left_early_reason}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

function exportToCSV(feedback: FeedbackItem[]) {
  const headers = [
    "Date", "Session", "Creator", "Rating", "Rating Label",
    "Public Tags", "Improvement Area", "Private Note",
    "Left Early", "Left Early Reason",
  ];

  const rows = feedback.map((f) => [
    format(new Date(f.created_at), "yyyy-MM-dd HH:mm"),
    f.event_title ?? "",
    f.creator_name ?? "",
    f.rating ?? "",
    f.rating ? STAR_LABELS[f.rating] : "",
    (f.public_tags ?? []).join("; "),
    f.improvement_category ?? "",
    f.private_feedback_text ?? "",
    f.left_early ? "Yes" : "No",
    f.left_early_reason ?? "",
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `exhiby-feedback-${format(new Date(), "yyyy-MM-dd")}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function AdminFeedback() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterRating, setFilterRating] = useState<string>("all");
  const [filterLeftEarly, setFilterLeftEarly] = useState<string>("all");

  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) { setIsLoading(false); return; }
      try {
        const { data } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
        setIsAdmin(data === true);
        if (!data) setIsLoading(false);
      } catch (err) {
        console.error("[AdminFeedback] checkAdmin error:", err);
        setIsLoading(false);
      }
    };
    checkAdmin();
  }, [user]);

  const fetchFeedback = useCallback(async () => {
    if (!isAdmin) return;
    setIsLoading(true);
    try {
      const { data: feedbackData, error } = await supabase.rpc("get_all_feedback_admin");
      if (error) { toast.error("Failed to load feedback"); return; }
      if (!feedbackData?.length) { setFeedback([]); return; }

      const eventIds = [...new Set(feedbackData.map((f: any) => f.event_id))];
      const [{ data: events }, { data: profiles }] = await Promise.all([
        supabase.from("events").select("id, title").in("id", eventIds),
        supabase.rpc("get_all_public_profiles"),
      ]);

      setFeedback(
        feedbackData.map((f: any) => ({
          ...f,
          event_title: events?.find((e: any) => e.id === f.event_id)?.title ?? "Unknown Session",
          creator_name: profiles?.find((p: any) => p.user_id === f.creator_id)?.name ?? "Unknown Creator",
        }))
      );
    } catch {
      toast.error("Failed to load feedback");
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => { if (isAdmin) fetchFeedback(); }, [isAdmin, fetchFeedback]);

  const filtered = feedback.filter((f) => {
    if (filterCategory !== "all" && f.improvement_category !== filterCategory) return false;
    if (filterRating !== "all" && String(f.rating) !== filterRating) return false;
    if (filterLeftEarly === "yes" && !f.left_early) return false;
    if (filterLeftEarly === "no" && f.left_early) return false;
    return true;
  });

  const categories = [...new Set(feedback.map((f) => f.improvement_category).filter(Boolean))];
  const rated = feedback.filter((f) => f.rating != null);
  const avgRating = rated.length > 0
    ? rated.reduce((acc, f) => acc + (f.rating ?? 0), 0) / rated.length
    : null;

  const ratingDist = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: rated.filter((f) => f.rating === star).length,
    color: star >= 4 ? "bg-green-500" : star === 3 ? "bg-yellow-500" : "bg-red-500",
  }));

  if (!user) {
    return (
      <div className="min-h-screen bg-carbon flex flex-col items-center justify-center px-4 gap-4">
        <AlertTriangle className="w-12 h-12 text-destructive" />
        <p className="text-foreground">Please log in to access this page</p>
        <Button onClick={() => navigate("/auth")}>Log In</Button>
      </div>
    );
  }

  if (!isLoading && !isAdmin) {
    return (
      <div className="min-h-screen bg-carbon flex flex-col items-center justify-center px-4 gap-4">
        <AlertTriangle className="w-12 h-12 text-destructive" />
        <p className="text-foreground text-sm">Access Denied</p>
        <Button onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-carbon">
      {/* Header */}
      <div className="sticky top-0 bg-carbon/95 backdrop-blur-sm border-b border-border z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.button
              onClick={() => navigate("/admin")}
              className="p-2 rounded-full bg-muted/50 hover:bg-muted transition-colors"
              whileTap={{ scale: 0.95 }}
            >
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </motion.button>
            <div>
              <h1 className="font-display text-xl text-foreground leading-none">Session Feedback</h1>
              {!isLoading && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {feedback.length} total · {rated.length} rated
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { triggerHaptic("light"); exportToCSV(filtered); }}
              disabled={filtered.length === 0}
              className="gap-1.5 text-xs"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </Button>
            <Badge variant="outline" className="text-electric border-electric">Admin</Badge>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total Feedback", value: isLoading ? null : feedback.length },
            { label: "Avg Rating", value: isLoading ? null : avgRating ? `${avgRating.toFixed(1)} ★` : "—" },
            { label: "Left Early", value: isLoading ? null : feedback.filter((f) => f.left_early).length },
            { label: "With Notes", value: isLoading ? null : feedback.filter((f) => f.private_feedback_text).length },
          ].map((s) => (
            <div key={s.label} className="bg-card rounded-xl p-4 border border-border">
              {s.value === null ? (
                <Skeleton className="h-7 w-10 mb-1" />
              ) : (
                <p className="text-2xl font-display text-foreground">{s.value}</p>
              )}
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Rating distribution */}
        {!isLoading && rated.length > 0 && (
          <div className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Rating Breakdown</h2>
            </div>
            <div className="space-y-2">
              {ratingDist.map(({ star, count, color }) => (
                <RatingBar
                  key={star}
                  label={`${star} star${star !== 1 ? "s" : ""}`}
                  count={count}
                  total={rated.length}
                  color={color}
                />
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Filter className="w-3.5 h-3.5" />
            <span>Filter:</span>
          </div>

          <Select value={filterRating} onValueChange={setFilterRating}>
            <SelectTrigger className="w-[130px] bg-card border-border text-sm h-9">
              <SelectValue placeholder="All Ratings" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Ratings</SelectItem>
              {[5, 4, 3, 2, 1].map((r) => (
                <SelectItem key={r} value={String(r)}>
                  {"★".repeat(r)} {STAR_LABELS[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[170px] bg-card border-border text-sm h-9">
              <SelectValue placeholder="All Areas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Areas</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat!} value={cat!}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterLeftEarly} onValueChange={setFilterLeftEarly}>
            <SelectTrigger className="w-[130px] bg-card border-border text-sm h-9">
              <SelectValue placeholder="All Users" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Users</SelectItem>
              <SelectItem value="yes">Left Early</SelectItem>
              <SelectItem value="no">Stayed</SelectItem>
            </SelectContent>
          </Select>

          {(filterRating !== "all" || filterCategory !== "all" || filterLeftEarly !== "all") && (
            <button
              onClick={() => { setFilterRating("all"); setFilterCategory("all"); setFilterLeftEarly("all"); }}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              Clear filters
            </button>
          )}

          {filtered.length !== feedback.length && (
            <span className="text-xs text-muted-foreground ml-auto">
              Showing {filtered.length} of {feedback.length}
            </span>
          )}
        </div>

        {/* Feedback list */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <MessageSquare className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
            <p className="text-muted-foreground text-sm">
              {feedback.length === 0 ? "No feedback yet — it will appear here after sessions" : "No feedback matches these filters"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((item) => (
              <FeedbackCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
