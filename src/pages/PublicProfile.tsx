import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Edit2, Share2, UserPlus, UserCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { triggerHaptic } from "@/lib/haptics";
import { toast } from "sonner";
import defaultCover from "@/assets/default-cover.jpg";

interface PublicProfileData {
  user_id: string;
  name: string;
  handle: string | null;
  avatar_url: string | null;
  bio: string | null;
}

export default function PublicProfile() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profile, setProfile] = useState<PublicProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [followerCount, setFollowerCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);

  const isOwnProfile = user?.id === profile?.user_id;

  const fetchFollowData = useCallback(async (targetUserId: string) => {
    // Fetch follower count
    const { data: count } = await supabase.rpc("get_follower_count", {
      target_user_id: targetUserId,
    });
    setFollowerCount(count || 0);

    // Check if current user follows this profile
    if (user) {
      const { data: following } = await supabase.rpc("is_following", {
        target_user_id: targetUserId,
      });
      setIsFollowing(following || false);
    }
  }, [user]);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!userId) {
        console.error("[PublicProfile] No userId provided in route params");
        setError("Invalid profile ID");
        setIsLoading(false);
        return;
      }

      try {
        // Only use RPC - never query profiles table directly for other users
        const { data, error: rpcError } = await supabase.rpc("get_public_profile", {
          profile_user_id: userId,
        });

        if (rpcError) {
          console.error("[PublicProfile] RPC error:", rpcError);
          setError("Failed to load profile");
          setIsLoading(false);
          return;
        }

        // The RPC returns an array, take the first result
        if (data && Array.isArray(data) && data.length > 0) {
          console.log("PublicProfile loaded via RPC for user_id:", userId);
          const profileData = data[0] as PublicProfileData;
          setProfile(profileData);
          fetchFollowData(profileData.user_id);
        } else {
          // Fallback: try by profile row id
          const { data: fallbackData, error: fallbackError } = await supabase.rpc(
            "get_public_profile_by_profile_id",
            { profile_id: userId }
          );

          if (fallbackError) {
            console.error("[PublicProfile] Fallback RPC error:", fallbackError);
            setError("Profile not found");
          } else if (fallbackData && Array.isArray(fallbackData) && fallbackData.length > 0) {
            console.log("PublicProfile loaded via RPC for user_id:", fallbackData[0].user_id);
            const profileData = fallbackData[0] as PublicProfileData;
            setProfile(profileData);
            fetchFollowData(profileData.user_id);
          } else {
            console.log("[PublicProfile] Profile not found for:", userId);
            setError("Profile not found");
          }
        }
      } catch (err) {
        console.error("[PublicProfile] Unexpected fetch error:", err);
        setError("Failed to load profile");
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [userId, fetchFollowData]);

  const handleFollow = async () => {
    if (!user || !profile) return;
    
    triggerHaptic("medium");
    setIsFollowLoading(true);

    try {
      if (isFollowing) {
        // Unfollow
        const { error } = await supabase
          .from("follows")
          .delete()
          .eq("follower_id", user.id)
          .eq("following_id", profile.user_id);

        if (error) throw error;

        setIsFollowing(false);
        setFollowerCount((prev) => Math.max(0, prev - 1));
        toast.success(`Unfollowed ${profile.name}`);
      } else {
        // Follow
        const { error } = await supabase.from("follows").insert({
          follower_id: user.id,
          following_id: profile.user_id,
        });

        if (error) throw error;

        setIsFollowing(true);
        setFollowerCount((prev) => prev + 1);
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
    navigate(-1);
  };

  const handleEditProfile = () => {
    triggerHaptic("light");
    navigate("/", { state: { openEditProfile: true } });
  };

  const handleShare = async () => {
    triggerHaptic("light");
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: profile?.name || "Profile", url });
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-carbon">
        <Skeleton className="w-full h-48" />
        <div className="px-4 -mt-16">
          <Skeleton className="w-32 h-32 rounded-full border-4 border-carbon" />
          <Skeleton className="mt-4 h-8 w-48" />
          <Skeleton className="mt-2 h-4 w-32" />
          <Skeleton className="mt-4 h-16 w-full" />
        </div>
      </div>
    );
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
      {/* Cover Image */}
      <div className="relative h-48 md:h-64">
        <img
          src={defaultCover}
          alt="Cover"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-carbon/80 to-transparent" />
        
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
          <Share2 className="w-5 h-5 text-foreground" />
        </motion.button>
      </div>

      {/* Profile Content */}
      <div className="px-4 md:px-6 -mt-16 relative z-10 max-w-2xl mx-auto">
        {/* Avatar */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <div className="w-28 h-28 md:w-32 md:h-32 rounded-full border-4 border-carbon overflow-hidden bg-obsidian">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl font-display text-muted-foreground">
                {profile.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </motion.div>

        {/* Name & Handle */}
        <motion.div
          className="mt-4"
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15 }}
        >
          <h1 className="font-display text-2xl md:text-3xl text-foreground">
            {profile.name}
          </h1>
          {profile.handle && (
            <p className="text-muted-foreground text-sm">@{profile.handle}</p>
          )}
        </motion.div>

        {/* Bio */}
        <motion.div
          className="mt-4"
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {profile.bio ? (
            <p className="text-foreground/80 text-sm leading-relaxed">
              {profile.bio}
            </p>
          ) : (
            <p className="text-muted-foreground/50 text-sm italic">
              No bio yet
            </p>
          )}
        </motion.div>

        {/* Stats */}
        <motion.div
          className="mt-6 flex gap-6"
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.25 }}
        >
          <div className="text-center">
            <p className="font-display text-lg text-foreground">{followerCount}</p>
            <p className="text-xs text-muted-foreground">Followers</p>
          </div>
          <div className="text-center">
            <p className="font-display text-lg text-foreground">0</p>
            <p className="text-xs text-muted-foreground">Sessions</p>
          </div>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          className="mt-6 flex gap-3"
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          {isOwnProfile ? (
            <Button
              onClick={handleEditProfile}
              variant="outline"
              className="flex-1 gap-2"
            >
              <Edit2 className="w-4 h-4" />
              Edit Profile
            </Button>
          ) : user ? (
            <Button
              onClick={handleFollow}
              disabled={isFollowLoading}
              variant={isFollowing ? "outline" : "default"}
              className="flex-1 gap-2"
            >
              {isFollowing ? (
                <>
                  <UserCheck className="w-4 h-4" />
                  Following
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  Follow
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={() => navigate("/auth")}
              variant="default"
              className="flex-1 gap-2"
            >
              <UserPlus className="w-4 h-4" />
              Sign in to Follow
            </Button>
          )}
        </motion.div>

        {/* Portfolio placeholder */}
        <motion.div
          className="mt-8 pb-8"
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.35 }}
        >
          <h2 className="font-display text-lg text-foreground mb-4">Portfolio</h2>
          <div className="rounded-xl border border-border/30 bg-obsidian/50 p-8 text-center">
            <p className="text-muted-foreground/50 text-sm">No artwork yet</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
