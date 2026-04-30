-- 1. Tighten follows SELECT policy to authenticated only
DROP POLICY IF EXISTS "Users can view related follows" ON public.follows;
CREATE POLICY "Users can view related follows"
ON public.follows
FOR SELECT
TO authenticated
USING ((auth.uid() = follower_id) OR (auth.uid() = following_id));

-- 2. Revoke EXECUTE from anon on all SECURITY DEFINER functions in public schema
REVOKE EXECUTE ON FUNCTION public.get_portfolio_items(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_creator_feedback(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_creator_rating_stats(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_attendance_count(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_follower_count(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_following_count(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_following(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_live_viewer_count(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_event_viewers(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_following_list(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_creator_profiles(uuid[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_all_public_profiles() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_public_profile(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_public_profile_by_handle(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_public_profile_by_profile_id(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_followers_list(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_or_create_conversation(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_conversations() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_conversation_participant(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.search_public_profiles(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_active_viewer_count(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_creator_session_stats(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_event_room_url(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_upcoming_sessions(uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.upsert_live_viewer(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.remove_live_viewer(uuid, uuid) FROM anon;

-- 3. Lock down admin-only / server-only functions from both anon and authenticated.
-- These already enforce their own checks but should not be reachable via PostgREST.
REVOKE EXECUTE ON FUNCTION public.get_all_feedback_admin() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.assign_admin_role(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text, text) FROM anon, authenticated, public;
