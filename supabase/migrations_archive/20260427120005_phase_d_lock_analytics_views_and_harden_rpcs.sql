-- Phase D: Tighten visibility on operator-only metrics + harden public RPCs.
--
-- Three things in one migration:
-- 1. REVOKE SELECT on 7 analytics views from anon/authenticated.
-- 2. Convert get_image_slugs() to SECURITY INVOKER + pin search_path.
-- 3. Pin search_path on check_analytics_rate_limit().
--
-- Closes the SECURITY DEFINER VIEW exposure (advisor ERROR x7) and the
-- two function_search_path_mutable WARNs.

-- 1. Operator-aggregate analytics views: not for client consumption.
-- They expose cross-user metrics (DAU, signup funnel, top searches/pages/
-- fragrances, device split, event counts). No per-user data, but operator-
-- level. service_role retains access via dashboard SQL editor.
REVOKE SELECT ON public.analytics_dau            FROM anon, authenticated;
REVOKE SELECT ON public.analytics_devices        FROM anon, authenticated;
REVOKE SELECT ON public.analytics_event_counts   FROM anon, authenticated;
REVOKE SELECT ON public.analytics_signup_funnel  FROM anon, authenticated;
REVOKE SELECT ON public.analytics_top_fragrances FROM anon, authenticated;
REVOKE SELECT ON public.analytics_top_pages      FROM anon, authenticated;
REVOKE SELECT ON public.analytics_top_searches   FROM anon, authenticated;

-- 2. get_image_slugs(): convert to SECURITY INVOKER + pin search_path.
-- Function returns fragrance image slugs for rows with image_url set.
-- The fragrances SELECT policy already allows is_approved=true reads from
-- anon, so SECURITY INVOKER produces the correct behaviour. Verified zero
-- callers in scentfolio-v2 codebase (repo grep returned nothing) -- pure
-- tightening with no client impact.
CREATE OR REPLACE FUNCTION public.get_image_slugs()
RETURNS TABLE(fid text, slug text)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $func$
  SELECT id::text, regexp_replace(image_url, '^https://cdn\.fragella\.com/images/', '')
  FROM public.fragrances
  WHERE image_url IS NOT NULL
  ORDER BY id;
$func$;

-- 3. check_analytics_rate_limit(): pin search_path. Already SECURITY INVOKER
-- (verified prosecdef = false). Advisor flagged only the mutable search_path.
ALTER FUNCTION public.check_analytics_rate_limit() SET search_path = public, pg_catalog;
