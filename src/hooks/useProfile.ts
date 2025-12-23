import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface UserProfile {
  name: string;
  handle: string | null;
  avatarUrl: string | null;
  email: string;
  memberSince: string;
  bio?: string | null;
  website?: string | null;
  coverUrl?: string | null;
}

export function useProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) {
        setProfile(null);
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("name, handle, avatar_url, email, created_at, bio, website, cover_url")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) {
          console.error("Error fetching profile:", error);
          setIsLoading(false);
          return;
        }

        if (data) {
          const createdDate = new Date(data.created_at);
          const memberSince = createdDate.toLocaleDateString("en-US", {
            month: "short",
            year: "numeric",
          });

          setProfile({
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
      } catch (error) {
        console.error("Profile fetch error:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

  return { profile, isLoading };
}
