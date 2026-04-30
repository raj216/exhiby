-- Revoke PUBLIC and re-grant to authenticated only for client-callable functions
DO $$
DECLARE
  f text;
  client_callable text[] := ARRAY[
    'public.get_portfolio_items(uuid)',
    'public.get_creator_feedback(uuid)',
    'public.get_creator_rating_stats(uuid)',
    'public.get_user_attendance_count(uuid)',
    'public.get_follower_count(uuid)',
    'public.get_following_count(uuid)',
    'public.is_following(uuid)',
    'public.get_live_viewer_count(uuid)',
    'public.get_event_viewers(uuid)',
    'public.has_role(uuid, public.app_role)',
    'public.get_following_list(uuid)',
    'public.get_creator_profiles(uuid[])',
    'public.get_all_public_profiles()',
    'public.get_public_profile(uuid)',
    'public.get_public_profile_by_handle(text)',
    'public.get_public_profile_by_profile_id(uuid)',
    'public.get_followers_list(uuid)',
    'public.get_or_create_conversation(uuid)',
    'public.get_user_conversations()',
    'public.is_conversation_participant(uuid, uuid)',
    'public.search_public_profiles(text)',
    'public.get_active_viewer_count(uuid)',
    'public.get_creator_session_stats(uuid)',
    'public.get_event_room_url(uuid)',
    'public.get_upcoming_sessions(uuid, integer)',
    'public.upsert_live_viewer(uuid, uuid)',
    'public.remove_live_viewer(uuid, uuid)'
  ];
BEGIN
  FOREACH f IN ARRAY client_callable LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
  END LOOP;
END $$;

-- Lock down admin/server-only functions completely from clients
REVOKE EXECUTE ON FUNCTION public.get_all_feedback_admin() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assign_admin_role(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;

-- Trigger-only functions: revoke from clients (they run as triggers)
REVOKE EXECUTE ON FUNCTION public.cleanup_ended_stream_viewers() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_message_columns() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assign_founding_member() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_notification_preferences() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tickets_user_update_guard() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
