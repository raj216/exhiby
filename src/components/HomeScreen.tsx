import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, User } from "lucide-react";
import { LiveMarqueeCard } from "./LiveMarqueeCard";
import { ScheduledCard } from "./ScheduledCard";
import { CuratedRow, CuratedItem } from "./CuratedRow";
import { LiveTicketPreview } from "./LiveTicketPreview";
import { ScheduledEventPage } from "./ScheduledEventPage";
import { CreatorStatus } from "./StudioCard";
import { createMockTiming } from "@/hooks/useEventStatus";
import { LiveRoomPortal } from "./LiveRoomPortal";
import { PaymentDrawer } from "./PaymentDrawer";

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
];

// Scheduled events with dynamic timing
const scheduledEvents = [
  {
    id: "1",
    coverImage: "https://images.unsplash.com/photo-1578926375605-eaf7559b1458?w=300&h=300&fit=crop",
    title: "Portrait Sketching",
    price: 5,
    artistName: "Alex Rivera",
    timing: createMockTiming(15), // Starts in 15 min
  },
  {
    id: "2",
    coverImage: "https://images.unsplash.com/photo-1531913764164-f85c52e6e654?w=300&h=300&fit=crop",
    title: "Oil Painting Basics",
    price: 10,
    artistName: "Emma Liu",
    timing: createMockTiming(60), // Starts in 1 hour
  },
  {
    id: "3",
    coverImage: "https://images.unsplash.com/photo-1549887534-1541e9326642?w=300&h=300&fit=crop",
    title: "Digital Art Stream",
    price: 0,
    artistName: "Jay Kim",
    timing: createMockTiming(120), // Starts in 2 hours
  },
];

// Curated rows with timing-based status
const masterclasses: CuratedItem[] = [
  { id: "1", image: "https://images.unsplash.com/photo-1547826039-bfc35e0f1ea8?w=200&h=200&fit=crop", artistName: "Mia Torres", timing: createMockTiming(-30, 90), eventTitle: "Color Theory Masterclass", price: 5 },
  { id: "2", image: "https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=200&h=200&fit=crop", artistName: "David Okonkwo", timing: createMockTiming(240), eventTitle: "Charcoal Techniques", price: 10 },
  { id: "3", image: "https://images.unsplash.com/photo-1561214115-f2f134cc4912?w=200&h=200&fit=crop", artistName: "Sophie Martin", timing: createMockTiming(-180, 60) },
  { id: "4", image: "https://images.unsplash.com/photo-1578301978693-85fa9c0320b9?w=200&h=200&fit=crop", artistName: "Kai Tanaka", timing: createMockTiming(1440), eventTitle: "Ink Wash Painting", price: 15 },
];

const freshEasel: CuratedItem[] = [
  { id: "1", image: "https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=200&h=200&fit=crop", artistName: "Ana Perez", timing: createMockTiming(-10, 60), eventTitle: "Unveiling: Ocean Series", price: 0 },
  { id: "2", image: "https://images.unsplash.com/photo-1605721911519-3dfeb3be25e7?w=200&h=200&fit=crop", artistName: "Tom Harris", timing: createMockTiming(-120, 60) },
  { id: "3", image: "https://images.unsplash.com/photo-1544967082-d9d25d867d66?w=200&h=200&fit=crop", artistName: "Nina Volkov", timing: createMockTiming(-90, 60) },
  { id: "4", image: "https://images.unsplash.com/photo-1571115764595-644a1f56a55c?w=200&h=200&fit=crop", artistName: "Leo Chen", timing: createMockTiming(2880), eventTitle: "New Collection Drop", price: 5 },
];

const handcraft: CuratedItem[] = [
  { id: "1", image: "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=200&h=200&fit=crop", artistName: "Ava Simmons", timing: createMockTiming(-200, 60) },
  { id: "2", image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=200&h=200&fit=crop", artistName: "Ben Wright", timing: createMockTiming(-15, 90), eventTitle: "Pottery Throwing Session", price: 8 },
  { id: "3", image: "https://images.unsplash.com/photo-1493106641515-6b5631de4bb9?w=200&h=200&fit=crop", artistName: "Clara Berg", timing: createMockTiming(180), eventTitle: "Weaving Workshop", price: 12 },
  { id: "4", image: "https://images.unsplash.com/photo-1452860606245-08befc0ff44b?w=200&h=200&fit=crop", artistName: "Dan Reyes", timing: createMockTiming(-300, 60) },
];

export function HomeScreen({ onGoLive, onViewCreatorProfile, onViewAudienceProfile, onEnterLiveRoom, onOpenSearch }: HomeScreenProps) {
  // State for live ticket preview (for curated rows)
  const [liveTicketOpen, setLiveTicketOpen] = useState(false);
  const [selectedLiveItem, setSelectedLiveItem] = useState<CuratedItem | null>(null);

  // State for scheduled event page
  const [eventPageOpen, setEventPageOpen] = useState(false);
  const [selectedScheduledItem, setSelectedScheduledItem] = useState<CuratedItem | null>(null);

  // State for portal flow (Live Now cards)
  const [portalEvent, setPortalEvent] = useState<LiveEvent | null>(null);
  const [showPaymentDrawer, setShowPaymentDrawer] = useState(false);
  const [showLiveRoom, setShowLiveRoom] = useState(false);

  // Handle Live Now card tap - Portal flow
  const handleLiveCardTap = (event: LiveEvent) => {
    setPortalEvent(event);
    
    if (event.price > 0) {
      // Ticketed - show payment drawer first
      setShowPaymentDrawer(true);
    } else {
      // Free - go directly to portal
      setShowLiveRoom(true);
    }
  };

  // Handle payment success
  const handlePaymentSuccess = () => {
    setShowPaymentDrawer(false);
    // Small delay for smooth transition
    setTimeout(() => {
      setShowLiveRoom(true);
    }, 100);
  };

  // Handle closing live room
  const handleCloseLiveRoom = () => {
    setShowLiveRoom(false);
    // Reset portal event after animation
    setTimeout(() => {
      setPortalEvent(null);
    }, 400);
  };

  // Handle card tap based on status (for curated rows)
  const handleCardTap = (item: CuratedItem, status: CreatorStatus) => {
    if (status === "live") {
      setSelectedLiveItem(item);
      setLiveTicketOpen(true);
    } else if (status === "scheduled") {
      setSelectedScheduledItem(item);
      setEventPageOpen(true);
    } else {
      // Offline - go to creator profile
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

  return (
    <div className="min-h-screen bg-carbon pb-8">
      {/* Header */}
      <header className="sticky top-0 z-30 glass">
        <div className="flex items-center justify-between p-4">
          <h1 className="font-display text-2xl text-gradient-electric">Exhiby</h1>
          <div className="flex items-center gap-3">
            <button 
              className="p-2 rounded-full bg-obsidian border border-border/30"
              onClick={onOpenSearch}
            >
              <Search className="w-5 h-5 text-muted-foreground" />
            </button>
            <button 
              className="p-2 rounded-full bg-obsidian border border-border/30"
              onClick={onViewAudienceProfile}
            >
              <User className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
        </div>
      </header>

      {/* Section A: The Marquee - LIVE NOW */}
      <section className="mb-8">
        <div className="flex items-center justify-between px-4 mb-4">
          <div>
            <h2 className="font-display text-xl text-foreground">Live Now</h2>
            <p className="text-sm text-muted-foreground">Step into a studio</p>
          </div>
        </div>

        <div className="scroll-snap-x gap-4 px-4 pb-4">
          {liveNowEvents.map((event, index) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
            >
              <LiveMarqueeCard 
                {...event} 
                onClick={() => handleLiveCardTap(event)}
                layoutId={`room-card-${event.id}`}
              />
            </motion.div>
          ))}
        </div>
      </section>

      {/* Section B: The Box Office - SCHEDULED with Spotlight Effect */}
      <section className="mb-8 relative spotlight">
        <div className="flex items-center justify-between px-4 mb-4 relative z-10">
          <div>
            <h2 className="font-display text-xl text-foreground">Box Office</h2>
            <p className="text-sm text-muted-foreground">Doors opening soon</p>
          </div>
        </div>

        <div className="scroll-snap-x gap-3 px-4 relative z-10">
          {scheduledEvents.map((event, index) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
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
        </div>
      </section>

      {/* Section C: Curated Studio Rows */}
      <section>
        <CuratedRow 
          title="Masterclasses" 
          items={masterclasses} 
          onCardTap={handleCardTap}
        />
        <CuratedRow 
          title="Fresh off the Easel" 
          items={freshEasel} 
          onCardTap={handleCardTap}
        />
        <CuratedRow 
          title="Handcraft & Sculpture" 
          items={handcraft} 
          onCardTap={handleCardTap}
        />
      </section>

      {/* Live Ticket Preview Slide-up (for curated rows) */}
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

      {/* Scheduled Event Page */}
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

      {/* Payment Drawer for ticketed Live Now events */}
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

      {/* Portal Live Room */}
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
