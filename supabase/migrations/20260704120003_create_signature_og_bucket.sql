-- Public storage bucket for pre-rendered 1200x630 Signature Audit OG images.
-- Object naming is strictly {user_id}.png -- one current OG image per user,
-- upserted on every regeneration. Public read comes from the bucket's public
-- flag (no broad SELECT policy, per the note-icons listing advisor lesson).

INSERT INTO storage.buckets (id, name, public)
VALUES ('signature-og', 'signature-og', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "signature og owner upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'signature-og' AND name = auth.uid()::text || '.png');

CREATE POLICY "signature og owner update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'signature-og' AND name = auth.uid()::text || '.png')
  WITH CHECK (bucket_id = 'signature-og' AND name = auth.uid()::text || '.png');
