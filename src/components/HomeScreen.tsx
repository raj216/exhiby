import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Search, User } from "lucide-react";
import { LiveMarqueeCard } from "./LiveMarqueeCard";
import { ScheduledCard } from "./ScheduledCard";
import { CuratedRow } from "./CuratedRow";

interface HomeScreenProps {
  onGoLive: () => void;
  onViewCreatorProfile?: () => void;
  onViewAudienceProfile?: () => void;
}

// Mock data
const liveNowEvents = [
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

const scheduledEvents = [
  {
    id: "1",
    coverImage: "https://images.unsplash.com/photo-1578926375605-eaf7559b1458?w=300&h=300&fit=crop",
    title: "Portrait Sketching",
    price: 5,
    artistName: "Alex Rivera",
    startsIn: "15 min",
  },
  {
    id: "2",
    coverImage: "https://images.unsplash.com/photo-1531913764164-f85c52e6e654?w=300&h=300&fit=crop",
    title: "Oil Painting Basics",
    price: 10,
    artistName: "Emma Liu",
    startsIn: "1 hour",
  },
  {
    id: "3",
    coverImage: "https://images.unsplash.com/photo-1549887534-1541e9326642?w=300&h=300&fit=crop",
    title: "Digital Art Stream",
    price: 0,
    artistName: "Jay Kim",
    startsIn: "2 hours",
  },
];

const masterclasses = [
  { id: "1", image: "https://images.unsplash.com/photo-1547826039-bfc35e0f1ea8?w=200&h=200&fit=crop", artistName: "Mia Torres" },
  { id: "2", image: "https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=200&h=200&fit=crop", artistName: "David Okonkwo" },
  { id: "3", image: "https://images.unsplash.com/photo-1561214115-f2f134cc4912?w=200&h=200&fit=crop", artistName: "Sophie Martin" },
  { id: "4", image: "https://images.unsplash.com/photo-1578301978693-85fa9c0320b9?w=200&h=200&fit=crop", artistName: "Kai Tanaka" },
];

const freshEasel = [
  { id: "1", image: "https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=200&h=200&fit=crop", artistName: "Ana Perez" },
  { id: "2", image: "https://images.unsplash.com/photo-1605721911519-3dfeb3be25e7?w=200&h=200&fit=crop", artistName: "Tom Harris" },
  { id: "3", image: "https://images.unsplash.com/photo-1544967082-d9d25d867d66?w=200&h=200&fit=crop", artistName: "Nina Volkov" },
  { id: "4", image: "https://images.unsplash.com/photo-1571115764595-644a1f56a55c?w=200&h=200&fit=crop", artistName: "Leo Chen" },
];

const handcraft = [
  { id: "1", image: "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=200&h=200&fit=crop", artistName: "Ava Simmons" },
  { id: "2", image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=200&h=200&fit=crop", artistName: "Ben Wright" },
  { id: "3", image: "https://images.unsplash.com/photo-1493106641515-6b5631de4bb9?w=200&h=200&fit=crop", artistName: "Clara Berg" },
  { id: "4", image: "https://images.unsplash.com/photo-1452860606245-08befc0ff44b?w=200&h=200&fit=crop", artistName: "Dan Reyes" },
];

export function HomeScreen({ onGoLive, onViewCreatorProfile, onViewAudienceProfile }: HomeScreenProps) {
  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 glass">
        <div className="flex items-center justify-between p-4">
          <h1 className="font-serif text-2xl text-gradient-gold">Exhiby</h1>
          <div className="flex items-center gap-3">
            <button 
              className="p-2 rounded-full bg-surface-elevated"
              onClick={onViewCreatorProfile}
            >
              <Search className="w-5 h-5 text-muted-foreground" />
            </button>
            <button 
              className="p-2 rounded-full bg-surface-elevated"
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
            <h2 className="font-serif text-xl text-foreground">Live Now</h2>
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
              <LiveMarqueeCard {...event} />
            </motion.div>
          ))}
        </div>
      </section>

      {/* Section B: The Box Office - SCHEDULED */}
      <section className="mb-8">
        <div className="flex items-center justify-between px-4 mb-4">
          <div>
            <h2 className="font-serif text-xl text-foreground">Box Office</h2>
            <p className="text-sm text-muted-foreground">Coming up soon</p>
          </div>
        </div>

        <div className="scroll-snap-x gap-3 px-4">
          {scheduledEvents.map((event, index) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <ScheduledCard {...event} />
            </motion.div>
          ))}
        </div>
      </section>

      {/* Section C: Curated Rows */}
      <section>
        <CuratedRow title="Masterclasses" items={masterclasses} />
        <CuratedRow title="Fresh off the Easel" items={freshEasel} />
        <CuratedRow title="Handcraft & Sculpture" items={handcraft} />
      </section>

      {/* Floating Action Button - Go Live */}
      <motion.button
        onClick={onGoLive}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-gradient-gold shadow-gold flex items-center justify-center z-40"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        <Plus className="w-7 h-7 text-primary-foreground" />
      </motion.button>
    </div>
  );
}
