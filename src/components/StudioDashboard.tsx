import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, 
  Video, 
  Calendar, 
  Upload,
  DollarSign,
  Ticket,
  TrendingUp,
  Users,
  Eye,
  EyeOff,
  Play,
  Image,
  ShoppingBag,
  MoreHorizontal,
  BadgeCheck,
  ChevronRight,
  Camera,
  Share2,
  Pencil,
  Award
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

interface StudioDashboardProps {
  onBack: () => void;
  onSwitchMode: () => void;
  onGoLive: () => void;
  profile?: UserProfile | null;
}

// Fallback data for when profile is loading
const fallbackCreator = {
  name: "Creator",
  avatarImage: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80",
  memberSince: "Dec 2024",
  followers: 128,
  sessionsHosted: 24,
};

const mockBadges = [
  { id: "1", title: "Verified Creator", type: "special" },
  { id: "2", title: "Top Seller", type: "event" },
];

const mockAnalytics = {
  earnings: 2450,
  ticketsSold: 47,
  followerGrowth: 12,
  conversionRate: 8.5,
};

const mockReplays = [
  { id: "1", title: "Portrait Masterclass", views: 234, date: "Dec 15", thumbnail: "https://images.unsplash.com/photo-1578926375605-eaf7559b1458?w=400&q=80" },
  { id: "2", title: "Pencil Techniques", views: 189, date: "Dec 10", thumbnail: "https://images.unsplash.com/photo-1544967082-d9d25d867d66?w=400&q=80" },
];

const mockFinishedWork = [
  { id: "1", image: "https://images.unsplash.com/photo-1578926375605-eaf7559b1458?w=400&q=80", title: "Portrait Study I", price: 150 },
  { id: "2", image: "https://images.unsplash.com/photo-1544967082-d9d25d867d66?w=400&q=80", title: "Eyes of Wonder", price: 200 },
  { id: "3", image: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=400&q=80", title: "Charcoal Dreams", price: 175 },
];

const mockInventory = [
  { id: "1", name: "Signed Print #1", stock: 5, price: 45 },
  { id: "2", name: "Original Sketch", stock: 1, price: 350 },
];

type PortfolioTab = "replays" | "finished" | "shop";

export function StudioDashboard({ onBack, onSwitchMode, onGoLive, profile }: StudioDashboardProps) {
  const [showEarnings, setShowEarnings] = useState(true);
  const [portfolioTab, setPortfolioTab] = useState<PortfolioTab>("replays");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile?.avatarUrl || null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [showAvatarEditor, setShowAvatarEditor] = useState(false);
  const [showCoverEditor, setShowCoverEditor] = useState(false);
  
  // Use real profile data or fallback
  const displayName = profile?.name || fallbackCreator.name;
  const displayHandle = profile?.handle ? `@${profile.handle}` : "";
  const displayMemberSince = profile?.memberSince || fallbackCreator.memberSince;
  const displayAvatar = avatarUrl || profile?.avatarUrl || fallbackCreator.avatarImage;
  const displayCover = coverUrl || defaultCover;

  const portfolioTabs: { id: PortfolioTab; label: string; icon: typeof Play }[] = [
    { id: "replays", label: "Replays", icon: Play },
    { id: "finished", label: "Work", icon: Image },
    { id: "shop", label: "Shop", icon: ShoppingBag },
  ];

  const handleAction = (action: string) => {
    triggerClickHaptic();
    if (action === "live") {
      onGoLive();
    } else {
      toast({
        title: action === "schedule" ? "Schedule Event" : "Upload Content",
        description: "Opening " + action + " flow...",
      });
    }
  };

  const handleShare = () => {
    triggerClickHaptic();
    toast({ title: "Share Profile", description: "Link copied to clipboard!" });
  };

  return (
    <div className="min-h-screen bg-carbon">
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
          
          {/* Mode Switch */}
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
            <span className="text-xs text-destructive font-medium">Switch to Buying</span>
            <ChevronRight className="w-4 h-4 text-destructive" />
          </motion.button>
        </div>
      </div>

      {/* Profile Section - Avatar overlapping cover (matches Audience) */}
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
            {/* Verified badge */}
            <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-destructive flex items-center justify-center">
              <BadgeCheck className="w-5 h-5 text-foreground" />
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
          {displayHandle && <p className="text-muted-foreground text-sm mt-0.5">{displayHandle}</p>}
        </motion.div>

        {/* Stats Row - Clean, grounded (matches Audience style) */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-sm text-muted-foreground mt-3"
        >
          {fallbackCreator.sessionsHosted} Sessions · {fallbackCreator.followers} Followers
        </motion.p>

        {/* Action Buttons (matches Audience) */}
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

        {/* Badges / Passport Stamps (matches Audience) */}
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
          Creator's Passport · Since {displayMemberSince}
        </motion.p>
      </div>

      {/* Action Center - Big Buttons */}
      <div className="px-4 mt-6">
        <div className="grid grid-cols-3 gap-3">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => handleAction("live")}
            className="flex flex-col items-center justify-center gap-2 py-5 rounded-2xl bg-gradient-to-br from-electric to-crimson"
          >
            <Video className="w-7 h-7 text-foreground" />
            <span className="text-xs font-semibold text-foreground">GO LIVE</span>
          </motion.button>
          
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => handleAction("schedule")}
            className="flex flex-col items-center justify-center gap-2 py-5 rounded-2xl bg-obsidian border border-border/50"
          >
            <Calendar className="w-7 h-7 text-electric" />
            <span className="text-xs font-semibold text-foreground">SCHEDULE</span>
          </motion.button>
          
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => handleAction("upload")}
            className="flex flex-col items-center justify-center gap-2 py-5 rounded-2xl bg-obsidian border border-border/50"
          >
            <Upload className="w-7 h-7 text-electric" />
            <span className="text-xs font-semibold text-foreground">UPLOAD</span>
          </motion.button>
        </div>
      </div>

      {/* Business Bar - Analytics Cards */}
      <div className="px-4 mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg text-foreground">Analytics</h2>
          <button 
            onClick={() => {
              triggerClickHaptic();
              setShowEarnings(!showEarnings);
            }}
            className="p-2"
          >
            {showEarnings ? (
              <Eye className="w-4 h-4 text-muted-foreground" />
            ) : (
              <EyeOff className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          {/* Earnings */}
          <div className="bg-obsidian rounded-2xl p-4 border border-border/30">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-gold" />
              <span className="text-xs text-muted-foreground">This Month</span>
            </div>
            <p className="font-display text-2xl text-gold">
              {showEarnings ? `$${mockAnalytics.earnings.toLocaleString()}` : "••••"}
            </p>
          </div>
          
          {/* Tickets Sold */}
          <div className="bg-obsidian rounded-2xl p-4 border border-border/30">
            <div className="flex items-center gap-2 mb-2">
              <Ticket className="w-4 h-4 text-electric" />
              <span className="text-xs text-muted-foreground">Tickets</span>
            </div>
            <p className="font-display text-2xl text-foreground">
              {mockAnalytics.ticketsSold}
            </p>
          </div>
          
          {/* Follower Growth */}
          <div className="bg-obsidian rounded-2xl p-4 border border-border/30">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-electric" />
              <span className="text-xs text-muted-foreground">Growth</span>
            </div>
            <p className="font-display text-2xl text-foreground">
              +{mockAnalytics.followerGrowth}%
            </p>
          </div>
          
          {/* Conversion */}
          <div className="bg-obsidian rounded-2xl p-4 border border-border/30">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-electric" />
              <span className="text-xs text-muted-foreground">Conversion</span>
            </div>
            <p className="font-display text-2xl text-foreground">
              {mockAnalytics.conversionRate}%
            </p>
          </div>
        </div>
      </div>

      {/* Portfolio Manager */}
      <div className="mt-6">
        <div className="px-4 mb-3">
          <h2 className="font-display text-lg text-foreground">Portfolio Manager</h2>
        </div>
        
        {/* Tabs */}
        <div className="flex gap-2 px-4 mb-4">
          {portfolioTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                triggerClickHaptic();
                setPortfolioTab(tab.id);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                portfolioTab === tab.id
                  ? "bg-destructive text-foreground"
                  : "bg-obsidian text-muted-foreground border border-border/50"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="px-4 pb-24">
          <AnimatePresence mode="wait">
            {/* Replays */}
            {portfolioTab === "replays" && (
              <motion.div
                key="replays"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-3"
              >
                {mockReplays.map((replay) => (
                  <div 
                    key={replay.id}
                    className="flex gap-3 bg-obsidian rounded-xl p-3 border border-border/30"
                  >
                    <div className="w-24 h-16 rounded-lg overflow-hidden relative">
                      <img 
                        src={replay.thumbnail}
                        alt={replay.title}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-carbon/50">
                        <Play className="w-6 h-6 text-foreground" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-foreground text-sm">{replay.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {replay.views} views • {replay.date}
                      </p>
                    </div>
                    <button className="p-2">
                      <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>
                ))}
              </motion.div>
            )}

            {/* Finished Work */}
            {portfolioTab === "finished" && (
              <motion.div
                key="finished"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid grid-cols-3 gap-2"
              >
                {mockFinishedWork.map((work) => (
                  <div 
                    key={work.id}
                    className="aspect-square rounded-xl overflow-hidden relative group"
                  >
                    <img 
                      src={work.image}
                      alt={work.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-carbon/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                      <div>
                        <p className="text-xs text-foreground font-medium line-clamp-1">{work.title}</p>
                        <p className="text-xs text-gold">${work.price}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}

            {/* Shop Inventory */}
            {portfolioTab === "shop" && (
              <motion.div
                key="shop"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-3"
              >
                {mockInventory.map((item) => (
                  <div 
                    key={item.id}
                    className="flex justify-between items-center bg-obsidian rounded-xl p-4 border border-border/30"
                  >
                    <div>
                      <p className="font-medium text-foreground">{item.name}</p>
                      <p className="text-sm text-muted-foreground">{item.stock} in stock</p>
                    </div>
                    <p className="font-display text-gold">${item.price}</p>
                  </div>
                ))}
                <button 
                  onClick={() => toast({ title: "Add Product", description: "Opening product form..." })}
                  className="w-full py-4 rounded-xl border-2 border-dashed border-border/50 text-muted-foreground text-sm flex items-center justify-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  Add New Product
                </button>
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
