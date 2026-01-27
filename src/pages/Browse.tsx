import { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Radio, Calendar, Palette } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LiveMarqueeCard } from "@/components/LiveMarqueeCard";
import { UpcomingEventCard } from "@/components/UpcomingEventCard";
import { Skeleton } from "@/components/ui/skeleton";
import { useLiveEvents } from "@/hooks/useLiveEvents";
import { getUpcomingSessions, UpcomingSessionWithCreator } from "@/data/getUpcomingSessions";
import { CATEGORIES, getCategoryId, getCategoryName } from "@/lib/categories";
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/lib/haptics";
import { useIsMobile } from "@/hooks/use-mobile";

type ViewMode = "live" | "schedule";

export default function Browse() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useIsMobile();
  
  // Read category from URL, default to "all"
  const categorySlug = searchParams.get("category") || "all";
  const viewParam = searchParams.get("view") as ViewMode | null;
  
  // View mode toggle state
  const [viewMode, setViewMode] = useState<ViewMode>(viewParam || "live");
  
  // Convert slug to display name for state
  const [selectedCategory, setSelectedCategory] = useState<string>(() => {
    const cat = CATEGORIES.find(c => c.id === categorySlug);
    return cat?.name || "All";
  });

  // Sync URL → state when URL changes
  useEffect(() => {
    const cat = CATEGORIES.find(c => c.id === categorySlug);
    if (cat) {
      setSelectedCategory(cat.name);
    }
  }, [categorySlug]);

  const queryClient = useQueryClient();

  // Fetch live events
  const { liveEvents, loading: loadingLive } = useLiveEvents();

  // Fetch upcoming sessions
  const { data: upcomingSessions = [], isLoading: loadingUpcoming } = useQuery({
    queryKey: ["browse-upcoming-sessions"],
    queryFn: () => getUpcomingSessions({ limit: 50 }),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  // Realtime subscription for events table changes
  useEffect(() => {
    const channel = supabase
      .channel("browse_events_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "events" },
        (payload) => {
          if (process.env.NODE_ENV === "development") {
            console.log("[Browse] Realtime event:", payload.eventType, payload);
          }
          // Invalidate upcoming sessions query to refetch
          queryClient.invalidateQueries({ queryKey: ["browse-upcoming-sessions"] });
        }
      )
      .subscribe((status) => {
        if (process.env.NODE_ENV === "development") {
          console.log("[Browse] Realtime subscription status:", status);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Convert live events to display format
  const liveStreams = useMemo(() => {
    return liveEvents.map(event => ({
      id: event.id,
      coverImage: event.cover_url || "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=400&h=600&fit=crop",
      title: event.title,
      description: event.description || undefined,
      price: event.is_free ? 0 : event.price || 0,
      viewers: event.viewer_count,
      artistName: event.creator?.name || "Unknown Artist",
      artistAvatar: event.creator?.avatar_url || undefined,
      creatorId: event.creator_id,
      category: event.category || "Handmade Art",
      isLive: !event.live_ended_at,
      endedAt: event.live_ended_at,
    }));
  }, [liveEvents]);

  // Filter live streams by category
  const filteredLiveStreams = useMemo(() => {
    if (selectedCategory === "All") return liveStreams;
    const catId = getCategoryId(selectedCategory);
    return liveStreams.filter(stream => 
      stream.category === catId || stream.category === selectedCategory
    );
  }, [liveStreams, selectedCategory]);

  // Filter upcoming sessions by category
  const filteredUpcomingSessions = useMemo(() => {
    if (selectedCategory === "All") return upcomingSessions;
    const catId = getCategoryId(selectedCategory);
    return upcomingSessions.filter(session => 
      session.category === catId || session.category === selectedCategory
    );
  }, [upcomingSessions, selectedCategory]);

  // Handle category tab change
  const handleCategoryChange = (category: typeof CATEGORIES[number]) => {
    triggerHaptic("light");
    setSelectedCategory(category.name);
    setSearchParams({ category: category.id, view: viewMode }, { replace: true });
    
    if (process.env.NODE_ENV === "development") {
      console.log("[Browse] Category changed:", { 
        category: category.name, 
        slug: category.id,
        liveCount: filteredLiveStreams.length,
        upcomingCount: filteredUpcomingSessions.length
      });
    }
  };

  // Handle view mode toggle
  const handleViewModeChange = (mode: ViewMode) => {
    triggerHaptic("light");
    setViewMode(mode);
    setSearchParams({ category: categorySlug, view: mode }, { replace: true });
  };

  const handleLiveCardTap = (eventId: string) => {
    navigate(`/live/${eventId}`);
  };

  const handleUpcomingCardTap = (eventId: string) => {
    navigate(`/live/${eventId}`);
  };

  const isLoading = loadingLive || loadingUpcoming;
  const hasLiveContent = filteredLiveStreams.length > 0;
  const hasUpcomingContent = filteredUpcomingSessions.length > 0;

  return (
    <div className="min-h-screen bg-carbon flex flex-col" style={{ height: "100dvh" }}>
      {/* Fixed Header */}
      <header 
        className="flex-shrink-0 px-4 pb-3 border-b border-border/30 bg-carbon/95 backdrop-blur-sm z-20"
        style={{ paddingTop: "max(1rem, env(safe-area-inset-top, 1rem))" }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 rounded-full hover:bg-muted/20 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="font-display text-lg text-foreground">Browse Studios</h1>
        </div>
      </header>

      {/* Sticky Category Tabs */}
      <div className="flex-shrink-0 sticky top-0 z-10 bg-carbon/95 backdrop-blur-sm border-b border-border/20">
        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex gap-2 px-4 py-3 min-w-max">
            {CATEGORIES.map((cat) => {
              const isActive = selectedCategory === cat.name;
              return (
                <button
                  key={cat.id}
                  onClick={() => handleCategoryChange(cat)}
                  className={cn(
                    "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  {cat.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Time Toggle - Mobile/Tablet Only */}
        <div className="lg:hidden px-4 pb-3">
          <div className="flex gap-2 p-1 bg-obsidian/60 rounded-full border border-border/30">
            <button
              onClick={() => handleViewModeChange("live")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-full text-sm font-medium transition-all duration-200",
                viewMode === "live"
                  ? "bg-destructive text-destructive-foreground shadow-md"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className={cn(
                "w-2 h-2 rounded-full",
                viewMode === "live" ? "bg-white animate-pulse" : "bg-destructive/60"
              )} />
              Live Now
            </button>
            <button
              onClick={() => handleViewModeChange("schedule")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-full text-sm font-medium transition-all duration-200",
                viewMode === "schedule"
                  ? "bg-muted text-foreground shadow-md"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Calendar className="w-4 h-4" />
              Schedule
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <main 
        className="flex-1 overflow-y-auto overscroll-contain"
        style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom, 2rem))" }}
      >
        {isLoading ? (
          <BrowseSkeleton />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={`${selectedCategory}-${viewMode}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="p-4"
            >
              {/* Mobile/Tablet: Show based on toggle */}
              <div className="lg:hidden">
                {viewMode === "live" ? (
                  // Live Now Grid
                  hasLiveContent ? (
                    <div className="grid grid-cols-2 gap-3">
                      {filteredLiveStreams.map((stream, index) => (
                        <motion.div
                          key={stream.id}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: index * 0.03 }}
                        >
                          <LiveMarqueeCard
                            id={stream.id}
                            coverImage={stream.coverImage}
                            title={stream.title}
                            description={stream.description}
                            price={stream.price}
                            viewers={stream.viewers}
                            artistName={stream.artistName}
                            artistAvatar={stream.artistAvatar}
                            creatorId={stream.creatorId}
                            category={stream.category as any}
                            endedAt={stream.endedAt}
                            onClick={() => handleLiveCardTap(stream.id)}
                          />
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <QuietStudioEmptyState 
                      onViewSchedule={() => handleViewModeChange("schedule")} 
                    />
                  )
                ) : (
                  // Schedule Grid
                  hasUpcomingContent ? (
                    <div className="grid grid-cols-2 gap-3">
                      {filteredUpcomingSessions.map((session, index) => (
                        <motion.div
                          key={session.id}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: index * 0.03 }}
                        >
                          <UpcomingEventCard
                            id={session.id}
                            title={session.title}
                            coverImage={session.cover_url || "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=400&h=600&fit=crop"}
                            scheduledAt={session.scheduled_at}
                            isFree={session.is_free}
                            price={session.price || 0}
                            category={session.category || undefined}
                            description={session.description || undefined}
                            creatorId={session.creator_id}
                            artistName={session.creator?.name}
                            artistAvatar={session.creator?.avatar_url || undefined}
                            artistIsVerified={session.creator?.is_verified}
                            onClick={() => handleUpcomingCardTap(session.id)}
                            variant="compact"
                          />
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      icon={<Calendar className="w-6 h-6 text-muted-foreground/60" />}
                      title={selectedCategory === "All" ? "No upcoming sessions" : `No ${selectedCategory} sessions scheduled`}
                      description="Explore other categories or check back later"
                    />
                  )
                )}
              </div>

              {/* Desktop: Show both sections (original layout) */}
              <div className="hidden lg:block space-y-6">
                {/* Live Now Section */}
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                    <h2 className="font-display text-base text-foreground">Live Now</h2>
                    <span className="text-xs text-muted-foreground">({filteredLiveStreams.length})</span>
                  </div>

                  {hasLiveContent ? (
                    <div className="grid grid-cols-2 gap-3">
                      {filteredLiveStreams.map((stream, index) => (
                        <motion.div
                          key={stream.id}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: index * 0.03 }}
                        >
                          <LiveMarqueeCard
                            id={stream.id}
                            coverImage={stream.coverImage}
                            title={stream.title}
                            description={stream.description}
                            price={stream.price}
                            viewers={stream.viewers}
                            artistName={stream.artistName}
                            artistAvatar={stream.artistAvatar}
                            creatorId={stream.creatorId}
                            category={stream.category as any}
                            endedAt={stream.endedAt}
                            onClick={() => handleLiveCardTap(stream.id)}
                          />
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      icon={<Radio className="w-6 h-6 text-muted-foreground/60" />}
                      title={selectedCategory === "All" ? "No live studios" : `No ${selectedCategory} studios live`}
                      description="Check back soon for live sessions"
                    />
                  )}
                </section>

                {/* Upcoming Sessions Section */}
                <section className="pt-5 border-t border-border/20">
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <h2 className="font-display text-base text-foreground">Upcoming Sessions</h2>
                    <span className="text-xs text-muted-foreground">({filteredUpcomingSessions.length})</span>
                  </div>

                  {hasUpcomingContent ? (
                    <div className="flex flex-col gap-3">
                      {filteredUpcomingSessions.map((session, index) => (
                        <motion.div
                          key={session.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.03 }}
                        >
                          <UpcomingEventCard
                            id={session.id}
                            title={session.title}
                            coverImage={session.cover_url || "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=400&h=600&fit=crop"}
                            scheduledAt={session.scheduled_at}
                            isFree={session.is_free}
                            price={session.price || 0}
                            category={session.category || undefined}
                            description={session.description || undefined}
                            creatorId={session.creator_id}
                            artistName={session.creator?.name}
                            artistAvatar={session.creator?.avatar_url || undefined}
                            artistIsVerified={session.creator?.is_verified}
                            onClick={() => handleUpcomingCardTap(session.id)}
                          />
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      icon={<Calendar className="w-6 h-6 text-muted-foreground/60" />}
                      title={selectedCategory === "All" ? "No upcoming sessions" : `No ${selectedCategory} sessions scheduled`}
                      description="Explore other categories or check back later"
                    />
                  )}
                </section>
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </main>
    </div>
  );
}

// Quiet Studio Empty State for Live Now
function QuietStudioEmptyState({ onViewSchedule }: { onViewSchedule: () => void }) {
  return (
    <div 
      className="py-16 px-6 rounded-2xl text-center border border-border/20"
      style={{ background: 'linear-gradient(145deg, hsl(var(--obsidian)/0.6) 0%, hsl(var(--carbon)/0.3) 100%)' }}
    >
      <div className="w-16 h-16 rounded-full bg-muted/10 border border-border/30 flex items-center justify-center mx-auto mb-4">
        <Palette className="w-7 h-7 text-muted-foreground/50" />
      </div>
      <h3 className="font-display text-lg text-foreground mb-2">The studio is quiet</h3>
      <p className="text-sm text-muted-foreground mb-5 max-w-[200px] mx-auto">
        No artists are live in this category right now.
      </p>
      <button 
        onClick={onViewSchedule}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-muted/30 text-foreground text-sm font-medium hover:bg-muted/50 transition-colors border border-border/30"
      >
        <Calendar className="w-4 h-4" />
        Check the Schedule
      </button>
    </div>
  );
}

// Empty state component
function EmptyState({ 
  icon, 
  title, 
  description 
}: { 
  icon: React.ReactNode; 
  title: string; 
  description: string;
}) {
  return (
    <div 
      className="py-8 px-4 rounded-xl text-center border border-border/20"
      style={{ background: 'linear-gradient(145deg, hsl(var(--obsidian)/0.4) 0%, hsl(var(--carbon)/0.2) 100%)' }}
    >
      <div className="w-12 h-12 rounded-full bg-muted/10 border border-border/20 flex items-center justify-center mx-auto mb-3">
        {icon}
      </div>
      <h3 className="font-display text-sm text-foreground mb-1">{title}</h3>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

// Loading skeleton
function BrowseSkeleton() {
  return (
    <div className="py-5 px-4 space-y-6">
      {/* Live Now skeleton */}
      <div>
        <Skeleton className="h-5 w-24 mb-3" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2].map(i => (
            <Skeleton key={i} className="aspect-[3/4] rounded-xl" />
          ))}
        </div>
      </div>
      
      {/* Upcoming skeleton */}
      <div>
        <Skeleton className="h-5 w-32 mb-3" />
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
