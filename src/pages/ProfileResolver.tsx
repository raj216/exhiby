import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ProfilePageSkeleton } from "@/components/ui/loading-skeletons";
import { Button } from "@/components/ui/button";

/**
 * ProfileResolver handles /user/:identifier routes
 * Resolves either a handle (e.g., "mrk") or a userId (UUID) to the correct profile
 */
export default function ProfileResolver() {
  const { identifier } = useParams<{ identifier: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!identifier) {
      setError("No profile identifier provided");
      return;
    }

    const resolveProfile = async () => {
      console.log("[ProfileResolver] Resolving identifier:", identifier);

      // Check if identifier looks like a UUID
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);

      if (isUUID) {
        // It's a UUID - redirect directly to /profile/:userId
        console.log("[ProfileResolver] Identifier is UUID, redirecting to /profile/" + identifier);
        navigate(`/profile/${identifier}`, { replace: true });
        return;
      }

      // Try to resolve as a handle
      console.log("[ProfileResolver] Looking up handle:", identifier);
      const { data, error: rpcError } = await supabase.rpc("get_public_profile_by_handle", {
        target_handle: identifier,
      });

      console.log("[ProfileResolver] Handle lookup result:", { data, error: rpcError });

      if (rpcError) {
        console.error("[ProfileResolver] RPC error:", rpcError);
        setError("Failed to load profile");
        return;
      }

      if (data && Array.isArray(data) && data.length > 0) {
        const userId = data[0].user_id;
        console.log("[ProfileResolver] Found user_id:", userId, "for handle:", identifier);
        navigate(`/profile/${userId}`, { replace: true });
        return;
      }

      // Handle not found
      console.log("[ProfileResolver] Handle not found:", identifier);
      setError("Profile not found");
    };

    resolveProfile();
  }, [identifier, navigate]);

  if (error) {
    return (
      <div className="min-h-screen bg-carbon flex flex-col items-center justify-center px-4">
        <p className="text-muted-foreground mb-4">{error}</p>
        <p className="text-xs text-muted-foreground/50 mb-4">@{identifier}</p>
        <Button variant="outline" onClick={() => navigate("/")}>
          Go Home
        </Button>
      </div>
    );
  }

  return <ProfilePageSkeleton />;
}
