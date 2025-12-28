import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, 
  Image as ImageIcon, 
  Award, 
  ShoppingBag,
  Ticket,
  ChevronRight,
  Share2,
  Pencil
} from "lucide-react";
import { triggerClickHaptic } from "@/lib/haptics";
import { toast } from "@/hooks/use-toast";
import { EditProfileModal } from "./EditProfileModal";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAudienceStats } from "@/hooks/useAudienceStats";
import defaultCover from "@/assets/default-cover.jpg";

interface UserProfile {
  name: string;
  handle: string | null;
  avatarUrl: string | null;
  email: string;
  memberSince: string;
  bio?: string | null;
  website?: string | null;
  coverUrl?: string | null;
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
  avatarImage: "",
  memberSince: "Dec 2024",
};

// Founding Member badge shown for early adopters (first month / first 1000 users)
const isFoundingMember = true; // MVP: Display for all current users

type TabType = "tickets" | "collection";

export function AudienceProfile({ 
  onBack, 
  onSwitchMode, 
  isVerifiedCreator = false,
  onOpenStudio,
  profile
}: AudienceProfileProps) {
  const { user } = useAuth();
  const { stats } = useAudienceStats(user?.id);
  const [localProfile, setLocalProfile] = useState(profile);
  const [showEditProfile, setShowEditProfile] = useState(false);
  
  // Sync local profile with prop changes
  useEffect(() => {
    setLocalProfile(profile);
  }, [profile]);

  // Fetch updated profile data
  const refreshProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("name, handle, avatar_url, email, created_at, bio, website, cover_url")
      .eq("user_id", user.id)
      .maybeSingle();
    
    if (data) {
      const createdDate = new Date(data.created_at);
      const memberSince = createdDate.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      });
      setLocalProfile({
        name: data.name,
        handle: data.handle,
        avatarUrl: data.avatar_url,
        email: data.email,
        memberSince,
        bio: data.bio,
        website: data.website,
        coverUrl: data.cover_url,
      });
    }
  };

  // Use real profile data or fallback
  const displayName = localProfile?.name || fallbackUser.name;
  const displayHandle = localProfile?.handle ? `@${localProfile.handle}` : fallbackUser.username;
  const displayMemberSince = localProfile?.memberSince || fallbackUser.memberSince;
  const displayBio = localProfile?.bio;
  
  const [activeTab, setActiveTab] = useState<TabType>("tickets");
  

  const displayAvatar = localProfile?.avatarUrl || fallbackUser.avatarImage;
  const displayCover = localProfile?.coverUrl || defaultCover;

  const tabs: { id: TabType; label: string; icon: typeof Ticket }[] = [
    { id: "tickets", label: "Tickets", icon: Ticket },
    { id: "collection", label: "Collection", icon: ShoppingBag },
  ];


  const handleShare = () => {
    triggerClickHaptic();
    toast({ title: "Share Profile", description: "Link copied to clipboard!" });
  };

  return (
    <div className="min-h-screen bg-carbon">
      {/* Main Container */}
      <div className="max-w-screen-xl mx-auto lg:px-8">
        
        {/* Cover Photo - Full Width (NOT clickable - edit through Edit Profile) */}
        <div className="relative h-48 sm:h-56 w-full overflow-hidden">
          <img
            src={displayCover}
            alt="Cover"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-carbon via-carbon/40 to-transparent" />

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
            {/* Avatar (NOT clickable - edit through Edit Profile) */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="relative"
            >
              <div className="w-28 h-28 rounded-full border-4 border-carbon overflow-hidden bg-obsidian shadow-deep">
                <img
                  src={displayAvatar}
                  alt={displayName}
                  className="w-full h-full object-cover"
                />
              </div>
            </motion.div>
          </div>

          {/* Name & Handle & Bio */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mt-4"
          >
            <h1 className="font-display text-2xl text-foreground font-bold">{displayName}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">{displayHandle}</p>
            {displayBio && (
              <p className="text-foreground/80 text-sm mt-2">{displayBio}</p>
            )}
          </motion.div>

          {/* Stats Row - Real data from database */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-sm text-muted-foreground mt-3"
          >
            {stats.eventsAttended} Attended · {stats.itemsCollected} Collected
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
                setShowEditProfile(true);
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

          {/* Founding Member Badge - Centered, Premium */}
          {isFoundingMember && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className="flex justify-center mt-5"
            >
              <div 
                className="px-4 py-2 rounded-full border-2 flex items-center gap-2 shadow-gold"
                style={{
                  background: "linear-gradient(135deg, hsl(43 72% 52% / 0.15), hsl(38 80% 45% / 0.1))",
                  borderColor: "hsl(43 72% 52% / 0.6)"
                }}
              >
                <Award className="w-4 h-4 text-gold" />
                <span className="text-sm font-semibold text-gold">
                  Founding Member
                </span>
              </div>
            </motion.div>
          )}

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
                {/* Upcoming Access - Empty state until tickets table exists */}
                <h3 className="font-display text-lg text-foreground mb-4">Upcoming Access</h3>
                <div className="flex flex-col items-center justify-center py-12 bg-obsidian rounded-2xl border border-border/30">
                  <Ticket className="w-12 h-12 text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No tickets yet</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Book a session to get your first ticket</p>
                </div>

                {/* Past Events - Empty state until purchase history exists */}
                <h3 className="font-display text-lg text-foreground mt-8 mb-4">Past Events</h3>
                <div className="flex flex-col items-center justify-center py-8 bg-obsidian/50 rounded-2xl border border-border/20">
                  <p className="text-muted-foreground/60 text-sm">No past events</p>
                </div>
              </motion.div>
            )}

            {/* Collection Tab - Empty state until collections table exists */}
            {activeTab === "collection" && (
              <motion.div
                key="collection"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-4"
              >
                <div className="flex flex-col items-center justify-center py-12 bg-obsidian rounded-2xl border border-border/30">
                  <ImageIcon className="w-12 h-12 text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No items collected yet</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Purchase art to build your collection</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Edit Profile Modal */}
      <EditProfileModal
        isOpen={showEditProfile}
        onClose={() => setShowEditProfile(false)}
        profile={localProfile}
        onProfileUpdated={refreshProfile}
      />
    </div>
  );
}
