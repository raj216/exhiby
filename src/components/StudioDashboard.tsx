import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { 
  ArrowLeft, 
  DollarSign,
  Ticket,
  Eye,
  EyeOff,
  BadgeCheck,
  ChevronRight,
  Share2,
  Pencil,
  Award,
  ImageIcon
} from "lucide-react";
import { triggerClickHaptic } from "@/lib/haptics";
import { toast } from "@/hooks/use-toast";
import { EditProfileModal } from "./EditProfileModal";
import { ScheduleEventModal } from "./ScheduleEventModal";
import { UpcomingEventsList } from "./UpcomingEventsList";
import { PortfolioGrid } from "./PortfolioGrid";
import { FollowListModal } from "./FollowListModal";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCreatorStats } from "@/hooks/useCreatorStats";
import { useFollowStats } from "@/hooks/useFollowStats";
import defaultCover from "@/assets/default-cover.jpg";

interface ScheduledEvent {
  id: string;
  title: string;
  cover_url: string | null;
  scheduled_at: string;
  is_free: boolean;
  price: number;
  creator_id: string;
}

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

interface StudioDashboardProps {
  onBack: () => void;
  onSwitchMode: () => void;
  onGoLive: () => void;
  profile?: UserProfile | null;
}

// Fallback data for when profile is loading
const fallbackCreator = {
  name: "Creator",
  avatarImage: "",
  memberSince: "Dec 2024",
};

export function StudioDashboard({ onBack, onSwitchMode, onGoLive, profile }: StudioDashboardProps) {
  const { user } = useAuth();
  const { stats } = useCreatorStats(user?.id);
  const { stats: followStats } = useFollowStats(user?.id);
  const [showEarnings, setShowEarnings] = useState(true);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showFollowList, setShowFollowList] = useState<"followers" | "following" | null>(null);
  const [localProfile, setLocalProfile] = useState(profile);
  const [upcomingEvents, setUpcomingEvents] = useState<ScheduledEvent[]>([]);
  
  // Fetch upcoming events
  const fetchUpcomingEvents = useCallback(async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('events')
      .select('id, title, cover_url, scheduled_at, is_free, price, creator_id')
      .eq('creator_id', user.id)
      .gte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true });

    if (!error && data) {
      setUpcomingEvents(data);
    }
  }, [user]);

  // Fetch events on mount
  useEffect(() => {
    fetchUpcomingEvents();
  }, [fetchUpcomingEvents]);
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
  const displayName = localProfile?.name || fallbackCreator.name;
  const displayHandle = localProfile?.handle ? `@${localProfile.handle}` : "";
  const displayMemberSince = localProfile?.memberSince || fallbackCreator.memberSince;
  const displayAvatar = localProfile?.avatarUrl || fallbackCreator.avatarImage;
  const displayCover = localProfile?.coverUrl || defaultCover;
  const displayBio = localProfile?.bio;


  const handleScheduleClick = () => {
    triggerClickHaptic();
    setShowScheduleModal(true);
  };

  const handleShare = () => {
    triggerClickHaptic();
    toast({ title: "Share Profile", description: "Link copied to clipboard!" });
  };

  return (
    <div className="min-h-screen bg-carbon">
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
            {/* Verified badge */}
            <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-destructive flex items-center justify-center">
              <BadgeCheck className="w-5 h-5 text-foreground" />
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
          {displayHandle && <p className="text-muted-foreground text-sm mt-0.5">{displayHandle}</p>}
          {displayBio && (
            <p className="text-foreground/80 text-sm mt-2">{displayBio}</p>
          )}
        </motion.div>

        {/* Stats Row - Following/Followers (replacing Sessions) */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-sm text-muted-foreground mt-3"
        >
          <button 
            onClick={() => { triggerClickHaptic(); setShowFollowList("following"); }}
            className="hover:underline"
          >
            <span className="text-foreground font-medium">{followStats.followingCount}</span> Following
          </button>
          {" · "}
          <button 
            onClick={() => { triggerClickHaptic(); setShowFollowList("followers"); }}
            className="hover:underline"
          >
            <span className="text-foreground font-medium">{followStats.followersCount}</span> Followers
          </button>
        </motion.div>

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

        {/* Verified Creator Badge */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex flex-wrap gap-2 mt-4"
        >
          <div 
            className="px-3 py-1.5 rounded-full border flex items-center gap-1.5"
            style={{
              background: "hsl(43 72% 52% / 0.15)",
              borderColor: "hsl(43 72% 52% / 0.4)"
            }}
          >
            <Award className="w-3.5 h-3.5 text-gold" />
            <span className="text-xs font-medium text-gold">
              Verified Creator
            </span>
          </div>
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

      {/* Schedule Event Button - Glass Morphism */}
      <div className="px-4 mt-6">
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={handleScheduleClick}
          className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-obsidian/80 backdrop-blur-md border border-border/30 shadow-deep"
        >
          <span className="text-lg">📅</span>
          <span className="text-sm font-semibold text-foreground">Schedule Upcoming Event</span>
        </motion.button>
      </div>

      {/* Upcoming Events List */}
      <UpcomingEventsList 
        events={upcomingEvents} 
        onEventDeleted={fetchUpcomingEvents} 
      />

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
        
        <div className="grid grid-cols-2 gap-4">
          {/* Earnings - 50% width */}
          <div className="bg-obsidian rounded-2xl p-5 border border-border/30">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="w-5 h-5 text-gold" />
              <span className="text-sm text-muted-foreground">This Month</span>
            </div>
            <p className="font-display text-3xl text-gold">
              {showEarnings ? `$${stats.earnings.toLocaleString()}` : "••••"}
            </p>
          </div>
          
          {/* Tickets Sold - 50% width */}
          <div className="bg-obsidian rounded-2xl p-5 border border-border/30">
            <div className="flex items-center gap-2 mb-3">
              <Ticket className="w-5 h-5 text-electric" />
              <span className="text-sm text-muted-foreground">Tickets</span>
            </div>
            <p className="font-display text-3xl text-foreground">
              {stats.ticketsSold}
            </p>
          </div>
        </div>
      </div>

      {/* Portfolio Section - Empty state until artworks table exists */}
      <div className="mt-6 px-4 pb-24">
        <h2 className="font-display text-lg text-foreground mb-4">Portfolio</h2>
        <div className="flex flex-col items-center justify-center py-12 bg-obsidian rounded-2xl border border-border/30">
          <ImageIcon className="w-12 h-12 text-muted-foreground mb-3" />
          <p className="text-muted-foreground mb-4">No artwork yet</p>
          <button
            onClick={() => toast({ title: "Coming Soon", description: "Portfolio uploads will be available soon!" })}
            className="px-4 py-2 rounded-full bg-surface-elevated border border-border/50 text-foreground text-sm font-medium flex items-center gap-2"
          >
            <Pencil className="w-4 h-4" />
            Add Art
          </button>
        </div>
      </div>

      {/* Edit Profile Modal */}
      <EditProfileModal
        isOpen={showEditProfile}
        onClose={() => setShowEditProfile(false)}
        profile={localProfile}
        onProfileUpdated={refreshProfile}
      />

      {/* Schedule Event Modal */}
      <ScheduleEventModal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        onEventCreated={fetchUpcomingEvents}
      />

      {/* Follow List Modal */}
      {user && (
        <FollowListModal
          isOpen={showFollowList !== null}
          onClose={() => setShowFollowList(null)}
          userId={user.id}
          type={showFollowList || "followers"}
        />
      )}
    </div>
  );
}
