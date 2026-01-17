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
  LogOut
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

export default function AdminFeedback() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterLeftEarly, setFilterLeftEarly] = useState<string>("all");

  // Check if user is admin
  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      const { data } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });

      setIsAdmin(data === true);
      if (!data) {
        setIsLoading(false);
      }
    };

    checkAdmin();
  }, [user]);

  // Fetch all feedback (admin only)
  const fetchFeedback = useCallback(async () => {
    if (!isAdmin) return;

    setIsLoading(true);
    try {
      // First get all feedback
      const { data: feedbackData, error: feedbackError } = await supabase
        .from("session_feedback")
        .select("*")
        .order("created_at", { ascending: false });

      if (feedbackError) {
        console.error("Error fetching feedback:", feedbackError);
        toast.error("Failed to load feedback");
        return;
      }

      if (!feedbackData || feedbackData.length === 0) {
        setFeedback([]);
        return;
      }

      // Get unique event IDs and creator IDs
      const eventIds = [...new Set(feedbackData.map((f) => f.event_id))];
      const creatorIds = [...new Set(feedbackData.map((f) => f.creator_id))];

      // Fetch event titles
      const { data: events } = await supabase
        .from("events")
        .select("id, title")
        .in("id", eventIds);

      // Fetch creator names
      const { data: profiles } = await supabase.rpc("get_all_public_profiles");

      // Map data together
      const enrichedFeedback = feedbackData.map((f) => {
        const event = events?.find((e) => e.id === f.event_id);
        const creator = profiles?.find((p: any) => p.user_id === f.creator_id);
        return {
          ...f,
          event_title: event?.title || "Unknown Session",
          creator_name: creator?.name || "Unknown Creator",
        };
      });

      setFeedback(enrichedFeedback);
    } catch (err) {
      console.error("Error fetching feedback:", err);
      toast.error("Failed to load feedback");
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) {
      fetchFeedback();
    }
  }, [isAdmin, fetchFeedback]);

  const handleBack = () => {
    triggerHaptic("light");
    navigate(-1);
  };

  // Filter feedback
  const filteredFeedback = feedback.filter((f) => {
    if (filterCategory !== "all" && f.improvement_category !== filterCategory) {
      return false;
    }
    if (filterLeftEarly === "yes" && !f.left_early) {
      return false;
    }
    if (filterLeftEarly === "no" && f.left_early) {
      return false;
    }
    return true;
  });

  // Get unique categories for filter
  const categories = [...new Set(feedback.map((f) => f.improvement_category).filter(Boolean))];

  if (!user) {
    return (
      <div className="min-h-screen bg-carbon flex flex-col items-center justify-center px-4">
        <AlertTriangle className="w-12 h-12 text-destructive mb-4" />
        <p className="text-foreground mb-2">Please log in to access this page</p>
        <Button onClick={() => navigate("/auth")}>Log In</Button>
      </div>
    );
  }

  if (!isLoading && !isAdmin) {
    return (
      <div className="min-h-screen bg-carbon flex flex-col items-center justify-center px-4">
        <AlertTriangle className="w-12 h-12 text-destructive mb-4" />
        <p className="text-foreground mb-2">Access Denied</p>
        <p className="text-muted-foreground text-sm mb-4">
          You don't have permission to view this page.
        </p>
        <Button onClick={handleBack}>Go Back</Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-carbon p-4">
        <div className="max-w-4xl mx-auto">
          <Skeleton className="h-10 w-48 mb-6" />
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 w-full rounded-xl" />
            ))}
          </div>
        </div>
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
              onClick={handleBack}
              className="p-2 rounded-full bg-muted/50 hover:bg-muted transition-colors"
              whileTap={{ scale: 0.95 }}
            >
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </motion.button>
            <h1 className="font-display text-xl text-foreground">Feedback Dashboard</h1>
          </div>
          <Badge variant="outline" className="text-electric border-electric">
            Admin
          </Badge>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Stats Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-card rounded-xl p-4 border border-border">
            <p className="text-2xl font-display text-foreground">{feedback.length}</p>
            <p className="text-sm text-muted-foreground">Total Feedback</p>
          </div>
          <div className="bg-card rounded-xl p-4 border border-border">
            <p className="text-2xl font-display text-foreground">
              {feedback.filter((f) => f.rating).length > 0
                ? (
                    feedback.filter((f) => f.rating).reduce((acc, f) => acc + (f.rating || 0), 0) /
                    feedback.filter((f) => f.rating).length
                  ).toFixed(1)
                : "—"}
            </p>
            <p className="text-sm text-muted-foreground">Avg Rating</p>
          </div>
          <div className="bg-card rounded-xl p-4 border border-border">
            <p className="text-2xl font-display text-foreground">
              {feedback.filter((f) => f.left_early).length}
            </p>
            <p className="text-sm text-muted-foreground">Left Early</p>
          </div>
          <div className="bg-card rounded-xl p-4 border border-border">
            <p className="text-2xl font-display text-foreground">
              {feedback.filter((f) => f.private_feedback_text).length}
            </p>
            <p className="text-sm text-muted-foreground">With Notes</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Filters:</span>
          </div>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[180px] bg-card border-border">
              <SelectValue placeholder="Improvement Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat || ""}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterLeftEarly} onValueChange={setFilterLeftEarly}>
            <SelectTrigger className="w-[140px] bg-card border-border">
              <SelectValue placeholder="Left Early" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="yes">Left Early</SelectItem>
              <SelectItem value="no">Stayed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Feedback List */}
        <div className="space-y-4">
          {filteredFeedback.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground">No feedback found</p>
            </div>
          ) : (
            filteredFeedback.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card rounded-xl border border-border p-4 space-y-3"
              >
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-foreground">{item.event_title}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                      <User className="w-3.5 h-3.5" />
                      <span>{item.creator_name}</span>
                      <span>•</span>
                      <Clock className="w-3.5 h-3.5" />
                      <span>{format(new Date(item.created_at), "MMM d, h:mm a")}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.left_early && (
                      <Badge variant="destructive" className="text-xs">
                        <LogOut className="w-3 h-3 mr-1" />
                        Left Early
                      </Badge>
                    )}
                    {item.rating && (
                      <div className="flex items-center gap-1 bg-gold/10 text-gold px-2 py-1 rounded-full">
                        <Star className="w-4 h-4 fill-gold" />
                        <span className="text-sm font-medium">{item.rating}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tags */}
                {item.public_tags && item.public_tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {item.public_tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Improvement Category */}
                {item.improvement_category && (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-electric border-electric">
                      Improve: {item.improvement_category}
                    </Badge>
                  </div>
                )}

                {/* Left Early Reason */}
                {item.left_early && item.left_early_reason && (
                  <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                    <p className="text-sm text-destructive">
                      <strong>Left early reason:</strong> {item.left_early_reason}
                    </p>
                  </div>
                )}

                {/* Private Feedback */}
                {item.private_feedback_text && (
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1 font-medium">Private Note:</p>
                    <p className="text-sm text-foreground">{item.private_feedback_text}</p>
                  </div>
                )}
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
