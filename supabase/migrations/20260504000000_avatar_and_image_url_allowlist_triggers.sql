-- M-X1 + M-X2: Validate avatar_url + fragrance image_url against an allowlist
-- of trusted hosts at write time. Closes the tracking-pixel + privacy-leak
-- surface identified in Security-XSS-Audit-04May2026.md.
--
-- Live DB state at apply-time:
--   profiles.avatar_url   -- 11 rows, all empty (no grandfathering needed)
--   fragrances.image_url  -- 2,844 rows on cdn.fragella.com + 218 empty
--                            (all existing data passes the allowlist)
--
-- Note on syntax: ~ and || share the same operator-precedence bucket in PG
-- and evaluate left-to-right, so `url ~ 'a' || 'b'` parses as
-- `(url ~ 'a') || 'b'` (boolean || string -> type error). Parenthesise the
-- regex string explicitly to force string concat first.

CREATE OR REPLACE FUNCTION public.is_allowed_avatar_url(url text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_catalog
AS $func$
  SELECT url IS NULL OR url = '' OR (
    url ~ ('^https://(' ||
      'i\.gravatar\.com' ||
      '|lh3\.googleusercontent\.com' ||
      '|avatars\.githubusercontent\.com' ||
      '|xyktbygztvpadrhawvur\.supabase\.co' ||
    ')/')
  );
$func$;

CREATE OR REPLACE FUNCTION public.is_allowed_fragrance_image_url(url text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_catalog
AS $func$
  SELECT url IS NULL OR url = '' OR (
    url ~ ('^https://(' ||
      'cdn\.fragella\.com' ||
      '|xyktbygztvpadrhawvur\.supabase\.co' ||
    ')/')
  );
$func$;

REVOKE EXECUTE ON FUNCTION public.is_allowed_avatar_url(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_allowed_avatar_url(text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.is_allowed_fragrance_image_url(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_allowed_fragrance_image_url(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.profiles_validate_avatar_url()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $func$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.avatar_url IS NOT NULL AND NEW.avatar_url <> '')
     OR (TG_OP = 'UPDATE' AND NEW.avatar_url IS DISTINCT FROM OLD.avatar_url) THEN
    IF NOT public.is_allowed_avatar_url(NEW.avatar_url) THEN
      RAISE EXCEPTION 'avatar_url must be on an allowed CDN (Gravatar, Google, GitHub, or Supabase Storage)'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$func$;

CREATE OR REPLACE FUNCTION public.fragrances_validate_image_url()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $func$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.image_url IS NOT NULL AND NEW.image_url <> '')
     OR (TG_OP = 'UPDATE' AND NEW.image_url IS DISTINCT FROM OLD.image_url) THEN
    IF NOT public.is_allowed_fragrance_image_url(NEW.image_url) THEN
      RAISE EXCEPTION 'image_url must be on cdn.fragella.com or Supabase Storage'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$func$;

REVOKE EXECUTE ON FUNCTION public.profiles_validate_avatar_url()    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fragrances_validate_image_url()   FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS profiles_avatar_url_validate  ON public.profiles;
DROP TRIGGER IF EXISTS fragrances_image_url_validate ON public.fragrances;

CREATE TRIGGER profiles_avatar_url_validate
  BEFORE INSERT OR UPDATE OF avatar_url ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_validate_avatar_url();

CREATE TRIGGER fragrances_image_url_validate
  BEFORE INSERT OR UPDATE OF image_url ON public.fragrances
  FOR EACH ROW EXECUTE FUNCTION public.fragrances_validate_image_url();
