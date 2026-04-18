import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Edit2, Users, BadgeCheck, Share } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ProfilePageSkeleton } from "@/components/ui/loading-skeletons";
import { triggerHaptic } from "@/lib/haptics";
import { safeExternalUrl } from "@/lib/utils";
import { toast } from "sonner";
import { FollowListModal } from "@/components/FollowListModal";
import { PortfolioGrid } from "@/components/PortfolioGrid";
import { ProfileActionBar } from "@/components/ProfileActionBar";
import { LiveAccessCard } from "@/components/LiveAccessCard";
import { useLiveViewers } from "@/hooks/useLiveViewers";
import { usePublicCreatorStats } from "@/hooks/usePublicCreatorStats";
import { CreatorReputationStats } from "@/components/CreatorReputationStats";
import { UpcomingSessionsPreview } from "@/components/UpcomingSessionsPreview";
import { TipCreatorModal } from "@/components/TipCreatorModal";
import { ShareProfileModal } from "@/components/ShareProfileModal";


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
  const { userId } = useParams<{ userId: string }>();

  // Debug: confirm the route param we are receiving
  console.log("[PublicProfile] param userId:", userId);
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
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
  const [isShareOpen, setIsShareOpen] = useState(false);
  
  const isOwnProfile = user?.id === profile?.user_id;

  // Real-time viewer count for the live event
  const { viewerCount } = useLiveViewers(liveEvent?.id ?? null);

  // Public creator stats (only show if user is a creator)
  const { stats: creatorStats, loading: creatorStatsLoading } = usePublicCreatorStats(profile?.user_id);
  const showTipMe = Boolean(creatorStats.isCreator);

  // Check if user is a founding member from database
  const isFoundingMember = profile?.is_founding_member ?? false;
  const foundingNumber = profile?.founding_number;
  const isLive = liveEvent !== null;

  const fetchFollowData = useCallback(async (targetUserId: string) => {
    // Fetch follower count
    const { data: followers } = await supabase.rpc("get_follower_count", {
      target_user_id: targetUserId
    });
    setFollowerCount(followers || 0);

    // Fetch following count
    const { data: following } = await supabase.rpc("get_following_count", {
      target_user_id: targetUserId
    });
    setFollowingCount(following || 0);

    // Check if current user follows this profile
    if (user) {
      const { data: isFollowingData } = await supabase.rpc("is_following", {
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
      const { data, error } = await supabase
        .from("events")
        .select("id, title, cover_url, live_started_at")
        .eq("creator_id", creatorUserId)
        .eq("is_live", true)
        .is("live_ended_at", null)
        .maybeSingle();
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
        const { data, error: rpcError } = await supabase.rpc("get_public_profile", {
          profile_user_id: userId
        });
        console.log("[PublicProfile][AUDIENCE] RPC get_public_profile response:", {
          args: { profile_user_id: userId },
          data,
          error: rpcError
        });
        let profileData: PublicProfileData | null = null;
        if (!rpcError && data && Array.isArray(data) && data.length > 0) {
          console.log("PublicProfile loaded via RPC for user_id:", userId);
          profileData = data[0] as PublicProfileData;
        } else {
          const { data: fallbackData, error: fallbackError } = await supabase.rpc("get_public_profile_by_profile_id", {
            profile_id: userId
          });
          console.log("[PublicProfile][AUDIENCE] RPC get_public_profile_by_profile_id response:", {
            args: { profile_id: userId },
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

        if (user && profileData.user_id === user.id) {
          console.log("[PublicProfile] Detected own profile, redirecting to own profile screen");
          navigate("/", { state: { openProfile: true }, replace: true });
          return;
        }
        setProfile(profileData);

        console.log("AUDIENCE PROFILE FETCH:", profileData);
        console.log("AUDIENCE is_verified:", (profileData as any)?.is_verified);
        fetchFollowData(profileData.user_id);

        await fetchLiveEvent(profileData.user_id);

        channel = supabase
          .channel(`creator-live-${profileData.user_id}`)
          .on("postgres_changes", {
            event: "*",
            schema: "public",
            table: "events",
            filter: `creator_id=eq.${profileData.user_id}`
          }, () => {
            fetchLiveEvent(profileData!.user_id);
          })
          .subscribe();
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
        const { error } = await supabase
          .from("follows")
          .delete()
          .eq("follower_id", user.id)
          .eq("following_id", profile.user_id);
        if (error) throw error;
        setIsFollowing(false);
        setFollowerCount(prev => Math.max(0, prev - 1));
        toast.success(`Unfollowed ${profile.name}`);
      } else {
        const { error } = await supabase.from("follows").insert({
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
    const state = (location.state && typeof location.state === "object" ? location.state as Record<string, unknown> : {}) as Record<string, unknown>;
    const returnTo = state.returnTo as {
      pathname: string;
      search?: string;
      state?: Record<string, unknown>;
    } | undefined;
    if (returnTo?.pathname) {
      navigate({
        pathname: returnTo.pathname,
        search: returnTo.search ?? ""
      }, { state: returnTo.state ?? undefined });
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
          navigate({
            pathname: parsed.pathname,
            search: parsed.search ?? ""
          }, { state: parsed.state ?? undefined });
          return;
        }
      }
    } catch {
      // ignore
    }

    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate("/", { state: { openProfile: true }, replace: true });
  };

  const handleEditProfile = () => {
    triggerHaptic("light");
    navigate("/", { state: { openEditProfile: true } });
  };

  const handleShare = () => {
    triggerHaptic("light");
    setIsShareOpen(true);
  };

  const handleMessage = () => {
    if (!profile) return;
    triggerHaptic("light");
    // Navigate to new chat screen - conversation is only created when first message is sent
    navigate(`/chat/new/${profile.user_id}`);
  };

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("en-US", {
        month: "short",
        year: "numeric"
      })
    : null;
  const websiteHref = safeExternalUrl(profile?.website);

  useEffect(() => {
    if (!profile) return;
    const baseTitle = profile.handle ? `${profile.name} (${profile.handle})` : profile.name;
    const title = `${baseTitle}${isLive ? " is Live 🔴" : ""} | Exhiby`;
    const shortTitle = title.slice(0, 60);
    const desc = `View ${profile.name}'s profile${isLive ? " and join their live stream" : ""} on Exhiby. Explore their portfolio and follow for future live sessions.`.slice(0, 160);
    const canonicalHref = `${window.location.origin}/profile/${profile.user_id}`;
    const image = profile.cover_url || profile.avatar_url || `${window.location.origin}/og-default.png`;

    const setMeta = (selector: string, attr: string, value: string) => {
      let el = document.querySelector(selector) as HTMLElement | null;
      if (!el) {
        el = document.createElement("meta");
        const match = selector.match(/\[(.*?)="(.*?)"\]/);
        if (match) el.setAttribute(match[1], match[2]);
        document.head.appendChild(el);
      }
      el.setAttribute(attr, value);
    };

    document.title = shortTitle;
    setMeta('meta[name="description"]', "content", desc);
    setMeta('meta[property="og:title"]', "content", shortTitle);
    setMeta('meta[property="og:description"]', "content", desc);
    setMeta('meta[property="og:image"]', "content", image);
    setMeta('meta[property="og:url"]', "content", canonicalHref);
    setMeta('meta[property="og:type"]', "content", "profile");
    setMeta('meta[property="og:site_name"]', "content", "Exhiby");
    setMeta('meta[name="twitter:card"]', "content", "summary_large_image");
    setMeta('meta[name="twitter:title"]', "content", shortTitle);
    setMeta('meta[name="twitter:description"]', "content", desc);
    setMeta('meta[name="twitter:image"]', "content", image);

    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", canonicalHref);
  }, [profile, isLive]);

  if (isLoading) {
    return <ProfilePageSkeleton />;
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-carbon flex flex-col items-center justify-center px-4">
        <p className="text-muted-foreground mb-4">{error || "Profile not found"}</p>
        <p className="text-xs text-muted-foreground/50 mb-4">ID: {userId}</p>
        <Button variant="outline" onClick={handleBack}>
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-carbon">
      {/* Main Container */}
      <div className="max-w-screen-xl mx-auto lg:px-8">
        {/* Cover Image */}
        <div className="relative h-48 sm:h-56 w-full overflow-hidden">
          {profile.cover_url ? (
            <img
              src={profile.cover_url}
              alt={`Cover photo of ${profile.name}`}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-obsidian via-carbon to-obsidian" />
          )}

          {/* Live pill on cover */}
          {isLive && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute bottom-4 left-4 px-3 py-1.5 rounded-full backdrop-blur-sm border border-live/30 bg-carbon/70 flex items-center gap-2"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-live opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-live" />
              </span>
              <span className="text-xs font-bold tracking-wide text-primary-foreground">LIVE NOW</span>
              {viewerCount > 0 && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="w-3 h-3" />
                  {viewerCount}
                </span>
              )}
            </motion.div>
          )}

          {/* Back Button */}
          <motion.button
            onClick={handleBack}
            className="absolute top-4 left-4 p-2 rounded-full bg-carbon/60 backdrop-blur-sm border border-border/30"
            style={{ top: "max(1rem, env(safe-area-inset-top))" }}
            whileTap={{ scale: 0.95 }}
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </motion.button>

          {/* Share Button */}
          <motion.button
            onClick={handleShare}
            className="absolute top-4 right-4 p-2 rounded-full bg-carbon/60 backdrop-blur-sm border border-border/30"
            style={{ top: "max(1rem, env(safe-area-inset-top))" }}
            whileTap={{ scale: 0.95 }}
          >
            <Share className="w-5 h-5 text-foreground" />
          </motion.button>
        </div>

        {/* Profile Content */}
        <div className="relative px-4 -mt-16">
          {/* Avatar with Live Beacon */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="relative"
          >
            <div className={`w-28 h-28 rounded-full ${isLive ? "live-avatar-beacon" : ""}`}>
              <div className="w-full h-full rounded-full border-4 border-carbon overflow-hidden bg-obsidian">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={`Avatar of ${profile.name}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-3xl font-display text-muted-foreground">
                    {profile.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            </div>

            {/* LIVE Badge */}
            {isLive && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 400 }}
                className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full font-bold text-xs bg-live text-primary-foreground"
              >
                LIVE
              </motion.div>
            )}
          </motion.div>

          {/* Name & Handle & Bio */}
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="mt-4"
          >
            <div className="flex items-center gap-2">
              <h1 className="font-display text-2xl text-foreground font-bold">{profile.handle ? profile.handle : profile.name}</h1>
              {profile.is_verified === true && <BadgeCheck className="w-5 h-5 text-gold fill-gold/20" />}
            </div>
            <p className="text-muted-foreground text-sm mt-0.5">{profile.name}</p>
            {profile.bio ? (
              <p className="text-foreground/80 text-sm mt-2">{profile.bio}</p>
            ) : (
              <p className="text-muted-foreground/50 text-sm italic mt-2">No bio yet</p>
            )}
            {websiteHref && (
              <a
                href={websiteHref}
                target="_blank"
                rel="noopener noreferrer"
                className="text-electric text-sm hover:underline mt-1 block"
              >
                {websiteHref.replace(/^https?:\/\//, "")}
              </a>
            )}
          </motion.div>

          {/* Creator Reputation Stats */}
          {creatorStats.isCreator && !creatorStatsLoading && (
            <div className="mt-4">
              <CreatorReputationStats
                sessionsHosted={creatorStats.sessionsHosted}
                averageRating={creatorStats.averageRating}
                totalGuests={creatorStats.totalGuests}
              />
            </div>
          )}

          {/* Stats */}
          <motion.div
            className="mt-6 flex gap-6"
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.25 }}
          >
            <button
              onClick={() => {
                triggerHaptic("light");
                setShowFollowList("followers");
              }}
              className="text-center hover:opacity-80 transition-opacity"
            >
              <p className="font-display text-lg text-foreground">{followerCount}</p>
              <p className="text-xs text-muted-foreground">Followers</p>
            </button>
            <button
              onClick={() => {
                triggerHaptic("light");
                setShowFollowList("following");
              }}
              className="text-center hover:opacity-80 transition-opacity"
            >
              <p className="font-display text-lg text-foreground">{followingCount}</p>
              <p className="text-xs text-muted-foreground">Following</p>
            </button>
          </motion.div>

          {/* Action Buttons - Show Follow + Message for ALL profiles (creators and audience) */}
          {isOwnProfile ? (
            <motion.div
              className="mt-6 flex gap-3"
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <Button onClick={handleEditProfile} variant="outline" className="flex-1 gap-2">
                <Edit2 className="w-4 h-4" />
                Edit Profile
              </Button>
            </motion.div>
          ) : (
            <ProfileActionBar
              isFollowing={isFollowing}
              isFollowLoading={isFollowLoading}
              isLoading={isLoading}
              onFollowClick={handleFollow}
              onMessageClick={handleMessage}
              onSupportClick={() => setIsTipOpen(true)}
              showTipButton={showTipMe}
            />
          )}

          {/* Live Access Card */}
          {isLive && liveEvent && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="mt-5"
            >
              <LiveAccessCard
                eventId={liveEvent.id}
                title={liveEvent.title}
                thumbnailUrl={liveEvent.cover_url}
                liveStartedAt={liveEvent.live_started_at}
                isOwnProfile={isOwnProfile}
              />
            </motion.div>
          )}

          {/* Member Since */}
          {memberSince && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-xs text-muted-foreground mt-4 text-center"
            >
              {isFoundingMember ? (
                <>
                  <span className="text-gold font-semibold">Founding Member</span>
                  <span> · Since {memberSince}</span>
                </>
              ) : (
                <>Member since {memberSince}</>
              )}
            </motion.p>
          )}

          {/* Upcoming Sessions */}
          {creatorStats.isCreator && <UpcomingSessionsPreview creatorUserId={profile.user_id} />}

          {/* Portfolio Section */}
          <motion.div
            className="mt-8 pb-8"
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.45 }}
          >
            <PortfolioGrid userId={profile.user_id} isOwner={false} />
          </motion.div>
        </div>
      </div>

      {/* Follow List Modal */}
      {profile && (
        <FollowListModal
          isOpen={showFollowList !== null}
          onClose={() => setShowFollowList(null)}
          userId={profile.user_id}
          type={showFollowList || "followers"}
        />
      )}

      {/* Tip Modal */}
      {profile && (
        <TipCreatorModal
          isOpen={isTipOpen}
          onClose={() => setIsTipOpen(false)}
          creatorName={profile.name}
        />
      )}

      {/* Share Profile Modal */}
      <ShareProfileModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        handle={profile?.handle ?? null}
        userId={profile?.user_id}
      />
    </div>
  );
}
