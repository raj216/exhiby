import { supabase } from "@/integrations/supabase/client";

export type UpcomingSessionStatus = "scheduled" | "live";

export interface UpcomingSessionRow {
  id: string;
  title: string;
  cover_url: string | null;
  scheduled_at: string; // timestamptz ISO string
  is_free: boolean;
  price: number | null;
  category: string | null;
  creator_id: string;
  is_live: boolean;
  live_ended_at: string | null;
  status: UpcomingSessionStatus;
}

export interface UpcomingSessionWithCreator extends UpcomingSessionRow {
  creator?: {
    name: string;
    avatar_url: string | null;
    is_verified?: boolean;
  };
}

export async function getUpcomingSessions(params: {
  limit?: number;
  creatorId?: string;
}): Promise<UpcomingSessionWithCreator[]> {
  const { limit = 50, creatorId } = params;

  // Source of truth: database-side filtering via public.get_upcoming_sessions()
  // - uses NOW() on the database (timezone-safe)
  // - includes a 10-minute grace window
  const { data, error } = await supabase.rpc("get_upcoming_sessions", {
    p_creator_id: creatorId ?? null,
    p_limit: limit,
  });

  if (error) throw error;

  const sessions = (data || []) as UpcomingSessionRow[];
  if (sessions.length === 0) return [];

  // Hydrate creator profile info (name + avatar) via existing safe RPC
  const creatorIds = Array.from(new Set(sessions.map((s) => s.creator_id)));
  const { data: creators, error: creatorsError } = await supabase.rpc(
    "get_creator_profiles",
    { user_ids: creatorIds }
  );

  if (creatorsError) {
    // Non-fatal: we can still render sessions without creator details.
    console.warn("[getUpcomingSessions] creator profile fetch failed", creatorsError);
    return sessions;
  }

  const creatorMap = new Map(
    (creators || []).map((c: { user_id: string; name: string; avatar_url: string | null; is_verified?: boolean }) => [
      c.user_id,
      c,
    ])
  );

  return sessions.map((s) => {
    const creator = creatorMap.get(s.creator_id);
    return {
      ...s,
      creator: creator
        ? {
            name: creator.name,
            avatar_url: creator.avatar_url,
            is_verified: (creator as any).is_verified,
          }
        : undefined,
    };
  });
}
