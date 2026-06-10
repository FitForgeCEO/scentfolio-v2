-- Trending leaderboard server-side aggregate (10 June 2026 review follow-up)
--
-- LeaderboardScreen queried wear_logs / user_collections / reviews directly
-- with no user filter. Under the owner-scoped RLS those SELECTs return only
-- the caller's own rows, so "Trending" silently showed each user their own
-- activity, not the community's. (Verified: not a privacy leak -- the
-- feature was just broken.)
--
-- This RPC aggregates across ALL users as SECURITY DEFINER but returns only
-- fragrance-level counts joined to approved catalogue rows -- no user data
-- crosses the boundary. Authenticated-only, rate-limited like
-- match_fragrances.

CREATE OR REPLACE FUNCTION public.get_trending_fragrances(
  p_category text,
  p_days integer DEFAULT NULL
)
RETURNS TABLE (fragrance_id uuid, name text, brand text, image_url text, cnt bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $func$
DECLARE
  v_cutoff timestamptz := CASE
    WHEN p_days IS NULL THEN '-infinity'::timestamptz
    ELSE now() - make_interval(days => p_days)
  END;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT public.consume_rpc_rate_limit('get_trending_fragrances', 60, 60) THEN
    RAISE EXCEPTION 'rate_limit_exceeded: 60 calls/min on get_trending_fragrances'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_category = 'worn' THEN
    RETURN QUERY
      SELECT f.id, f.name, f.brand, f.image_url, count(*)::bigint
      FROM public.wear_logs w
      JOIN public.fragrances f ON f.id = w.fragrance_id
      WHERE w.wear_date >= v_cutoff::date
        AND f.is_approved
      GROUP BY f.id, f.name, f.brand, f.image_url
      ORDER BY count(*) DESC, f.name ASC
      LIMIT 20;
  ELSIF p_category = 'added' THEN
    RETURN QUERY
      SELECT f.id, f.name, f.brand, f.image_url, count(*)::bigint
      FROM public.user_collections uc
      JOIN public.fragrances f ON f.id = uc.fragrance_id
      WHERE uc.date_added >= v_cutoff
        AND f.is_approved
      GROUP BY f.id, f.name, f.brand, f.image_url
      ORDER BY count(*) DESC, f.name ASC
      LIMIT 20;
  ELSIF p_category = 'reviewed' THEN
    RETURN QUERY
      SELECT f.id, f.name, f.brand, f.image_url, count(*)::bigint
      FROM public.reviews r
      JOIN public.fragrances f ON f.id = r.fragrance_id
      WHERE r.created_at >= v_cutoff
        AND f.is_approved
      GROUP BY f.id, f.name, f.brand, f.image_url
      ORDER BY count(*) DESC, f.name ASC
      LIMIT 20;
  ELSE
    RAISE EXCEPTION 'invalid_category: %', p_category;
  END IF;
END;
$func$;

REVOKE EXECUTE ON FUNCTION public.get_trending_fragrances(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_trending_fragrances(text, integer) TO authenticated, service_role;
