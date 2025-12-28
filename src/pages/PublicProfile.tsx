import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Edit2, Share2, MapPin, Link as LinkIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { triggerHaptic } from "@/lib/haptics";
import defaultCover from "@/assets/default-cover.jpg";

interface PublicProfileData {
  id: string;
  user_id: string;
  handle: string | null;
  name: string;
  avatar_url: string | null;
  bio: string | null;
  cover_url: string | null;
  website: string | null;
  created_at: string;
  updated_at: string;
}

export default function PublicProfile() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profile, setProfile] = useState<PublicProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isOwnProfile = user?.id === userId;

  useEffect(() => {
    const fetchProfile = async () => {
      if (!userId) {
        setError("Invalid profile ID");
        setIsLoading(false);
        return;
      }

      try {
        const { data, error: rpcError } = await supabase.rpc("get_public_profile", {
          profile_user_id: userId,
        });

        if (rpcError) {
          console.error("Error fetching profile:", rpcError);
          setError("Failed to load profile");
          return;
        }

        // The RPC returns an array, take the first result
        if (data && Array.isArray(data) && data.length > 0) {
          setProfile(data[0] as PublicProfileData);
        } else {
          console.log("No profile data returned for userId:", userId);
          setError("Profile not found");
        }
      } catch (err) {
        console.error("Profile fetch error:", err);
        setError("Failed to load profile");
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [userId]);

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
          src={profile.cover_url || defaultCover}
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
        {profile.bio && (
          <motion.p
            className="mt-4 text-foreground/80 text-sm leading-relaxed"
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            {profile.bio}
          </motion.p>
        )}

        {/* Website */}
        {profile.website && (
          <motion.a
            href={profile.website.startsWith("http") ? profile.website : `https://${profile.website}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex items-center gap-2 text-electric text-sm hover:underline"
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.25 }}
          >
            <LinkIcon className="w-4 h-4" />
            {profile.website.replace(/^https?:\/\//, "")}
          </motion.a>
        )}

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
          ) : (
            <>
              {/* Follow button will be added in the next iteration */}
              <div className="flex-1" />
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
