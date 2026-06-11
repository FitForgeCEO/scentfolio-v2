-- rls_auto_enable() is a trigger function created when Dan clicked
-- "Create ensure_rls trigger" in the Supabase Auth Policies dashboard.
-- It fires on new public.* table creation to auto-enable RLS -- great
-- defence-in-depth, but should NOT be callable as a public RPC via
-- /rest/v1/rpc/rls_auto_enable.
--
-- Triggers run with the function owner's privileges regardless of
-- EXECUTE grants on the calling role, so revoking EXECUTE here does
-- NOT break the auto-enable mechanism.
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated, PUBLIC;
