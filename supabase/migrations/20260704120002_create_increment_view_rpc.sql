-- View-counter RPC for shared Signature Audit URLs.
--
-- consume_rpc_rate_limit() returns true unconditionally for anonymous
-- callers (it keys on auth.uid()), so it cannot rate-limit this RPC --
-- most audit views ARE anonymous. Instead we rate-limit per *audit*
-- using the same rpc_rate_limit table keyed on the audit owner's
-- user_id: at most 120 counted views per audit per minute. Excess views
-- still render (the SELECT is separate); they just stop incrementing.
--
-- The owner viewing their own audit is not counted.

CREATE OR REPLACE FUNCTION public.increment_signature_audit_view(p_slug text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  v_owner uuid;
  v_now timestamptz := now();
  v_window interval := make_interval(secs => 60);
  v_count integer;
BEGIN
  SELECT user_id INTO v_owner
  FROM public.signature_audits
  WHERE slug = p_slug;

  IF v_owner IS NULL THEN
    RETURN; -- unknown slug: silently no-op, never error to the client
  END IF;

  IF auth.uid() = v_owner THEN
    RETURN; -- owners don't inflate their own counter
  END IF;

  INSERT INTO public.rpc_rate_limit AS rrl (user_id, rpc_name, window_start, call_count)
  VALUES (v_owner, 'signature_audit_view', v_now, 1)
  ON CONFLICT (user_id, rpc_name) DO UPDATE
  SET
    window_start = CASE
      WHEN rrl.window_start < (v_now - v_window) THEN v_now
      ELSE rrl.window_start
    END,
    call_count = CASE
      WHEN rrl.window_start < (v_now - v_window) THEN 1
      ELSE rrl.call_count + 1
    END
  RETURNING rrl.call_count INTO v_count;

  IF v_count > 120 THEN
    RETURN; -- window saturated: stop counting, keep serving
  END IF;

  UPDATE public.signature_audits
  SET view_count = view_count + 1
  WHERE slug = p_slug;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.increment_signature_audit_view(text) FROM public;
GRANT EXECUTE ON FUNCTION public.increment_signature_audit_view(text) TO anon, authenticated;
