-- ============================================================================
-- Migration: harden public.match_fragrances search_path
-- ============================================================================
-- Status:   Ready to apply. Depends on:
--             * public.match_fragrances (20260417170000_create_match_fragrances_rpc)
-- Created:  2026-04-18
-- Purpose:  Resolve the Supabase advisor WARN
--           (function_search_path_mutable) on public.match_fragrances by
--           pinning search_path at function-creation time. Without this,
--           the function inherits the caller's search_path, which opens a
--           narrow search-path hijack vector if a rogue schema of the same
--           name is ever placed earlier on the path.
--
-- Why ALTER vs. CREATE OR REPLACE:
--   We already own a hand-rolled body in 20260417170000. Re-shipping it as
--   a CREATE OR REPLACE would duplicate the source of truth and drift
--   risk. ALTER FUNCTION ... SET search_path leaves the body untouched and
--   just adds the GUC pin.
--
-- Safe to re-run: ALTER FUNCTION ... SET is idempotent.
-- ============================================================================

ALTER FUNCTION public.match_fragrances(vector, int, uuid)
  SET search_path = public, pg_catalog;
