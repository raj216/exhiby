import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, 
  Image as ImageIcon, 
  Award, 
  ShoppingBag,
  Ticket,
  ChevronRight,
  Clock,
  Camera,
  Share2,
  Pencil
} from "lucide-react";
import { triggerClickHaptic } from "@/lib/haptics";
import { toast } from "@/hooks/use-toast";
import { ProfileImageEditor } from "./ProfileImageEditor";
import defaultCover from "@/assets/default-cover.jpg";

interface UserProfile {
  name: string;
  handle: string | null;
  avatarUrl: string | null;
  email: string;
  memberSince: string;
}

interface AudienceProfileProps {
  onBack: () => void;
  onSwitchMode?: () => void;
  isVerifiedCreator?: boolean;
  onOpenStudio?: () => void;
  profile?: UserProfile | null;
}

// Fallback data for when profile is loading
const fallbackUser = {
  name: "Guest",
  username: "@guest",
  avatarImage: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80",
  memberSince: "Dec 2024",
  eventsAttended: 12,
};

const mockCollectedArt = [
  { id: "1", image: "https://images.unsplash.com/photo-1578926375605-eaf7559b1458?w=400&q=80", title: "Portrait Study I", artist: "Elena Voss", type: "handcraft" },
  { id: "2", image: "https://images.unsplash.com/photo-1544967082-d9d25d867d66?w=400&q=80", title: "Digital Dreams", artist: "Luna Kim", type: "artworks" },
  { id: "3", image: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=400&q=80", title: "Abstract Form", artist: "James Wright", type: "artworks" },
  { id: "4", image: "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=400&q=80", title: "Motion Study", artist: "Sarah Park", type: "handcraft" },
];

const mockBadges = [
  { id: "1", title: "Founding Member", type: "special" },
  { id: "2", title: "Hair Masterclass Alumni", type: "event" },
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
  onOpenStudio,
  profile
}: AudienceProfileProps) {
  // Use real profile data or fallback
  const displayName = profile?.name || fallbackUser.name;
  const displayHandle = profile?.handle ? `@${profile.handle}` : fallbackUser.username;
  const displayMemberSince = profile?.memberSince || fallbackUser.memberSince;
  
  const [activeTab, setActiveTab] = useState<TabType>("tickets");
  const [collectionFilter, setCollectionFilter] = useState<"all" | "handcraft" | "artworks">("all");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile?.avatarUrl || null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [showAvatarEditor, setShowAvatarEditor] = useState(false);
  const [showCoverEditor, setShowCoverEditor] = useState(false);

  const displayAvatar = avatarUrl || profile?.avatarUrl || fallbackUser.avatarImage;
  const displayCover = coverUrl || defaultCover;

  const tabs: { id: TabType; label: string; icon: typeof Ticket }[] = [
    { id: "tickets", label: "Tickets", icon: Ticket },
    { id: "vault", label: "Vault", icon: ShoppingBag },
  ];

  const filteredArt = collectionFilter === "all" 
    ? mockCollectedArt 
    : mockCollectedArt.filter(a => a.type === collectionFilter);

  const handleShare = () => {
    triggerClickHaptic();
    toast({ title: "Share Profile", description: "Link copied to clipboard!" });
  };

  return (
    <div className="min-h-screen bg-carbon">
      {/* Main Container */}
      <div className="max-w-screen-xl mx-auto lg:px-8">
        
        {/* Cover Photo - Full Width, Editable */}
        <div 
          className="relative h-48 sm:h-56 w-full overflow-hidden cursor-pointer group"
          onClick={() => setShowCoverEditor(true)}
        >
          <img
            src={displayCover}
            alt="Cover"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-carbon via-carbon/40 to-transparent" />
          
          {/* Cover edit overlay */}
          <div className="absolute inset-0 bg-carbon/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-carbon/80 backdrop-blur-sm border border-border/50">
              <Camera className="w-4 h-4 text-foreground" />
              <span className="text-sm text-foreground">Change Cover Photo</span>
            </div>
          </div>

          {/* Header Controls */}
          <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-10">
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={(e) => { e.stopPropagation(); onBack(); }}
              className="w-10 h-10 rounded-full bg-carbon/80 backdrop-blur-sm border border-border/50 flex items-center justify-center"
            >
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </motion.button>
            
            {/* Mode Switch (only for verified creators) */}
            {isVerifiedCreator && onSwitchMode && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={(e) => {
                  e.stopPropagation();
                  triggerClickHaptic();
                  onSwitchMode();
                }}
                className="px-4 py-2 rounded-full bg-carbon/80 backdrop-blur-sm border border-destructive/50 flex items-center gap-2"
              >
                <span className="text-xs text-destructive font-medium">Switch to Studio</span>
                <ChevronRight className="w-4 h-4 text-destructive" />
              </motion.button>
            )}
          </div>
        </div>

        {/* Profile Section - Avatar overlapping cover */}
        <div className="relative px-4 -mt-16">
          <div className="flex items-end gap-4">
            {/* Avatar - Editable */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="relative cursor-pointer group"
              onClick={() => setShowAvatarEditor(true)}
            >
              <div className="w-28 h-28 rounded-full border-4 border-carbon overflow-hidden bg-obsidian shadow-deep">
                <img
                  src={displayAvatar}
                  alt={displayName}
                  className="w-full h-full object-cover"
                />
              </div>
              {/* Avatar edit overlay */}
              <div className="absolute inset-0 rounded-full bg-carbon/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera className="w-6 h-6 text-foreground" />
              </div>
            </motion.div>
          </div>

          {/* Name & Handle */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mt-4"
          >
            <h1 className="font-display text-2xl text-foreground font-bold">{displayName}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">{displayHandle}</p>
          </motion.div>

          {/* Stats Row - Clean, grounded */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-sm text-muted-foreground mt-3"
          >
            {fallbackUser.eventsAttended} Attended · {mockCollectedArt.length} Collected
          </motion.p>

          {/* Action Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="flex items-center gap-3 mt-4"
          >
            <button
              onClick={() => {
                triggerClickHaptic();
                toast({ title: "Edit Profile", description: "Opening profile editor..." });
              }}
              className="px-5 py-2.5 rounded-full bg-surface-elevated border border-border/50 text-foreground text-sm font-medium flex items-center gap-2"
            >
              <Pencil className="w-4 h-4" />
              Edit Profile
            </button>
            <button
              onClick={handleShare}
              className="w-10 h-10 rounded-full bg-surface-elevated border border-border/50 flex items-center justify-center"
            >
              <Share2 className="w-4 h-4 text-foreground" />
            </button>
          </motion.div>

          {/* Badges / Passport Stamps */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex flex-wrap gap-2 mt-4"
          >
            {mockBadges.map((badge) => (
              <div 
                key={badge.id}
                className="px-3 py-1.5 rounded-full border flex items-center gap-1.5"
                style={{
                  background: badge.type === "special" 
                    ? "hsl(43 72% 52% / 0.15)"
                    : "hsl(var(--surface))",
                  borderColor: badge.type === "special" 
                    ? "hsl(43 72% 52% / 0.4)" 
                    : "hsl(var(--border) / 0.3)"
                }}
              >
                <Award className={`w-3.5 h-3.5 ${badge.type === "special" ? "text-gold" : "text-muted-foreground"}`} />
                <span className={`text-xs font-medium ${badge.type === "special" ? "text-gold" : "text-foreground"}`}>
                  {badge.title}
                </span>
              </div>
            ))}
          </motion.div>

          {/* Passport Line */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
            className="text-xs text-muted-foreground mt-4"
          >
            Collector's Passport · Since {displayMemberSince}
          </motion.p>
        </div>

        {/* Tabs */}
        <div className="border-b border-border/30 mt-6">
          <div className="flex max-w-2xl mx-auto lg:justify-center lg:gap-4 px-4">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  triggerClickHaptic();
                  setActiveTab(tab.id);
                }}
                className={`flex-1 min-w-[100px] lg:min-w-[140px] py-3 text-xs font-semibold relative transition-colors flex flex-col items-center gap-1 ${
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
                    className="absolute bottom-0 left-2 right-2 h-0.5 bg-destructive"
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
                              ? "bg-gradient-to-r from-electric to-crimson text-foreground"
                              : "bg-obsidian border border-border/50 text-muted-foreground"
                          }`}
                        >
                          {ticket.startsIn <= 15 ? (
                            "Enter Room"
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-destructive/20 text-destructive font-bold text-xs">
                              Opens in {ticket.startsIn}m
                            </span>
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
                          ? "bg-destructive text-foreground"
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

      {/* Image Editors */}
      <ProfileImageEditor
        isOpen={showAvatarEditor}
        onClose={() => setShowAvatarEditor(false)}
        type="avatar"
        currentImage={displayAvatar}
        onImageUpdated={setAvatarUrl}
      />
      <ProfileImageEditor
        isOpen={showCoverEditor}
        onClose={() => setShowCoverEditor(false)}
        type="cover"
        currentImage={displayCover}
        onImageUpdated={setCoverUrl}
      />
    </div>
  );
}
