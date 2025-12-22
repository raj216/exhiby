import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LiveMarqueeCard } from "./LiveMarqueeCard";
import { LiveStudioView, StudioRoom } from "./studio";
import { PaymentDrawer } from "./PaymentDrawer";
import { DesktopSidebar } from "./DesktopSidebar";
import { LeftSidebar } from "./LeftSidebar";
import { BottomNavigation } from "./BottomNavigation";
import { useUserMode } from "@/contexts/UserModeContext";
import { ChevronRight, Play, Clock } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface HomeScreenProps {
  onGoLive: () => void;
  onViewCreatorProfile?: () => void;
  onViewAudienceProfile?: () => void;
  onEnterLiveRoom?: () => void;
  onOpenSearch?: () => void;
  onLogout?: () => void;
}

// Content item with category
interface ContentItem {
  id: string;
  coverImage: string;
  title: string;
  price: number;
  viewers: number;
  artistName: string;
  materials?: string[];
  category: "Pencil Art" | "Watercolor" | "Oil Painting" | "Acrylic" | "Handmade Art" | "Pottery" | "Jewelry";
  type: "live" | "masterclass" | "replay";
  isLive: boolean;
  duration?: string;
}

// Mock data with categories
const allContent: ContentItem[] = [
  // LIVE STREAMS
  {
    id: "live-1",
    coverImage: "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=400&h=600&fit=crop",
    title: "Drawing Realistic Eyes",
    price: 5,
    viewers: 53,
    artistName: "Sarah Chen",
    materials: ["Prismacolor Premier Pencil (Black)", "Fabriano Bristol Paper (Smooth)", "Kneaded Eraser"],
    category: "Pencil Art",
    type: "live",
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
    type: "live",
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
    type: "live",
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
    type: "live",
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
    type: "live",
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
    type: "live",
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
    type: "live",
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
    type: "live",
    isLive: true,
  },
  // MASTERCLASSES
  {
    id: "master-1",
    coverImage: "https://images.unsplash.com/photo-1513519245088-0e12902e35a9?w=400&h=600&fit=crop",
    title: "Pencil Portraits Masterclass",
    price: 25,
    viewers: 1240,
    artistName: "David Kim",
    category: "Pencil Art",
    type: "masterclass",
    isLive: false,
    duration: "2h 30m",
  },
  {
    id: "master-2",
    coverImage: "https://images.unsplash.com/photo-1579762715118-a6f1d4b934f1?w=400&h=600&fit=crop",
    title: "Watercolor Botanicals",
    price: 35,
    viewers: 890,
    artistName: "Emma Rose",
    category: "Watercolor",
    type: "masterclass",
    isLive: false,
    duration: "3h 15m",
  },
  {
    id: "master-3",
    coverImage: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=600&fit=crop",
    title: "Oil Painting Fundamentals",
    price: 45,
    viewers: 2100,
    artistName: "Robert Vale",
    category: "Oil Painting",
    type: "masterclass",
    isLive: false,
    duration: "4h 00m",
  },
  {
    id: "master-4",
    coverImage: "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=400&h=600&fit=crop",
    title: "Acrylic Texture Techniques",
    price: 30,
    viewers: 756,
    artistName: "Lisa Wong",
    category: "Acrylic",
    type: "masterclass",
    isLive: false,
    duration: "2h 45m",
  },
  {
    id: "master-5",
    coverImage: "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=400&h=600&fit=crop",
    title: "Handmade Paper Crafts",
    price: 20,
    viewers: 432,
    artistName: "Amy Chen",
    category: "Handmade Art",
    type: "masterclass",
    isLive: false,
    duration: "1h 50m",
  },
  {
    id: "master-6",
    coverImage: "https://images.unsplash.com/photo-1493106641515-6b5631de4bb9?w=400&h=600&fit=crop",
    title: "Pottery Wheel Basics",
    price: 40,
    viewers: 1560,
    artistName: "James Potter",
    category: "Pottery",
    type: "masterclass",
    isLive: false,
    duration: "3h 30m",
  },
  {
    id: "master-7",
    coverImage: "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=400&h=600&fit=crop",
    title: "Silver Ring Making",
    price: 55,
    viewers: 678,
    artistName: "Maria Santos",
    category: "Jewelry",
    type: "masterclass",
    isLive: false,
    duration: "2h 20m",
  },
  // REPLAYS
  {
    id: "replay-1",
    coverImage: "https://images.unsplash.com/photo-1513519245088-0e12902e35a9?w=400&h=600&fit=crop",
    title: "Yesterday's Sketch Session",
    price: 0,
    viewers: 342,
    artistName: "Sarah Chen",
    category: "Pencil Art",
    type: "replay",
    isLive: false,
    duration: "1h 45m",
  },
  {
    id: "replay-2",
    coverImage: "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=400&h=600&fit=crop",
    title: "Sunset Watercolor Session",
    price: 0,
    viewers: 567,
    artistName: "Marcus Webb",
    category: "Watercolor",
    type: "replay",
    isLive: false,
    duration: "2h 10m",
  },
  {
    id: "replay-3",
    coverImage: "https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=400&h=600&fit=crop",
    title: "Oil Portrait Demo",
    price: 0,
    viewers: 890,
    artistName: "Nina Chen",
    category: "Oil Painting",
    type: "replay",
    isLive: false,
    duration: "1h 30m",
  },
  {
    id: "replay-4",
    coverImage: "https://images.unsplash.com/photo-1547891654-e66ed7ebb968?w=400&h=600&fit=crop",
    title: "Clay Throwing Basics",
    price: 0,
    viewers: 445,
    artistName: "Maya Rodriguez",
    category: "Pottery",
    type: "replay",
    isLive: false,
    duration: "1h 55m",
  },
  {
    id: "replay-5",
    coverImage: "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=400&h=600&fit=crop",
    title: "Beaded Necklace Workshop",
    price: 0,
    viewers: 234,
    artistName: "Maria Santos",
    category: "Jewelry",
    type: "replay",
    isLive: false,
    duration: "1h 20m",
  },
];

export function HomeScreen({ onGoLive, onViewCreatorProfile, onViewAudienceProfile, onEnterLiveRoom, onOpenSearch, onLogout }: HomeScreenProps) {
  const { mode } = useUserMode();
  const [activeTab, setActiveTab] = useState(mode === "audience" ? "home" : "studio");
  const [portalEvent, setPortalEvent] = useState<ContentItem | null>(null);
  const [showPaymentDrawer, setShowPaymentDrawer] = useState(false);
  const [showLiveRoom, setShowLiveRoom] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  // Filter content based on selected category
  const filteredContent = useMemo(() => {
    if (selectedCategory === "All") {
      return {
        live: allContent.filter(item => item.type === "live"),
        masterclasses: allContent.filter(item => item.type === "masterclass"),
        replays: allContent.filter(item => item.type === "replay"),
      };
    }
    return {
      live: allContent.filter(item => item.type === "live" && item.category === selectedCategory),
      masterclasses: allContent.filter(item => item.type === "masterclass" && item.category === selectedCategory),
      replays: allContent.filter(item => item.type === "replay" && item.category === selectedCategory),
    };
  }, [selectedCategory]);

  const hasLiveContent = filteredContent.live.length > 0;
  const hasMasterclasses = filteredContent.masterclasses.length > 0;
  const hasReplays = filteredContent.replays.length > 0;
  const hasAnyContent = hasLiveContent || hasMasterclasses || hasReplays;

  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category);
    // Smooth scroll to top when changing category
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

  // Content card for masterclasses and replays
  const ContentCard = ({ item, index }: { item: ContentItem; index: number }) => (
    <motion.div
      key={item.id}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.03 }}
      onClick={() => handleLiveCardTap(item)}
      className="group cursor-pointer"
    >
      <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-obsidian border border-border/20 hover:border-electric/30 transition-all duration-300">
        <img
          src={item.coverImage}
          alt={item.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-obsidian via-obsidian/20 to-transparent" />
        
        {/* Type badge */}
        <div className="absolute top-3 left-3">
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
            item.type === "masterclass" 
              ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
              : "bg-electric/20 text-electric border border-electric/30"
          }`}>
            {item.type === "masterclass" ? <Play className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
            {item.type === "masterclass" ? "Masterclass" : "Replay"}
          </span>
        </div>

        {/* Price badge */}
        {item.price > 0 && (
          <div className="absolute top-3 right-3">
            <span className="px-2 py-1 rounded-full bg-electric text-obsidian text-xs font-bold">
              ${item.price}
            </span>
          </div>
        )}

        {/* Duration badge */}
        {item.duration && (
          <div className="absolute bottom-16 right-3">
            <span className="px-2 py-1 rounded-md bg-obsidian/80 text-foreground/80 text-xs">
              {item.duration}
            </span>
          </div>
        )}
        
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <h3 className="text-sm font-medium text-foreground line-clamp-2 mb-1">{item.title}</h3>
          <p className="text-xs text-muted-foreground">{item.artistName}</p>
        </div>
      </div>
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-carbon flex">
      {/* Left Sidebar - Desktop only */}
      <LeftSidebar 
        onSelectCategory={handleCategorySelect}
        activeCategory={selectedCategory}
      />

      {/* Main Content Wrapper */}
      <div className="flex-1 flex flex-col min-w-0">

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

                      {/* Mobile: Horizontal scroll carousel */}
                      <div className="px-4 lg:hidden">
                        <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide">
                          {filteredContent.live.map((event, index) => (
                            <motion.div
                              key={event.id}
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: index * 0.05 }}
                              className="snap-start flex-shrink-0 w-[65vw] sm:w-[45vw]"
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
                          {filteredContent.live.slice(0, 8).map((event, index) => (
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

                  {/* Empty Live State - Show when no live streams for selected category */}
                  {!hasLiveContent && selectedCategory !== "All" && (
                    <section className="py-6 px-4 lg:px-6">
                      <div className="mb-4">
                        <h2 className="font-display text-xl lg:text-2xl text-foreground">
                          Live {selectedCategory} Streams
                        </h2>
                        <p className="text-sm text-muted-foreground mt-1">
                          No one is live right now. {hasMasterclasses ? "Watch these Masterclasses instead:" : hasReplays ? "Check out these Replays:" : ""}
                        </p>
                      </div>
                    </section>
                  )}

                  {/* Section B: Masterclasses */}
                  {hasMasterclasses && (
                    <section className="py-6">
                      <div className="flex items-center justify-between px-4 lg:px-6 mb-4">
                        <div>
                          <h2 className="font-display text-xl lg:text-2xl text-foreground">
                            {selectedCategory === "All" ? "Masterclasses" : `${selectedCategory} Masterclasses`}
                          </h2>
                          <p className="text-sm text-muted-foreground">Learn from the best</p>
                        </div>
                        <button className="hidden lg:flex items-center gap-1 text-sm text-muted-foreground hover:text-electric transition-colors">
                          See all <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Mobile: Horizontal scroll */}
                      <div className="px-4 lg:hidden">
                        <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide">
                          {filteredContent.masterclasses.map((item, index) => (
                            <div key={item.id} className="snap-start flex-shrink-0 w-[45vw] sm:w-[35vw]">
                              <ContentCard item={item} index={index} />
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Desktop: Grid */}
                      <div className="hidden lg:block px-6">
                        <div className="grid grid-cols-4 xl:grid-cols-5 gap-4">
                          {filteredContent.masterclasses.slice(0, 5).map((item, index) => (
                            <ContentCard key={item.id} item={item} index={index} />
                          ))}
                        </div>
                      </div>
                    </section>
                  )}

                  {/* Section C: Replays */}
                  {hasReplays && (
                    <section className="py-6">
                      <div className="flex items-center justify-between px-4 lg:px-6 mb-4">
                        <div>
                          <h2 className="font-display text-xl lg:text-2xl text-foreground">
                            {selectedCategory === "All" ? "Replays" : `${selectedCategory} Replays`}
                          </h2>
                          <p className="text-sm text-muted-foreground">Watch anytime</p>
                        </div>
                        <button className="hidden lg:flex items-center gap-1 text-sm text-muted-foreground hover:text-electric transition-colors">
                          See all <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Mobile: Horizontal scroll */}
                      <div className="px-4 lg:hidden">
                        <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide">
                          {filteredContent.replays.map((item, index) => (
                            <div key={item.id} className="snap-start flex-shrink-0 w-[45vw] sm:w-[35vw]">
                              <ContentCard item={item} index={index} />
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Desktop: Grid */}
                      <div className="hidden lg:block px-6">
                        <div className="grid grid-cols-4 xl:grid-cols-5 gap-4">
                          {filteredContent.replays.slice(0, 5).map((item, index) => (
                            <ContentCard key={item.id} item={item} index={index} />
                          ))}
                        </div>
                      </div>
                    </section>
                  )}

                  {/* Fallback: Nothing available */}
                  {!hasAnyContent && selectedCategory !== "All" && (
                    <section className="py-12 px-4 lg:px-6">
                      <div className="text-center max-w-md mx-auto">
                        <div className="w-16 h-16 rounded-full bg-muted/20 flex items-center justify-center mx-auto mb-4">
                          <Clock className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <h3 className="font-display text-lg text-foreground mb-2">
                          Nothing available yet
                        </h3>
                        <p className="text-sm text-muted-foreground mb-6">
                          There's no {selectedCategory} content right now. Check back soon or explore other categories.
                        </p>
                        <button
                          onClick={() => setSelectedCategory("All")}
                          className="btn-electric px-6 py-2.5 text-sm font-medium"
                        >
                          Browse All Categories
                        </button>
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
          onOpenStudio={onGoLive}
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
