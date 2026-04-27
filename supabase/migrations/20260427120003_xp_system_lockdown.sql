-- Phase C: XP system lockdown
--
-- Closes mass-assignment vulnerabilities on profiles.xp/level and the
-- direct INSERT path to xp_ledger. All XP grants now flow through a
-- SECURITY DEFINER RPC that controls the amount server-side.
--
-- Background: prior to this migration any authenticated user could
-- (a) UPDATE profiles SET xp=999999 directly, OR
-- (b) INSERT INTO xp_ledger any reward amount they wanted.
--
-- xp_ledger has 0 rows in production at apply-time, so no live data
-- migration needed. Companion src/lib/xp.ts patch ships in same commit.
--
-- Residual: src/hooks/useChallenges.ts.claimReward() will keep failing
-- silently (it already does today due to schema drift on user_challenges).
-- A follow-up task tracks the schema fix + claim_challenge RPC.

-- 1. Drop the public INSERT path on xp_ledger. RLS now denies all
--    direct INSERTs; xp_ledger is written only via SECURITY DEFINER.
DROP POLICY IF EXISTS "Users can insert own xp entries" ON public.xp_ledger;

-- 2. Revoke direct UPDATE on xp + level columns. Other profile fields
--    (display_name, avatar_url) remain user-writable via the existing
--    "Users can update own profile" policy.
REVOKE UPDATE (xp, level) ON public.profiles FROM authenticated;

-- 3. Helper: compute level from total XP. Mirrors LEVEL_THRESHOLDS
--    in src/lib/xp.ts -- keep in sync on changes.
CREATE OR REPLACE FUNCTION public.compute_level_from_xp(p_xp integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_catalog
AS $func$
  SELECT CASE
    WHEN p_xp >= 17000 THEN 15
    WHEN p_xp >= 13000 THEN 14
    WHEN p_xp >= 10000 THEN 13
    WHEN p_xp >= 7800  THEN 12
    WHEN p_xp >= 6000  THEN 11
    WHEN p_xp >= 4600  THEN 10
    WHEN p_xp >= 3500  THEN 9
    WHEN p_xp >= 2600  THEN 8
    WHEN p_xp >= 1900  THEN 7
    WHEN p_xp >= 1300  THEN 6
    WHEN p_xp >= 850   THEN 5
    WHEN p_xp >= 500   THEN 4
    WHEN p_xp >= 250   THEN 3
    WHEN p_xp >= 100   THEN 2
    ELSE 1
  END;
$func$;

REVOKE EXECUTE ON FUNCTION public.compute_level_from_xp(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compute_level_from_xp(integer) TO authenticated, service_role;

-- 4. award_xp() RPC -- the only path for clients to grant themselves XP.
--    Server controls amount; client only chooses an action from the
--    allowed enum. Action enum mirrors XP_AWARDS in src/lib/xp.ts.
CREATE OR REPLACE FUNCTION public.award_xp(p_action text)
RETURNS TABLE (new_xp integer, new_level integer, leveled_up boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $func$
DECLARE
  v_user_id uuid := auth.uid();
  v_amount integer;
  v_old_level integer;
  v_old_xp integer;
  v_new_xp integer;
  v_new_level integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  v_amount := CASE p_action
    WHEN 'LOG_WEAR'          THEN 10
    WHEN 'WRITE_REVIEW'      THEN 25
    WHEN 'ADD_TO_COLLECTION' THEN 5
    WHEN 'PROMOTE_TO_OWNED'  THEN 10
    WHEN 'FIRST_WEAR'        THEN 20
    WHEN 'STREAK_3'          THEN 30
    WHEN 'STREAK_7'          THEN 75
    WHEN 'STREAK_14'         THEN 150
    WHEN 'STREAK_30'         THEN 300
    ELSE NULL
  END;

  IF v_amount IS NULL THEN
    RAISE EXCEPTION 'invalid_action: %', p_action;
  END IF;

  -- Lock the row to prevent concurrent xp races.
  SELECT level, xp INTO v_old_level, v_old_xp
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  v_new_xp := v_old_xp + v_amount;
  v_new_level := public.compute_level_from_xp(v_new_xp);

  UPDATE public.profiles
  SET xp = v_new_xp,
      level = v_new_level,
      updated_at = now()
  WHERE id = v_user_id;

  INSERT INTO public.xp_ledger (user_id, action, xp_amount)
  VALUES (v_user_id, p_action, v_amount);

  RETURN QUERY SELECT v_new_xp, v_new_level, (v_new_level > v_old_level);
END;
$func$;

REVOKE EXECUTE ON FUNCTION public.award_xp(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.award_xp(text) TO authenticated;
