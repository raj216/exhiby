import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Calendar } from "lucide-react";
import { UpcomingEventCard } from "@/components/UpcomingEventCard";
import { Skeleton } from "@/components/ui/skeleton";
import { CATEGORIES, getCategoryId, getCategoryName } from "@/lib/categories";
import { getUpcomingSessions, UpcomingSessionWithCreator } from "@/data/getUpcomingSessions";
import { triggerHaptic } from "@/lib/haptics";
import { supabase } from "@/integrations/supabase/client";

export default function Schedule() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryParam = searchParams.get("category") || "all";
  
  const [sessions, setSessions] = useState<UpcomingSessionWithCreator[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>(() => {
    // Convert slug to name for display (e.g., "pencil-art" -> "Pencil Art")
    if (categoryParam === "all") return "All";
    return getCategoryName(categoryParam);
  });

  // Fetch sessions function (reusable for initial load + realtime updates)
  const fetchSessions = useCallback(async () => {
    try {
      const data = await getUpcomingSessions({ limit: 100 });
      setSessions(data);
      if (process.env.NODE_ENV === "development") {
        console.log("[Schedule] Sessions fetched:", data.length);
      }
    } catch (err) {
      console.error("[Schedule] Error fetching sessions:", err);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Realtime subscription for events table changes
  useEffect(() => {
    const channel = supabase
      .channel("schedule_events_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "events" },
        (payload) => {
          if (process.env.NODE_ENV === "development") {
            console.log("[Schedule] Realtime event:", payload.eventType, payload);
          }
          // Refetch sessions on any event change (INSERT, UPDATE, DELETE)
          fetchSessions();
        }
      )
      .subscribe((status) => {
        if (process.env.NODE_ENV === "development") {
          console.log("[Schedule] Realtime subscription status:", status);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchSessions]);

  // Sync URL param with selected category
  useEffect(() => {
    const categoryId = getCategoryId(selectedCategory);
    setSearchParams({ category: categoryId }, { replace: true });
  }, [selectedCategory, setSearchParams]);

  // Filter sessions by selected category
  const filteredSessions = useMemo(() => {
    if (selectedCategory === "All") {
      if (process.env.NODE_ENV === "development") {
        console.log("[Schedule] Filter:", { selectedCategory, count: sessions.length });
      }
      return sessions;
    }
    const categoryId = getCategoryId(selectedCategory);
    const filtered = sessions.filter(
      (s) => s.category === categoryId || s.category === selectedCategory
    );
    if (process.env.NODE_ENV === "development") {
      console.log("[Schedule] Filter:", { selectedCategory, categoryId, count: filtered.length });
    }
    return filtered;
  }, [sessions, selectedCategory]);

  const handleCategorySelect = (categoryName: string) => {
    triggerHaptic("light");
    setSelectedCategory(categoryName);
  };

  const handleSessionClick = (sessionId: string) => {
    navigate(`/live/${sessionId}`);
  };

  return (
    <div className="min-h-screen bg-carbon">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-carbon/95 backdrop-blur-sm border-b border-border/20">
        <div className="flex items-center gap-4 px-4 lg:px-6 py-4">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full flex items-center justify-center bg-muted/30 hover:bg-muted/50 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <div>
            <h1 className="font-display text-xl lg:text-2xl text-foreground">Studio Schedule</h1>
            <p className="text-sm text-muted-foreground">All upcoming sessions</p>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="px-4 lg:px-6 pb-4">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {CATEGORIES.map((cat) => {
              const isActive = selectedCategory === cat.name;
              const IconComponent = cat.icon;
              return (
                <motion.button
                  key={cat.id}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleCategorySelect(cat.name)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                    isActive
                      ? "bg-primary/15 text-primary border border-primary/30"
                      : "bg-muted/30 text-muted-foreground border border-border/30 hover:bg-muted/50 hover:text-foreground"
                  }`}
                >
                  <IconComponent className="w-4 h-4" />
                  {cat.name}
                </motion.button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="px-4 lg:px-6 py-6 pb-24">
        {/* Loading Skeleton */}
        {loading && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] rounded-xl overflow-hidden">
                <Skeleton className="w-full h-full" />
              </div>
            ))}
          </div>
        )}

        {/* Sessions Grid */}
        {!loading && filteredSessions.length > 0 && (
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedCategory}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"
            >
              {filteredSessions.map((session, index) => (
                <motion.div
                  key={session.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.03 }}
                >
                  <UpcomingEventCard
                    id={session.id}
                    coverImage={session.cover_url || "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=400&h=600&fit=crop"}
                    title={session.title}
                    scheduledAt={session.scheduled_at}
                    price={session.price || 0}
                    isFree={session.is_free}
                    category={session.category || undefined}
                    description={session.description || undefined}
                    artistName={session.creator?.name}
                    artistAvatar={session.creator?.avatar_url || undefined}
                    artistIsVerified={session.creator?.is_verified}
                    creatorId={session.creator_id}
                    onClick={() => handleSessionClick(session.id)}
                    desktopSize
                  />
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>
        )}

        {/* Empty State */}
        {!loading && filteredSessions.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative text-center py-16 px-6 rounded-2xl bg-gradient-to-br from-obsidian/50 to-carbon/30 border border-border/20 overflow-hidden"
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--muted)/0.1)_0%,transparent_70%)]" />
            <Calendar className="relative w-12 h-12 text-muted-foreground/60 mx-auto mb-4" />
            <h3 className="relative font-display text-lg text-foreground mb-2">
              {selectedCategory === "All" 
                ? "No upcoming sessions" 
                : `No ${selectedCategory} sessions scheduled`}
            </h3>
            <p className="relative text-sm text-muted-foreground/80 max-w-sm mx-auto">
              {selectedCategory === "All"
                ? "Check back later for new studio sessions."
                : "Try selecting a different category or check back later."}
            </p>
          </motion.div>
        )}
      </main>
    </div>
  );
}
