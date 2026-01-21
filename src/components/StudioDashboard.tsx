import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, DollarSign, Ticket, Eye, EyeOff, BadgeCheck, ChevronRight, Share2, Pencil, Award, Zap, Calendar, Check, Clock } from "lucide-react";
import { triggerClickHaptic } from "@/lib/haptics";
import { EditProfileModal } from "./EditProfileModal";
import { UpcomingEventsList } from "./UpcomingEventsList";
import { PortfolioGrid } from "./PortfolioGrid";
import { FollowListModal } from "./FollowListModal";
import { ShareStudioModal } from "./ShareStudioModal";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMonthlyAnalytics } from "@/hooks/useMonthlyAnalytics";
import { useFollowStats } from "@/hooks/useFollowStats";
import featureFlags from "@/lib/featureFlags";
interface ScheduledEvent {
  id: string;
  title: string;
  cover_url: string | null;
  scheduled_at: string;
  is_free: boolean;
  price: number;
  creator_id: string;
  is_live: boolean | null;
  live_ended_at: string | null;
}
interface UserProfile {
  name: string;
  handle: string | null;
  avatarUrl: string | null;
  memberSince: string;
  bio?: string | null;
  website?: string | null;
  coverUrl?: string | null;
  isFoundingMember?: boolean;
  foundingNumber?: number | null;
}
interface StudioDashboardProps {
  onBack: () => void;
  onSwitchMode: () => void;
  onGoLive: () => void;
  onSchedule: () => void;
  refreshScheduleKey?: number;
  profile?: UserProfile | null;
}

// Fallback data for when profile is loading
const fallbackCreator = {
  name: "Creator",
  avatarImage: "",
  memberSince: "Dec 2024"
};
export function StudioDashboard({
  onBack,
  onSwitchMode,
  onGoLive,
  onSchedule,
  refreshScheduleKey,
  profile
}: StudioDashboardProps) {
  const navigate = useNavigate();
  const {
    user
  } = useAuth();
  const {
    analytics
  } = useMonthlyAnalytics(user?.id);
  const {
    stats: followStats
  } = useFollowStats(user?.id);
  const [showEarnings, setShowEarnings] = useState(true);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showFollowList, setShowFollowList] = useState<"followers" | "following" | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [localProfile, setLocalProfile] = useState(profile);
  const [upcomingEvents, setUpcomingEvents] = useState<ScheduledEvent[]>([]);

  // Dev-only schedule debug logging (enable via: localStorage.setItem('debug_schedule','1'))
  const DEBUG_SCHEDULE = import.meta.env.DEV && localStorage.getItem("debug_schedule") === "1";

  // Fetch upcoming events for Creator Profile "My Studio Schedule"
  // IMPORTANT: keep filters consistent with Home's Studio Schedule for scheduled sessions,
  // but also include currently live sessions.
  const fetchUpcomingEvents = useCallback(async () => {
    if (!user) return;

    const nowIso = new Date().toISOString();

    // Same canonical field as Home: scheduled_at (UTC ISO)
    // Include:
    // - scheduled sessions: scheduled_at > now AND is_live = false
    // - live sessions: is_live = true
    // No upper-bound cutoff (supports months ahead)
    const { data, error } = await supabase
      .from("events")
      .select(
        "id, title, cover_url, scheduled_at, is_free, price, creator_id, is_live, live_ended_at"
      )
      .eq("creator_id", user.id)
      .or(`and(is_live.eq.false,scheduled_at.gt.${nowIso}),is_live.eq.true`)
      .order("scheduled_at", { ascending: true });
    
    if (error) {
      console.error("[StudioDashboard] Error fetching creator schedule:", error);
      return;
    }

    const events = (data || []) as ScheduledEvent[];

    if (DEBUG_SCHEDULE) {
      const sample = events.slice(0, 5).map((e) => ({
        id: e.id,
        scheduled_at: e.scheduled_at,
        creator_id: e.creator_id,
        is_live: e.is_live,
        live_ended_at: e.live_ended_at,
      }));

      console.log("[ScheduleDebug][CreatorProfile] params", {
        creator_id: user.id,
        nowIso,
        filter:
          "creator_id = user.id AND ((is_live=false AND scheduled_at>now) OR is_live=true)",
      });
      console.log("[ScheduleDebug][CreatorProfile] returned", {
        count: events.length,
        sample,
      });
    }

    setUpcomingEvents(events);
  }, [user]);

  // Fetch events on mount and when refreshScheduleKey changes
  useEffect(() => {
    fetchUpcomingEvents();
  }, [fetchUpcomingEvents, refreshScheduleKey]);
  useEffect(() => {
    setLocalProfile(profile);
  }, [profile]);

  // Fetch updated profile data
  const refreshProfile = async () => {
    if (!user) return;
    const {
      data
    } = await supabase.from("profiles").select("name, handle, avatar_url, created_at, bio, website, cover_url, is_founding_member, founding_number").eq("user_id", user.id).maybeSingle();
    if (data) {
      const createdDate = new Date(data.created_at);
      const memberSince = createdDate.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric"
      });
      setLocalProfile({
        name: data.name,
        handle: data.handle,
        avatarUrl: data.avatar_url,
        memberSince,
        bio: data.bio,
        website: data.website,
        coverUrl: data.cover_url,
        isFoundingMember: data.is_founding_member ?? false,
        foundingNumber: data.founding_number
      });
    }
  };

  // Use real profile data or fallback
  const displayName = localProfile?.name || fallbackCreator.name;
  const displayHandle = localProfile?.handle ? `@${localProfile.handle}` : "";
  const displayMemberSince = localProfile?.memberSince || fallbackCreator.memberSince;
  const displayAvatar = localProfile?.avatarUrl;
  const displayCover = localProfile?.coverUrl;
  const displayBio = localProfile?.bio;
  const handleScheduleClick = () => {
    triggerClickHaptic();
    onSchedule();
  };
  const handleShare = () => {
    triggerClickHaptic();
    setShowShareModal(true);
  };
  return <div className="min-h-screen bg-carbon">
      {/* Main Container - matches Audience profile layout */}
      <div className="max-w-screen-xl mx-auto lg:px-8">
      {/* Cover Photo - Full Width (NOT clickable - edit through Edit Profile) */}
      <div className="relative h-48 sm:h-56 w-full overflow-hidden">
        {displayCover ? <img src={displayCover} alt="Cover" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gradient-to-br from-obsidian via-carbon to-obsidian" />}
        

        {/* Header Controls */}
        <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-10">
          <motion.button initial={{
          opacity: 0
        }} animate={{
          opacity: 1
        }} onClick={e => {
          e.stopPropagation();
          onBack();
        }} className="w-10 h-10 rounded-full bg-carbon/80 backdrop-blur-sm border border-border/50 flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </motion.button>
          
          {/* Mode Switch - Subtle toggle, not a primary CTA */}
          <motion.button initial={{
          opacity: 0
        }} animate={{
          opacity: 1
        }} onClick={e => {
          e.stopPropagation();
          triggerClickHaptic();
          onSwitchMode();
        }} className="px-4 py-2 rounded-full bg-carbon/80 backdrop-blur-sm border border-border/50 flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium">Switch to Buying</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </motion.button>
        </div>
      </div>

      {/* Profile Section - Avatar overlapping cover (matches Audience) */}
      <div className="relative px-4 -mt-16">
        <div className="flex items-end gap-4">
          {/* Avatar (NOT clickable - edit through Edit Profile) */}
          <motion.div initial={{
          scale: 0.8,
          opacity: 0
        }} animate={{
          scale: 1,
          opacity: 1
        }} transition={{
          delay: 0.1
        }} className="relative">
            <div className="w-28 h-28 rounded-full border-4 border-carbon overflow-hidden bg-obsidian shadow-deep">
              {displayAvatar ? <img src={displayAvatar} alt={displayName} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-3xl font-display text-muted-foreground">
                  {displayName.charAt(0).toUpperCase()}
                </div>}
            </div>
            {/* Verified badge - Premium gold circle */}
            <div 
              className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, #F59E0B 0%, #B45309 100%)",
                border: "2px solid #000000",
                boxShadow: "0 2px 8px rgba(245, 158, 11, 0.3)"
              }}
            >
              <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
            </div>
          </motion.div>
        </div>

        {/* Name & Handle & Bio */}
        <motion.div initial={{
        opacity: 0,
        y: 10
      }} animate={{
        opacity: 1,
        y: 0
      }} transition={{
        delay: 0.15
      }} className="mt-4">
          <h1 className="font-display text-2xl text-foreground font-bold">{displayName}</h1>
          {displayHandle && <p className="text-muted-foreground text-sm mt-0.5">{displayHandle}</p>}
          {displayBio && <p className="text-foreground/80 text-sm mt-2">{displayBio}</p>}
        </motion.div>

        {/* Stats Row - Following/Followers (replacing Sessions) */}
        <motion.div initial={{
        opacity: 0,
        y: 10
      }} animate={{
        opacity: 1,
        y: 0
      }} transition={{
        delay: 0.2
      }} className="text-sm text-muted-foreground mt-3">
          <button onClick={() => {
          triggerClickHaptic();
          setShowFollowList("following");
        }} className="hover:underline">
            <span className="text-foreground font-medium">{followStats.followingCount}</span> Following
          </button>
          {" · "}
          <button onClick={() => {
          triggerClickHaptic();
          setShowFollowList("followers");
        }} className="hover:underline">
            <span className="text-foreground font-medium">{followStats.followersCount}</span> Followers
          </button>
        </motion.div>

        {/* Action Buttons (matches Audience) */}
        <motion.div initial={{
        opacity: 0,
        y: 10
      }} animate={{
        opacity: 1,
        y: 0
      }} transition={{
        delay: 0.25
      }} className="flex items-center gap-3 mt-4">
          <button onClick={() => {
          triggerClickHaptic();
          setShowEditProfile(true);
        }} className="px-5 py-2.5 rounded-full bg-muted/50 border border-border/40 text-muted-foreground text-sm font-medium flex items-center gap-2 hover:bg-muted/70 transition-colors">
            <Pencil className="w-4 h-4" />
            Edit Profile
          </button>
          <button onClick={handleShare} className="w-10 h-10 rounded-full bg-muted/50 border border-border/40 flex items-center justify-center hover:bg-muted/70 transition-colors">
            <Share2 className="w-4 h-4 text-muted-foreground" />
          </button>
        </motion.div>

        {/* Badges Row */}
        <motion.div initial={{
        opacity: 0
      }} animate={{
        opacity: 1
      }} transition={{
        delay: 0.3
      }} className="flex flex-wrap gap-2 mt-4">
          {/* Founding Member Badge */}
          {localProfile?.isFoundingMember && <div className="px-3 py-1.5 rounded-full border-2 flex items-center gap-1.5 shadow-gold" style={{
          background: "linear-gradient(135deg, hsl(43 72% 52% / 0.15), hsl(38 80% 45% / 0.1))",
          borderColor: "hsl(43 72% 52% / 0.6)"
        }}>
              <Award className="w-3.5 h-3.5 text-gold" />
              <span className="text-xs font-semibold text-gold">
                Founding Member {localProfile.foundingNumber ? `#${localProfile.foundingNumber}` : ""}
              </span>
            </div>}
        </motion.div>

        {/* Passport Line */}
        <motion.p initial={{
        opacity: 0
      }} animate={{
        opacity: 1
      }} transition={{
        delay: 0.35
      }} className="text-xs text-muted-foreground mt-4">
          Creator's Passport · Since {displayMemberSince}
        </motion.p>
      </div>

      {/* Studio Action Buttons - Split CTA */}
      <div className="px-4 mt-6 flex gap-3">
        {/* Open Studio - Immediate (60%) */}
        <motion.button 
          whileTap={{ scale: 0.98 }} 
          onClick={() => {
            triggerClickHaptic();
            onGoLive();
          }} 
          className="flex-[3] flex items-center justify-center gap-2 py-4 rounded-2xl text-white font-semibold shadow-electric"
          style={{
            background: "linear-gradient(135deg, hsl(7 100% 67%), hsl(345 100% 50%))"
          }}
        >
          <Zap className="w-5 h-5" />
          <span className="text-sm">Open Studio</span>
        </motion.button>
        
        {/* Schedule - Future (40%) */}
        <motion.button 
          whileTap={{ scale: 0.98 }} 
          onClick={handleScheduleClick} 
          className="flex-[2] flex items-center justify-center gap-2 py-4 rounded-2xl bg-obsidian border border-border/60 text-foreground font-semibold hover:bg-muted/50 transition-colors"
        >
          <Calendar className="w-5 h-5 text-muted-foreground" />
          <span className="text-sm">Schedule</span>
        </motion.button>
      </div>

      {/* Studio Schedule */}
      <UpcomingEventsList events={upcomingEvents} onEventDeleted={fetchUpcomingEvents} />

      {/* Business Bar - Analytics Cards */}
      <div className="px-4 mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg text-foreground">Analytics</h2>
          <button onClick={() => {
          triggerClickHaptic();
          setShowEarnings(!showEarnings);
        }} className="p-2">
            {showEarnings ? <Eye className="w-4 h-4 text-muted-foreground" /> : <EyeOff className="w-4 h-4 text-muted-foreground" />}
          </button>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          {/* Earnings - 50% width - Clickable → navigates to /earnings-history */}
          {featureFlags.paymentsEnabled ? (
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                triggerClickHaptic();
                navigate("/earnings-history");
              }}
              className="bg-obsidian rounded-2xl p-5 border border-border/30 text-left hover:border-gold/30 transition-colors"
            >
              <div className="flex items-center gap-2 mb-3">
                <DollarSign className="w-5 h-5 text-gold" />
                <span className="text-sm text-muted-foreground">This Month</span>
              </div>
              <p className="font-display text-3xl text-gold">
                {showEarnings ? `$${analytics.totalEarnings.toLocaleString()}` : "••••"}
              </p>
            </motion.button>
          ) : (
            <div className="bg-obsidian rounded-2xl p-5 border border-border/30 text-left">
              <div className="flex items-center gap-2 mb-3">
                <DollarSign className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Earnings</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Coming soon</p>
              </div>
            </div>
          )}
          
          {/* Tickets Sold - 50% width - Clickable → navigates to /tickets-history */}
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              triggerClickHaptic();
              navigate("/tickets-history");
            }}
            className="bg-obsidian rounded-2xl p-5 border border-border/30 text-left hover:border-electric/30 transition-colors"
          >
            <div className="flex items-center gap-2 mb-3">
              <Ticket className="w-5 h-5 text-electric" />
              <span className="text-sm text-muted-foreground">Tickets</span>
            </div>
            <p className="font-display text-3xl text-foreground">
              {analytics.totalTickets}
            </p>
          </motion.button>
        </div>
      </div>

      {/* Portfolio Section */}
      <div className="mt-6 px-4 pb-24">
        <PortfolioGrid userId={user?.id} isOwner={true} />
      </div>

      {/* Edit Profile Modal */}
      <EditProfileModal isOpen={showEditProfile} onClose={() => setShowEditProfile(false)} profile={localProfile} onProfileUpdated={refreshProfile} />


      {/* Follow List Modal */}
      {user && <FollowListModal isOpen={showFollowList !== null} onClose={() => setShowFollowList(null)} userId={user.id} type={showFollowList || "followers"} />}

      {/* Share Studio Modal */}
      <ShareStudioModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        handle={localProfile?.handle || null}
        userId={user?.id}
        creatorName={localProfile?.name}
      />

      </div>
    </div>;
}