import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, DollarSign, Ticket, Eye, EyeOff, BadgeCheck, ChevronRight, Pencil, Award, Zap, Calendar, Check, Clock, Share, Star, TrendingUp, Users, BarChart3, RefreshCw, Lock } from "lucide-react";
import { triggerClickHaptic } from "@/lib/haptics";
import { EditProfileModal } from "./EditProfileModal";
import type { ProfileLink } from "./EditProfileModal";
import { ProfileLinks } from "./ProfileLinks";
import { UpcomingEventsList } from "./UpcomingEventsList";
import { PortfolioGrid } from "./PortfolioGrid";
import { FollowListModal } from "./FollowListModal";
import { ShareStudioModal } from "./ShareStudioModal";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCreatorEarnings } from "@/hooks/useCreatorEarnings";
import { useMonthlyAnalytics } from "@/hooks/useMonthlyAnalytics";
import { useFollowStats } from "@/hooks/useFollowStats";
import { useCreatorRatings } from "@/hooks/useCreatorRatings";
import { useCreatorStats } from "@/hooks/useCreatorStats";
import { usePlanGate } from "@/hooks/usePlanGate";
import { AudienceTab } from "./studio/AudienceTab";
import featureFlags from "@/lib/featureFlags";
import { getUpcomingSessions } from "@/data/getUpcomingSessions";
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
  isVerified?: boolean;
  profileLinks?: ProfileLink[];
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
    data: earningsData
  } = useCreatorEarnings(user?.id);
  const { analytics } = useMonthlyAnalytics(user?.id);
  const lifetimeEarningsDollars = ((earningsData?.lifetimeEarnings || 0) / 100);
  const {
    stats: followStats
  } = useFollowStats(user?.id);
  const {
    ratings
  } = useCreatorRatings(user?.id);
  const { stats: creatorStats } = useCreatorStats(user?.id);
  const planGate = usePlanGate();
  const { can } = planGate;
  const hasAdvancedAnalytics = can("hasAdvancedAnalytics");
  const [showEarnings, setShowEarnings] = useState(true);
  const [activeStudioTab, setActiveStudioTab] = useState<"overview" | "audience" | "portfolio">("overview");
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
    const sessions = await getUpcomingSessions({
      creatorId: user.id,
      limit: 200
    });
    const events = sessions.map(s => ({
      id: s.id,
      title: s.title,
      cover_url: s.cover_url,
      scheduled_at: s.scheduled_at,
      is_free: s.is_free,
      price: (s.price ?? 0) as number,
      creator_id: s.creator_id,
      is_live: s.is_live,
      live_ended_at: s.live_ended_at
    })) as ScheduledEvent[];
    if (DEBUG_SCHEDULE) {
      const sample = events.slice(0, 5).map(e => ({
        id: e.id,
        scheduled_at: e.scheduled_at,
        creator_id: e.creator_id,
        is_live: e.is_live,
        live_ended_at: e.live_ended_at
      }));
      console.log("[ScheduleDebug][CreatorProfile] params", {
        creator_id: user.id,
        filter: "get_upcoming_sessions(creator_id=user.id) (DB now() + 10m grace)"
      });
      console.log("[ScheduleDebug][CreatorProfile] returned", {
        count: events.length,
        sample
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
    } = await supabase.from("profiles").select("name, handle, avatar_url, created_at, bio, website, cover_url, is_founding_member, founding_number, is_verified").eq("user_id", user.id).maybeSingle();
    if (data) {
      // Fetch profile_links separately — graceful if column not yet migrated
      let profileLinks: ProfileLink[] = [];
      try {
        const { data: linksRow } = await supabase
          .from("profiles").select("profile_links").eq("user_id", user.id).maybeSingle();
        if (linksRow?.profile_links) profileLinks = linksRow.profile_links as ProfileLink[];
      } catch { /* migration pending */ }

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
        foundingNumber: data.founding_number,
        isVerified: data.is_verified ?? false,
        profileLinks,
      });
    }
  };

  // Use real profile data or fallback
  const displayName = localProfile?.name || fallbackCreator.name;
  const displayHandle = localProfile?.handle ? localProfile.handle : "";
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
            <span className="text-xs text-muted-foreground font-medium">Audience Mode</span>
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
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl text-foreground font-bold">{displayHandle || displayName}</h1>
            {localProfile?.isVerified === true && <BadgeCheck className="w-5 h-5 text-gold fill-gold/20" />}
          </div>
          {displayHandle && <p className="text-muted-foreground text-sm mt-0.5">{displayName}</p>}
          {displayBio && <p className="text-foreground/80 text-sm mt-2">{displayBio}</p>}
          {localProfile?.profileLinks && localProfile.profileLinks.length > 0 && (
            <ProfileLinks links={localProfile.profileLinks} className="mt-2.5" />
          )}
        </motion.div>

        {/* Stats Row - Sessions hosted · Rating · Followers · Following (standardized) */}
        <motion.div initial={{
          opacity: 0,
          y: 10
        }} animate={{
          opacity: 1,
          y: 0
        }} transition={{
          delay: 0.2
        }} className="flex items-center flex-wrap gap-x-1.5 text-sm text-muted-foreground mt-3" style={{ fontVariantNumeric: "tabular-nums" }}>
          <span>
            <span className="text-foreground font-medium">{creatorStats.sessionsHosted}</span> Sessions hosted
          </span>
          <span>·</span>
          <span className="inline-flex items-center gap-1">
            <Star className="w-3.5 h-3.5 text-gold fill-gold" />
            {ratings.totalRatings > 0 ? (
              <>
                <span className="text-foreground font-medium">{ratings.averageRating.toFixed(1)}</span>
                <span className="text-muted-foreground">({ratings.totalRatings})</span>
              </>
            ) : (
              <span className="text-muted-foreground/70">No ratings</span>
            )}
          </span>
          <span>·</span>
          <button onClick={() => {
            triggerClickHaptic();
            setShowFollowList("followers");
          }} className="hover:underline">
            <span className="text-foreground font-medium">{followStats.followersCount}</span> Followers
          </button>
          <span>·</span>
          <button onClick={() => {
            triggerClickHaptic();
            setShowFollowList("following");
          }} className="hover:underline">
            <span className="text-foreground font-medium">{followStats.followingCount}</span> Following
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
            <Share className="w-4 h-4 text-muted-foreground" />
          </button>
        </motion.div>

        {/* Passport Line (Founding status merged into timestamp) */}
        <motion.p initial={{
          opacity: 0
        }} animate={{
          opacity: 1
        }} transition={{
          delay: 0.35
        }} className="mt-4" style={{ fontSize: "13px", color: "rgba(255,107,88,0.70)" }}>
          {localProfile?.isFoundingMember ? <>
              <span className="font-semibold">✦ Founding Member</span>
              <span> · Since {displayMemberSince}</span>
            </> : <span className="text-muted-foreground">Creator's Passport · Since {displayMemberSince}</span>}
        </motion.p>
      </div>

      {/* Studio Action Buttons - Split CTA */}
      <div className="px-4 mt-6 flex gap-3">
        {/* Open Studio - Immediate (60%) */}
        <motion.button whileTap={{
          scale: 0.98
        }} onClick={() => {
          triggerClickHaptic();
          onGoLive();
        }} className="flex-[3] flex items-center justify-center gap-2 py-4 rounded-2xl text-white font-semibold shadow-electric" style={{
          background: "linear-gradient(135deg, hsl(7 100% 67%), hsl(345 100% 50%))"
        }}>
          <Zap className="w-5 h-5" />
          <span className="text-sm">Open Studio</span>
        </motion.button>
        
        {/* Schedule - Future (40%) */}
        <motion.button whileTap={{
          scale: 0.98
        }} onClick={handleScheduleClick} className="flex-[2] flex items-center justify-center gap-2 py-4 rounded-2xl bg-obsidian border border-border/60 text-foreground font-semibold hover:bg-muted/50 transition-colors">
          <Calendar className="w-5 h-5 text-muted-foreground" />
          <span className="text-sm">Schedule</span>
        </motion.button>
      </div>

      {/* Studio Schedule */}
      <UpcomingEventsList events={upcomingEvents} onEventDeleted={fetchUpcomingEvents} />

      {/* Studio Sub-Tabs: Analytics / Audience / Portfolio */}
      <div className="border-b border-border/30 mt-6">
        <div className="flex px-4">
          {(["overview", "audience", "portfolio"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => { triggerClickHaptic(); setActiveStudioTab(tab); }}
              className={`py-3 px-4 text-xs font-semibold relative transition-colors ${
                activeStudioTab === tab ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {tab === "overview" ? "Analytics" : tab === "audience" ? "Audience" : "Portfolio"}
              {activeStudioTab === tab && (
                <motion.div
                  layoutId="studioTab"
                  className="absolute bottom-0 left-2 right-2 h-0.5 bg-electric"
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Audience Tab Content */}
      <AnimatePresence mode="wait">
        {activeStudioTab === "audience" && (
          <motion.div
            key="audience-tab"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="px-4 mt-4"
          >
            <AudienceTab creatorId={user?.id} planGate={planGate} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Analytics Section - Premium View */}
      {activeStudioTab === "overview" && <div className="px-4 mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg text-foreground">Analytics</h2>
          <button onClick={() => {
            triggerClickHaptic();
            setShowEarnings(!showEarnings);
          }} className="p-2">
            {showEarnings ? <Eye className="w-4 h-4 text-muted-foreground" /> : <EyeOff className="w-4 h-4 text-muted-foreground" />}
          </button>
        </div>

        {/* KPI Cards Row */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          {/* Total Earnings */}
          {featureFlags.paymentsEnabled ? (
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => { triggerClickHaptic(); navigate("/earnings-history"); }}
              className="bg-obsidian rounded-2xl p-4 border border-border/30 text-left hover:border-gold/30 transition-colors"
            >
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-gold" />
                <span className="text-xs text-muted-foreground">Total Earnings</span>
              </div>
              <p className="font-display text-2xl text-gold" style={{ fontVariantNumeric: "tabular-nums" }}>
                {showEarnings ? `$${lifetimeEarningsDollars.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "••••"}
              </p>
              {analytics.totalEarnings > 0 && showEarnings && (
                <p className="text-xs text-muted-foreground mt-1">
                  +${(analytics.totalEarnings / 100).toFixed(2)} this month
                </p>
              )}
            </motion.button>
          ) : (
            <div className="bg-obsidian rounded-2xl p-4 border border-border/30">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Total Earnings</span>
              </div>
              <p className="font-display text-2xl text-muted-foreground">$0.00</p>
            </div>
          )}

          {/* Tickets Sold — lifetime total (paid + free, excl. self) */}
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => { triggerClickHaptic(); navigate("/tickets-history"); }}
            className="bg-obsidian rounded-2xl p-4 border border-border/30 text-left hover:border-electric/30 transition-colors"
          >
            <div className="flex items-center gap-2 mb-2">
              <Ticket className="w-4 h-4 text-electric" />
              <span className="text-xs text-muted-foreground">Tickets Sold</span>
            </div>
            <p className="font-display text-2xl text-foreground" style={{ fontVariantNumeric: "tabular-nums" }}>
              {creatorStats.ticketsSold.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground mt-1">lifetime total</p>
          </motion.button>
        </div>

        {/* Second row: Sessions + Avg/Session */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-obsidian rounded-2xl p-4 border border-border/30">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="w-4 h-4 text-electric" />
              <span className="text-xs text-muted-foreground">Sessions</span>
            </div>
            <p className="font-display text-2xl text-foreground" style={{ fontVariantNumeric: "tabular-nums" }}>
              {creatorStats.sessionsHosted}
            </p>
            <p className="text-xs text-muted-foreground mt-1">hosted total</p>
          </div>

          <div className="bg-obsidian rounded-2xl p-4 border border-border/30">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-gold" />
              <span className="text-xs text-muted-foreground">Avg / Session</span>
            </div>
            <p className="font-display text-2xl text-gold" style={{ fontVariantNumeric: "tabular-nums" }}>
              {showEarnings
                ? creatorStats.sessionsHosted > 0 && featureFlags.paymentsEnabled
                  ? `$${(lifetimeEarningsDollars / creatorStats.sessionsHosted).toFixed(0)}`
                  : "$0"
                : "••••"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">lifetime avg</p>
          </div>
        </div>

        {/* Best Performing Session */}
        {featureFlags.paymentsEnabled && (() => {
          // Compute best session from lifetime earnings transactions
          const txMap = new Map<string, { title: string; net: number }>();
          for (const tx of (earningsData?.transactions ?? [])) {
            const existing = txMap.get(tx.event_id);
            if (existing) { existing.net += tx.amount_net; }
            else { txMap.set(tx.event_id, { title: tx.event_title, net: tx.amount_net }); }
          }
          const bestEntry = txMap.size > 0
            ? [...txMap.values()].reduce((a, b) => a.net > b.net ? a : b)
            : null;

          if (!bestEntry) return null;
          return (
            <div className="mt-3 bg-obsidian rounded-2xl p-4 border border-gold/20">
              <div className="flex items-center gap-2 mb-2">
                <Star className="w-4 h-4 text-gold fill-gold/30" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Best Session</span>
              </div>
              <p className="text-sm font-semibold text-foreground truncate">{bestEntry.title}</p>
              <p className="font-display text-2xl text-gold mt-1" style={{ fontVariantNumeric: "tabular-nums" }}>
                {showEarnings ? `$${(bestEntry.net / 100).toFixed(2)}` : "••••"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">highest single session earned</p>
            </div>
          );
        })()}

        {/* Advanced Analytics Upsell — Free plan users */}
        {!hasAdvancedAnalytics && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-1 rounded-2xl border border-electric/20 bg-gradient-to-br from-electric/5 to-transparent p-4"
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-electric/15 flex items-center justify-center flex-shrink-0">
                <Lock className="w-4 h-4 text-electric" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">Unlock Advanced Analytics</p>
                <p className="text-xs text-muted-foreground mt-0.5">Revenue bar charts, repeat attendee tracking, session rankings & payout history</p>
                <button
                  onClick={() => { triggerClickHaptic(); navigate("/pricing"); }}
                  className="mt-2.5 px-3 py-1.5 rounded-full bg-electric/15 text-electric text-xs font-semibold hover:bg-electric/25 transition-colors border border-electric/30"
                >
                  Upgrade to Pro →
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </div>}

      {/* Portfolio Tab Content */}
      <AnimatePresence mode="wait">
        {activeStudioTab === "portfolio" && (
          <motion.div
            key="portfolio-tab"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="px-4 mt-4 pb-24"
          >
            <PortfolioGrid userId={user?.id} isOwner={true} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom padding for non-portfolio tabs */}
      {activeStudioTab !== "portfolio" && <div className="pb-24" />}

      {/* Edit Profile Modal */}
      <EditProfileModal isOpen={showEditProfile} onClose={() => setShowEditProfile(false)} profile={localProfile} onProfileUpdated={(savedLinks) => {
        // Optimistic update: show saved links immediately without waiting for DB read-back
        setLocalProfile(prev => prev ? { ...prev, profileLinks: savedLinks } : prev);
        refreshProfile();
      }} />


      {/* Follow List Modal */}
      {user && <FollowListModal isOpen={showFollowList !== null} onClose={() => setShowFollowList(null)} userId={user.id} type={showFollowList || "followers"} />}

      {/* Share Studio Modal */}
      <ShareStudioModal isOpen={showShareModal} onClose={() => setShowShareModal(false)} handle={localProfile?.handle || null} userId={user?.id} creatorName={localProfile?.name} />

      </div>
    </div>;
}