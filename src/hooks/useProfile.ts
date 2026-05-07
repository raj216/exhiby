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

      // Core profile query — uses only stable, long-existing columns
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "name, handle, avatar_url, created_at, bio, website, cover_url, is_founding_member, founding_number, is_verified"
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

      // Try DB column first (available once migration is applied).
      // Fall back to auth user_metadata — this is the primary save path used
      // by EditProfileModal so it always has the latest links even without the
      // DB column.
      let profileLinks: ProfileLink[] = [];
      const { data: linksRow, error: linksError } = await supabase
        .from("profiles")
        .select("profile_links")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!linksError && linksRow?.profile_links) {
        profileLinks = linksRow.profile_links as ProfileLink[];
      } else {
        const { data: authData } = await supabase.auth.getUser();
        const metaLinks = authData?.user?.user_metadata?.profile_links;
        if (Array.isArray(metaLinks)) {
          profileLinks = metaLinks as ProfileLink[];
        }
      }

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
        profileLinks,
      };
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  return { profile, isLoading };
}
