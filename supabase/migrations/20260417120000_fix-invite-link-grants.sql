-- Fix: explicitly re-grant execute on invite link functions to authenticated role
-- and notify PostgREST to reload its schema cache

GRANT USAGE ON SCHEMA public TO authenticated, anon;

GRANT EXECUTE ON FUNCTION public.create_invite_link(uuid, text, text, timestamptz, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_invite_link_details(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_invite_link(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_invite_link(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
