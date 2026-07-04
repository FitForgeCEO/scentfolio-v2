-- Signature Audit cache table (Signature-Audit-Build-Brief-04Jul2026).
-- Stores the pre-computed audit payload so anonymous views of a shared
-- URL never hit the recommender RPC. Public read by design -- the slug
-- is un-guessable (10-char random) but not private-per-view, matching
-- the Letterboxd Wrapped sharing pattern.

CREATE TABLE public.signature_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  generated_at timestamptz NOT NULL DEFAULT now(),
  data jsonb NOT NULL, -- pre-computed audit payload (all 6 cards' worth of data)
  og_image_url text,   -- Supabase Storage URL of pre-rendered 1200x630 OG image
  view_count int NOT NULL DEFAULT 0
);

CREATE INDEX signature_audits_slug_idx ON public.signature_audits(slug);
CREATE INDEX signature_audits_user_id_idx ON public.signature_audits(user_id);

ALTER TABLE public.signature_audits ENABLE ROW LEVEL SECURITY;

-- Anyone can read audits by slug (this is the point -- shared URLs work for strangers)
CREATE POLICY "signature_audits public read" ON public.signature_audits
  FOR SELECT USING (true);

-- Only owner can insert/update their own audit
CREATE POLICY "signature_audits owner write" ON public.signature_audits
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

GRANT SELECT ON public.signature_audits TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.signature_audits TO authenticated;
