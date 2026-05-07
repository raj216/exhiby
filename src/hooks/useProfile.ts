import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { ProfileLink } from "@/components/EditProfileModal";

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
  isVerified?: boolean;
  profileLinks?: ProfileLink[];
}

export function useProfile() {
  const { user } = useAuth();

  const { data: profile = null, isLoading } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async (): Promise<UserProfile | null> => {
      if (!user) return null;

      const { data, error } = await supabase
        .from("profiles")
        .select(
          "name, handle, avatar_url, created_at, bio, website, cover_url, is_founding_member, founding_number, is_verified, profile_links"
        )
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("[useProfile] Error:", error);
        return null;
      }

      if (!data) return null;

      const createdDate = new Date(data.created_at);
      const memberSince = createdDate.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      });

      return {
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
        profileLinks: (data.profile_links as ProfileLink[]) || [],
      };
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  return { profile, isLoading };
}
