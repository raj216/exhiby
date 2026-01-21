import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { LiveMarqueeCard } from "./LiveMarqueeCard";
import { UpcomingEventCard } from "./UpcomingEventCard";
import { LiveStudioView, StudioRoom } from "./studio";
import { PaymentDrawer } from "./PaymentDrawer";
import { DesktopHeader } from "./DesktopHeader";
import { MobileHeader } from "./MobileHeader";
import { LeftSidebar } from "./LeftSidebar";

import { useUserMode } from "@/contexts/UserModeContext";
import { ChevronRight, Clock, Calendar } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useLiveEvents, LiveEvent } from "@/hooks/useLiveEvents";
import { getCategoryId } from "@/lib/categories";
import { useAuth } from "@/contexts/AuthContext";
import { useEventTicket } from "@/hooks/useEventTicket";
import featureFlags from "@/lib/featureFlags";
interface HomeScreenProps {
  onGoLive: () => void;
  onViewCreatorProfile?: () => void;
  onViewAudienceProfile?: () => void;
  onEnterLiveRoom?: () => void;
  onOpenSearch?: () => void;
  onOpenStudio?: () => void;
  onLogout?: () => void;
  onGoHome?: () => void;
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
  creatorId?: string;
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
  onLogout,
  onGoHome
}: HomeScreenProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
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

  // Ticket check for paid events - prevents double charging
  const { hasValidTicket, isLoading: ticketLoading, purchaseTicket } = useEventTicket(
    portalEvent?.id || null,
    user?.id
  );

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
      creatorId: event.creator_id,
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
  const handleLiveCardTap = async (event: ContentItem) => {
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
    
    // When payments are disabled, all events are free - go directly to live room
    if (!featureFlags.paymentsEnabled || event.price === 0) {
      navigate(`/live/${event.id}`);
      return;
    }
    
    // Payments enabled and event is paid
    if (event.price > 0) {
      // Set portal event first to trigger ticket check
      setPortalEvent(event);
      
      // Check if user already has a ticket for this event
      if (user?.id) {
        const { data: existingTicket } = await supabase
          .from("tickets")
          .select("id")
          .eq("event_id", event.id)
          .eq("user_id", user.id)
          .maybeSingle();
        
        if (existingTicket) {
          // User already paid - go directly to live room
          console.log("[HomeScreen] User has valid ticket, skipping payment");
          navigate(`/live/${event.id}`);
          return;
        }
      }
      
      // No valid ticket - show payment drawer
      setShowPaymentDrawer(true);
    } else {
      navigate(`/live/${event.id}`);
    }
  };
  const handlePaymentSuccess = async () => {
    setShowPaymentDrawer(false);
    if (portalEvent && user?.id) {
      // Create ticket record before navigating
      const success = await purchaseTicket();
      if (success) {
        console.log("[HomeScreen] Ticket created, navigating to live room");
        navigate(`/live/${portalEvent.id}`);
      } else {
        toast({
          title: "Payment Error",
          description: "Failed to record your ticket. Please try again.",
          variant: "destructive"
        });
      }
    } else if (portalEvent) {
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
        {/* Mobile Header - visible on mobile/tablet only */}
        <MobileHeader onOpenSearch={onOpenSearch} onGoHome={onGoHome} />

        {/* Desktop Header - hidden on mobile */}
        <div className="hidden lg:block">
          <DesktopHeader onOpenSearch={onOpenSearch} onViewProfile={onViewAudienceProfile} onGoLive={onGoLive} onOpenStudio={onOpenStudio} onLogout={onLogout} onGoHome={onGoHome} hideLogo />
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
                              <LiveMarqueeCard id={event.id} coverImage={event.coverImage} title={event.title} description={event.description} price={event.price} viewers={event.viewers} artistName={event.artistName} artistAvatar={event.artistAvatar} creatorId={event.creatorId} category={event.category} endedAt={event.endedAt} onClick={() => handleLiveCardTap(event)} layoutId={`room-card-${event.id}`} />
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
                              <LiveMarqueeCard id={event.id} coverImage={event.coverImage} title={event.title} description={event.description} price={event.price} viewers={event.viewers} artistName={event.artistName} artistAvatar={event.artistAvatar} creatorId={event.creatorId} category={event.category} endedAt={event.endedAt} onClick={() => handleLiveCardTap(event)} layoutId={`room-card-${event.id}`} desktopSize />
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
                  }} className="relative text-center py-14 px-6 rounded-2xl overflow-hidden border border-border/20" style={{
                    background: 'linear-gradient(145deg, hsl(var(--obsidian)/0.6) 0%, hsl(var(--carbon)/0.4) 100%)'
                  }}>
                        {/* Subtle radial gradient for depth */}
                        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--muted)/0.08)_0%,transparent_70%)]" />
                        
                        <div className="relative w-16 h-16 rounded-full bg-muted/10 border border-border/20 flex items-center justify-center mx-auto mb-4">
                          <Clock className="w-8 h-8 text-muted-foreground/60" />
                        </div>
                        <h3 className="relative font-display text-lg text-foreground mb-2">
                          {selectedCategory === "All" ? "The studio is quiet." : `No ${selectedCategory} studios open`}
                        </h3>
                        <p className="relative text-sm text-muted-foreground/80 max-w-sm mx-auto mb-4">
                          {selectedCategory === "All" ? "Discover open and upcoming artist studios." : "Try selecting a different category or check back later."}
                        </p>
                        
                        {/* Explore Studios CTA - only on audience home when no live sessions */}
                        {mode === "audience" && selectedCategory === "All" && <button onClick={() => navigate("/explore")} className="relative inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium text-muted-foreground border border-border/40 bg-transparent hover:border-border/60 hover:text-foreground transition-colors">
                            Explore Studios
                          </button>}
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
                              <UpcomingEventCard id={event.id} coverImage={event.cover_url || "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=400&h=600&fit=crop"} title={event.title} scheduledAt={event.scheduled_at} price={event.price || 0} isFree={event.is_free} category={event.category || undefined} artistName={event.creator?.name} artistAvatar={event.creator?.avatar_url || undefined} creatorId={event.creator_id} onClick={() => handleUpcomingEventClick(event.id)} onRemind={() => handleRemind(event.id)} />
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
                              <UpcomingEventCard id={event.id} coverImage={event.cover_url || "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=400&h=600&fit=crop"} title={event.title} scheduledAt={event.scheduled_at} price={event.price || 0} isFree={event.is_free} category={event.category || undefined} artistName={event.creator?.name} artistAvatar={event.creator?.avatar_url || undefined} creatorId={event.creator_id} onClick={() => handleUpcomingEventClick(event.id)} onRemind={() => handleRemind(event.id)} desktopSize />
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
                      <div className="relative text-center py-10 px-6 rounded-2xl bg-gradient-to-br from-obsidian/50 to-carbon/30 border border-border/20 overflow-hidden">
                        {/* Subtle ambient glow */}
                        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--muted)/0.1)_0%,transparent_70%)]" />
                        <Calendar className="relative w-10 h-10 text-muted-foreground/60 mx-auto mb-3" />
                        <p className="relative text-sm text-muted-foreground/80">The studio is quiet.</p>
                      </div>
                    </section>}

                  {/* Hero Card: Auctions Coming Soon - Always visible */}
                  <section className="px-4 lg:px-6 py-8">
                    <motion.div initial={{
                    opacity: 0,
                    y: 20
                  }} animate={{
                    opacity: 1,
                    y: 0
                  }} className="relative w-full rounded-2xl overflow-hidden border border-border/30" style={{
                    background: 'linear-gradient(145deg, hsl(var(--carbon)) 0%, hsl(var(--obsidian)) 40%, hsl(var(--carbon)) 100%)'
                  }}>
                      {/* Abstract background layers - dark gradient with texture */}
                      <div className="absolute inset-0">
                        {/* Deep radial vignette for depth */}
                        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,hsl(var(--muted)/0.08)_0%,transparent_50%)]" />
                        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_80%,hsl(var(--muted)/0.05)_0%,transparent_40%)]" />
                        
                        {/* Subtle grain texture */}
                        <div className="absolute inset-0 opacity-[0.02]" style={{
                        backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")',
                        backgroundSize: '128px 128px'
                      }} />
                        
                        {/* Soft studio-light shadow from top */}
                        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-white/[0.02] to-transparent" />
                        
                        {/* Edge vignette */}
                        <div className="absolute inset-0 shadow-[inset_0_0_80px_rgba(0,0,0,0.4)]" />
                      </div>
                      
                      {/* Content */}
                      <div className="relative z-10 p-8 sm:p-10 lg:p-14">
                        <div className="max-w-lg">
                          <h3 className="font-display text-2xl sm:text-3xl lg:text-4xl text-foreground mb-3 tracking-tight">
                            Live Art Exhibitions
                          </h3>
                          <p className="text-sm sm:text-base text-muted-foreground/90 mb-6 leading-relaxed">Monetizing the exhibition experience — not just the art.</p>
                          <motion.button onClick={handleJoinWaitlist} whileHover={{
                          scale: 1.02
                        }} whileTap={{
                          scale: 0.98
                        }} className="group relative px-6 py-3 text-sm font-medium rounded-lg bg-transparent border border-electric/50 text-electric transition-all duration-300 hover:border-electric hover:bg-electric/5">
                            {/* Subtle red glow on hover only */}
                            <span className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 shadow-[0_0_20px_hsl(var(--electric)/0.15)]" />
                            <span className="relative z-10">Request Exhibition Access</span>
                          </motion.button>
                        </div>
                      </div>
                    </motion.div>
                  </section>
                </motion.div>
              </AnimatePresence>
            </main>

          </div>
        </div>

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