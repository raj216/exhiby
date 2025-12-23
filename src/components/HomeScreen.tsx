import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LiveMarqueeCard } from "./LiveMarqueeCard";
import { LiveStudioView, StudioRoom } from "./studio";
import { PaymentDrawer } from "./PaymentDrawer";
import { DesktopSidebar } from "./DesktopSidebar";
import { DesktopHeader } from "./DesktopHeader";
import { LeftSidebar } from "./LeftSidebar";
import { BottomNavigation } from "./BottomNavigation";
import { useUserMode } from "@/contexts/UserModeContext";
import { ChevronRight, Clock, Calendar, Bell } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

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
  price: number;
  viewers: number;
  artistName: string;
  materials?: string[];
  category: "Pencil Art" | "Watercolor" | "Oil Painting" | "Acrylic" | "Handmade Art" | "Pottery" | "Jewelry";
  isLive: boolean;
}

// Upcoming event from database
interface UpcomingEvent {
  id: string;
  title: string;
  cover_url: string | null;
  scheduled_at: string;
  is_free: boolean;
  price: number | null;
}

// Mock data - Live streams only
const liveStreams: ContentItem[] = [
  {
    id: "live-1",
    coverImage: "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=400&h=600&fit=crop",
    title: "Drawing Realistic Eyes",
    price: 5,
    viewers: 53,
    artistName: "Sarah Chen",
    materials: ["Prismacolor Premier Pencil (Black)", "Fabriano Bristol Paper (Smooth)", "Kneaded Eraser"],
    category: "Pencil Art",
    isLive: true,
  },
  {
    id: "live-2",
    coverImage: "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=400&h=600&fit=crop",
    title: "Watercolor Landscapes",
    price: 0,
    viewers: 127,
    artistName: "Marcus Webb",
    materials: ["Winsor & Newton Cotman Set", "Arches Cold Press 140lb Paper"],
    category: "Watercolor",
    isLive: true,
  },
  {
    id: "live-3",
    coverImage: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=400&h=600&fit=crop",
    title: "Abstract Expressionism",
    price: 10,
    viewers: 34,
    artistName: "Luna Park",
    materials: ["Golden Heavy Body Acrylics", "Palette Knives (assorted)"],
    category: "Acrylic",
    isLive: true,
  },
  {
    id: "live-4",
    coverImage: "https://images.unsplash.com/photo-1547891654-e66ed7ebb968?w=400&h=600&fit=crop",
    title: "Ceramic Sculpting",
    price: 0,
    viewers: 89,
    artistName: "Maya Rodriguez",
    materials: ["Stoneware Clay (10 lbs)", "Wire Clay Cutter"],
    category: "Pottery",
    isLive: true,
  },
  {
    id: "live-5",
    coverImage: "https://images.unsplash.com/photo-1561214115-f2f134cc4912?w=400&h=600&fit=crop",
    title: "Acrylic Pour Art",
    price: 8,
    viewers: 156,
    artistName: "Jake Thompson",
    materials: ["Liquitex Pouring Medium", "Primary Color Acrylic Set"],
    category: "Acrylic",
    isLive: true,
  },
  {
    id: "live-6",
    coverImage: "https://images.unsplash.com/photo-1578926375605-eaf7559b1458?w=400&h=600&fit=crop",
    title: "Figure Drawing Live",
    price: 0,
    viewers: 234,
    artistName: "Elena Volkov",
    materials: ["Conte Crayons", "Newsprint Pad 18x24"],
    category: "Pencil Art",
    isLive: true,
  },
  {
    id: "live-7",
    coverImage: "https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=400&h=600&fit=crop",
    title: "Portrait Mastery",
    price: 12,
    viewers: 78,
    artistName: "Nina Chen",
    materials: ["Oil Paint Set (Gamblin)", "Linen Canvas Panel"],
    category: "Oil Painting",
    isLive: true,
  },
  {
    id: "live-8",
    coverImage: "https://images.unsplash.com/photo-1605721911519-3dfeb3be25e7?w=400&h=600&fit=crop",
    title: "Ink Wash Techniques",
    price: 0,
    viewers: 145,
    artistName: "Tom Harris",
    materials: ["Sumi Ink", "Rice Paper Roll"],
    category: "Watercolor",
    isLive: true,
  },
];

export function HomeScreen({ onGoLive, onViewCreatorProfile, onViewAudienceProfile, onEnterLiveRoom, onOpenSearch, onOpenStudio, onLogout }: HomeScreenProps) {
  const { mode } = useUserMode();
  const [activeTab, setActiveTab] = useState(mode === "audience" ? "home" : "studio");
  const [portalEvent, setPortalEvent] = useState<ContentItem | null>(null);
  const [showPaymentDrawer, setShowPaymentDrawer] = useState(false);
  const [showLiveRoom, setShowLiveRoom] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);

  // Fetch upcoming events from database
  useEffect(() => {
    const fetchUpcomingEvents = async () => {
      try {
        const { data, error } = await supabase
          .from('events')
          .select('id, title, cover_url, scheduled_at, is_free, price')
          .gt('scheduled_at', new Date().toISOString())
          .order('scheduled_at', { ascending: true });
        
        if (error) throw error;
        setUpcomingEvents(data || []);
      } catch (err) {
        console.error('Error fetching upcoming events:', err);
      } finally {
        setLoadingEvents(false);
      }
    };
    
    fetchUpcomingEvents();
  }, []);

  // Filter live content based on selected category
  const filteredLive = useMemo(() => {
    if (selectedCategory === "All") {
      return liveStreams;
    }
    return liveStreams.filter(item => item.category === selectedCategory);
  }, [selectedCategory]);

  const hasLiveContent = filteredLive.length > 0;
  const hasUpcomingEvents = upcomingEvents.length > 0;

  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLiveCardTap = (event: ContentItem) => {
    setPortalEvent(event);
    if (event.price > 0) {
      setShowPaymentDrawer(true);
    } else {
      setShowLiveRoom(true);
    }
  };

  const handlePaymentSuccess = () => {
    setShowPaymentDrawer(false);
    setTimeout(() => setShowLiveRoom(true), 100);
  };

  const handleCloseLiveRoom = () => {
    setShowLiveRoom(false);
    setTimeout(() => setPortalEvent(null), 400);
  };

  const handleRemind = (eventId: string) => {
    toast({ title: "Reminder Set!", description: "We'll notify you when this event starts." });
  };

  const handleJoinWaitlist = () => {
    toast({ title: "You're on the list!", description: "We'll notify you when Season 2 launches." });
  };

  // Format event date for display
  const formatEventDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return format(date, "MMM d • h:mm a");
  };

  return (
    <div className="min-h-screen bg-carbon flex">
      {/* Left Sidebar - Desktop only */}
      <LeftSidebar 
        onSelectCategory={handleCategorySelect}
        activeCategory={selectedCategory}
      />

      {/* Main Content Wrapper */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Desktop Header - hidden on mobile */}
        <div className="hidden lg:block">
          <DesktopHeader
            onOpenSearch={onOpenSearch}
            onViewProfile={onViewAudienceProfile}
            onGoLive={onGoLive}
            onOpenStudio={onOpenStudio}
            onLogout={onLogout}
            hideLogo
          />
        </div>

        {/* Main Layout Container */}
        <div className="flex-1">
          <div className="flex">
            {/* Main Content Area */}
            <main className="flex-1 min-w-0 pb-24 lg:pb-8">
              <AnimatePresence mode="wait">
                <motion.div
                  key={selectedCategory}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  {/* Section A: Live Now - Only show if there are live streams */}
                  {hasLiveContent && (
                    <section className="py-6">
                      <div className="flex items-center justify-between px-4 lg:px-6 mb-4">
                        <div>
                          <h2 className="font-display text-xl lg:text-2xl text-foreground">
                            {selectedCategory === "All" ? "Live Now" : `Live ${selectedCategory}`}
                          </h2>
                          <p className="text-sm text-muted-foreground">Step into a studio</p>
                        </div>
                        <button className="hidden lg:flex items-center gap-1 text-sm text-muted-foreground hover:text-electric transition-colors">
                          See all <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Mobile & Tablet: Horizontal scroll carousel */}
                      <div className="px-4 lg:hidden">
                        <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide">
                          {filteredLive.map((event, index) => (
                            <motion.div
                              key={event.id}
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: index * 0.05 }}
                              className="snap-start flex-shrink-0"
                              style={{ width: 'min(65vw, 280px)' }}
                            >
                              <LiveMarqueeCard
                                {...event}
                                onClick={() => handleLiveCardTap(event)}
                                layoutId={`room-card-${event.id}`}
                              />
                            </motion.div>
                          ))}
                        </div>
                      </div>

                      {/* Desktop: Responsive grid - 4 columns, max 2 rows */}
                      <div className="hidden lg:block px-6">
                        <div className="grid grid-cols-4 gap-4 xl:gap-5">
                          {filteredLive.slice(0, 8).map((event, index) => (
                            <motion.div
                              key={event.id}
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: index * 0.03 }}
                            >
                              <LiveMarqueeCard
                                {...event}
                                onClick={() => handleLiveCardTap(event)}
                                layoutId={`room-card-${event.id}`}
                              />
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    </section>
                  )}

                  {/* Empty Live State - Show when no one is live */}
                  {!hasLiveContent && (
                    <section className="py-8 px-4 lg:px-6">
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center py-12 px-6 rounded-2xl bg-obsidian/50 border border-border/20"
                      >
                        <div className="w-16 h-16 rounded-full bg-muted/10 flex items-center justify-center mx-auto mb-4">
                          <Clock className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <h3 className="font-display text-lg text-foreground mb-2">
                          The Studios are Quiet
                        </h3>
                        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                          Check back soon or schedule an event.
                        </p>
                      </motion.div>
                    </section>
                  )}

                  {/* Section B: Box Office (Upcoming Events) */}
                  {hasUpcomingEvents && (
                    <section className="py-6">
                      <div className="flex items-center justify-between px-4 lg:px-6 mb-4">
                        <div>
                          <h2 className="font-display text-xl lg:text-2xl text-foreground">Box Office</h2>
                          <p className="text-sm text-muted-foreground">Upcoming events</p>
                        </div>
                        <button className="hidden lg:flex items-center gap-1 text-sm text-muted-foreground hover:text-electric transition-colors">
                          See all <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Mobile: Vertical list */}
                      <div className="px-4 lg:hidden space-y-4">
                        {upcomingEvents.map((event, index) => (
                          <motion.div
                            key={event.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="group cursor-pointer"
                          >
                            <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-obsidian border border-border/20 hover:border-electric/30 transition-all duration-300">
                              <img
                                src={event.cover_url || "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=400&h=600&fit=crop"}
                                alt={event.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-obsidian via-obsidian/30 to-transparent" />
                              
                              {/* Price badge */}
                              <div className="absolute top-3 right-3">
                                <span className="px-2 py-1 rounded-full bg-electric text-obsidian text-xs font-bold">
                                  {event.is_free ? "Free" : `$${event.price}`}
                                </span>
                              </div>

                              {/* Date badge */}
                              <div className="absolute top-3 left-3">
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-obsidian/80 text-foreground text-xs">
                                  <Calendar className="w-3 h-3" />
                                  {formatEventDate(event.scheduled_at)}
                                </span>
                              </div>
                              
                              <div className="absolute bottom-0 left-0 right-0 p-4">
                                <h3 className="text-base font-medium text-foreground line-clamp-2 mb-2">{event.title}</h3>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemind(event.id);
                                  }}
                                  className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-electric/10 text-electric text-xs font-medium hover:bg-electric/20 transition-colors"
                                >
                                  <Bell className="w-3 h-3" />
                                  Remind Me
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>

                      {/* Desktop: Grid of event posters */}
                      <div className="hidden lg:block px-6">
                        <div className="grid grid-cols-4 xl:grid-cols-5 gap-4">
                          {upcomingEvents.map((event, index) => (
                            <motion.div
                              key={event.id}
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: index * 0.03 }}
                              className="group cursor-pointer"
                            >
                              <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-obsidian border border-border/20 hover:border-electric/30 transition-all duration-300">
                                <img
                                  src={event.cover_url || "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=400&h=600&fit=crop"}
                                  alt={event.title}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-obsidian via-obsidian/20 to-transparent" />
                                
                                {/* Price badge */}
                                <div className="absolute top-3 right-3">
                                  <span className="px-2 py-1 rounded-full bg-electric text-obsidian text-xs font-bold">
                                    {event.is_free ? "Free" : `$${event.price}`}
                                  </span>
                                </div>

                                {/* Date badge */}
                                <div className="absolute top-3 left-3">
                                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-obsidian/80 text-foreground text-xs">
                                    <Calendar className="w-3 h-3" />
                                    {formatEventDate(event.scheduled_at)}
                                  </span>
                                </div>
                                
                                <div className="absolute bottom-0 left-0 right-0 p-3">
                                  <h3 className="text-sm font-medium text-foreground line-clamp-2 mb-2">{event.title}</h3>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRemind(event.id);
                                    }}
                                    className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-electric/10 text-electric text-xs font-medium hover:bg-electric/20 transition-colors"
                                  >
                                    <Bell className="w-3 h-3" />
                                    Remind
                                  </button>
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    </section>
                  )}

                  {/* Empty Box Office State */}
                  {!hasUpcomingEvents && !loadingEvents && (
                    <section className="py-6 px-4 lg:px-6">
                      <div className="mb-4">
                        <h2 className="font-display text-xl lg:text-2xl text-foreground">Box Office</h2>
                        <p className="text-sm text-muted-foreground">Upcoming events</p>
                      </div>
                      <div className="text-center py-8 px-6 rounded-2xl bg-obsidian/30 border border-border/10">
                        <Calendar className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground">No upcoming events scheduled yet.</p>
                      </div>
                    </section>
                  )}

                  {/* Hero Card: Coming Season 2 - Always visible */}
                  <section className="px-4 lg:px-6 py-8">
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="relative w-full rounded-2xl overflow-hidden bg-gradient-to-br from-obsidian via-carbon to-obsidian border border-border/30"
                    >
                      {/* Background glow effect */}
                      <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 via-transparent to-electric/10" />
                      
                      {/* Gavel image overlay */}
                      <div className="absolute right-0 top-0 bottom-0 w-1/2 opacity-30 lg:opacity-40">
                        <img
                          src="https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=600&h=400&fit=crop"
                          alt=""
                          className="w-full h-full object-cover object-center"
                        />
                        <div className="absolute inset-0 bg-gradient-to-r from-carbon via-carbon/80 to-transparent" />
                      </div>
                      
                      {/* Content */}
                      <div className="relative z-10 p-6 sm:p-8 lg:p-10">
                        <div className="max-w-md">
                          <p className="text-xs sm:text-sm uppercase tracking-widest text-amber-400 mb-2 font-medium">
                            Coming Soon
                          </p>
                          <h3 className="font-display text-2xl sm:text-3xl lg:text-4xl text-foreground mb-3">
                            Season 2
                          </h3>
                          <p className="text-sm sm:text-base text-muted-foreground mb-6 leading-relaxed">
                            Live Auctions & Masterclass Series. Be the first to know.
                          </p>
                          <button 
                            onClick={handleJoinWaitlist}
                            className="btn-electric px-6 py-3 text-sm sm:text-base font-medium"
                          >
                            Join Waitlist
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  </section>
                </motion.div>
              </AnimatePresence>
            </main>

            {/* Desktop Right Sidebar - narrower now */}
            <div className="hidden lg:block w-64 xl:w-72 flex-shrink-0">
              <DesktopSidebar onRemind={handleRemind} />
            </div>
          </div>
        </div>

        {/* Bottom Navigation - Mobile only */}
        <BottomNavigation
          mode={mode}
          activeTab={activeTab}
          onTabChange={(tab) => {
            setActiveTab(tab);
            if (tab === "passport") {
              onViewAudienceProfile?.();
            }
          }}
          onOpenSearch={onOpenSearch}
          onViewProfile={onViewAudienceProfile}
          onOpenStudio={onOpenStudio}
          onGoLive={onGoLive}
          onLogout={onLogout}
        />
      </div>

      {portalEvent && (
        <PaymentDrawer
          isOpen={showPaymentDrawer}
          onClose={() => {
            setShowPaymentDrawer(false);
            setPortalEvent(null);
          }}
          onPaymentSuccess={handlePaymentSuccess}
          price={portalEvent.price}
          eventTitle={portalEvent.title}
          artistName={portalEvent.artistName}
          coverImage={portalEvent.coverImage}
        />
      )}

      <AnimatePresence>
        {showLiveRoom && portalEvent && (
          <LiveStudioView
            room={{
              id: portalEvent.id,
              title: portalEvent.title,
              isLive: portalEvent.isLive,
              artistName: portalEvent.artistName,
              coverImage: portalEvent.coverImage,
              materials: portalEvent.materials || [],
              price: portalEvent.price,
              viewers: portalEvent.viewers,
            }}
            onClose={handleCloseLiveRoom}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
