import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Settings, Image as ImageIcon, Award, ShoppingBag } from "lucide-react";
import { EventBadge } from "./EventBadge";
import { triggerClickHaptic } from "@/lib/haptics";

interface AudienceProfileProps {
  onBack: () => void;
}

// Mock data
const mockUser = {
  name: "Marcus Chen",
  username: "@marcuschen",
  avatarImage: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80",
  memberSince: "Dec 2024",
  totalSpent: 245,
  eventsAttended: 12,
};

const mockCollectedArt = [
  { id: "1", image: "https://images.unsplash.com/photo-1578926375605-eaf7559b1458?w=400&q=80", title: "Portrait Study I", artist: "Elena Voss" },
  { id: "2", image: "https://images.unsplash.com/photo-1544967082-d9d25d867d66?w=400&q=80", title: "Digital Dreams", artist: "Luna Kim" },
  { id: "3", image: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=400&q=80", title: "Abstract Form", artist: "James Wright" },
  { id: "4", image: "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=400&q=80", title: "Motion Study", artist: "Sarah Park" },
];

const mockBadges = [
  { id: "1", title: "Hair Masterclass Alumni", image: "https://images.unsplash.com/photo-1503023345310-bd7c1de61c7d?w=400&q=80", date: "Dec 2024" },
  { id: "2", title: "Eye Workshop Graduate", image: "https://images.unsplash.com/photo-1495231916356-a86217efff12?w=400&q=80", date: "Dec 2024" },
  { id: "3", title: "First Live Attendee", image: "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=400&q=80", date: "Nov 2024" },
  { id: "4", title: "Sketch Session Pro", image: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=400&q=80", date: "Nov 2024" },
];

type TabType = "collected" | "badges";

export function AudienceProfile({ onBack }: AudienceProfileProps) {
  const [activeTab, setActiveTab] = useState<TabType>("collected");

  const tabs: { id: TabType; label: string; icon: typeof ImageIcon }[] = [
    { id: "collected", label: "Art Collected", icon: ShoppingBag },
    { id: "badges", label: "Events Attended", icon: Award },
  ];

  return (
    <div className="min-h-screen bg-carbon">
      {/* Header with subtle Electric Clay gradient */}
      <div className="relative bg-gradient-to-b from-electric/10 to-carbon pt-12 pb-6 px-4">
        {/* Back & Settings */}
        <div className="absolute top-4 left-4 right-4 flex justify-between">
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-carbon/80 backdrop-blur-sm border border-border/50 flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </motion.button>
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="w-10 h-10 rounded-full bg-carbon/80 backdrop-blur-sm border border-border/50 flex items-center justify-center"
          >
            <Settings className="w-5 h-5 text-foreground" />
          </motion.button>
        </div>

        {/* Profile Info */}
        <div className="flex flex-col items-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-24 h-24 rounded-full border-4 border-carbon overflow-hidden bg-obsidian shadow-deep"
          >
            <img
              src={mockUser.avatarImage}
              alt={mockUser.name}
              className="w-full h-full object-cover"
            />
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="font-display text-2xl text-foreground mt-4"
          >
            {mockUser.name}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="text-muted-foreground text-sm"
          >
            {mockUser.username}
          </motion.p>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex items-center gap-8 mt-6"
          >
            <div className="text-center">
              <p className="font-display text-2xl text-gold">${mockUser.totalSpent}</p>
              <p className="text-xs text-muted-foreground">Invested</p>
            </div>
            <div className="w-px h-10 bg-border/50" />
            <div className="text-center">
              <p className="font-display text-2xl text-foreground">{mockUser.eventsAttended}</p>
              <p className="text-xs text-muted-foreground">Events</p>
            </div>
            <div className="w-px h-10 bg-border/50" />
            <div className="text-center">
              <p className="font-display text-2xl text-foreground">{mockCollectedArt.length}</p>
              <p className="text-xs text-muted-foreground">Collected</p>
            </div>
          </motion.div>

          {/* Passport Badge - Gold accent */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.25 }}
            className="mt-4 px-4 py-1.5 rounded-full border"
            style={{
              background: "hsl(43 72% 52% / 0.1)",
              borderColor: "hsl(43 72% 52% / 0.3)"
            }}
          >
            <p className="text-xs font-semibold text-gold">
              🎫 Collector's Passport • Member since {mockUser.memberSince}
            </p>
          </motion.div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border/50">
        <div className="flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                triggerClickHaptic();
                setActiveTab(tab.id);
              }}
              className={`flex-1 py-4 text-sm font-semibold relative transition-colors flex items-center justify-center gap-2 ${
                activeTab === tab.id
                  ? "text-foreground"
                  : "text-muted-foreground"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {activeTab === tab.id && (
                <motion.div
                  layoutId="audienceTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-electric"
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="pb-20">
        {activeTab === "collected" && (
          <div className="p-4">
            {mockCollectedArt.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="w-16 h-16 rounded-full bg-obsidian flex items-center justify-center mb-4">
                  <ImageIcon className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground text-center">
                  No art collected yet
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {mockCollectedArt.map((art, index) => (
                  <motion.div
                    key={art.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.05 }}
                    className="rounded-2xl overflow-hidden bg-obsidian border border-border/30"
                  >
                    <div className="aspect-square">
                      <img
                        src={art.image}
                        alt={art.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-3">
                      <p className="font-medium text-foreground text-sm line-clamp-1">
                        {art.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        by {art.artist}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "badges" && (
          <div className="p-4">
            <p className="text-sm text-muted-foreground mb-4">
              Badges earned from attending events
            </p>
            {mockBadges.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="w-16 h-16 rounded-full bg-obsidian flex items-center justify-center mb-4">
                  <Award className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground text-center">
                  No badges earned yet
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-4">
                {mockBadges.map((badge, index) => (
                  <EventBadge
                    key={badge.id}
                    title={badge.title}
                    image={badge.image}
                    date={badge.date}
                    index={index}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}