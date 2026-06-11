-- ============================================================================
-- Migration: create user_signals table
-- ============================================================================
-- Status:   Ready to apply. Recommender surface design landed 17 April 2026
--           in notes/recommender-design.md. See §6 of that doc for the
--           rationale behind applying as-is (no schema amendments needed).
-- Created:  2026-04-17
-- Purpose:  Capture explicit user feedback signals on fragrances for the
--           learning recommender system (Q3/Q4 2026 target).
--
-- Pattern mirrors user_collections:
--   * uuid PK with gen_random_uuid() default
--   * FKs to profiles(id) and fragrances(id), both ON DELETE CASCADE
--   * text column + CHECK constraint (matches user_collections.status;
--     Postgres enums are intentionally NOT used -- codebase convention)
--   * timestamptz with now() default
--   * RLS enabled with four policies (select/insert/update/delete) keyed
--     on auth.uid() = user_id
--
-- Divergences from user_collections (documented because they are choices,
-- not oversights):
--
--   1. Composite UNIQUE is (user_id, fragrance_id, signal_type).
--      user_collections is (user_id, fragrance_id) because you only own a
--      fragrance once. Signals differ -- a user can simultaneously have
--      a 'saved' and a 'thumbs_up' signal on the same fragrance, but only
--      one of each type.
--
--   2. Additional single-column indexes (see Indexes section). The
--      composite UNIQUE already covers (user_id) and (user_id, fragrance_id)
--      as btree prefixes, so no separate compound index on those columns.
--
--   3. weight is nullable numeric. This lets the recommender default
--      weights by signal_type at query time, while leaving room for future
--      per-row strength overrides without a schema change.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_signals (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       uuid        NOT NULL REFERENCES public.profiles(id)   ON DELETE CASCADE,
    fragrance_id  uuid        NOT NULL REFERENCES public.fragrances(id) ON DELETE CASCADE,
    signal_type   text        NOT NULL,
    weight        numeric(4,3),
    created_at    timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT user_signals_signal_type_check
        CHECK (signal_type IN ('thumbs_up', 'thumbs_down', 'saved', 'worn')),

    CONSTRAINT user_signals_weight_range_check
        CHECK (weight IS NULL OR (weight >= -9.999 AND weight <= 9.999)),

    CONSTRAINT user_signals_user_fragrance_type_key
        UNIQUE (user_id, fragrance_id, signal_type)
);

COMMENT ON TABLE  public.user_signals
    IS 'Explicit user feedback signals on fragrances. Feeds the learning recommender.';
COMMENT ON COLUMN public.user_signals.signal_type
    IS 'One of: thumbs_up, thumbs_down, saved, worn. Extend via a CHECK-constraint migration.';
COMMENT ON COLUMN public.user_signals.weight
    IS 'Optional per-row weight override. NULL means the recommender applies a default weight by signal_type at query time.';


-- ----------------------------------------------------------------------------
-- Indexes
-- ----------------------------------------------------------------------------
-- The UNIQUE (user_id, fragrance_id, signal_type) constraint provides a
-- btree index that already covers (user_id) and (user_id, fragrance_id)
-- as prefixes. Adding explicit indexes only where they are NOT prefixes
-- of that unique index:
--
--   * fragrance_id_idx      -- supports cross-user aggregate reads
--                              ("how many thumbs_ups does this fragrance
--                              have?" for a future public-facing counter)
--   * created_at_idx        -- supports recency-weighted recommender
--                              scoring and "recent signals" feeds
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS user_signals_fragrance_id_idx
    ON public.user_signals (fragrance_id);

CREATE INDEX IF NOT EXISTS user_signals_created_at_idx
    ON public.user_signals (created_at DESC);


-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
-- Mirrors user_collections RLS: users can CRUD only their own signals.
-- For cross-user aggregate reads (e.g. "top thumbs_up'd fragrances this
-- week"), DO NOT relax these policies. Add a SECURITY DEFINER function or
-- a materialised view in a follow-up migration instead -- that keeps the
-- raw table locked down.
-- ----------------------------------------------------------------------------
ALTER TABLE public.user_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own signals"
    ON public.user_signals
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own signals"
    ON public.user_signals
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own signals"
    ON public.user_signals
    FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own signals"
    ON public.user_signals
    FOR DELETE
    USING (auth.uid() = user_id);


-- ----------------------------------------------------------------------------
-- Rollback (keep in this file for convenience; not auto-run)
-- ----------------------------------------------------------------------------
-- DROP TABLE IF EXISTS public.user_signals CASCADE;
