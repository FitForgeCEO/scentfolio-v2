-- M-4: Rate-limit match_fragrances RPC.
--
-- Pre-state: match_fragrances was SECURITY INVOKER, callable by anon +
-- authenticated, no per-user QPS cap. A tab-loop attacker could pin the
-- DB by firing 1000+ vector scans/sec. Vector scan over 3067 x 384 floats
-- is sub-ms but accumulates.
--
-- Strategy: small rpc_rate_limit table (one row per user_id+rpc_name with
-- a sliding window) consumed via a SECURITY DEFINER helper. match_fragrances
-- becomes plpgsql, calls the helper at the top, raises if over limit.
-- Default budget: 60 calls/minute -- generous for legitimate use (single
-- detail-screen view fires 1 call), brutal for brute-force.
--
-- Anonymous + service_role calls are not rate-limited at this layer
-- (auth.uid() is NULL for both). Anon was also revoked from match_fragrances
-- EXECUTE in this migration -- recommender is authenticated-only territory.
-- Service role retains access for the eval-recommender GHA script.

-- 1. Rate limit table (locked down -- only DEFINER functions touch it)
CREATE TABLE IF NOT EXISTS public.rpc_rate_limit (
  user_id uuid NOT NULL,
  rpc_name text NOT NULL,
  window_start timestamptz NOT NULL DEFAULT now(),
  call_count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, rpc_name)
);

ALTER TABLE public.rpc_rate_limit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rpc_rate_limit FROM PUBLIC, anon, authenticated;
-- (no RLS policies = deny-all from non-DEFINER callers)

-- 2. Token-consume helper. Returns true if call allowed, false if over limit.
CREATE OR REPLACE FUNCTION public.consume_rpc_rate_limit(
  p_rpc_name text,
  p_max_calls integer DEFAULT 60,
  p_window_seconds integer DEFAULT 60
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $func$
DECLARE
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();
  v_window_age interval := make_interval(secs => p_window_seconds);
  v_current_count integer;
BEGIN
  IF v_user_id IS NULL THEN
    -- Anonymous / service_role: not rate-limited at this layer.
    RETURN true;
  END IF;

  INSERT INTO public.rpc_rate_limit AS rrl (user_id, rpc_name, window_start, call_count)
  VALUES (v_user_id, p_rpc_name, v_now, 1)
  ON CONFLICT (user_id, rpc_name) DO UPDATE
  SET
    window_start = CASE
      WHEN rrl.window_start < (v_now - v_window_age) THEN v_now
      ELSE rrl.window_start
    END,
    call_count = CASE
      WHEN rrl.window_start < (v_now - v_window_age) THEN 1
      ELSE rrl.call_count + 1
    END
  RETURNING rrl.call_count INTO v_current_count;

  RETURN v_current_count <= p_max_calls;
END;
$func$;

REVOKE EXECUTE ON FUNCTION public.consume_rpc_rate_limit(text, integer, integer) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.consume_rpc_rate_limit(text, integer, integer) TO authenticated, service_role;

-- 3. Replace match_fragrances with a rate-limited plpgsql version.
-- Same signature + same return shape so existing callers don't move.
CREATE OR REPLACE FUNCTION public.match_fragrances(
  query_embedding vector,
  match_count integer DEFAULT 20,
  exclude_id uuid DEFAULT NULL
)
RETURNS TABLE(id uuid, score double precision)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $func$
BEGIN
  IF NOT public.consume_rpc_rate_limit('match_fragrances', 60, 60) THEN
    RAISE EXCEPTION 'rate_limit_exceeded: 60 calls/min on match_fragrances'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
    SELECT
      f.id,
      (1 - (f.embedding <=> query_embedding))::double precision AS score
    FROM public.fragrances f
    WHERE f.embedding IS NOT NULL
      AND (exclude_id IS NULL OR f.id <> exclude_id)
    ORDER BY f.embedding <=> query_embedding
    LIMIT match_count;
END;
$func$;

-- 4. Lock anon out of the recommender.
REVOKE EXECUTE ON FUNCTION public.match_fragrances(vector, integer, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.match_fragrances(vector, integer, uuid) TO authenticated, service_role;
