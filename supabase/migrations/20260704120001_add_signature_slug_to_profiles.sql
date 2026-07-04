-- profiles.signature_slug -- points at the user's CURRENT shareable audit.
-- profiles has column-level UPDATE grants only (27 Apr 2026 lockdown:
-- table-level UPDATE revoked, then display_name/avatar_url/updated_at
-- granted). signature_slug must be added to that grant list or client
-- writes will be silently rejected.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS signature_slug text UNIQUE;

GRANT UPDATE (signature_slug) ON public.profiles TO authenticated;
