import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { LiveMarqueeCard } from "./LiveMarqueeCard";
import { UpcomingEventCard } from "./UpcomingEventCard";
import { LiveStudioView, StudioRoom } from "./studio";
import { PaymentDrawer } from "./PaymentDrawer";
import { DesktopHeader } from "./DesktopHeader";
import { LeftSidebar } from "./LeftSidebar";
import { BottomNavigation } from "./BottomNavigation";
import { useUserMode } from "@/contexts/UserModeContext";
import { ChevronRight, Clock, Calendar } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useLiveEvents, LiveEvent } from "@/hooks/useLiveEvents";
import { getCategoryId } from "@/lib/categories";
interface HomeScreenProps {
  onGoLive: () => void;
  onViewCreatorProfile?: () => void;
  onViewAudienceProfile?: () => void;
  onEnterLiveRoom?: () => void;
  onOpenSearch?: () => void;
  onOpenStudio?: () => void;
  onLogout?: () => void;
}

// Content item with category (Live streams only)
interface ContentItem {
  id: string;
  coverImage: string;
  title: string;
  description?: string;
  price: number;
  viewers: number;
  artistName: string;
  artistAvatar?: string;
  materials?: string[];
  category: "Pencil Art" | "Watercolor" | "Oil Painting" | "Acrylic" | "Handmade Art" | "Pottery" | "Jewelry";
  isLive: boolean;
  endedAt?: string | null;
}

// Upcoming event from database with creator info
interface UpcomingEvent {
  id: string;
  title: string;
  cover_url: string | null;
  scheduled_at: string;
  is_free: boolean;
  price: number | null;
  category: string | null;
  creator_id: string;
  creator?: {
    name: string;
    avatar_url: string | null;
  };
}
export function HomeScreen({
  onGoLive,
  onViewCreatorProfile,
  onViewAudienceProfile,
  onEnterLiveRoom,
  onOpenSearch,
  onOpenStudio,
  onLogout
}: HomeScreenProps) {
  const navigate = useNavigate();
  const {
    mode
  } = useUserMode();
  const [activeTab, setActiveTab] = useState(mode === "audience" ? "home" : "studio");
  const [portalEvent, setPortalEvent] = useState<ContentItem | null>(null);
  const [showPaymentDrawer, setShowPaymentDrawer] = useState(false);
  const [showLiveRoom, setShowLiveRoom] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);

  // Fetch real live events from database
  const {
    liveEvents,
    loading: loadingLiveEvents
  } = useLiveEvents();

  // Convert live events from DB to ContentItem format - using real-time viewer counts
  const liveStreams: ContentItem[] = useMemo(() => {
    console.log("[HomeScreen] Converting live events to content items:", liveEvents.length);
    return liveEvents.map(event => ({
      id: event.id,
      coverImage: event.cover_url || "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=400&h=600&fit=crop",
      title: event.title,
      description: event.description || undefined,
      price: event.is_free ? 0 : event.price || 0,
      viewers: event.viewer_count,
      // Real-time viewer count from database
      artistName: event.creator?.name || "Unknown Artist",
      artistAvatar: event.creator?.avatar_url || undefined,
      materials: [],
      category: event.category as ContentItem["category"] || "Handmade Art",
      isLive: !event.live_ended_at,
      endedAt: event.live_ended_at
    }));
  }, [liveEvents]);

  // Filter live streams by selected category
  const filteredLiveStreams = useMemo(() => {
    if (selectedCategory === "All") return liveStreams;
    const categoryId = getCategoryId(selectedCategory);
    return liveStreams.filter(stream => stream.category === categoryId || stream.category === selectedCategory);
  }, [liveStreams, selectedCategory]);

  // Fetch upcoming events from database with creator info
  useEffect(() => {
    const fetchUpcomingEvents = async () => {
      try {
        const {
          data,
          error
        } = await supabase.from('events').select('id, title, cover_url, scheduled_at, is_free, price, category, creator_id').gt('scheduled_at', new Date().toISOString()).eq('is_live', false).order('scheduled_at', {
          ascending: true
        });
        if (error) throw error;

        // Fetch creator profiles for each event
        if (data && data.length > 0) {
          const creatorIds = [...new Set(data.map(e => e.creator_id))];
          const {
            data: profiles
          } = await supabase.rpc('get_all_public_profiles');
          const profileMap = new Map((profiles || []).map((p: {
            user_id: string;
            name: string;
            avatar_url: string | null;
          }) => [p.user_id, p]));
          const eventsWithCreators = data.map(event => ({
            ...event,
            creator: profileMap.get(event.creator_id) ? {
              name: (profileMap.get(event.creator_id) as {
                name: string;
              }).name,
              avatar_url: (profileMap.get(event.creator_id) as {
                avatar_url: string | null;
              }).avatar_url
            } : undefined
          }));
          setUpcomingEvents(eventsWithCreators);
        } else {
          setUpcomingEvents([]);
        }
      } catch (err) {
        console.error('Error fetching upcoming events:', err);
      } finally {
        setLoadingEvents(false);
      }
    };
    fetchUpcomingEvents();
  }, []);

  // Live Now: show filtered streams based on selected category
  const liveNowStreams = filteredLiveStreams;
  const hasLiveContent = liveNowStreams.length > 0;
  const hasAnyLiveContent = liveStreams.length > 0; // For showing empty state vs nothing
  const hasUpcomingEvents = upcomingEvents.length > 0;
  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category);
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };
  const handleLiveCardTap = (event: ContentItem) => {
    // Don't allow joining ended streams
    if (event.endedAt) {
      toast({
        title: "Session Ended",
        description: "This studio session has ended."
      });
      return;
    }

    // Navigate directly to the live room page
    console.log("[HomeScreen] Navigating to live room:", event.id);
    if (event.price > 0) {
      setPortalEvent(event);
      setShowPaymentDrawer(true);
    } else {
      navigate(`/live/${event.id}`);
    }
  };
  const handlePaymentSuccess = () => {
    setShowPaymentDrawer(false);
    if (portalEvent) {
      navigate(`/live/${portalEvent.id}`);
    }
  };
  const handleCloseLiveRoom = () => {
    setShowLiveRoom(false);
    setTimeout(() => setPortalEvent(null), 400);
  };
  const handleRemind = (eventId: string) => {
    toast({
      title: "Reminder Set!",
      description: "We'll notify you when this event starts."
    });
  };
  const handleJoinWaitlist = () => {
    toast({
      title: "You're on the list!",
      description: "We'll notify you when Season 2 launches."
    });
  };
  const handleUpcomingEventClick = (eventId: string) => {
    navigate(`/event/${eventId}`);
  };
  return <div className="min-h-screen bg-carbon flex">
      {/* Left Sidebar - Desktop only */}
      <LeftSidebar onSelectCategory={handleCategorySelect} activeCategory={selectedCategory} />

      {/* Main Content Wrapper */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Desktop Header - hidden on mobile */}
        <div className="hidden lg:block">
          <DesktopHeader onOpenSearch={onOpenSearch} onViewProfile={onViewAudienceProfile} onGoLive={onGoLive} onOpenStudio={onOpenStudio} onLogout={onLogout} hideLogo />
        </div>

        {/* Main Layout Container */}
        <div className="flex-1">
          <div className="flex">
            {/* Main Content Area */}
            <main className="flex-1 min-w-0 pb-24 lg:pb-8">
              <AnimatePresence mode="wait">
                <motion.div key={selectedCategory} initial={{
                opacity: 0,
                y: 10
              }} animate={{
                opacity: 1,
                y: 0
              }} exit={{
                opacity: 0,
                y: -10
              }} transition={{
                duration: 0.2
              }}>
                  {/* Section A: Live Now - Only show if there are live streams */}
                  {hasLiveContent && <section className="py-6">
                      <div className="flex items-center justify-between px-4 lg:px-6 mb-4">
                        <div>
                          <h2 className="font-display text-xl lg:text-2xl text-foreground">Live Now</h2>
                          <p className="text-sm text-muted-foreground">Step into a studio</p>
                        </div>
                        <button className="hidden lg:flex items-center gap-1 text-sm text-muted-foreground hover:text-electric transition-colors">
                          See all <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Mobile & Tablet: Horizontal scroll carousel */}
                      <div className="px-4 lg:hidden">
                        <div className="flex items-stretch gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide min-h-[300px]">
                          {liveNowStreams.map((event, index) => <motion.div key={event.id} initial={{
                        opacity: 0,
                        scale: 0.9
                      }} animate={{
                        opacity: 1,
                        scale: 1
                      }} transition={{
                        delay: index * 0.05
                      }} className="snap-start flex-shrink-0" style={{
                        width: 'min(65vw, 280px)'
                      }}>
                              <LiveMarqueeCard id={event.id} coverImage={event.coverImage} title={event.title} description={event.description} price={event.price} viewers={event.viewers} artistName={event.artistName} artistAvatar={event.artistAvatar} category={event.category} endedAt={event.endedAt} onClick={() => handleLiveCardTap(event)} layoutId={`room-card-${event.id}`} />
                            </motion.div>)}
                        </div>
                      </div>

                      {/* Desktop: 5-column grid with larger cards like Whatnot */}
                      <div className="hidden lg:block px-6">
                        <div className="grid grid-cols-5 gap-4">
                          {liveNowStreams.map((event, index) => <motion.div key={event.id} initial={{
                        opacity: 0,
                        scale: 0.9
                      }} animate={{
                        opacity: 1,
                        scale: 1
                      }} transition={{
                        delay: index * 0.03
                      }}>
                              <LiveMarqueeCard id={event.id} coverImage={event.coverImage} title={event.title} description={event.description} price={event.price} viewers={event.viewers} artistName={event.artistName} artistAvatar={event.artistAvatar} category={event.category} endedAt={event.endedAt} onClick={() => handleLiveCardTap(event)} layoutId={`room-card-${event.id}`} desktopSize />
                            </motion.div>)}
                        </div>
                      </div>
                    </section>}

                  {/* Empty Live State - Show when no streams for selected category */}
                  {!hasLiveContent && <section className="py-8 px-4 lg:px-6">
                      <motion.div initial={{
                    opacity: 0,
                    y: 10
                  }} animate={{
                    opacity: 1,
                    y: 0
                  }} className="text-center py-12 px-6 rounded-2xl bg-obsidian/50 border border-border/20">
                        <div className="w-16 h-16 rounded-full bg-muted/10 flex items-center justify-center mx-auto mb-4">
                          <Clock className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <h3 className="font-display text-lg text-foreground mb-2">
                          {selectedCategory === "All" ? "The Studios are Quiet" : `No ${selectedCategory} studios open`}
                        </h3>
                        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                          {selectedCategory === "All" ? "Waiting to be opened." : "Try selecting a different category or check back later."}
                        </p>
                      </motion.div>
                    </section>}

                  {/* Section B: Box Office (Upcoming Events) */}
                  {hasUpcomingEvents && <section className="py-6">
                      <div className="flex items-center justify-between px-4 lg:px-6 mb-4">
                        <div>
                          <h2 className="font-display text-xl lg:text-2xl text-foreground">Studio Schedule</h2>
                          <p className="text-sm text-muted-foreground">Upcoming sessions</p>
                        </div>
                        <button className="hidden lg:flex items-center gap-1 text-sm text-muted-foreground hover:text-electric transition-colors">
                          See all <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Mobile & Tablet: Horizontal scroll carousel */}
                      <div className="px-4 lg:hidden">
                        <div className="flex items-stretch gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide min-h-[300px]">
                          {upcomingEvents.map((event, index) => <motion.div key={event.id} initial={{
                        opacity: 0,
                        scale: 0.9
                      }} animate={{
                        opacity: 1,
                        scale: 1
                      }} transition={{
                        delay: index * 0.05
                      }} className="snap-start flex-shrink-0" style={{
                        width: 'min(65vw, 280px)'
                      }}>
                              <UpcomingEventCard id={event.id} coverImage={event.cover_url || "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=400&h=600&fit=crop"} title={event.title} scheduledAt={event.scheduled_at} price={event.price || 0} isFree={event.is_free} category={event.category || undefined} artistName={event.creator?.name} artistAvatar={event.creator?.avatar_url || undefined} onClick={() => handleUpcomingEventClick(event.id)} onRemind={() => handleRemind(event.id)} />
                            </motion.div>)}
                        </div>
                      </div>

                      {/* Desktop: 5-column grid matching Live Now */}
                      <div className="hidden lg:block px-6">
                        <div className="grid grid-cols-5 gap-4">
                          {upcomingEvents.map((event, index) => <motion.div key={event.id} initial={{
                        opacity: 0,
                        scale: 0.9
                      }} animate={{
                        opacity: 1,
                        scale: 1
                      }} transition={{
                        delay: index * 0.03
                      }}>
                              <UpcomingEventCard id={event.id} coverImage={event.cover_url || "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=400&h=600&fit=crop"} title={event.title} scheduledAt={event.scheduled_at} price={event.price || 0} isFree={event.is_free} category={event.category || undefined} artistName={event.creator?.name} artistAvatar={event.creator?.avatar_url || undefined} onClick={() => handleUpcomingEventClick(event.id)} onRemind={() => handleRemind(event.id)} desktopSize />
                            </motion.div>)}
                        </div>
                      </div>
                    </section>}

                  {/* Empty Studio Schedule State */}
                  {!hasUpcomingEvents && !loadingEvents && <section className="py-6 px-4 lg:px-6">
                      <div className="mb-4">
                        <h2 className="font-display text-xl lg:text-2xl text-foreground">Studio Schedule</h2>
                        <p className="text-sm text-muted-foreground">Upcoming sessions</p>
                      </div>
                      <div className="text-center py-8 px-6 rounded-2xl bg-obsidian/30 border border-border/10">
                        <Calendar className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground">The studio is quiet.</p>
                      </div>
                    </section>}

                  {/* Hero Card: Coming Season 2 - Always visible */}
                  <section className="px-4 lg:px-6 py-8">
                    <motion.div initial={{
                    opacity: 0,
                    y: 20
                  }} animate={{
                    opacity: 1,
                    y: 0
                  }} className="relative w-full rounded-2xl overflow-hidden bg-gradient-to-br from-obsidian via-carbon to-obsidian border border-border/30">
                      {/* Background glow effect */}
                      <div className="absolute inset-0 bg-gradient-to-r from-accent/10 via-transparent to-electric/10" />
                      
                      {/* Gavel image overlay */}
                      <div className="absolute right-0 top-0 bottom-0 w-1/2 opacity-30 lg:opacity-40">
                        <img src="https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=600&h=400&fit=crop" alt="" className="w-full h-full object-cover object-center" />
                        <div className="absolute inset-0 bg-gradient-to-r from-carbon via-carbon/80 to-transparent" />
                      </div>
                      
                      {/* Content */}
                      <div className="relative z-10 p-6 sm:p-8 lg:p-10">
                        <div className="max-w-md">
                        <h3 className="font-display text-2xl sm:text-3xl lg:text-4xl text-accent mb-3">
                            Coming Soon
                          </h3>
                          <p className="text-sm sm:text-base text-muted-foreground mb-6 leading-relaxed">
                            Live Auctions. Be the first to know.
                          </p>
                          <button onClick={handleJoinWaitlist} className="btn-electric px-6 py-3 text-sm sm:text-base font-medium">
                            Join Waitlist
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  </section>
                </motion.div>
              </AnimatePresence>
            </main>

          </div>
        </div>

        {/* Bottom Navigation - Mobile only */}
        <BottomNavigation mode={mode} activeTab={activeTab} onTabChange={tab => {
        setActiveTab(tab);
        if (tab === "passport") {
          onViewAudienceProfile?.();
        }
      }} onOpenSearch={onOpenSearch} onViewProfile={onViewAudienceProfile} onOpenStudio={onOpenStudio} onGoLive={onGoLive} onLogout={onLogout} />
      </div>

      {portalEvent && <PaymentDrawer isOpen={showPaymentDrawer} onClose={() => {
      setShowPaymentDrawer(false);
      setPortalEvent(null);
    }} onPaymentSuccess={handlePaymentSuccess} price={portalEvent.price} eventTitle={portalEvent.title} artistName={portalEvent.artistName} coverImage={portalEvent.coverImage} />}

      <AnimatePresence>
        {showLiveRoom && portalEvent && <LiveStudioView room={{
        id: portalEvent.id,
        title: portalEvent.title,
        isLive: portalEvent.isLive,
        artistName: portalEvent.artistName,
        artistAvatar: portalEvent.artistAvatar,
        coverImage: portalEvent.coverImage,
        materials: portalEvent.materials || [],
        price: portalEvent.price,
        viewers: portalEvent.viewers
      }} onClose={handleCloseLiveRoom} />}
      </AnimatePresence>
    </div>;
}