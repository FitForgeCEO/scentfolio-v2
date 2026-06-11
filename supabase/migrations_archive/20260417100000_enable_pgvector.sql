-- 20260417100000_enable_pgvector.sql
-- Enable pgvector extension for embedding-based similarity search.
--
-- Applied to live DB via Supabase MCP on 17 April 2026.
-- Mirrored here for environment parity (local supabase start, branch envs).
--
-- Purpose: unlock native vector similarity for the recommender surface
-- (see Tier 3 of Action-Plan-Waitlist-and-Community-17Apr2026.md).
-- Complements the hand-rolled heuristic in src/lib/similarity.ts.
--
-- Usage once live:
--   alter table fragrances add column embedding vector(384);
--   create index on fragrances using ivfflat (embedding vector_cosine_ops) with (lists = 100);
--   -- then backfill embeddings from a sentence-transformers model (notes + accords + description).

create extension if not exists vector;
