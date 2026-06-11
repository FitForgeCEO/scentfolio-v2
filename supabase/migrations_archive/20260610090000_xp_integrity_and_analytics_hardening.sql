-- XP integrity + analytics hardening (10 June 2026 deep-review follow-up)
--
-- Closes three gaps:
--
-- (1) award_xp validated the action enum but never that the action
--     happened: any authenticated user could loop
--     rpc('award_xp', {p_action:'STREAK_30'}) for +300 XP per call.
--     Now: high-water-mark eligibility (lifetime awards per action must
--     stay below the live count of the underlying entity, so delete +
--     re-create can never re-earn), real-streak verification + a
--     once-per-window cap on STREAK_* awards, and a 20/day volume
--     backstop on LOG_WEAR. Client signature unchanged -- the three
--     awardXP() call sites don't move.
--
-- (2) claim_challenge marked claimed=true without recomputing progress;
--     the client INSERTs user_challenges rows directly, so a fake
--     completion row could mint up to 300 XP per challenge. Now the RPC
--     recomputes progress from the real tables and rejects the claim
--     unless progress >= target. (Tradeoff: a broken streak that was
--     never claimed while live can no longer be claimed retroactively.)
--
-- (3) analytics_events INSERT policy was WITH CHECK (true): anyone could
--     insert events attributed to any user's UUID. Now user_id must be
--     NULL (anonymous event) or match auth.uid().
--
-- Plus: get_image_slugs() EXECUTE revoked from anon + authenticated --
-- zero callers in the codebase; service_role keeps access.

-- ── 1. Wear-streak helper (shared by award_xp + claim_challenge) ────
-- Gaps-and-islands: streak = length of the consecutive-day run ending
-- at the most recent wear date, provided that date is today or
-- yesterday (UTC). Server-side authority for the client-side
-- countWearStreak in src/hooks/useChallenges.ts (which is local-time
-- and 60-row-capped; small boundary mismatches are acceptable).
CREATE OR REPLACE FUNCTION public.compute_wear_streak(p_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SET search_path = public, pg_catalog
AS $func$
  WITH dd AS (
    SELECT DISTINCT wear_date
    FROM public.wear_logs
    WHERE user_id = p_user_id
  ),
  anchored AS (
    SELECT
      wear_date,
      (ROW_NUMBER() OVER (ORDER BY wear_date DESC) - 1)::int AS rn,
      MAX(wear_date) OVER () AS anchor
    FROM dd
  )
  SELECT COALESCE(
    (SELECT count(*)::int
     FROM anchored
     WHERE anchor >= current_date - 1
       AND wear_date = anchor - rn),
    0);
$func$;

-- Internal-only: invoked from inside the SECURITY DEFINER RPCs (which
-- execute as the function owner, so owner-level EXECUTE suffices).
REVOKE EXECUTE ON FUNCTION public.compute_wear_streak(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.compute_wear_streak(uuid) TO service_role;

-- ── 2. award_xp v2: evidence-based eligibility ──────────────────────
CREATE OR REPLACE FUNCTION public.award_xp(p_action text)
RETURNS TABLE (new_xp integer, new_level integer, leveled_up boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $func$
DECLARE
  v_user_id uuid := auth.uid();
  v_amount integer;
  v_awarded_count integer;
  v_eligible_count integer;
  v_streak_days integer;
  v_old_level integer;
  v_old_xp integer;
  v_new_xp integer;
  v_new_level integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Server-controlled amounts. Mirrors XP_AWARDS in src/lib/xp.ts.
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

  -- Eligibility A: high-water mark. Lifetime awards for this action must
  -- stay below the live count of the underlying entity. Deleting and
  -- re-creating rows can therefore never re-earn the same XP, and a bare
  -- RPC loop with no underlying activity earns nothing.
  SELECT count(*) INTO v_awarded_count
  FROM public.xp_ledger
  WHERE user_id = v_user_id AND action = p_action;

  v_eligible_count := CASE p_action
    WHEN 'LOG_WEAR'          THEN (SELECT count(*) FROM public.wear_logs WHERE user_id = v_user_id)
    WHEN 'FIRST_WEAR'        THEN (SELECT count(DISTINCT fragrance_id) FROM public.wear_logs WHERE user_id = v_user_id)
    WHEN 'WRITE_REVIEW'      THEN (SELECT count(*) FROM public.reviews WHERE user_id = v_user_id)
    WHEN 'ADD_TO_COLLECTION' THEN (SELECT count(*) FROM public.user_collections WHERE user_id = v_user_id)
    WHEN 'PROMOTE_TO_OWNED'  THEN (SELECT count(*) FROM public.user_collections WHERE user_id = v_user_id AND status = 'own')
    ELSE NULL  -- STREAK_* handled below
  END;

  IF v_eligible_count IS NOT NULL AND v_awarded_count >= v_eligible_count THEN
    RAISE EXCEPTION 'xp_not_eligible: %', p_action;
  END IF;

  -- Eligibility B: streak awards require a real streak of that length
  -- and fire at most once per streak-length window.
  IF p_action IN ('STREAK_3', 'STREAK_7', 'STREAK_14', 'STREAK_30') THEN
    v_streak_days := substring(p_action FROM 8)::integer;
    IF public.compute_wear_streak(v_user_id) < v_streak_days THEN
      RAISE EXCEPTION 'xp_not_eligible: %', p_action;
    END IF;
    IF NOT public.consume_rpc_rate_limit('award_xp:' || p_action, 1, v_streak_days * 86400) THEN
      RAISE EXCEPTION 'xp_rate_limited: %', p_action;
    END IF;
  END IF;

  -- Volume backstop: LOG_WEAR awards capped at 20/day.
  IF p_action = 'LOG_WEAR'
     AND NOT public.consume_rpc_rate_limit('award_xp:LOG_WEAR', 20, 86400) THEN
    RAISE EXCEPTION 'xp_rate_limited: %', p_action;
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

-- ── 3. claim_challenge v2: server-side progress recomputation ───────
CREATE OR REPLACE FUNCTION public.claim_challenge(p_challenge_id text)
RETURNS TABLE (new_xp integer, new_level integer, leveled_up boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $func$
DECLARE
  v_user_id uuid := auth.uid();
  v_amount integer;
  v_target integer;
  v_progress integer;
  v_old_level integer;
  v_old_xp integer;
  v_new_xp integer;
  v_new_level integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Server-controlled per-challenge XP + target. Mirrors CHALLENGES
  -- in src/hooks/useChallenges.ts -- keep in sync on challenge edits.
  SELECT c.amount, c.target INTO v_amount, v_target
  FROM (VALUES
    ('coll-3',     25,   3),
    ('coll-10',    50,  10),
    ('coll-25',   100,  25),
    ('coll-50',   200,  50),
    ('wear-10',    30,  10),
    ('wear-50',    75,  50),
    ('wear-100',  150, 100),
    ('streak-7',   75,   7),
    ('streak-30', 300,  30),
    ('unique-5',   40,   5),
    ('unique-15', 100,  15),
    ('brand-5',    40,   5),
    ('brand-10',   80,  10),
    ('family-3',   30,   3),
    ('family-6',   80,   6),
    ('follow-3',   25,   3),
    ('follow-10',  60,  10),
    ('review-1',   25,   1),
    ('review-5',   50,   5),
    ('review-15', 120,  15)
  ) AS c(id, amount, target)
  WHERE c.id = p_challenge_id;

  IF v_amount IS NULL THEN
    RAISE EXCEPTION 'invalid_challenge: %', p_challenge_id;
  END IF;

  -- Recompute progress from the real tables. The client's direct INSERT
  -- into user_challenges is bookkeeping only -- it can no longer mint XP.
  -- Mirrors the getProgress functions in src/hooks/useChallenges.ts.
  v_progress := CASE
    WHEN p_challenge_id LIKE 'coll-%' THEN
      (SELECT count(*) FROM public.user_collections
       WHERE user_id = v_user_id AND status = 'own')
    WHEN p_challenge_id LIKE 'wear-%' THEN
      (SELECT count(*) FROM public.wear_logs WHERE user_id = v_user_id)
    WHEN p_challenge_id LIKE 'streak-%' THEN
      public.compute_wear_streak(v_user_id)
    WHEN p_challenge_id LIKE 'unique-%' THEN
      (SELECT count(DISTINCT fragrance_id) FROM public.wear_logs
       WHERE user_id = v_user_id
         AND wear_date >= date_trunc('month', current_date)::date)
    WHEN p_challenge_id LIKE 'brand-%' THEN
      (SELECT count(DISTINCT f.brand) FROM public.user_collections uc
       JOIN public.fragrances f ON f.id = uc.fragrance_id
       WHERE uc.user_id = v_user_id AND uc.status = 'own')
    WHEN p_challenge_id LIKE 'family-%' THEN
      (SELECT count(DISTINCT f.note_family) FROM public.user_collections uc
       JOIN public.fragrances f ON f.id = uc.fragrance_id
       WHERE uc.user_id = v_user_id AND uc.status = 'own'
         AND f.note_family IS NOT NULL)
    WHEN p_challenge_id LIKE 'follow-%' THEN
      (SELECT count(*) FROM public.user_follows WHERE follower_id = v_user_id)
    WHEN p_challenge_id LIKE 'review-%' THEN
      (SELECT count(*) FROM public.reviews WHERE user_id = v_user_id)
  END;

  IF v_progress IS NULL OR v_progress < v_target THEN
    RAISE EXCEPTION 'challenge_not_complete: % (progress %/%)',
      p_challenge_id, COALESCE(v_progress, 0), v_target;
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

  INSERT INTO public.xp_ledger (user_id, action, xp_amount)
  VALUES (v_user_id, 'CHALLENGE:' || p_challenge_id, v_amount);

  RETURN QUERY SELECT v_new_xp, v_new_level, (v_new_level > v_old_level);
END;
$func$;

-- ── 4. analytics_events: kill user_id forgery ───────────────────────
DROP POLICY IF EXISTS "Anyone can insert analytics events" ON public.analytics_events;
CREATE POLICY "Anyone can insert analytics events"
  ON public.analytics_events
  FOR INSERT
  WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

-- ── 5. get_image_slugs: no callers -> no app-role access ────────────
REVOKE EXECUTE ON FUNCTION public.get_image_slugs() FROM PUBLIC, anon, authenticated;
