UPDATE public.profiles p
SET profile_links = (u.raw_user_meta_data->'profile_links')
FROM auth.users u
WHERE p.user_id = u.id
  AND u.raw_user_meta_data ? 'profile_links'
  AND jsonb_typeof(u.raw_user_meta_data->'profile_links') = 'array'
  AND jsonb_array_length(u.raw_user_meta_data->'profile_links') > 0
  AND (p.profile_links IS NULL OR p.profile_links = '[]'::jsonb);