-- ============================================================================
-- Migration: create public.match_fragrances RPC
-- ============================================================================
-- Status:   Ready to apply. Depends on:
--             * pgvector extension   (20260417144800_enable_pgvector)
--             * embedding column     (20260417160000_add_fragrance_embedding)
-- Created:  2026-04-17
-- Purpose:  Server-side cosine-similarity query used by the recommender.
--           Takes a query_embedding and returns the N nearest fragrances
--           with their similarity scores. See notes/recommender-design.md §4.
--
-- Security model:
--   SECURITY INVOKER (the default). The function runs with the caller's
--   privileges and the caller's RLS context -- so the existing
--   "Anyone can read approved fragrances" policy is automatically enforced.
--   Unapproved fragrances will not appear in results.
--
-- Language choice: `language sql stable`.
--   - `stable` is correct because the function is pure within a transaction
--     (inputs -> same outputs). Lets the planner cache the query.
--   - `sql` (not `plpgsql`) keeps it inlinable so pgvector's ivfflat
--     operator class can be used by the planner without a wrapper penalty.
--
-- Score convention:
--   `<=>` is pgvector cosine DISTANCE. We return 1 - distance as `score`
--   so the caller can treat higher = more similar (matches the hand-rolled
--   similarity in src/lib/similarity.ts which is already 0-1 higher-better).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.match_fragrances(
    query_embedding vector(384),
    match_count     int  DEFAULT 20,
    exclude_id      uuid DEFAULT NULL
)
RETURNS TABLE (id uuid, score float)
LANGUAGE sql
STABLE
AS $$
    SELECT
        f.id,
        1 - (f.embedding <=> query_embedding) AS score
    FROM public.fragrances f
    WHERE f.embedding IS NOT NULL
      AND (exclude_id IS NULL OR f.id <> exclude_id)
    ORDER BY f.embedding <=> query_embedding
    LIMIT match_count;
$$;

COMMENT ON FUNCTION public.match_fragrances(vector, int, uuid)
  IS 'Returns the match_count fragrances most similar to query_embedding by cosine similarity. Respects RLS (is_approved filter applies). exclude_id optionally excludes the seed fragrance. See notes/recommender-design.md §4.';

-- Allow both anonymous and authenticated users to call this. RLS still
-- enforces is_approved gating; this GRANT only exposes the function.
GRANT EXECUTE ON FUNCTION public.match_fragrances(vector, int, uuid)
  TO anon, authenticated;
