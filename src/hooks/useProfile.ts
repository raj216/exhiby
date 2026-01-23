import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface UserProfile {
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

export function useProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      // Debug: Always log auth state
      console.log("[useProfile] Auth state:", { 
        hasUser: !!user, 
        userId: user?.id, 
        email: user?.email 
      });

      if (!user) {
        console.log("[useProfile] No user, clearing profile");
        setProfile(null);
        setIsLoading(false);
        return;
      }

      try {
        console.log("[useProfile] Fetching profile for user:", user.id);
        const { data, error } = await supabase
          .from("profiles")
          .select("name, handle, avatar_url, created_at, bio, website, cover_url, is_founding_member, founding_number")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) {
          console.error("[useProfile] ❌ Error fetching profile:", error);
          // IMPORTANT: Do NOT set fallback "Guest" for authenticated users
          setIsLoading(false);
          return;
        }

        if (data) {
          console.log("[useProfile] ✅ Profile loaded:", { 
            name: data.name, 
            handle: data.handle,
            hasAvatar: !!data.avatar_url,
            hasCover: !!data.cover_url
          });
          const createdDate = new Date(data.created_at);
          const memberSince = createdDate.toLocaleDateString("en-US", {
            month: "short",
            year: "numeric",
          });

          setProfile({
            name: data.name,
            handle: data.handle,
            avatarUrl: data.avatar_url,
            memberSince,
            bio: data.bio,
            website: data.website,
            coverUrl: data.cover_url,
            isFoundingMember: data.is_founding_member ?? false,
            foundingNumber: data.founding_number,
          });
        } else {
          console.warn("[useProfile] ⚠️ Profile query returned null/empty for authenticated user");
          // Profile row missing - this should not happen for authenticated users
        }
      } catch (error) {
        console.error("[useProfile] ❌ Unexpected error:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

  return { profile, isLoading };
}
