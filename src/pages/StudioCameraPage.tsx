import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { StudioCameraView } from "@/components/live/StudioCameraView";
import { toast } from "sonner";

interface CameraEventData {
  id: string;
  title: string;
  creator_id: string;
  room_url: string | null;
}

export default function StudioCameraPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile();

  const [event, setEvent] = useState<CameraEventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId || !user) return;

    let cancelled = false;

    const fetchEvent = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from("events")
          .select("id, title, creator_id")
          .eq("id", eventId)
          .single();

        if (fetchError) throw fetchError;
        if (cancelled) return;

        if (data.creator_id !== user.id) {
          setError("Only the studio creator can use the studio camera.");
          setLoading(false);
          return;
        }

        const { data: roomUrl } = await supabase.rpc("get_event_room_url", {
          event_id: eventId,
        });

        if (cancelled) return;

        setEvent({
          id: data.id,
          title: data.title,
          creator_id: data.creator_id,
          room_url: roomUrl || null,
        });
        setLoading(false);
      } catch (e: any) {
        console.error("[StudioCameraPage] Failed to load event:", e);
        if (!cancelled) {
          setError("Could not load studio session.");
          setLoading(false);
        }
      }
    };

    fetchEvent();

    return () => {
      cancelled = true;
    };
  }, [eventId, user]);

  const handleDisconnect = () => {
    toast.success("Studio camera disconnected");
    navigate(`/live/${eventId}`);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-white/70 animate-spin" />
          <p className="text-white/70 text-sm">Loading studio camera…</p>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center px-6">
        <div className="flex flex-col items-center gap-4 max-w-sm text-center">
          <p className="text-white text-base">{error || "Session not found."}</p>
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 rounded-full bg-white text-black text-sm font-medium"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  if (!event.room_url) {
    return (
      <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center px-6">
        <div className="flex flex-col items-center gap-4 max-w-sm text-center">
          <p className="text-white text-base">
            This studio doesn't have an active room yet.
          </p>
          <p className="text-white/60 text-sm">
            Open the studio from the main view first, then return here to use the camera.
          </p>
          <button
            onClick={() => navigate(`/live/${eventId}`)}
            className="px-4 py-2 rounded-full bg-white text-black text-sm font-medium"
          >
            Open studio
          </button>
        </div>
      </div>
    );
  }

  return (
    <StudioCameraView
      roomUrl={event.room_url}
      eventTitle={event.title}
      creatorName={profile?.name || profile?.handle || "Studio"}
      onDisconnect={handleDisconnect}
    />
  );
}
