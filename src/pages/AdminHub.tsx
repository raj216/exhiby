import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  MessageSquare,
  Users,
  Clock,
  Star,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface HubStats {
  pendingApplications: number;
  totalFeedback: number;
  avgRating: number | null;
  feedbackWithNotes: number;
}

export default function AdminHub() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<HubStats>({
    pendingApplications: 0,
    totalFeedback: 0,
    avgRating: null,
    feedbackWithNotes: 0,
  });

  useEffect(() => {
    const init = async () => {
      if (!user) { setIsLoading(false); return; }

      const { data } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });

      if (!data) { setIsLoading(false); return; }
      setIsAdmin(true);

      // Load quick stats in parallel
      const [appsRes, feedbackRes] = await Promise.all([
        supabase
          .from("creator_applications")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
        supabase.rpc("get_all_feedback_admin"),
      ]);

      if (appsRes.error) console.error("[AdminHub] applications count error:", appsRes.error);
      if (feedbackRes.error) console.error("[AdminHub] feedback load error:", feedbackRes.error);

      const feedbackRows = feedbackRes.data ?? [];
      const rated = feedbackRows.filter((f: any) => f.rating != null);
      const avgRating =
        rated.length > 0
          ? rated.reduce((acc: number, f: any) => acc + f.rating, 0) / rated.length
          : null;

      setStats({
        pendingApplications: appsRes.count ?? 0,
        totalFeedback: feedbackRows.length,
        avgRating,
        feedbackWithNotes: feedbackRows.filter((f: any) => f.private_feedback_text).length,
      });

      setIsLoading(false);
    };

    init();
  }, [user]);

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
        <p className="text-foreground">Access Denied</p>
        <Button onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );
  }

  const sections = [
    {
      title: "Creator Applications",
      description: "Review verification photos, written answers, and approve or reject applicants.",
      icon: Users,
      href: "/admin/creators",
      badge: stats.pendingApplications > 0 ? `${stats.pendingApplications} pending` : null,
      badgeVariant: "urgent" as const,
      stats: [
        { label: "Awaiting Review", value: isLoading ? null : stats.pendingApplications },
      ],
    },
    {
      title: "Session Feedback",
      description: "Every rating, tag, private note, and improvement suggestion from your users.",
      icon: MessageSquare,
      href: "/admin/feedback",
      badge: null,
      badgeVariant: "default" as const,
      stats: [
        { label: "Total Reviews", value: isLoading ? null : stats.totalFeedback },
        {
          label: "Avg Rating",
          value: isLoading ? null : stats.avgRating ? stats.avgRating.toFixed(1) : "—",
        },
        { label: "With Notes", value: isLoading ? null : stats.feedbackWithNotes },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-carbon">
      {/* Header */}
      <div className="sticky top-0 bg-carbon/95 backdrop-blur-sm border-b border-border z-10">
        <div className="max-w-3xl mx-auto px-4 py-5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-xl text-foreground leading-none">Admin</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Exhiby Command Centre</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
        {sections.map((section, i) => {
          const Icon = section.icon;
          return (
            <motion.button
              key={section.href}
              onClick={() => navigate(section.href)}
              className="w-full text-left bg-card border border-border rounded-2xl p-5 hover:border-primary/40 hover:bg-card/80 transition-all group"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              whileTap={{ scale: 0.99 }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-muted/40 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/10 transition-colors">
                    <Icon className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-semibold text-foreground">{section.title}</h2>
                      {section.badge && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/15 text-destructive font-medium">
                          {section.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 leading-snug">
                      {section.description}
                    </p>

                    {/* Quick stats row */}
                    <div className="flex items-center gap-4 mt-3 flex-wrap">
                      {section.stats.map((s) => (
                        <div key={s.label} className="flex items-center gap-1.5">
                          {s.value === null ? (
                            <Skeleton className="h-4 w-8" />
                          ) : (
                            <span className="text-sm font-semibold text-foreground">
                              {s.value}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">{s.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground/40 group-hover:text-primary/60 transition-colors mt-1 flex-shrink-0" />
              </div>
            </motion.button>
          );
        })}

        {/* Timestamp */}
        <div className="flex items-center gap-2 pt-2 px-1">
          <Clock className="w-3.5 h-3.5 text-muted-foreground/40" />
          <p className="text-xs text-muted-foreground/40">
            Stats loaded at {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
          <Star className="w-3 h-3 text-muted-foreground/20 ml-auto" />
        </div>
      </div>
    </div>
  );
}
