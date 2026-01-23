import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Edit2, Share2, UserPlus, UserCheck, Award, Users, BadgeCheck, Heart, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { triggerHaptic } from "@/lib/haptics";
import { safeExternalUrl } from "@/lib/utils";
import { toast } from "sonner";
import { FollowListModal } from "@/components/FollowListModal";
import { PortfolioGrid } from "@/components/PortfolioGrid";
import { LiveAccessCard } from "@/components/LiveAccessCard";
import { useLiveViewers } from "@/hooks/useLiveViewers";
import { usePublicCreatorStats } from "@/hooks/usePublicCreatorStats";
import { CreatorReputationStats } from "@/components/CreatorReputationStats";
import { UpcomingSessionsPreview } from "@/components/UpcomingSessionsPreview";
import { TipCreatorModal } from "@/components/TipCreatorModal";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
interface LiveEventData {
  id: string;
  title: string;
  cover_url: string | null;
  live_started_at: string | null;
}
interface PublicProfileData {
  user_id: string;
  name: string;
  handle: string | null;
  avatar_url: string | null;
  bio: string | null;
  cover_url: string | null;
  website: string | null;
  created_at: string | null;
  is_founding_member: boolean | null;
  founding_number: number | null;
  is_verified?: boolean | null;
}
export default function PublicProfile() {
  const {
    userId
  } = useParams<{
    userId: string;
  }>();

  // Debug: confirm the route param we are receiving
  console.log("[PublicProfile] param userId:", userId);
  const navigate = useNavigate();
  const location = useLocation();
  const {
    user
  } = useAuth();
  const [profile, setProfile] = useState<PublicProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [showFollowList, setShowFollowList] = useState<"followers" | "following" | null>(null);
  const [liveEvent, setLiveEvent] = useState<LiveEventData | null>(null);
  const [isTipOpen, setIsTipOpen] = useState(false);
  const [isMessageOpen, setIsMessageOpen] = useState(false);
  const isOwnProfile = user?.id === profile?.user_id;

  // Real-time viewer count for the live event
  const {
    viewerCount
  } = useLiveViewers(liveEvent?.id ?? null);

  // Public creator stats (only show if user is a creator)
  const {
    stats: creatorStats,
    loading: creatorStatsLoading
  } = usePublicCreatorStats(profile?.user_id);
  const showTipMe = Boolean(creatorStats.isCreator);

  // Check if user is a founding member from database
  const isFoundingMember = profile?.is_founding_member ?? false;
  const foundingNumber = profile?.founding_number;
  const isLive = liveEvent !== null;
  const fetchFollowData = useCallback(async (targetUserId: string) => {
    // Fetch follower count
    const {
      data: followers
    } = await supabase.rpc("get_follower_count", {
      target_user_id: targetUserId
    });
    setFollowerCount(followers || 0);

    // Fetch following count
    const {
      data: following
    } = await supabase.rpc("get_following_count", {
      target_user_id: targetUserId
    });
    setFollowingCount(following || 0);

    // Check if current user follows this profile
    if (user) {
      const {
        data: isFollowingData
      } = await supabase.rpc("is_following", {
        target_user_id: targetUserId
      });
      setIsFollowing(isFollowingData || false);
    }
  }, [user]);
  useEffect(() => {
    if (!userId) {
      console.error("[PublicProfile] No userId provided in route params");
      setError("Invalid profile ID");
      setIsLoading(false);
      return;
    }
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let isCancelled = false;
    const fetchLiveEvent = async (creatorUserId: string) => {
      // RLS policy checks event_rooms existence for live events
      const {
        data,
        error
      } = await supabase.from("events").select("id, title, cover_url, live_started_at").eq("creator_id", creatorUserId).eq("is_live", true).is("live_ended_at", null).maybeSingle();
      if (isCancelled) return;
      if (!error && data) {
        setLiveEvent(data);
      } else {
        setLiveEvent(null);
      }
    };
    const fetchProfileAndSetup = async () => {
      setIsLoading(true);
      setError(null);
      setProfile(null);
      setLiveEvent(null);
      try {
        // Only use RPC - never query profiles table directly for other users
        const {
          data,
          error: rpcError
        } = await supabase.rpc("get_public_profile", {
          profile_user_id: userId
        });
        console.log("[PublicProfile][AUDIENCE] RPC get_public_profile response:", {
          args: {
            profile_user_id: userId
          },
          data,
          error: rpcError
        });
        let profileData: PublicProfileData | null = null;
        if (!rpcError && data && Array.isArray(data) && data.length > 0) {
          console.log("PublicProfile loaded via RPC for user_id:", userId);
          profileData = data[0] as PublicProfileData;
        } else {
          // Fallback: try by profile row id
          const {
            data: fallbackData,
            error: fallbackError
          } = await supabase.rpc("get_public_profile_by_profile_id", {
            profile_id: userId
          });
          console.log("[PublicProfile][AUDIENCE] RPC get_public_profile_by_profile_id response:", {
            args: {
              profile_id: userId
            },
            data: fallbackData,
            error: fallbackError
          });
          if (!fallbackError && fallbackData && Array.isArray(fallbackData) && fallbackData.length > 0) {
            console.log("PublicProfile loaded via RPC for user_id:", fallbackData[0].user_id);
            profileData = fallbackData[0] as PublicProfileData;
          }
        }
        if (!profileData) {
          setError("Profile not found");
          return;
        }

        // If this resolves to the current user's own profile, redirect to internal profile view
        if (user && profileData.user_id === user.id) {
          console.log("[PublicProfile] Detected own profile, redirecting to own profile screen");
          navigate("/", {
            state: {
              openProfile: true
            },
            replace: true
          });
          return;
        }
        setProfile(profileData);

        // TEMP DEBUG: Verify audience receives is_verified
        console.log("AUDIENCE PROFILE FETCH:", profileData);
        console.log("AUDIENCE is_verified:", (profileData as any)?.is_verified);
        fetchFollowData(profileData.user_id);

        // Live status must use the resolved creator user_id (route param may be user_id OR profile row id)
        await fetchLiveEvent(profileData.user_id);

        // Subscribe to real-time updates for creator's live status
        channel = supabase.channel(`creator-live-${profileData.user_id}`).on("postgres_changes", {
          event: "*",
          schema: "public",
          table: "events",
          filter: `creator_id=eq.${profileData.user_id}`
        }, () => {
          fetchLiveEvent(profileData!.user_id);
        }).subscribe();
      } catch (err) {
        console.error("[PublicProfile] Unexpected fetch error:", err);
        setError("Failed to load profile");
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    };
    fetchProfileAndSetup();
    return () => {
      isCancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [userId, fetchFollowData, user, navigate]);
  const handleFollow = async () => {
    if (!user || !profile) return;
    triggerHaptic("medium");
    setIsFollowLoading(true);
    try {
      if (isFollowing) {
        // Unfollow
        const {
          error
        } = await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", profile.user_id);
        if (error) throw error;
        setIsFollowing(false);
        setFollowerCount(prev => Math.max(0, prev - 1));
        toast.success(`Unfollowed ${profile.name}`);
      } else {
        // Follow
        const {
          error
        } = await supabase.from("follows").insert({
          follower_id: user.id,
          following_id: profile.user_id
        });
        if (error) throw error;
        setIsFollowing(true);
        setFollowerCount(prev => prev + 1);
        toast.success(`Following ${profile.name}`);
      }
    } catch (err: any) {
      console.error("Follow/unfollow error:", err);
      toast.error(err.message || "Something went wrong");
    } finally {
      setIsFollowLoading(false);
    }
  };
  const handleBack = () => {
    triggerHaptic("light");

    // HARD FIX: prefer explicit return context so back works even if browser history
    // was reset (new tab, full reload, replace(), etc.).
    const state = (location.state && typeof location.state === "object"
      ? (location.state as Record<string, unknown>)
      : {}) as Record<string, unknown>;

    const returnTo = state.returnTo as
      | {
          pathname: string;
          search?: string;
          state?: Record<string, unknown>;
        }
      | undefined;

    if (returnTo?.pathname) {
      navigate(
        {
          pathname: returnTo.pathname,
          search: returnTo.search ?? "",
        },
        { state: returnTo.state ?? undefined }
      );
      return;
    }

    try {
      const raw = sessionStorage.getItem("exhiby_return_to");
      if (raw) {
        const parsed = JSON.parse(raw) as {
          pathname?: string;
          search?: string;
          state?: Record<string, unknown>;
        };
        if (parsed?.pathname) {
          navigate(
            { pathname: parsed.pathname, search: parsed.search ?? "" },
            { state: parsed.state ?? undefined }
          );
          return;
        }
      }
    } catch {
      // ignore
    }

    // Prefer real history if present
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    // Fallback: go to the user's own internal profile view (NOT home)
    navigate("/", { state: { openProfile: true }, replace: true });
  };
  const handleEditProfile = () => {
    triggerHaptic("light");
    navigate("/", {
      state: {
        openEditProfile: true
      }
    });
  };
  const handleShare = async () => {
    triggerHaptic("light");
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({
        title: profile?.name || "Profile",
        url
      });
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard");
    }
  };

  // Format member since date
  const memberSince = profile?.created_at ? new Date(profile.created_at).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric"
  }) : null;
  const websiteHref = safeExternalUrl(profile?.website);

  // Lightweight per-page SEO (no extra deps)
  useEffect(() => {
    if (!profile) return;
    const baseTitle = profile.handle ? `${profile.name} (@${profile.handle})` : profile.name;
    const title = `${baseTitle}${isLive ? " is Live" : ""} | Exhiby`;
    document.title = title.slice(0, 60);
    const desc = `View ${profile.name}'s profile${isLive ? " and join their live stream" : ""} on Exhiby. Explore their portfolio and follow for future live sessions.`;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", desc.slice(0, 160));

    // Canonical
    const canonicalHref = `${window.location.origin}/profile/${profile.user_id}`;
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", canonicalHref);
  }, [profile, isLive]);
  if (isLoading) {
    return <div className="min-h-screen bg-carbon">
        <Skeleton className="w-full h-48" />
        <div className="px-4 -mt-16">
          <Skeleton className="w-32 h-32 rounded-full border-4 border-carbon" />
          <Skeleton className="mt-4 h-8 w-48" />
          <Skeleton className="mt-2 h-4 w-32" />
          <Skeleton className="mt-4 h-16 w-full" />
        </div>
      </div>;
  }
  if (error || !profile) {
    return <div className="min-h-screen bg-carbon flex flex-col items-center justify-center px-4">
        <p className="text-muted-foreground mb-4">{error || "Profile not found"}</p>
        <p className="text-xs text-muted-foreground/50 mb-4">ID: {userId}</p>
        <Button variant="outline" onClick={handleBack}>
          Go Back
        </Button>
      </div>;
  }
  return <div className="min-h-screen bg-carbon">
      {/* Main Container - match creator self-view (StudioDashboard) */}
      <div className="max-w-screen-xl mx-auto lg:px-8">
        {/* Cover Image - constrained to container (matches creator self-view) */}
        <div className="relative h-48 sm:h-56 w-full overflow-hidden">
          {profile.cover_url ? <img src={profile.cover_url} alt={`Cover photo of ${profile.name}`} className="w-full h-full object-cover" loading="lazy" /> : <div className="w-full h-full bg-gradient-to-br from-obsidian via-carbon to-obsidian" />}

          {/* Live pill on cover */}
          {isLive && <motion.div initial={{
          opacity: 0,
          y: -8
        }} animate={{
          opacity: 1,
          y: 0
        }} className="absolute bottom-4 left-4 px-3 py-1.5 rounded-full backdrop-blur-sm border border-live/30 bg-carbon/70 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-live opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-live" />
              </span>
              <span className="text-xs font-bold tracking-wide text-primary-foreground">LIVE NOW</span>
              {viewerCount > 0 && <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="w-3 h-3" />
                  {viewerCount}
                </span>}
            </motion.div>}

          {/* Back Button */}
          <motion.button onClick={handleBack} className="absolute top-4 left-4 p-2 rounded-full bg-carbon/60 backdrop-blur-sm border border-border/30" style={{
          top: "max(1rem, env(safe-area-inset-top))"
        }} whileTap={{
          scale: 0.95
        }}>
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </motion.button>

          {/* Share Button */}
          <motion.button onClick={handleShare} className="absolute top-4 right-4 p-2 rounded-full bg-carbon/60 backdrop-blur-sm border border-border/30" style={{
          top: "max(1rem, env(safe-area-inset-top))"
        }} whileTap={{
          scale: 0.95
        }}>
            <Share2 className="w-5 h-5 text-foreground" />
          </motion.button>
        </div>

        {/* Profile Content - match creator self-view spacing */}
        <div className="relative px-4 -mt-16">
          {/* Avatar with Live Beacon */}
          <motion.div initial={{
          scale: 0.9,
          opacity: 0
        }} animate={{
          scale: 1,
          opacity: 1
        }} transition={{
          delay: 0.1
        }} className="relative">
            {/* Beacon wrapper (must NOT be overflow-hidden or the ring gets clipped) */}
            <div className={`w-28 h-28 rounded-full ${isLive ? "live-avatar-beacon" : ""}`}>
              <div className="w-full h-full rounded-full border-4 border-carbon overflow-hidden bg-obsidian">
                {profile.avatar_url ? <img src={profile.avatar_url} alt={`Avatar of ${profile.name}`} className="w-full h-full object-cover" loading="lazy" /> : <div className="w-full h-full flex items-center justify-center text-3xl font-display text-muted-foreground">
                    {profile.name.charAt(0).toUpperCase()}
                  </div>}
              </div>
            </div>

            {/* LIVE Badge */}
            {isLive && <motion.div initial={{
            scale: 0,
            opacity: 0
          }} animate={{
            scale: 1,
            opacity: 1
          }} transition={{
            delay: 0.2,
            type: "spring",
            stiffness: 400
          }} className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full font-bold text-xs bg-live text-primary-foreground">
                LIVE
              </motion.div>}
          </motion.div>

          {/* Name & Handle & Bio (spacing matches creator self-view) */}
          <motion.div initial={{
          y: 10,
          opacity: 0
        }} animate={{
          y: 0,
          opacity: 1
        }} transition={{
          delay: 0.15
        }} className="mt-4">
            <div className="flex items-center gap-2">
              <h1 className="font-display text-2xl text-foreground font-bold">
                {profile.name}
              </h1>
              {profile.is_verified === true && <BadgeCheck className="w-5 h-5 text-gold fill-gold/20" />}
            </div>
            {profile.handle && <p className="text-muted-foreground text-sm mt-0.5">@{profile.handle}</p>}
            {profile.bio ? <p className="text-foreground/80 text-sm mt-2">{profile.bio}</p> : <p className="text-muted-foreground/50 text-sm italic mt-2">No bio yet</p>}
            {websiteHref && <a href={websiteHref} target="_blank" rel="noopener noreferrer" className="text-electric text-sm hover:underline mt-1 block">
                {websiteHref.replace(/^https?:\/\//, "")}
              </a>}
          </motion.div>

          {/* Creator Reputation Stats - Only show for creators */}
          {creatorStats.isCreator && !creatorStatsLoading && <div className="mt-4">
              <CreatorReputationStats sessionsHosted={creatorStats.sessionsHosted} averageRating={creatorStats.averageRating} totalGuests={creatorStats.totalGuests} />
            </div>}

        {/* Stats */}
        <motion.div className="mt-6 flex gap-6" initial={{
          y: 10,
          opacity: 0
        }} animate={{
          y: 0,
          opacity: 1
        }} transition={{
          delay: 0.25
        }}>
          <button onClick={() => {
            triggerHaptic("light");
            setShowFollowList("followers");
          }} className="text-center hover:opacity-80 transition-opacity">
            <p className="font-display text-lg text-foreground">{followerCount}</p>
            <p className="text-xs text-muted-foreground">Followers</p>
          </button>
          <button onClick={() => {
            triggerHaptic("light");
            setShowFollowList("following");
          }} className="text-center hover:opacity-80 transition-opacity">
            <p className="font-display text-lg text-foreground">{followingCount}</p>
            <p className="text-xs text-muted-foreground">Following</p>
          </button>
        </motion.div>

        {/* Action Buttons */}
        <motion.div className="mt-6 flex gap-3" initial={{
          y: 10,
          opacity: 0
        }} animate={{
          y: 0,
          opacity: 1
        }} transition={{
          delay: 0.3
        }}>
          {isOwnProfile ? <Button onClick={handleEditProfile} variant="outline" className="flex-1 gap-2">
              <Edit2 className="w-4 h-4" />
              Edit Profile
            </Button> : user ? <Button onClick={handleFollow} disabled={isFollowLoading} variant={isFollowing ? "outline" : "default"} className="flex-1 gap-2">
              {isFollowing ? <>
                  <UserCheck className="w-4 h-4" />
                  Following
                </> : <>
                  <UserPlus className="w-4 h-4" />
                  Follow
                </>}
            </Button> : <Button onClick={() => navigate("/auth")} variant="default" className="flex-1 gap-2">
              <UserPlus className="w-4 h-4" />
              Sign in to Follow
            </Button>}
        </motion.div>

        {/* Message + Tip pills (creator-only, audience view) */}
        {showTipMe && !isOwnProfile && <motion.div initial={{
          opacity: 0,
          scale: 0.9
        }} animate={{
          opacity: 1,
          scale: 1
        }} transition={{
          delay: 0.32
        }} className="mt-5">
            <div className="flex items-center justify-center gap-3">
              {/* Message (LEFT) */}
              <motion.button whileTap={{
              scale: 0.97
            }} onClick={() => {
              triggerHaptic("light");
              setIsMessageOpen(true);
            }} className="px-4 py-2 rounded-full border border-border/40 bg-carbon/60 backdrop-blur-sm flex items-center gap-2 hover:bg-muted/30 transition-colors">
                <MessageCircle className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">Message</span>
              </motion.button>

              {/* Tip / Support (RIGHT) */}
              <motion.button whileTap={{
              scale: 0.97
            }} onClick={() => {
              triggerHaptic("light");
              setIsTipOpen(true);
            }} className="px-4 py-2 rounded-full border border-border/40 bg-carbon/60 backdrop-blur-sm flex items-center gap-2 hover:bg-muted/30 transition-colors">
                <Heart className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">Tip / Support</span>
              </motion.button>
            </div>
          </motion.div>}

        {/* Live Access Card - appears when creator is live */}
        {isLive && liveEvent && <motion.div initial={{
          opacity: 0,
          y: 20
        }} animate={{
          opacity: 1,
          y: 0
        }} transition={{
          delay: 0.4
        }} className="mt-5">
            <LiveAccessCard eventId={liveEvent.id} title={liveEvent.title} thumbnailUrl={liveEvent.cover_url} liveStartedAt={liveEvent.live_started_at} isOwnProfile={isOwnProfile} />
          </motion.div>}

        {/* Member Since */}
        {memberSince && <motion.p initial={{
          opacity: 0
        }} animate={{
          opacity: 1
        }} transition={{
          delay: 0.4
        }} className="text-xs text-muted-foreground mt-4 text-center">
            {isFoundingMember ? <>
                <span className="text-gold font-semibold">Founding Member</span>
                <span> · Since {memberSince}</span>
              </> : <>Member since {memberSince}</>}
          </motion.p>}

        {/* Upcoming Sessions - Only show for creators */}
        {creatorStats.isCreator && <UpcomingSessionsPreview creatorUserId={profile.user_id} />}

          {/* Portfolio Section */}
          <motion.div className="mt-8 pb-8" initial={{
          y: 10,
          opacity: 0
        }} animate={{
          y: 0,
          opacity: 1
        }} transition={{
          delay: 0.45
        }}>
            <PortfolioGrid userId={profile.user_id} isOwner={false} />
          </motion.div>
        </div>
      </div>

      {/* Follow List Modal */}
      {profile && <FollowListModal isOpen={showFollowList !== null} onClose={() => setShowFollowList(null)} userId={profile.user_id} type={showFollowList || "followers"} />}

      {/* Tip Modal */}
      {profile && <TipCreatorModal isOpen={isTipOpen} onClose={() => setIsTipOpen(false)} creatorName={profile.name} onComingSoon={() => toast.info("Tips will be enabled soon")} />}

      {/* Message Placeholder Modal */}
      <Dialog open={isMessageOpen} onOpenChange={setIsMessageOpen}>
        <DialogContent className="bg-obsidian border-border/40">
          <DialogHeader>
            <DialogTitle className="font-display text-foreground">Messaging is coming soon</DialogTitle>
            <DialogDescription>
              Direct messages with creators aren’t available yet. We’ll add this soon.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setIsMessageOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>;
}