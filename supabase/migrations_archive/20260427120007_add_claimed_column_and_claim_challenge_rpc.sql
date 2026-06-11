-- Fix user_challenges schema drift (Task #95) + ship claim_challenge RPC.
--
-- Background: src/hooks/useChallenges.ts has been reading/writing a
-- 'claimed' boolean column that doesn't exist on this table. All claim
-- attempts have failed silently inside try/catch blocks since the
-- challenge feature shipped. user_challenges has 0 rows in production
-- so no data migration is needed.
--
-- This migration:
--   1. Adds the missing claimed column (DEFAULT false NOT NULL).
--   2. Creates claim_challenge(p_challenge_id text) SECURITY DEFINER RPC
--      that mirrors the standard award_xp pattern: server-controlled
--      amount (per challenge), atomic UPDATE with claimed=false guard,
--      atomic xp/level update on profiles, audit row in xp_ledger.
--
-- Residual risk (acknowledged): the RPC validates the user_challenges
-- row exists with claimed=false but does NOT recompute progress >= target
-- server-side. An attacker could INSERT a fake row and immediately claim.
-- Mitigated by: per-challenge XP cap is small (max 300), and a future
-- refactor will move progress recomputation to the server. For now this
-- is much better than the prior state (silent failure + direct profile
-- writes) and consistent with the Phase C lockdown trust model.

ALTER TABLE public.user_challenges
  ADD COLUMN IF NOT EXISTS claimed boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.claim_challenge(p_challenge_id text)
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

  -- Server-controlled per-challenge XP. Mirrors CHALLENGES array
  -- in src/hooks/useChallenges.ts -- keep in sync on challenge edits.
  v_amount := CASE p_challenge_id
    WHEN 'coll-3'    THEN 25
    WHEN 'coll-10'   THEN 50
    WHEN 'coll-25'   THEN 100
    WHEN 'coll-50'   THEN 200
    WHEN 'wear-10'   THEN 30
    WHEN 'wear-50'   THEN 75
    WHEN 'wear-100'  THEN 150
    WHEN 'streak-7'  THEN 75
    WHEN 'streak-30' THEN 300
    WHEN 'unique-5'  THEN 40
    WHEN 'unique-15' THEN 100
    WHEN 'brand-5'   THEN 40
    WHEN 'brand-10'  THEN 80
    WHEN 'family-3'  THEN 30
    WHEN 'family-6'  THEN 80
    WHEN 'follow-3'  THEN 25
    WHEN 'follow-10' THEN 60
    WHEN 'review-1'  THEN 25
    WHEN 'review-5'  THEN 50
    WHEN 'review-15' THEN 120
    ELSE NULL
  END;

  IF v_amount IS NULL THEN
    RAISE EXCEPTION 'invalid_challenge: %', p_challenge_id;
  END IF;

  -- Atomic mark-as-claimed. UPDATE only succeeds if the row exists AND
  -- claimed = false -- prevents double-claim races.
  UPDATE public.user_challenges
  SET claimed = true
  WHERE user_id = v_user_id
    AND challenge_id = p_challenge_id
    AND claimed = false;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'challenge_not_claimable';
  END IF;

  -- Lock and update profiles.
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

  -- Audit row. Action prefix 'CHALLENGE:' distinguishes from the standard
  -- XP_AWARDS actions written by award_xp().
  INSERT INTO public.xp_ledger (user_id, action, xp_amount)
  VALUES (v_user_id, 'CHALLENGE:' || p_challenge_id, v_amount);

  RETURN QUERY SELECT v_new_xp, v_new_level, (v_new_level > v_old_level);
END;
$func$;

REVOKE EXECUTE ON FUNCTION public.claim_challenge(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_challenge(text) TO authenticated;
