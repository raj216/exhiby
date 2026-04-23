import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { CompanionModeView } from "@/components/live/CompanionModeView";

interface EventData {
  id: string;
  title: string;
  creator_id: string;
  is_live: boolean;
}

export default function CompanionModePage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile();

  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId || !user) return;

    let cancelled = false;

    const fetchEvent = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from("events")
          .select("id, title, creator_id, is_live")
          .eq("id", eventId)
          .single();

        if (fetchError) throw fetchError;
        if (cancelled) return;

        // Only the creator can use companion mode
        if (data.creator_id !== user.id) {
          setError("Companion mode is only available to the session creator.");
          setLoading(false);
          return;
        }

        if (!data.is_live) {
          setError("This session is not currently live.");
          setLoading(false);
          return;
        }

        setEvent(data);
        setLoading(false);
      } catch (e: any) {
        console.error("[CompanionModePage] Failed to load event:", e);
        if (!cancelled) {
          setError("Could not load studio session.");
          setLoading(false);
        }
      }
    };

    fetchEvent();
    return () => { cancelled = true; };
  }, [eventId, user]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
          <p className="text-sm text-muted-foreground">Loading companion mode…</p>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center px-6">
        <div className="flex flex-col items-center gap-4 max-w-sm text-center">
          <p className="text-foreground text-base">{error || "Session not found."}</p>
          <button
            onClick={() => navigate(-1)}
            className="px-5 py-2.5 rounded-full bg-foreground text-background text-sm font-medium"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <CompanionModeView
      eventId={event.id}
      creatorId={event.creator_id}
      eventTitle={event.title}
      creatorName={profile?.name || profile?.handle || "Studio"}
    />
  );
}
