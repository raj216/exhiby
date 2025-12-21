import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LiveMarqueeCard } from "./LiveMarqueeCard";
import { LiveStudioView, StudioRoom } from "./studio";
import { PaymentDrawer } from "./PaymentDrawer";
import { DesktopHeader } from "./DesktopHeader";
import { DesktopSidebar } from "./DesktopSidebar";
import { LeftSidebar } from "./LeftSidebar";
import { BottomNavigation } from "./BottomNavigation";
import { useUserMode } from "@/contexts/UserModeContext";
import { ChevronRight } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface HomeScreenProps {
  onGoLive: () => void;
  onViewCreatorProfile?: () => void;
  onViewAudienceProfile?: () => void;
  onEnterLiveRoom?: () => void;
  onOpenSearch?: () => void;
}

// Live now events data - extended for studio view
interface LiveEvent {
  id: string;
  coverImage: string;
  title: string;
  price: number;
  viewers: number;
  artistName: string;
  materials?: string[];
}

// Mock data with timing-based status
const liveNowEvents: LiveEvent[] = [
  {
    id: "1",
    coverImage: "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=400&h=600&fit=crop",
    title: "Drawing Realistic Eyes",
    price: 5,
    viewers: 53,
    artistName: "Sarah Chen",
    materials: [
      "Prismacolor Premier Pencil (Black)",
      "Fabriano Bristol Paper (Smooth)",
      "Kneaded Eraser",
      "Tombow Mono Zero Eraser",
      "Blending Stump Set"
    ],
  },
  {
    id: "2",
    coverImage: "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=400&h=600&fit=crop",
    title: "Watercolor Landscapes",
    price: 0,
    viewers: 127,
    artistName: "Marcus Webb",
    materials: [
      "Winsor & Newton Cotman Set",
      "Arches Cold Press 140lb Paper",
      "Princeton Neptune Brushes",
      "Ceramic Mixing Palette"
    ],
  },
  {
    id: "3",
    coverImage: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=400&h=600&fit=crop",
    title: "Abstract Expressionism",
    price: 10,
    viewers: 34,
    artistName: "Luna Park",
    materials: [
      "Golden Heavy Body Acrylics",
      "Palette Knives (assorted)",
      "Large Canvas 36x48",
      "Spray Bottle for Texture"
    ],
  },
  {
    id: "4",
    coverImage: "https://images.unsplash.com/photo-1547891654-e66ed7ebb968?w=400&h=600&fit=crop",
    title: "Ceramic Sculpting",
    price: 0,
    viewers: 89,
    artistName: "Maya Rodriguez",
    materials: [
      "Stoneware Clay (10 lbs)",
      "Wire Clay Cutter",
      "Wooden Modeling Tools",
      "Sponge Set"
    ],
  },
  {
    id: "5",
    coverImage: "https://images.unsplash.com/photo-1561214115-f2f134cc4912?w=400&h=600&fit=crop",
    title: "Acrylic Pour Art",
    price: 8,
    viewers: 156,
    artistName: "Jake Thompson",
    materials: [
      "Liquitex Pouring Medium",
      "Primary Color Acrylic Set",
      "Silicone Oil",
      "Heat Gun / Torch"
    ],
  },
  {
    id: "6",
    coverImage: "https://images.unsplash.com/photo-1578926375605-eaf7559b1458?w=400&h=600&fit=crop",
    title: "Figure Drawing Live",
    price: 0,
    viewers: 234,
    artistName: "Elena Volkov",
    materials: [
      "Conte Crayons",
      "Newsprint Pad 18x24",
      "Charcoal Pencils",
      "Fixative Spray"
    ],
  },
  {
    id: "7",
    coverImage: "https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=400&h=600&fit=crop",
    title: "Portrait Mastery",
    price: 12,
    viewers: 78,
    artistName: "Nina Chen",
    materials: [
      "Oil Paint Set (Gamblin)",
      "Linen Canvas Panel",
      "Filbert Brushes",
      "Odorless Mineral Spirits"
    ],
  },
  {
    id: "8",
    coverImage: "https://images.unsplash.com/photo-1605721911519-3dfeb3be25e7?w=400&h=600&fit=crop",
    title: "Ink Wash Techniques",
    price: 0,
    viewers: 145,
    artistName: "Tom Harris",
    materials: [
      "Sumi Ink",
      "Rice Paper Roll",
      "Chinese Calligraphy Brushes",
      "Ink Stone"
    ],
  },
];


export function HomeScreen({ onGoLive, onViewCreatorProfile, onViewAudienceProfile, onEnterLiveRoom, onOpenSearch }: HomeScreenProps) {
  const { mode } = useUserMode();
  const [activeTab, setActiveTab] = useState(mode === "audience" ? "home" : "studio");
  const [portalEvent, setPortalEvent] = useState<LiveEvent | null>(null);
  const [showPaymentDrawer, setShowPaymentDrawer] = useState(false);
  const [showLiveRoom, setShowLiveRoom] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | undefined>();

  const handleLiveCardTap = (event: LiveEvent) => {
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

  return (
    <div className="min-h-screen bg-carbon flex">
      {/* Left Sidebar - Desktop only */}
      <LeftSidebar 
        onSelectCategory={setActiveCategory}
        activeCategory={activeCategory}
      />

      {/* Main Content Wrapper */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Desktop Header - spans remaining width */}
        <DesktopHeader
          onOpenSearch={onOpenSearch}
          onViewProfile={onViewAudienceProfile}
          onGoLive={onGoLive}
          hideLogo={true}
        />

        {/* Main Layout Container */}
        <div className="flex-1">
          <div className="flex">
            {/* Main Content Area */}
            <main className="flex-1 min-w-0 pb-24 lg:pb-8">
              {/* Section A: Live Now */}
              <section className="py-6">
                <div className="flex items-center justify-between px-4 lg:px-6 mb-4">
                  <div>
                    <h2 className="font-display text-xl lg:text-2xl text-foreground">Live Now</h2>
                    <p className="text-sm text-muted-foreground">Step into a studio</p>
                  </div>
                  <button className="hidden lg:flex items-center gap-1 text-sm text-muted-foreground hover:text-electric transition-colors">
                    See all <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Mobile: Horizontal scroll carousel */}
                <div className="px-4 lg:hidden">
                  <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide">
                    {liveNowEvents.map((event, index) => (
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
                    {liveNowEvents.slice(0, 8).map((event, index) => (
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

              {/* Hero Card: Coming Season 2 */}
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
            if (tab === "passport" || tab === "profile") {
              onViewAudienceProfile?.();
            }
          }}
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
              isLive: true,
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
