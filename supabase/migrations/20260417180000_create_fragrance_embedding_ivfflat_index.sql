-- ivfflat index on public.fragrances.embedding for cosine similarity.
-- Intentionally created AFTER the initial backfill (step 2c of notes/recommender-design.md §11)
-- because ivfflat clusters the vector space at index-creation time -- indexing an empty
-- column produces a degenerate index. Backfill completed 17 April 2026 with all 3067 rows
-- embedded at version 1 via scripts/embed-fragrances.ts.
--
-- lists = 100 per design-doc §5. Rule-of-thumb for ivfflat is sqrt(rows) (~55 for 3067)
-- but overshooting to 100 trades a little build time for a bit more recall headroom as
-- the corpus grows. Revisit if the corpus crosses ~10k rows.
--
-- IF NOT EXISTS for idempotency -- safe to re-apply.
CREATE INDEX IF NOT EXISTS fragrances_embedding_ivfflat_idx
ON public.fragrances
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
