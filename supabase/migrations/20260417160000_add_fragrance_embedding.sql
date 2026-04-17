-- ============================================================================
-- Migration: add embedding + embedding_version columns to fragrances
-- ============================================================================
-- Status:   Part 1 of 2 for the recommender embedding layer.
--           Part 1 (THIS FILE) -- add the column. Safe to apply any time.
--           Part 2 (separate file, run AFTER backfill) -- create ivfflat
--           index on the populated column so clustering is meaningful.
-- Created:  2026-04-17
-- Purpose:  Store 384-dim sentence-transformer embeddings for each fragrance.
--           Used by public.match_fragrances() RPC for vector similarity.
--           See notes/recommender-design.md §3.
--
-- Why split the column + index into two migrations:
--   pgvector's ivfflat index clusters data at creation time. Creating it
--   against an empty column produces a degenerate index that needs a
--   REINDEX after backfill. Cleaner to create the column, run the
--   one-off backfill script, then add the index.
--
-- Model / dimensionality:
--   all-MiniLM-L6-v2  (sentence-transformers)
--   384 dimensions, cosine similarity
--   ~23MB in-browser via @xenova/transformers
--
-- embedding_version:
--   Tracks which model/source-string version produced the row's vector.
--   Bumping this invalidates old vectors. v1 = first rollout (this commit).
--   Future re-embeddings can run without dropping the column.
-- ============================================================================

-- pgvector extension was enabled in migration 20260417144800_enable_pgvector.
-- Assert it is present; fail fast if it is not.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'vector'
  ) THEN
    RAISE EXCEPTION 'pgvector extension is required. Apply 20260417144800_enable_pgvector first.';
  END IF;
END$$;

ALTER TABLE public.fragrances
  ADD COLUMN IF NOT EXISTS embedding         vector(384),
  ADD COLUMN IF NOT EXISTS embedding_version smallint NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.fragrances.embedding
  IS '384-dim MiniLM-L6-v2 embedding of the fragrance source string. NULL until backfilled. See notes/recommender-design.md §3.';
COMMENT ON COLUMN public.fragrances.embedding_version
  IS 'Which source-string / model generation produced this row''s embedding. Bump in a follow-up migration when re-embedding.';

-- ----------------------------------------------------------------------------
-- NO index in this migration. Add ivfflat index in a follow-up migration
-- once scripts/embed-fragrances.ts has populated the column.
-- ----------------------------------------------------------------------------
