import { useState, useEffect, type MouseEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { 
  ArrowLeft, 
  Image as ImageIcon, 
  Award, 
  ShoppingBag,
  Ticket,
  ChevronRight,
  Share2,
  Pencil,
  Calendar,
  Clock,
  Radio,
  XCircle,
  Trash2,
  CheckCircle2,
  BadgeCheck
} from "lucide-react";
import { triggerClickHaptic } from "@/lib/haptics";
import { EditProfileModal } from "./EditProfileModal";
import { FollowListModal } from "./FollowListModal";
import { ShareProfileModal } from "./ShareProfileModal";
import { SessionEndedScreen } from "./SessionEndedScreen";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAudienceStats } from "@/hooks/useAudienceStats";
import { useFollowStats } from "@/hooks/useFollowStats";
import { useTickets, UpcomingSession, PastSession } from "@/hooks/useTickets";
import { useUpcomingSessions, SavedUpcomingSession } from "@/hooks/useUpcomingSessions";
import { useSavedSessions } from "@/hooks/useSavedSessions";
import { toast } from "@/hooks/use-toast";
import { getEventThumbnailUrl } from "@/lib/eventImages";

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

type TabType = "tickets" | "collection";

export function AudienceProfile({ 
  onBack, 
  onSwitchMode, 
  isVerifiedCreator = false,
  onOpenStudio,
  profile
}: AudienceProfileProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { stats } = useAudienceStats(user?.id);
  const { stats: followStats } = useFollowStats(user?.id);
  const { upcomingSessions: ticketSessions, pastSessions, isLoading: ticketsLoading } = useTickets(user?.id);
  const { sessions: savedSessions, isLoading: savedLoading, refetch: refetchSaved } = useUpcomingSessions(user?.id);
  const { isEventSaved, saveSession, removeSession } = useSavedSessions();
  const [localProfile, setLocalProfile] = useState(profile);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showFollowList, setShowFollowList] = useState<"followers" | "following" | null>(null);
  const [showShareProfile, setShowShareProfile] = useState(false);
  const [selectedEndedSession, setSelectedEndedSession] = useState<SavedUpcomingSession | null>(null);
  
  // Sync local profile with prop changes
  useEffect(() => {
    setLocalProfile(profile);
  }, [profile]);

  // Fetch updated profile data
  const refreshProfile = async () => {
    if (!user) return;
    console.log("[AudienceProfile] Refreshing profile for user:", user.id);
    const { data } = await supabase
      .from("profiles")
      .select(
        "name, handle, avatar_url, created_at, bio, website, cover_url, is_founding_member, founding_number, is_verified"
      )
      .eq("user_id", user.id)
      .maybeSingle();
    
    if (data) {
      console.log("[AudienceProfile] ✅ Profile refreshed:", data.name);
      const createdDate = new Date(data.created_at);
      const memberSince = createdDate.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
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
      });
    } else {
      console.warn("[AudienceProfile] ⚠️ Profile refresh returned null for authenticated user");
    }
  };

  // CRITICAL: Do NOT fall back to "Guest" if user is authenticated and profile is loading/missing
  const displayName = localProfile?.name || (user ? "Loading..." : fallbackUser.name);
  const displayHandle = localProfile?.handle ? `@${localProfile.handle}` : (user ? "@..." : fallbackUser.username);
  const displayMemberSince = localProfile?.memberSince || (user ? "..." : fallbackUser.memberSince);
  const displayBio = localProfile?.bio;
  
  const [activeTab, setActiveTab] = useState<TabType>("tickets");
  

  const displayAvatar = localProfile?.avatarUrl;
  const displayCover = localProfile?.coverUrl;

  const tabs: { id: TabType; label: string; icon: typeof Ticket }[] = [
    { id: "tickets", label: "Tickets", icon: Ticket },
    { id: "collection", label: "Collection", icon: ShoppingBag },
  ];


  const handleShare = () => {
    triggerClickHaptic();
    setShowShareProfile(true);
  };

  return (
    <div className="min-h-screen bg-carbon">
      {/* Main Container */}
      <div className="max-w-screen-xl mx-auto lg:px-8">
        
        {/* Cover Photo - Full Width (NOT clickable - edit through Edit Profile) */}
        <div className="relative h-48 sm:h-56 w-full overflow-hidden">
          {displayCover ? (
            <img
              src={displayCover}
              alt="Cover"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-obsidian via-carbon to-obsidian" />
          )}
          

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
            
            {/* Mode Switch - Subtle toggle, not a primary CTA */}
            {isVerifiedCreator && onSwitchMode && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={(e) => {
                  e.stopPropagation();
                  triggerClickHaptic();
                  onSwitchMode();
                }}
                className="px-4 py-2 rounded-full bg-carbon/80 backdrop-blur-sm border border-border/50 flex items-center gap-2"
              >
                <span className="text-xs text-muted-foreground font-medium">Switch to Studio</span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
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
                {displayAvatar ? (
                  <img
                    src={displayAvatar}
                    alt={displayName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-3xl font-display text-muted-foreground">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}
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
            <div className="flex items-center gap-2">
              <h1 className="font-display text-2xl text-foreground font-bold">{displayName}</h1>
              {localProfile?.isVerified === true && (
                <BadgeCheck className="w-5 h-5 text-gold fill-gold/20" />
              )}
            </div>
            <p className="text-muted-foreground text-sm mt-0.5">{displayHandle}</p>
            {displayBio && (
              <p className="text-foreground/80 text-sm mt-2">{displayBio}</p>
            )}
          </motion.div>

          {/* Stats Row - Following/Followers then Attended/Collected */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col gap-1 mt-3"
          >
            <p className="text-sm text-muted-foreground">
              <button 
                onClick={() => { triggerClickHaptic(); setShowFollowList("followers"); }}
                className="hover:underline"
              >
                <span className="text-foreground font-medium">{followStats.followersCount}</span> Followers
              </button>
              {" · "}
              <button 
                onClick={() => { triggerClickHaptic(); setShowFollowList("following"); }}
                className="hover:underline"
              >
                <span className="text-foreground font-medium">{followStats.followingCount}</span> Following
              </button>
            </p>
            <p className="text-sm text-muted-foreground">
              {stats.eventsAttended} Attended · {stats.itemsCollected} Collected
            </p>
          </motion.div>

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
              className="px-5 py-2.5 rounded-full bg-muted/50 border border-border/40 text-muted-foreground text-sm font-medium flex items-center gap-2 hover:bg-muted/70 transition-colors"
            >
              <Pencil className="w-4 h-4" />
              Edit Profile
            </button>
            <button
              onClick={handleShare}
              className="w-10 h-10 rounded-full bg-muted/50 border border-border/40 flex items-center justify-center hover:bg-muted/70 transition-colors"
            >
              <Share2 className="w-4 h-4 text-muted-foreground" />
            </button>
          </motion.div>

          {/* Founding Member Badge - Centered, Premium */}
          {localProfile?.isFoundingMember && (
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
                  Founding Member {localProfile.foundingNumber ? `#${localProfile.foundingNumber}` : ""}
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
                {/* Filter sessions into upcoming and past */}
                {(() => {
                  const upcomingSaved = savedSessions.filter(s => 
                    s.status === "upcoming" || s.status === "starting_soon" || s.status === "live"
                  );
                  const pastSaved = savedSessions.filter(s => 
                    s.status === "ended" || s.status === "missed"
                  );
                  const upcomingTickets = ticketSessions.filter(s => 
                    s.status === "upcoming" || s.status === "starting_soon" || s.status === "live"
                  );
                  const pastTickets = ticketSessions.filter(s => 
                    s.status === "ended" || s.status === "missed"
                  );

                  const handleSessionClick = (session: SavedUpcomingSession | UpcomingSession, isSaved: boolean) => {
                    triggerClickHaptic();
                    
                    if (session.status === "live") {
                      navigate(`/live/${session.eventId}`);
                    } else if (session.status === "upcoming" || session.status === "starting_soon") {
                      navigate(`/s/${session.eventId}`);
                    } else if (session.status === "ended" || session.status === "missed") {
                      // Show ended screen for saved sessions
                      if (isSaved && "creatorId" in session) {
                        setSelectedEndedSession(session as SavedUpcomingSession);
                      } else {
                        // For tickets, just navigate to session page
                        navigate(`/s/${session.eventId}`);
                      }
                    }
                  };

                  const handleRemoveSession = async (e: MouseEvent, eventId: string) => {
                    e.stopPropagation();
                    triggerClickHaptic();
                    await removeSession(eventId);
                    refetchSaved();
                  };

                  const renderStatusBadge = (status: string, attended?: boolean) => {
                    switch (status) {
                      case "live":
                        return (
                          <span className="px-2 py-0.5 rounded-full bg-destructive text-destructive-foreground text-xs font-medium flex items-center gap-1">
                            <Radio className="w-3 h-3" />
                            LIVE
                          </span>
                        );
                      case "starting_soon":
                        return (
                          <span className="px-2 py-0.5 rounded-full bg-electric/15 text-electric text-xs font-medium flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Soon
                          </span>
                        );
                      case "upcoming":
                        // Audience Upcoming Sessions section already communicates this.
                        return null;
                      case "ended":
                        return (
                          <span className="px-2 py-0.5 rounded-full bg-muted/50 text-muted-foreground text-xs font-medium flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Attended
                          </span>
                        );
                      case "missed":
                        return (
                          <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-medium flex items-center gap-1">
                            <XCircle className="w-3 h-3" />
                            Missed
                          </span>
                        );
                      default:
                        return null;
                    }
                  };

                  const toggleSaved = async (params: {
                    e: MouseEvent;
                    eventId: string;
                    creatorId: string;
                  }) => {
                    const { e, eventId, creatorId } = params;
                    e.stopPropagation();
                    triggerClickHaptic();

                    const alreadySaved = isEventSaved(eventId);
                    const ok = alreadySaved
                      ? await removeSession(eventId)
                      : await saveSession(eventId, creatorId);

                    if (ok) {
                      toast({
                        title: alreadySaved ? "Removed" : "Added",
                        description: alreadySaved
                          ? "Removed from your Upcoming"
                          : "Added to your Upcoming",
                      });
                      // Saved sessions list is derived from saved_sessions; refetch for immediate UI sync.
                      refetchSaved();
                    }
                  };

                  return (
                    <>
                      {/* Upcoming Sessions */}
                      <h3 className="font-display text-lg text-foreground mb-4">Upcoming Sessions</h3>
                      {(ticketsLoading || savedLoading) ? (
                        <div className="flex flex-col items-center justify-center py-12 bg-obsidian rounded-2xl border border-border/30">
                          <div className="w-8 h-8 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
                        </div>
                      ) : (upcomingSaved.length > 0 || upcomingTickets.length > 0) ? (
                        <div className="space-y-3">
                          {/* Saved Sessions (upcoming only) */}
                          {upcomingSaved.map((session) => (
                            <motion.div
                              key={`saved-${session.id}`}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              onClick={() => handleSessionClick(session, true)}
                              className={`bg-obsidian rounded-xl border p-4 cursor-pointer transition-colors ${
                                session.status === "live" 
                                  ? "border-destructive/50 bg-destructive/5" 
                                  : "border-border/30 hover:border-border/50"
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <img
                                  src={getEventThumbnailUrl({
                                    eventCoverUrl: session.coverUrl,
                                    creatorAvatarUrl: session.artistAvatar,
                                  })}
                                  alt={session.title}
                                  className="w-10 h-10 rounded-full object-cover"
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-foreground truncate">{session.title}</p>
                                  <p className="text-xs text-muted-foreground">{session.artistName}</p>
                                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                      <Calendar className="w-3 h-3" />
                                      {session.scheduledAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      {session.scheduledAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                                    </span>
                                  </div>
                                </div>
                                {session.status === "upcoming" ? (
                                  <button
                                    onClick={(e) =>
                                      toggleSaved({
                                        e,
                                        eventId: session.eventId,
                                        creatorId: session.creatorId,
                                      })
                                    }
                                    className="px-2 py-0.5 rounded-full bg-muted/50 text-muted-foreground text-xs font-medium"
                                  >
                                    Added ✓
                                  </button>
                                ) : (
                                  renderStatusBadge(session.status)
                                )}
                              </div>
                            </motion.div>
                          ))}
                          
                          {/* Ticket Sessions (upcoming only) */}
                          {upcomingTickets.map((session) => (
                            <motion.div
                              key={`ticket-${session.id}`}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              onClick={() => handleSessionClick(session, false)}
                              className={`bg-obsidian rounded-xl border p-4 cursor-pointer transition-colors ${
                                session.status === "live" 
                                  ? "border-destructive/50 bg-destructive/5" 
                                  : "border-border/30 hover:border-border/50"
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <img
                                  src={getEventThumbnailUrl({
                                    eventCoverUrl: session.coverUrl,
                                    creatorAvatarUrl: session.artistAvatar,
                                  })}
                                  alt={session.title}
                                  className="w-10 h-10 rounded-full object-cover"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium text-foreground truncate">{session.title}</p>
                                    <span className="px-1.5 py-0.5 rounded bg-gold/15 text-gold text-[10px] font-medium">
                                      TICKET
                                    </span>
                                  </div>
                                  <p className="text-xs text-muted-foreground">{session.artistName}</p>
                                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                      <Calendar className="w-3 h-3" />
                                      {session.scheduledAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      {session.scheduledAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                                    </span>
                                  </div>
                                </div>
                                {session.status === "upcoming" ? (
                                  <button
                                    onClick={(e) =>
                                      toggleSaved({
                                        e,
                                        eventId: session.eventId,
                                        creatorId: session.creatorId,
                                      })
                                    }
                                    className="px-2 py-0.5 rounded-full bg-muted/50 text-muted-foreground text-xs font-medium"
                                  >
                                    {isEventSaved(session.eventId) ? "Added ✓" : "Add +"}
                                  </button>
                                ) : (
                                  renderStatusBadge(session.status)
                                )}
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-12 bg-obsidian rounded-2xl border border-border/30">
                          <Ticket className="w-12 h-12 text-muted-foreground mb-3" />
                          <p className="text-muted-foreground text-center">
                            No upcoming sessions
                          </p>
                          <p className="text-xs text-muted-foreground/70 mt-1 text-center">
                            Add sessions from creator profiles to get reminders
                          </p>
                        </div>
                      )}

                      {/* Past Sessions - Including missed and ended saved sessions */}
                      <h3 className="font-display text-lg text-foreground mt-8 mb-4">Past Sessions</h3>
                      {(ticketsLoading || savedLoading) ? (
                        <div className="flex flex-col items-center justify-center py-8 bg-obsidian/50 rounded-2xl border border-border/20">
                          <div className="w-6 h-6 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
                        </div>
                      ) : (pastSaved.length > 0 || pastSessions.length > 0 || pastTickets.length > 0) ? (
                        <div className="space-y-2">
                          {/* Missed/Ended saved sessions with remove button */}
                          {pastSaved.map((session) => (
                            <motion.div
                              key={`past-saved-${session.id}`}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, x: -20 }}
                              onClick={() => handleSessionClick(session, true)}
                              className={`bg-obsidian/50 rounded-xl border p-4 cursor-pointer transition-colors ${
                                session.status === "missed"
                                  ? "border-muted-foreground/30 opacity-70"
                                  : "border-border/20 hover:border-border/40"
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                {session.artistAvatar ? (
                                  <img
                                    src={session.artistAvatar}
                                    alt={session.artistName}
                                    className="w-10 h-10 rounded-full object-cover"
                                  />
                                ) : (
                                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                                    {session.artistName.charAt(0).toUpperCase()}
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-foreground truncate">{session.title}</p>
                                  <p className="text-xs text-muted-foreground">{session.artistName}</p>
                                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                      <Calendar className="w-3 h-3" />
                                      {session.scheduledAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {renderStatusBadge(session.status, session.attended)}
                                  <button
                                    onClick={(e) => handleRemoveSession(e, session.eventId)}
                                    className="p-1.5 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                    title="Remove from list"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            </motion.div>
                          ))}

                          {/* Past ticketed sessions */}
                          {pastSessions.map((session) => (
                            <div
                              key={`past-ticket-${session.id}`}
                              className="bg-obsidian/50 rounded-xl border border-border/20 p-4"
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-medium text-foreground">{session.artistName}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {session.category || "Studio Session"} · {session.attendedAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                  </p>
                                </div>
                                <span className="px-1.5 py-0.5 rounded bg-gold/15 text-gold text-[10px] font-medium">
                                  TICKET
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-8 bg-obsidian/50 rounded-2xl border border-border/20">
                          <p className="text-muted-foreground/60 text-sm">No past sessions</p>
                        </div>
                      )}
                    </>
                  );
                })()}
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

      {/* Follow List Modal */}
      {user && (
        <FollowListModal
          isOpen={showFollowList !== null}
          onClose={() => setShowFollowList(null)}
          userId={user.id}
          type={showFollowList || "followers"}
        />
      )}

      {/* Share Profile Modal */}
      <ShareProfileModal
        isOpen={showShareProfile}
        onClose={() => setShowShareProfile(false)}
        handle={localProfile?.handle || null}
        userId={user?.id}
      />

      {/* Session Ended Screen */}
      <AnimatePresence>
        {selectedEndedSession && (
          <SessionEndedScreen
            title={selectedEndedSession.title}
            artistName={selectedEndedSession.artistName}
            artistAvatar={selectedEndedSession.artistAvatar}
            scheduledAt={selectedEndedSession.scheduledAt}
            creatorId={selectedEndedSession.creatorId}
            isMissed={selectedEndedSession.status === "missed"}
            onRemove={async () => {
              await removeSession(selectedEndedSession.eventId);
              refetchSaved();
              setSelectedEndedSession(null);
            }}
            onBack={() => setSelectedEndedSession(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
