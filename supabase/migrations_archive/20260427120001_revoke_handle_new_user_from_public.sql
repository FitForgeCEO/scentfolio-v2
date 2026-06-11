-- handle_new_user() is the auth trigger that inserts into public.profiles
-- when a new auth.users row is created. It should fire ONLY as the trigger,
-- not be callable by browser clients via /rest/v1/rpc/handle_new_user.
--
-- Triggers run with the function owner's privileges regardless of EXECUTE
-- grants on the role calling them, so revoking EXECUTE here does NOT break
-- the signup flow -- it only closes the rogue RPC call path.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
