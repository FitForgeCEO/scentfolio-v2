-- Postgres column-level REVOKE only takes effect when table-level UPDATE
-- is NOT granted. The previous migration's REVOKE UPDATE (xp, level)
-- was a no-op because authenticated still had table-level UPDATE.
--
-- Fix: revoke table-level UPDATE, then grant UPDATE on the specific
-- columns clients are allowed to write. xp and level are NOT in the
-- grant list, so they become writable only via service_role or
-- SECURITY DEFINER (the award_xp RPC).
--
-- The "Users can update own profile" RLS policy still applies on top,
-- so users still can only UPDATE their own row.

REVOKE UPDATE ON public.profiles FROM authenticated;

GRANT UPDATE (display_name, avatar_url, updated_at)
  ON public.profiles
  TO authenticated;
