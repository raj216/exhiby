import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, 
  Settings, 
  Image as ImageIcon, 
  Award, 
  ShoppingBag,
  Ticket,
  CreditCard,
  MapPin,
  Bell,
  ChevronRight,
  Palette,
  Clock,
  X
} from "lucide-react";
import { triggerClickHaptic } from "@/lib/haptics";
import { toast } from "@/hooks/use-toast";

interface AudienceProfileProps {
  onBack: () => void;
  onSwitchMode?: () => void;
  isVerifiedCreator?: boolean;
  onOpenStudio?: () => void;
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
  { id: "1", image: "https://images.unsplash.com/photo-1578926375605-eaf7559b1458?w=400&q=80", title: "Portrait Study I", artist: "Elena Voss", type: "handcraft" },
  { id: "2", image: "https://images.unsplash.com/photo-1544967082-d9d25d867d66?w=400&q=80", title: "Digital Dreams", artist: "Luna Kim", type: "artworks" },
  { id: "3", image: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=400&q=80", title: "Abstract Form", artist: "James Wright", type: "artworks" },
  { id: "4", image: "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=400&q=80", title: "Motion Study", artist: "Sarah Park", type: "handcraft" },
];

const mockBadges = [
  { id: "1", title: "Founding Member", image: "https://images.unsplash.com/photo-1503023345310-bd7c1de61c7d?w=400&q=80", date: "Dec 2024", type: "special" },
  { id: "2", title: "Hair Masterclass Alumni", image: "https://images.unsplash.com/photo-1503023345310-bd7c1de61c7d?w=400&q=80", date: "Dec 2024", type: "event" },
  { id: "3", title: "First Purchase", image: "https://images.unsplash.com/photo-1495231916356-a86217efff12?w=400&q=80", date: "Dec 2024", type: "achievement" },
  { id: "4", title: "Pottery Lover", image: "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=400&q=80", date: "Nov 2024", type: "interest" },
];

const mockTickets = [
  { id: "1", event: "Realistic Eye Workshop", creator: "Elena Voss", date: "Sat, Dec 21", time: "8 PM EST", price: 5, startsIn: 45 },
  { id: "2", event: "Drawing Realistic Hair", creator: "Mia Torres", date: "Sun, Dec 22", time: "3 PM EST", price: 10, startsIn: 180 },
];

const mockPastEvents = [
  { id: "p1", event: "Watercolor Basics", creator: "James Wright", date: "Sat, Dec 14", time: "6 PM EST", price: 8 },
  { id: "p2", event: "Abstract Expressions", creator: "Luna Kim", date: "Fri, Dec 13", time: "4 PM EST", price: 12 },
];

type TabType = "tickets" | "vault";

export function AudienceProfile({ 
  onBack, 
  onSwitchMode, 
  isVerifiedCreator = false,
  onOpenStudio 
}: AudienceProfileProps) {
  const [activeTab, setActiveTab] = useState<TabType>("tickets");
  const [collectionFilter, setCollectionFilter] = useState<"all" | "handcraft" | "artworks">("all");
  const [showSettings, setShowSettings] = useState(false);

  const tabs: { id: TabType; label: string; icon: typeof Ticket }[] = [
    { id: "tickets", label: "Tickets", icon: Ticket },
    { id: "vault", label: "Vault", icon: ShoppingBag },
  ];

  const filteredArt = collectionFilter === "all" 
    ? mockCollectedArt 
    : mockCollectedArt.filter(a => a.type === collectionFilter);

  return (
    <div className="min-h-screen bg-carbon">
      {/* Main Container */}
      <div className="max-w-screen-xl mx-auto lg:px-8">
      {/* Header */}
      <div className="relative bg-gradient-to-b from-electric/10 to-carbon pt-12 pb-6 px-4">
        {/* Controls */}
        <div className="absolute top-4 left-4 right-4 flex justify-between items-center">
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-carbon/80 backdrop-blur-sm border border-border/50 flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </motion.button>
          
          <div className="flex items-center gap-2">
            {/* Settings Gear Icon */}
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={() => {
                triggerClickHaptic();
                setShowSettings(true);
              }}
              className="w-10 h-10 rounded-full bg-carbon/80 backdrop-blur-sm border border-border/50 flex items-center justify-center"
            >
              <Settings className="w-5 h-5 text-foreground" />
            </motion.button>

            {/* Mode Switch (only for verified creators) */}
            {isVerifiedCreator && onSwitchMode && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={() => {
                  triggerClickHaptic();
                  onSwitchMode();
                }}
                className="px-4 py-2 rounded-full bg-carbon/80 backdrop-blur-sm border border-electric/50 flex items-center gap-2"
              >
                <span className="text-xs text-electric font-medium">Switch to Studio</span>
                <ChevronRight className="w-4 h-4 text-electric" />
              </motion.button>
            )}
          </div>
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
              <p className="font-display text-2xl text-foreground">{mockUser.eventsAttended}</p>
              <p className="text-xs text-muted-foreground">Attended</p>
            </div>
            <div className="w-px h-10 bg-border/50" />
            <div className="text-center">
              <p className="font-display text-2xl text-foreground">{mockCollectedArt.length}</p>
              <p className="text-xs text-muted-foreground">Collected</p>
            </div>
          </motion.div>

          {/* Badges Row - Horizontal Scroll */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="mt-4 w-full overflow-x-auto scrollbar-hide"
          >
            <div className="flex gap-2 px-4 pb-2">
              {mockBadges.slice(0, 4).map((badge) => (
                <div 
                  key={badge.id}
                  className="flex-shrink-0 px-3 py-1.5 rounded-full border flex items-center gap-1.5"
                  style={{
                    background: badge.type === "special" 
                      ? "linear-gradient(135deg, hsl(43 72% 52% / 0.2), hsl(43 72% 52% / 0.1))"
                      : "hsl(var(--obsidian) / 0.5)",
                    borderColor: badge.type === "special" 
                      ? "hsl(43 72% 52% / 0.4)" 
                      : "hsl(var(--border) / 0.3)"
                  }}
                >
                  <Award className={`w-3 h-3 ${badge.type === "special" ? "text-gold" : "text-electric"}`} />
                  <span className={`text-xs font-medium ${badge.type === "special" ? "text-gold" : "text-foreground"}`}>
                    {badge.title}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Passport Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-2 px-4 py-1.5 rounded-full border"
            style={{
              background: "hsl(43 72% 52% / 0.1)",
              borderColor: "hsl(43 72% 52% / 0.3)"
            }}
          >
            <p className="text-xs font-semibold text-gold">
              🎫 Collector's Passport • Since {mockUser.memberSince}
            </p>
          </motion.div>
        </div>
      </div>

      {/* Tabs - Only Tickets and Vault */}
      <div className="border-b border-border/50 overflow-x-auto scrollbar-hide">
        <div className="flex min-w-max max-w-2xl mx-auto lg:justify-center lg:gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                triggerClickHaptic();
                setActiveTab(tab.id);
              }}
              className={`flex-1 min-w-[120px] lg:min-w-[140px] py-3 text-xs font-semibold relative transition-colors flex flex-col items-center gap-1 ${
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
                  className="absolute bottom-0 left-2 right-2 h-0.5 bg-electric"
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="pb-24 lg:pb-8 max-w-4xl mx-auto">
        <AnimatePresence mode="wait">
          {/* Tickets Tab */}
          {activeTab === "tickets" && (
            <motion.div
              key="tickets"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4"
            >
              {/* Upcoming Access */}
              <h3 className="font-display text-lg text-foreground mb-4">Upcoming Access</h3>
              {mockTickets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Ticket className="w-12 h-12 text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No tickets yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {mockTickets.map((ticket) => (
                    <div 
                      key={ticket.id}
                      className="bg-obsidian rounded-2xl p-4 border border-border/30"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="font-display text-foreground">{ticket.event}</p>
                          <p className="text-sm text-muted-foreground">by {ticket.creator}</p>
                        </div>
                        <span className="px-2 py-1 rounded-full bg-gold/10 text-gold text-xs font-medium">
                          ${ticket.price}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {ticket.date} • {ticket.time}
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          triggerClickHaptic();
                          if (ticket.startsIn <= 15) {
                            toast({ title: "Entering Room...", description: "Welcome to the session!" });
                          } else {
                            toast({ title: "Not Yet", description: `Room opens in ${ticket.startsIn} minutes` });
                          }
                        }}
                        className={`w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                          ticket.startsIn <= 15
                            ? "bg-gradient-to-r from-electric to-crimson text-white"
                            : "bg-obsidian border border-border/50 text-muted-foreground"
                        }`}
                      >
                        {ticket.startsIn <= 15 ? (
                          "Enter Room"
                        ) : (
                          <>
                            <span className="px-2 py-0.5 rounded-full bg-[#FF6B58]/20 text-[#FF6B58] font-bold text-xs">
                              Opens in {ticket.startsIn}m
                            </span>
                          </>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Past Events Section */}
              <h3 className="font-display text-lg text-foreground mt-8 mb-4">Past Events</h3>
              <div className="space-y-3 opacity-60">
                {mockPastEvents.map((event) => (
                  <div 
                    key={event.id}
                    className="bg-obsidian rounded-2xl p-4 border border-border/30"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-display text-foreground">{event.event}</p>
                        <p className="text-sm text-muted-foreground">by {event.creator}</p>
                      </div>
                      <span className="px-2 py-1 rounded-full bg-muted/20 text-muted-foreground text-xs font-medium">
                        ${event.price}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {event.date} • {event.time}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Vault Tab */}
          {activeTab === "vault" && (
            <motion.div
              key="vault"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4"
            >
              {/* Filters */}
              <div className="flex gap-2 mb-4">
                {(["all", "handcraft", "artworks"] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => {
                      triggerClickHaptic();
                      setCollectionFilter(filter);
                    }}
                    className={`px-4 py-2 rounded-full text-xs font-medium capitalize transition-all ${
                      collectionFilter === filter
                        ? "bg-electric text-carbon"
                        : "bg-obsidian text-muted-foreground border border-border/50"
                    }`}
                  >
                    {filter === "all" ? "All" : filter === "handcraft" ? "Handcraft" : "Artworks"}
                  </button>
                ))}
              </div>

              {/* Grid */}
              {filteredArt.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <ImageIcon className="w-12 h-12 text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No items collected yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {filteredArt.map((art, index) => (
                    <motion.div
                      key={art.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.05 }}
                      className="rounded-2xl overflow-hidden bg-obsidian border border-border/30"
                    >
                      <div className="aspect-square relative">
                        <img
                          src={art.image}
                          alt={art.title}
                          className="w-full h-full object-cover"
                        />
                        <span className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          art.type === "handcraft" ? "bg-electric/90 text-carbon" : "bg-gold/90 text-carbon"
                        }`}>
                          {art.type === "handcraft" ? "Handcraft" : "Artworks"}
                        </span>
                      </div>
                      <div className="p-3">
                        <p className="font-medium text-foreground text-sm line-clamp-1">{art.title}</p>
                        <p className="text-xs text-muted-foreground">by {art.artist}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      </div>

      {/* Settings Panel (Slide-up) */}
      <AnimatePresence>
        {showSettings && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-carbon/80 backdrop-blur-sm z-50"
              onClick={() => setShowSettings(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 bg-obsidian rounded-t-3xl z-50 max-h-[80vh] overflow-y-auto"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-display text-xl text-foreground">Settings</h2>
                  <button
                    onClick={() => setShowSettings(false)}
                    className="w-10 h-10 rounded-full bg-carbon/50 flex items-center justify-center"
                  >
                    <X className="w-5 h-5 text-foreground" />
                  </button>
                </div>

                <div className="space-y-3">
                  {/* Payment Methods */}
                  <button 
                    onClick={() => toast({ title: "Payment Methods", description: "Opening payment settings..." })}
                    className="w-full flex items-center justify-between p-4 bg-carbon rounded-xl border border-border/30"
                  >
                    <div className="flex items-center gap-3">
                      <CreditCard className="w-5 h-5 text-electric" />
                      <span className="text-foreground">Payment Methods</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </button>

                  {/* Shipping */}
                  <button 
                    onClick={() => toast({ title: "Shipping Address", description: "Opening shipping settings..." })}
                    className="w-full flex items-center justify-between p-4 bg-carbon rounded-xl border border-border/30"
                  >
                    <div className="flex items-center gap-3">
                      <MapPin className="w-5 h-5 text-electric" />
                      <span className="text-foreground">Shipping Address</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </button>

                  {/* Notifications */}
                  <button 
                    onClick={() => toast({ title: "Notifications", description: "Opening notification preferences..." })}
                    className="w-full flex items-center justify-between p-4 bg-carbon rounded-xl border border-border/30"
                  >
                    <div className="flex items-center gap-3">
                      <Bell className="w-5 h-5 text-electric" />
                      <span className="text-foreground">Notification Preferences</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </button>

                  {/* Open Studio (only if not verified) */}
                  {!isVerifiedCreator && onOpenStudio && (
                    <button 
                      onClick={() => {
                        triggerClickHaptic();
                        onOpenStudio();
                        setShowSettings(false);
                      }}
                      className="w-full mt-6 p-4 rounded-xl bg-gradient-to-r from-electric to-crimson flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <Palette className="w-5 h-5 text-white" />
                        <div className="text-left">
                          <span className="text-white font-semibold block">Open Your Studio</span>
                          <span className="text-white/70 text-xs">Become a verified creator</span>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-white" />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
