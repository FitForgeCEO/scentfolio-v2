-- P0 fix (6 July 2026): signature-og bucket had INSERT + UPDATE policies but
-- no SELECT policy. storage-api uploads use INSERT ... RETURNING, and under
-- RLS the RETURNING clause requires the new row to pass SELECT policies --
-- so every OG image upload since the 4 July ship silently failed with 403,
-- leaving signature_audits.og_image_url null on all rows.
-- Public read matches the bucket's purpose (crawler-fetchable OG images)
-- and mirrors the existing note-icons pattern.
create policy "signature og public read"
on storage.objects for select
to public
using (bucket_id = 'signature-og');
