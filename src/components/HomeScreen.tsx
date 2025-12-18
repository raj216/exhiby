import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LiveMarqueeCard } from "./LiveMarqueeCard";
import { ScheduledCard } from "./ScheduledCard";
import { CuratedRow, CuratedItem } from "./CuratedRow";
import { LiveTicketPreview } from "./LiveTicketPreview";
import { ScheduledEventPage } from "./ScheduledEventPage";
import { CreatorStatus } from "./StudioCard";
import { createMockTiming } from "@/hooks/useEventStatus";
import { LiveRoomPortal } from "./LiveRoomPortal";
import { PaymentDrawer } from "./PaymentDrawer";
import { DesktopHeader } from "./DesktopHeader";
import { DesktopSidebar } from "./DesktopSidebar";
import { LeftSidebar } from "./LeftSidebar";
import { CarouselWithArrows } from "./CarouselWithArrows";
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

// Live now events data
interface LiveEvent {
  id: string;
  coverImage: string;
  title: string;
  price: number;
  viewers: number;
  artistName: string;
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
  },
  {
    id: "2",
    coverImage: "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=400&h=600&fit=crop",
    title: "Watercolor Landscapes",
    price: 0,
    viewers: 127,
    artistName: "Marcus Webb",
  },
  {
    id: "3",
    coverImage: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=400&h=600&fit=crop",
    title: "Abstract Expressionism",
    price: 10,
    viewers: 34,
    artistName: "Luna Park",
  },
  {
    id: "4",
    coverImage: "https://images.unsplash.com/photo-1547891654-e66ed7ebb968?w=400&h=600&fit=crop",
    title: "Ceramic Sculpting",
    price: 0,
    viewers: 89,
    artistName: "Maya Rodriguez",
  },
  {
    id: "5",
    coverImage: "https://images.unsplash.com/photo-1561214115-f2f134cc4912?w=400&h=600&fit=crop",
    title: "Acrylic Pour Art",
    price: 8,
    viewers: 156,
    artistName: "Jake Thompson",
  },
  {
    id: "6",
    coverImage: "https://images.unsplash.com/photo-1578926375605-eaf7559b1458?w=400&h=600&fit=crop",
    title: "Figure Drawing Live",
    price: 0,
    viewers: 234,
    artistName: "Elena Volkov",
  },
  {
    id: "7",
    coverImage: "https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=400&h=600&fit=crop",
    title: "Portrait Mastery",
    price: 12,
    viewers: 78,
    artistName: "Nina Chen",
  },
  {
    id: "8",
    coverImage: "https://images.unsplash.com/photo-1605721911519-3dfeb3be25e7?w=400&h=600&fit=crop",
    title: "Ink Wash Techniques",
    price: 0,
    viewers: 145,
    artistName: "Tom Harris",
  },
];

// Scheduled events with dynamic timing
const scheduledEvents = [
  {
    id: "1",
    coverImage: "https://images.unsplash.com/photo-1578926375605-eaf7559b1458?w=300&h=300&fit=crop",
    title: "Portrait Sketching",
    price: 5,
    artistName: "Alex Rivera",
    timing: createMockTiming(15),
  },
  {
    id: "2",
    coverImage: "https://images.unsplash.com/photo-1531913764164-f85c52e6e654?w=300&h=300&fit=crop",
    title: "Oil Painting Basics",
    price: 10,
    artistName: "Emma Liu",
    timing: createMockTiming(60),
  },
  {
    id: "3",
    coverImage: "https://images.unsplash.com/photo-1549887534-1541e9326642?w=300&h=300&fit=crop",
    title: "Digital Art Stream",
    price: 0,
    artistName: "Jay Kim",
    timing: createMockTiming(120),
  },
  {
    id: "4",
    coverImage: "https://images.unsplash.com/photo-1547826039-bfc35e0f1ea8?w=300&h=300&fit=crop",
    title: "Charcoal Techniques",
    price: 8,
    artistName: "David Okonkwo",
    timing: createMockTiming(240),
  },
  {
    id: "5",
    coverImage: "https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=300&h=300&fit=crop",
    title: "Ink Wash Painting",
    price: 12,
    artistName: "Sophie Martin",
    timing: createMockTiming(1440),
  },
];

// Curated rows with timing-based status
const masterclasses: CuratedItem[] = [
  { id: "1", image: "https://images.unsplash.com/photo-1547826039-bfc35e0f1ea8?w=200&h=200&fit=crop", artistName: "Mia Torres", timing: createMockTiming(-30, 90), eventTitle: "Color Theory Masterclass", price: 5 },
  { id: "2", image: "https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=200&h=200&fit=crop", artistName: "David Okonkwo", timing: createMockTiming(240), eventTitle: "Charcoal Techniques", price: 10 },
  { id: "3", image: "https://images.unsplash.com/photo-1561214115-f2f134cc4912?w=200&h=200&fit=crop", artistName: "Sophie Martin", timing: createMockTiming(-180, 60) },
  { id: "4", image: "https://images.unsplash.com/photo-1578301978693-85fa9c0320b9?w=200&h=200&fit=crop", artistName: "Kai Tanaka", timing: createMockTiming(1440), eventTitle: "Ink Wash Painting", price: 15 },
  { id: "5", image: "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=200&h=200&fit=crop", artistName: "Luna Kim", timing: createMockTiming(-60, 90), eventTitle: "Portrait Mastery", price: 8 },
  { id: "6", image: "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=200&h=200&fit=crop", artistName: "Ben Wright", timing: createMockTiming(480), eventTitle: "Advanced Shading", price: 12 },
];

const freshEasel: CuratedItem[] = [
  { id: "1", image: "https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=200&h=200&fit=crop", artistName: "Ana Perez", timing: createMockTiming(-10, 60), eventTitle: "Unveiling: Ocean Series", price: 0 },
  { id: "2", image: "https://images.unsplash.com/photo-1605721911519-3dfeb3be25e7?w=200&h=200&fit=crop", artistName: "Tom Harris", timing: createMockTiming(-120, 60) },
  { id: "3", image: "https://images.unsplash.com/photo-1544967082-d9d25d867d66?w=200&h=200&fit=crop", artistName: "Nina Volkov", timing: createMockTiming(-90, 60) },
  { id: "4", image: "https://images.unsplash.com/photo-1571115764595-644a1f56a55c?w=200&h=200&fit=crop", artistName: "Leo Chen", timing: createMockTiming(2880), eventTitle: "New Collection Drop", price: 5 },
  { id: "5", image: "https://images.unsplash.com/photo-1578301978693-85fa9c0320b9?w=200&h=200&fit=crop", artistName: "Rosa Martinez", timing: createMockTiming(-45, 90), eventTitle: "Abstract Forms", price: 0 },
  { id: "6", image: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=200&h=200&fit=crop", artistName: "James Park", timing: createMockTiming(720), eventTitle: "Color Studies", price: 6 },
];

const handcraft: CuratedItem[] = [
  { id: "1", image: "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=200&h=200&fit=crop", artistName: "Ava Simmons", timing: createMockTiming(-200, 60) },
  { id: "2", image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=200&h=200&fit=crop", artistName: "Ben Wright", timing: createMockTiming(-15, 90), eventTitle: "Pottery Throwing Session", price: 8 },
  { id: "3", image: "https://images.unsplash.com/photo-1493106641515-6b5631de4bb9?w=200&h=200&fit=crop", artistName: "Clara Berg", timing: createMockTiming(180), eventTitle: "Weaving Workshop", price: 12 },
  { id: "4", image: "https://images.unsplash.com/photo-1452860606245-08befc0ff44b?w=200&h=200&fit=crop", artistName: "Dan Reyes", timing: createMockTiming(-300, 60) },
  { id: "5", image: "https://images.unsplash.com/photo-1547891654-e66ed7ebb968?w=200&h=200&fit=crop", artistName: "Eva Stone", timing: createMockTiming(360), eventTitle: "Ceramic Glazing", price: 10 },
  { id: "6", image: "https://images.unsplash.com/photo-1531913764164-f85c52e6e654?w=200&h=200&fit=crop", artistName: "Frank Lee", timing: createMockTiming(-80, 120), eventTitle: "Clay Modeling", price: 0 },
];

export function HomeScreen({ onGoLive, onViewCreatorProfile, onViewAudienceProfile, onEnterLiveRoom, onOpenSearch }: HomeScreenProps) {
  const { mode } = useUserMode();
  const [activeTab, setActiveTab] = useState(mode === "audience" ? "home" : "studio");
  const [liveTicketOpen, setLiveTicketOpen] = useState(false);
  const [selectedLiveItem, setSelectedLiveItem] = useState<CuratedItem | null>(null);
  const [eventPageOpen, setEventPageOpen] = useState(false);
  const [selectedScheduledItem, setSelectedScheduledItem] = useState<CuratedItem | null>(null);
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

  const handleCardTap = (item: CuratedItem, status: CreatorStatus) => {
    if (status === "live") {
      setSelectedLiveItem(item);
      setLiveTicketOpen(true);
    } else if (status === "scheduled") {
      setSelectedScheduledItem(item);
      setEventPageOpen(true);
    } else {
      onViewCreatorProfile?.();
    }
  };

  const handleEnterLiveRoom = () => {
    setLiveTicketOpen(false);
    onEnterLiveRoom?.();
  };

  const handleBuyTicket = () => {
    setEventPageOpen(false);
  };

  const handleRemind = (eventId: string) => {
    toast({ title: "Reminder Set!", description: "We'll notify you when this event starts." });
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

              {/* Section B: Box Office */}
              <section className="py-6 relative spotlight">
                <div className="flex items-center justify-between px-4 lg:px-6 mb-4 relative z-10">
                  <div>
                    <h2 className="font-display text-xl lg:text-2xl text-foreground">Box Office</h2>
                    <p className="text-sm text-muted-foreground">Doors opening soon</p>
                  </div>
                  <button className="hidden lg:flex items-center gap-1 text-sm text-muted-foreground hover:text-electric transition-colors">
                    See all <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="px-4 lg:px-6 relative z-10">
                  <CarouselWithArrows>
                    {scheduledEvents.map((event, index) => (
                      <motion.div
                        key={event.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="snap-start flex-shrink-0 w-[40vw] sm:w-[30vw] md:w-[160px] lg:w-[140px] xl:w-[160px]"
                      >
                        <ScheduledCard
                          coverImage={event.coverImage}
                          title={event.title}
                          price={event.price}
                          artistName={event.artistName}
                          timing={event.timing}
                        />
                      </motion.div>
                    ))}
                  </CarouselWithArrows>
                </div>
              </section>

              {/* Section C: Curated Studio Rows */}
              <section className="py-4">
                <CuratedRow title="Masterclasses" items={masterclasses} onCardTap={handleCardTap} />
                <CuratedRow title="Fresh off the Easel" items={freshEasel} onCardTap={handleCardTap} />
                <CuratedRow title="Handcraft & Sculpture" items={handcraft} onCardTap={handleCardTap} />
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

      {/* Modals and Overlays */}
      {selectedLiveItem && (
        <LiveTicketPreview
          isOpen={liveTicketOpen}
          onClose={() => setLiveTicketOpen(false)}
          onEnterRoom={handleEnterLiveRoom}
          artistName={selectedLiveItem.artistName}
          eventTitle={selectedLiveItem.eventTitle || "Live Session"}
          price={selectedLiveItem.price || 0}
          coverImage={selectedLiveItem.image}
        />
      )}

      {selectedScheduledItem && (
        <ScheduledEventPage
          isOpen={eventPageOpen}
          onClose={() => setEventPageOpen(false)}
          onBuyTicket={handleBuyTicket}
          artistName={selectedScheduledItem.artistName}
          eventTitle={selectedScheduledItem.eventTitle || "Upcoming Event"}
          price={selectedScheduledItem.price || 0}
          coverImage={selectedScheduledItem.image}
          scheduledTime={selectedScheduledItem.scheduledTime || "Coming Soon"}
          description="Join this exclusive session to learn new techniques and connect with fellow art enthusiasts."
          hasTrailer={true}
        />
      )}

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
          <LiveRoomPortal
            eventId={portalEvent.id}
            coverImage={portalEvent.coverImage}
            title={portalEvent.title}
            artistName={portalEvent.artistName}
            viewers={portalEvent.viewers}
            onClose={handleCloseLiveRoom}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
