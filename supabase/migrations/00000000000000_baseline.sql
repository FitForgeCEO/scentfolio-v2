-- ════════════════════════════════════════════════════════════════════
-- ScentFolio baseline schema (squash), generated 10 June 2026.
--
-- Snapshot of live project xyktbygztvpadrhawvur public schema, generated
-- by catalog introspection (pg_dump unavailable: no Docker on the dev
-- machine; see CLAUDE.md 10 June entry). Incorporates every migration
-- through 20260610100000 -- the historical files are preserved in
-- supabase/migrations_archive/ for reference and in git history.
--
-- Replay target: a Supabase stack (auth schema + anon/authenticated/
-- service_role roles must exist, i.e. `supabase start` or a fresh
-- hosted project).
-- ════════════════════════════════════════════════════════════════════

-- ── 1. Extensions ───────────────────────────────────────────────────
-- (plpgsql / pg_stat_statements / supabase_vault are platform-managed)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS http;
CREATE EXTENSION IF NOT EXISTS vector;

-- ── 2. Tables ────────────────────────────────────────────────────────

CREATE TABLE public.analytics_events (
    id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
    user_id uuid,
    session_id text NOT NULL,
    event_name text NOT NULL,
    event_data jsonb DEFAULT '{}'::jsonb,
    page_path text,
    referrer text,
    device_type text,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.blind_buys (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    fragrance_id uuid NOT NULL,
    purchase_date date DEFAULT CURRENT_DATE NOT NULL,
    price_paid numeric(10,2),
    outcome text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.custom_list_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    list_id uuid NOT NULL,
    fragrance_id uuid NOT NULL,
    sort_order integer DEFAULT 0,
    added_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.custom_lists (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    icon text DEFAULT 'label'::text,
    color text DEFAULT '#e5c276'::text,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.decants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    fragrance_id uuid NOT NULL,
    size_type text NOT NULL,
    size_ml numeric(6,1),
    remaining_ml numeric(6,1),
    purchase_price numeric(8,2),
    currency text DEFAULT 'GBP'::text,
    source text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.fragrance_dupes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    fragrance_a_id uuid NOT NULL,
    fragrance_b_id uuid NOT NULL,
    similarity_score integer NOT NULL,
    submitted_by uuid NOT NULL,
    votes integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.fragrance_tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    fragrance_id uuid NOT NULL,
    tag text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.fragrances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    brand text NOT NULL,
    name text NOT NULL,
    concentration text,
    gender text,
    year_released integer,
    image_url text,
    notes_top text[],
    notes_heart text[],
    notes_base text[],
    note_family text,
    accords text[],
    submitted_by uuid,
    is_approved boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    image_url_transparent text,
    longevity numeric,
    sillage numeric,
    price_value text,
    rating numeric,
    country text,
    popularity text,
    price text,
    general_notes text[] DEFAULT '{}'::text[],
    main_accords_percentage jsonb DEFAULT '{}'::jsonb,
    season_ranking jsonb DEFAULT '[]'::jsonb,
    occasion_ranking jsonb DEFAULT '[]'::jsonb,
    embedding vector(384),
    embedding_version smallint DEFAULT 1 NOT NULL
);

CREATE TABLE public.journal_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    fragrance_id uuid,
    title text,
    body text NOT NULL,
    mood text,
    tags text[] DEFAULT '{}'::text[],
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.layering_combos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    fragrance_a_id uuid NOT NULL,
    fragrance_b_id uuid NOT NULL,
    rating integer,
    notes text,
    occasion text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.layering_stacks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    fragrance_id uuid NOT NULL,
    vibe text NOT NULL,
    body_prep jsonb DEFAULT '{}'::jsonb NOT NULL,
    layering_fragrance jsonb DEFAULT '{}'::jsonb NOT NULL,
    technique text,
    why_it_works text,
    resulting_vibe text,
    pro_tip text,
    user_rating integer,
    user_notes text,
    tried_it boolean DEFAULT false NOT NULL,
    tried_at timestamp with time zone,
    is_public boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.profile_extras (
    user_id uuid NOT NULL,
    bio text DEFAULT ''::text,
    signature_fragrance_id uuid,
    favorite_notes text[] DEFAULT '{}'::text[],
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    display_name text DEFAULT ''::text NOT NULL,
    avatar_url text,
    level integer DEFAULT 1 NOT NULL,
    xp integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.review_likes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    review_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    fragrance_id uuid NOT NULL,
    overall_rating integer NOT NULL,
    longevity_rating integer,
    sillage_rating integer,
    scent_rating integer,
    value_rating integer,
    season_tags text[] DEFAULT '{}'::text[],
    occasion_tags text[] DEFAULT '{}'::text[],
    review_text text,
    title text,
    would_recommend boolean,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.rpc_rate_limit (
    user_id uuid NOT NULL,
    rpc_name text NOT NULL,
    window_start timestamp with time zone DEFAULT now() NOT NULL,
    call_count integer DEFAULT 0 NOT NULL
);

CREATE TABLE public.scent_board_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    board_id uuid NOT NULL,
    fragrance_id uuid NOT NULL,
    note text,
    "position" integer DEFAULT 0 NOT NULL,
    added_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.scent_boards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    cover_style text DEFAULT 'grid'::text NOT NULL,
    is_public boolean DEFAULT false NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.top_shelf (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    fragrance_id uuid NOT NULL,
    "position" integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.user_blocks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    blocker_id uuid NOT NULL,
    blocked_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.user_challenges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    challenge_id text NOT NULL,
    progress jsonb DEFAULT '{}'::jsonb,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    claimed boolean DEFAULT false NOT NULL
);

CREATE TABLE public.user_collections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    fragrance_id uuid NOT NULL,
    status text NOT NULL,
    personal_rating integer,
    personal_notes text,
    date_added timestamp with time zone DEFAULT now() NOT NULL,
    date_acquired date,
    bottle_size text,
    purchase_source text
);

CREATE TABLE public.user_follows (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    follower_id uuid NOT NULL,
    following_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.user_signals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    fragrance_id uuid NOT NULL,
    signal_type text NOT NULL,
    weight numeric(4,3),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.wear_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    fragrance_id uuid NOT NULL,
    wear_date date DEFAULT CURRENT_DATE NOT NULL,
    occasion text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    notes text
);

CREATE TABLE public.xp_ledger (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    action text NOT NULL,
    xp_amount integer NOT NULL,
    reference_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ── 3. Primary keys / unique / check constraints ──────────────────

ALTER TABLE public.analytics_events ADD CONSTRAINT analytics_events_pkey PRIMARY KEY (id);
ALTER TABLE public.blind_buys ADD CONSTRAINT blind_buys_outcome_check CHECK ((outcome = ANY (ARRAY['love'::text, 'like'::text, 'neutral'::text, 'dislike'::text, 'sold'::text])));
ALTER TABLE public.blind_buys ADD CONSTRAINT blind_buys_pkey PRIMARY KEY (id);
ALTER TABLE public.blind_buys ADD CONSTRAINT blind_buys_user_id_fragrance_id_key UNIQUE (user_id, fragrance_id);
ALTER TABLE public.custom_list_items ADD CONSTRAINT custom_list_items_list_id_fragrance_id_key UNIQUE (list_id, fragrance_id);
ALTER TABLE public.custom_list_items ADD CONSTRAINT custom_list_items_pkey PRIMARY KEY (id);
ALTER TABLE public.custom_lists ADD CONSTRAINT custom_lists_pkey PRIMARY KEY (id);
ALTER TABLE public.decants ADD CONSTRAINT decants_pkey PRIMARY KEY (id);
ALTER TABLE public.decants ADD CONSTRAINT decants_size_type_check CHECK ((size_type = ANY (ARRAY['full'::text, 'travel'::text, 'decant'::text, 'sample'::text, 'discovery'::text])));
ALTER TABLE public.fragrance_dupes ADD CONSTRAINT fragrance_dupes_fragrance_a_id_fragrance_b_id_key UNIQUE (fragrance_a_id, fragrance_b_id);
ALTER TABLE public.fragrance_dupes ADD CONSTRAINT fragrance_dupes_pkey PRIMARY KEY (id);
ALTER TABLE public.fragrance_dupes ADD CONSTRAINT fragrance_dupes_similarity_score_check CHECK (((similarity_score >= 0) AND (similarity_score <= 100)));
ALTER TABLE public.fragrance_tags ADD CONSTRAINT fragrance_tags_pkey PRIMARY KEY (id);
ALTER TABLE public.fragrance_tags ADD CONSTRAINT fragrance_tags_user_id_fragrance_id_tag_key UNIQUE (user_id, fragrance_id, tag);
ALTER TABLE public.fragrances ADD CONSTRAINT fragrances_name_brand_unique UNIQUE (name, brand);
ALTER TABLE public.fragrances ADD CONSTRAINT fragrances_pkey PRIMARY KEY (id);
ALTER TABLE public.journal_entries ADD CONSTRAINT journal_entries_pkey PRIMARY KEY (id);
ALTER TABLE public.layering_combos ADD CONSTRAINT layering_combos_pkey PRIMARY KEY (id);
ALTER TABLE public.layering_combos ADD CONSTRAINT layering_combos_rating_check CHECK (((rating >= 1) AND (rating <= 5)));
ALTER TABLE public.layering_stacks ADD CONSTRAINT layering_stacks_pkey PRIMARY KEY (id);
ALTER TABLE public.profile_extras ADD CONSTRAINT profile_extras_pkey PRIMARY KEY (user_id);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);
ALTER TABLE public.review_likes ADD CONSTRAINT review_likes_pkey PRIMARY KEY (id);
ALTER TABLE public.review_likes ADD CONSTRAINT review_likes_user_id_review_id_key UNIQUE (user_id, review_id);
ALTER TABLE public.reviews ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);
ALTER TABLE public.reviews ADD CONSTRAINT reviews_user_id_fragrance_id_key UNIQUE (user_id, fragrance_id);
ALTER TABLE public.rpc_rate_limit ADD CONSTRAINT rpc_rate_limit_pkey PRIMARY KEY (user_id, rpc_name);
ALTER TABLE public.scent_board_items ADD CONSTRAINT scent_board_items_board_id_fragrance_id_key UNIQUE (board_id, fragrance_id);
ALTER TABLE public.scent_board_items ADD CONSTRAINT scent_board_items_pkey PRIMARY KEY (id);
ALTER TABLE public.scent_boards ADD CONSTRAINT scent_boards_pkey PRIMARY KEY (id);
ALTER TABLE public.top_shelf ADD CONSTRAINT top_shelf_pkey PRIMARY KEY (id);
ALTER TABLE public.top_shelf ADD CONSTRAINT top_shelf_position_check CHECK ((("position" >= 0) AND ("position" < 10)));
ALTER TABLE public.top_shelf ADD CONSTRAINT top_shelf_user_id_fragrance_id_key UNIQUE (user_id, fragrance_id);
ALTER TABLE public.top_shelf ADD CONSTRAINT top_shelf_user_id_position_key UNIQUE (user_id, "position");
ALTER TABLE public.user_blocks ADD CONSTRAINT user_blocks_blocker_id_blocked_id_key UNIQUE (blocker_id, blocked_id);
ALTER TABLE public.user_blocks ADD CONSTRAINT user_blocks_check CHECK ((blocker_id <> blocked_id));
ALTER TABLE public.user_blocks ADD CONSTRAINT user_blocks_pkey PRIMARY KEY (id);
ALTER TABLE public.user_challenges ADD CONSTRAINT user_challenges_pkey PRIMARY KEY (id);
ALTER TABLE public.user_challenges ADD CONSTRAINT user_challenges_user_id_challenge_id_key UNIQUE (user_id, challenge_id);
ALTER TABLE public.user_collections ADD CONSTRAINT user_collections_personal_rating_check CHECK (((personal_rating >= 1) AND (personal_rating <= 10)));
ALTER TABLE public.user_collections ADD CONSTRAINT user_collections_pkey PRIMARY KEY (id);
ALTER TABLE public.user_collections ADD CONSTRAINT user_collections_status_check CHECK ((status = ANY (ARRAY['own'::text, 'wishlist'::text, 'sampled'::text, 'sold'::text])));
ALTER TABLE public.user_collections ADD CONSTRAINT user_collections_user_id_fragrance_id_key UNIQUE (user_id, fragrance_id);
ALTER TABLE public.user_follows ADD CONSTRAINT user_follows_check CHECK ((follower_id <> following_id));
ALTER TABLE public.user_follows ADD CONSTRAINT user_follows_follower_id_following_id_key UNIQUE (follower_id, following_id);
ALTER TABLE public.user_follows ADD CONSTRAINT user_follows_pkey PRIMARY KEY (id);
ALTER TABLE public.user_signals ADD CONSTRAINT user_signals_pkey PRIMARY KEY (id);
ALTER TABLE public.user_signals ADD CONSTRAINT user_signals_signal_type_check CHECK ((signal_type = ANY (ARRAY['thumbs_up'::text, 'thumbs_down'::text, 'saved'::text, 'worn'::text])));
ALTER TABLE public.user_signals ADD CONSTRAINT user_signals_user_fragrance_type_key UNIQUE (user_id, fragrance_id, signal_type);
ALTER TABLE public.user_signals ADD CONSTRAINT user_signals_weight_range_check CHECK (((weight IS NULL) OR ((weight >= '-9.999'::numeric) AND (weight <= 9.999))));
ALTER TABLE public.wear_logs ADD CONSTRAINT wear_logs_pkey PRIMARY KEY (id);
ALTER TABLE public.xp_ledger ADD CONSTRAINT xp_ledger_pkey PRIMARY KEY (id);

-- ── 4. Foreign keys (after all tables exist) ───────────────────────

ALTER TABLE public.analytics_events ADD CONSTRAINT analytics_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.blind_buys ADD CONSTRAINT blind_buys_fragrance_id_fkey FOREIGN KEY (fragrance_id) REFERENCES public.fragrances(id) ON DELETE CASCADE;
ALTER TABLE public.blind_buys ADD CONSTRAINT blind_buys_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.custom_list_items ADD CONSTRAINT custom_list_items_fragrance_id_fkey FOREIGN KEY (fragrance_id) REFERENCES public.fragrances(id) ON DELETE CASCADE;
ALTER TABLE public.custom_list_items ADD CONSTRAINT custom_list_items_list_id_fkey FOREIGN KEY (list_id) REFERENCES public.custom_lists(id) ON DELETE CASCADE;
ALTER TABLE public.custom_lists ADD CONSTRAINT custom_lists_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.decants ADD CONSTRAINT decants_fragrance_id_fkey FOREIGN KEY (fragrance_id) REFERENCES public.fragrances(id) ON DELETE CASCADE;
ALTER TABLE public.decants ADD CONSTRAINT decants_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.fragrance_dupes ADD CONSTRAINT fragrance_dupes_fragrance_a_id_fkey FOREIGN KEY (fragrance_a_id) REFERENCES public.fragrances(id) ON DELETE CASCADE;
ALTER TABLE public.fragrance_dupes ADD CONSTRAINT fragrance_dupes_fragrance_b_id_fkey FOREIGN KEY (fragrance_b_id) REFERENCES public.fragrances(id) ON DELETE CASCADE;
ALTER TABLE public.fragrance_dupes ADD CONSTRAINT fragrance_dupes_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.fragrance_tags ADD CONSTRAINT fragrance_tags_fragrance_id_fkey FOREIGN KEY (fragrance_id) REFERENCES public.fragrances(id);
ALTER TABLE public.fragrances ADD CONSTRAINT fragrances_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES public.profiles(id);
ALTER TABLE public.journal_entries ADD CONSTRAINT journal_entries_fragrance_id_fkey FOREIGN KEY (fragrance_id) REFERENCES public.fragrances(id) ON DELETE SET NULL;
ALTER TABLE public.journal_entries ADD CONSTRAINT journal_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.layering_combos ADD CONSTRAINT layering_combos_fragrance_a_id_fkey FOREIGN KEY (fragrance_a_id) REFERENCES public.fragrances(id) ON DELETE CASCADE;
ALTER TABLE public.layering_combos ADD CONSTRAINT layering_combos_fragrance_b_id_fkey FOREIGN KEY (fragrance_b_id) REFERENCES public.fragrances(id) ON DELETE CASCADE;
ALTER TABLE public.layering_combos ADD CONSTRAINT layering_combos_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.layering_stacks ADD CONSTRAINT layering_stacks_fragrance_id_fkey FOREIGN KEY (fragrance_id) REFERENCES public.fragrances(id) ON DELETE CASCADE;
ALTER TABLE public.layering_stacks ADD CONSTRAINT layering_stacks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.profile_extras ADD CONSTRAINT profile_extras_signature_fragrance_id_fkey FOREIGN KEY (signature_fragrance_id) REFERENCES public.fragrances(id) ON DELETE SET NULL;
ALTER TABLE public.profile_extras ADD CONSTRAINT profile_extras_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.review_likes ADD CONSTRAINT review_likes_review_id_fkey FOREIGN KEY (review_id) REFERENCES public.reviews(id) ON DELETE CASCADE;
ALTER TABLE public.review_likes ADD CONSTRAINT review_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_fragrance_id_fkey FOREIGN KEY (fragrance_id) REFERENCES public.fragrances(id) ON DELETE CASCADE;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.scent_board_items ADD CONSTRAINT scent_board_items_board_id_fkey FOREIGN KEY (board_id) REFERENCES public.scent_boards(id) ON DELETE CASCADE;
ALTER TABLE public.scent_board_items ADD CONSTRAINT scent_board_items_fragrance_id_fkey FOREIGN KEY (fragrance_id) REFERENCES public.fragrances(id) ON DELETE CASCADE;
ALTER TABLE public.scent_boards ADD CONSTRAINT scent_boards_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.top_shelf ADD CONSTRAINT top_shelf_fragrance_id_fkey FOREIGN KEY (fragrance_id) REFERENCES public.fragrances(id) ON DELETE CASCADE;
ALTER TABLE public.top_shelf ADD CONSTRAINT top_shelf_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.user_blocks ADD CONSTRAINT user_blocks_blocked_id_fkey FOREIGN KEY (blocked_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.user_blocks ADD CONSTRAINT user_blocks_blocker_id_fkey FOREIGN KEY (blocker_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.user_challenges ADD CONSTRAINT user_challenges_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.user_collections ADD CONSTRAINT user_collections_fragrance_id_fkey FOREIGN KEY (fragrance_id) REFERENCES public.fragrances(id) ON DELETE CASCADE;
ALTER TABLE public.user_collections ADD CONSTRAINT user_collections_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.user_follows ADD CONSTRAINT user_follows_follower_id_fkey FOREIGN KEY (follower_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.user_follows ADD CONSTRAINT user_follows_following_id_fkey FOREIGN KEY (following_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.user_signals ADD CONSTRAINT user_signals_fragrance_id_fkey FOREIGN KEY (fragrance_id) REFERENCES public.fragrances(id) ON DELETE CASCADE;
ALTER TABLE public.user_signals ADD CONSTRAINT user_signals_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.wear_logs ADD CONSTRAINT wear_logs_fragrance_id_fkey FOREIGN KEY (fragrance_id) REFERENCES public.fragrances(id) ON DELETE CASCADE;
ALTER TABLE public.wear_logs ADD CONSTRAINT wear_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.xp_ledger ADD CONSTRAINT xp_ledger_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ── 5. Plain indexes (constraint-backed indexes come with their constraints) ──

CREATE INDEX idx_analytics_events_created ON public.analytics_events USING btree (created_at DESC);
CREATE INDEX idx_analytics_events_name ON public.analytics_events USING btree (event_name);
CREATE INDEX idx_analytics_events_session ON public.analytics_events USING btree (session_id);
CREATE INDEX idx_analytics_events_user ON public.analytics_events USING btree (user_id) WHERE (user_id IS NOT NULL);
CREATE INDEX idx_blind_buys_user ON public.blind_buys USING btree (user_id);
CREATE INDEX idx_custom_list_items_list ON public.custom_list_items USING btree (list_id);
CREATE INDEX idx_custom_lists_user ON public.custom_lists USING btree (user_id);
CREATE INDEX idx_decants_user_id ON public.decants USING btree (user_id);
CREATE INDEX idx_fragrance_dupes_a ON public.fragrance_dupes USING btree (fragrance_a_id);
CREATE INDEX idx_fragrance_dupes_b ON public.fragrance_dupes USING btree (fragrance_b_id);
CREATE INDEX idx_journal_entries_created_at ON public.journal_entries USING btree (created_at DESC);
CREATE INDEX idx_journal_entries_user_id ON public.journal_entries USING btree (user_id);
CREATE INDEX idx_layering_combos_user ON public.layering_combos USING btree (user_id);
CREATE INDEX idx_review_likes_review ON public.review_likes USING btree (review_id);
CREATE INDEX idx_review_likes_user ON public.review_likes USING btree (user_id);
CREATE INDEX idx_top_shelf_user ON public.top_shelf USING btree (user_id);
CREATE INDEX idx_user_blocks_blocked ON public.user_blocks USING btree (blocked_id);
CREATE INDEX idx_user_blocks_blocker ON public.user_blocks USING btree (blocker_id);
CREATE INDEX idx_user_challenges_user ON public.user_challenges USING btree (user_id);
CREATE INDEX idx_user_follows_follower ON public.user_follows USING btree (follower_id);
CREATE INDEX idx_user_follows_following ON public.user_follows USING btree (following_id);
CREATE INDEX idx_xp_ledger_duplicate_check ON public.xp_ledger USING btree (user_id, action, reference_id);
CREATE INDEX idx_xp_ledger_user_id ON public.xp_ledger USING btree (user_id);
CREATE INDEX user_signals_created_at_idx ON public.user_signals USING btree (created_at DESC);
CREATE INDEX user_signals_fragrance_id_idx ON public.user_signals USING btree (fragrance_id);

-- ── 6. Application functions (extension-owned functions excluded; ──
-- ──    CREATE EXTENSION recreates those) ───────────────────────────

CREATE OR REPLACE FUNCTION public.award_xp(p_action text)
 RETURNS TABLE(new_xp integer, new_level integer, leveled_up boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_amount integer;
  v_awarded_count integer;
  v_eligible_count integer;
  v_streak_days integer;
  v_old_level integer;
  v_old_xp integer;
  v_new_xp integer;
  v_new_level integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Server-controlled amounts. Mirrors XP_AWARDS in src/lib/xp.ts.
  v_amount := CASE p_action
    WHEN 'LOG_WEAR'          THEN 10
    WHEN 'WRITE_REVIEW'      THEN 25
    WHEN 'ADD_TO_COLLECTION' THEN 5
    WHEN 'PROMOTE_TO_OWNED'  THEN 10
    WHEN 'FIRST_WEAR'        THEN 20
    WHEN 'STREAK_3'          THEN 30
    WHEN 'STREAK_7'          THEN 75
    WHEN 'STREAK_14'         THEN 150
    WHEN 'STREAK_30'         THEN 300
    ELSE NULL
  END;

  IF v_amount IS NULL THEN
    RAISE EXCEPTION 'invalid_action: %', p_action;
  END IF;

  -- Eligibility A: high-water mark. Lifetime awards for this action must
  -- stay below the live count of the underlying entity. Deleting and
  -- re-creating rows can therefore never re-earn the same XP, and a bare
  -- RPC loop with no underlying activity earns nothing.
  SELECT count(*) INTO v_awarded_count
  FROM public.xp_ledger
  WHERE user_id = v_user_id AND action = p_action;

  v_eligible_count := CASE p_action
    WHEN 'LOG_WEAR'          THEN (SELECT count(*) FROM public.wear_logs WHERE user_id = v_user_id)
    WHEN 'FIRST_WEAR'        THEN (SELECT count(DISTINCT fragrance_id) FROM public.wear_logs WHERE user_id = v_user_id)
    WHEN 'WRITE_REVIEW'      THEN (SELECT count(*) FROM public.reviews WHERE user_id = v_user_id)
    WHEN 'ADD_TO_COLLECTION' THEN (SELECT count(*) FROM public.user_collections WHERE user_id = v_user_id)
    WHEN 'PROMOTE_TO_OWNED'  THEN (SELECT count(*) FROM public.user_collections WHERE user_id = v_user_id AND status = 'own')
    ELSE NULL  -- STREAK_* handled below
  END;

  IF v_eligible_count IS NOT NULL AND v_awarded_count >= v_eligible_count THEN
    RAISE EXCEPTION 'xp_not_eligible: %', p_action;
  END IF;

  -- Eligibility B: streak awards require a real streak of that length
  -- and fire at most once per streak-length window.
  IF p_action IN ('STREAK_3', 'STREAK_7', 'STREAK_14', 'STREAK_30') THEN
    v_streak_days := substring(p_action FROM 8)::integer;
    IF public.compute_wear_streak(v_user_id) < v_streak_days THEN
      RAISE EXCEPTION 'xp_not_eligible: %', p_action;
    END IF;
    IF NOT public.consume_rpc_rate_limit('award_xp:' || p_action, 1, v_streak_days * 86400) THEN
      RAISE EXCEPTION 'xp_rate_limited: %', p_action;
    END IF;
  END IF;

  -- Volume backstop: LOG_WEAR awards capped at 20/day.
  IF p_action = 'LOG_WEAR'
     AND NOT public.consume_rpc_rate_limit('award_xp:LOG_WEAR', 20, 86400) THEN
    RAISE EXCEPTION 'xp_rate_limited: %', p_action;
  END IF;

  -- Lock the row to prevent concurrent xp races.
  SELECT level, xp INTO v_old_level, v_old_xp
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  v_new_xp := v_old_xp + v_amount;
  v_new_level := public.compute_level_from_xp(v_new_xp);

  UPDATE public.profiles
  SET xp = v_new_xp,
      level = v_new_level,
      updated_at = now()
  WHERE id = v_user_id;

  INSERT INTO public.xp_ledger (user_id, action, xp_amount)
  VALUES (v_user_id, p_action, v_amount);

  RETURN QUERY SELECT v_new_xp, v_new_level, (v_new_level > v_old_level);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.check_analytics_rate_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  recent_count integer;
BEGIN
  SELECT COUNT(*) INTO recent_count
  FROM analytics_events
  WHERE session_id = NEW.session_id
    AND created_at > now() - interval '1 hour';

  IF recent_count >= 500 THEN
    -- Silently drop the event (don't error — the client batches fire-and-forget)
    RETURN NULL;
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.claim_challenge(p_challenge_id text)
 RETURNS TABLE(new_xp integer, new_level integer, leveled_up boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_amount integer;
  v_target integer;
  v_progress integer;
  v_old_level integer;
  v_old_xp integer;
  v_new_xp integer;
  v_new_level integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Server-controlled per-challenge XP + target. Mirrors CHALLENGES
  -- in src/hooks/useChallenges.ts -- keep in sync on challenge edits.
  SELECT c.amount, c.target INTO v_amount, v_target
  FROM (VALUES
    ('coll-3',     25,   3),
    ('coll-10',    50,  10),
    ('coll-25',   100,  25),
    ('coll-50',   200,  50),
    ('wear-10',    30,  10),
    ('wear-50',    75,  50),
    ('wear-100',  150, 100),
    ('streak-7',   75,   7),
    ('streak-30', 300,  30),
    ('unique-5',   40,   5),
    ('unique-15', 100,  15),
    ('brand-5',    40,   5),
    ('brand-10',   80,  10),
    ('family-3',   30,   3),
    ('family-6',   80,   6),
    ('follow-3',   25,   3),
    ('follow-10',  60,  10),
    ('review-1',   25,   1),
    ('review-5',   50,   5),
    ('review-15', 120,  15)
  ) AS c(id, amount, target)
  WHERE c.id = p_challenge_id;

  IF v_amount IS NULL THEN
    RAISE EXCEPTION 'invalid_challenge: %', p_challenge_id;
  END IF;

  -- Recompute progress from the real tables. The client's direct INSERT
  -- into user_challenges is bookkeeping only -- it can no longer mint XP.
  -- Mirrors the getProgress functions in src/hooks/useChallenges.ts.
  v_progress := CASE
    WHEN p_challenge_id LIKE 'coll-%' THEN
      (SELECT count(*) FROM public.user_collections
       WHERE user_id = v_user_id AND status = 'own')
    WHEN p_challenge_id LIKE 'wear-%' THEN
      (SELECT count(*) FROM public.wear_logs WHERE user_id = v_user_id)
    WHEN p_challenge_id LIKE 'streak-%' THEN
      public.compute_wear_streak(v_user_id)
    WHEN p_challenge_id LIKE 'unique-%' THEN
      (SELECT count(DISTINCT fragrance_id) FROM public.wear_logs
       WHERE user_id = v_user_id
         AND wear_date >= date_trunc('month', current_date)::date)
    WHEN p_challenge_id LIKE 'brand-%' THEN
      (SELECT count(DISTINCT f.brand) FROM public.user_collections uc
       JOIN public.fragrances f ON f.id = uc.fragrance_id
       WHERE uc.user_id = v_user_id AND uc.status = 'own')
    WHEN p_challenge_id LIKE 'family-%' THEN
      (SELECT count(DISTINCT f.note_family) FROM public.user_collections uc
       JOIN public.fragrances f ON f.id = uc.fragrance_id
       WHERE uc.user_id = v_user_id AND uc.status = 'own'
         AND f.note_family IS NOT NULL)
    WHEN p_challenge_id LIKE 'follow-%' THEN
      (SELECT count(*) FROM public.user_follows WHERE follower_id = v_user_id)
    WHEN p_challenge_id LIKE 'review-%' THEN
      (SELECT count(*) FROM public.reviews WHERE user_id = v_user_id)
  END;

  IF v_progress IS NULL OR v_progress < v_target THEN
    RAISE EXCEPTION 'challenge_not_complete: % (progress %/%)',
      p_challenge_id, COALESCE(v_progress, 0), v_target;
  END IF;

  -- Atomic mark-as-claimed. UPDATE only succeeds if the row exists AND
  -- claimed = false -- prevents double-claim races.
  UPDATE public.user_challenges
  SET claimed = true
  WHERE user_id = v_user_id
    AND challenge_id = p_challenge_id
    AND claimed = false;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'challenge_not_claimable';
  END IF;

  -- Lock and update profiles.
  SELECT level, xp INTO v_old_level, v_old_xp
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  v_new_xp := v_old_xp + v_amount;
  v_new_level := public.compute_level_from_xp(v_new_xp);

  UPDATE public.profiles
  SET xp = v_new_xp,
      level = v_new_level,
      updated_at = now()
  WHERE id = v_user_id;

  INSERT INTO public.xp_ledger (user_id, action, xp_amount)
  VALUES (v_user_id, 'CHALLENGE:' || p_challenge_id, v_amount);

  RETURN QUERY SELECT v_new_xp, v_new_level, (v_new_level > v_old_level);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.compute_level_from_xp(p_xp integer)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_catalog'
AS $function$
  SELECT CASE
    WHEN p_xp >= 17000 THEN 15
    WHEN p_xp >= 13000 THEN 14
    WHEN p_xp >= 10000 THEN 13
    WHEN p_xp >= 7800  THEN 12
    WHEN p_xp >= 6000  THEN 11
    WHEN p_xp >= 4600  THEN 10
    WHEN p_xp >= 3500  THEN 9
    WHEN p_xp >= 2600  THEN 8
    WHEN p_xp >= 1900  THEN 7
    WHEN p_xp >= 1300  THEN 6
    WHEN p_xp >= 850   THEN 5
    WHEN p_xp >= 500   THEN 4
    WHEN p_xp >= 250   THEN 3
    WHEN p_xp >= 100   THEN 2
    ELSE 1
  END;
$function$
;

CREATE OR REPLACE FUNCTION public.compute_wear_streak(p_user_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_catalog'
AS $function$
  WITH dd AS (
    SELECT DISTINCT wear_date
    FROM public.wear_logs
    WHERE user_id = p_user_id
  ),
  anchored AS (
    SELECT
      wear_date,
      (ROW_NUMBER() OVER (ORDER BY wear_date DESC) - 1)::int AS rn,
      MAX(wear_date) OVER () AS anchor
    FROM dd
  )
  SELECT COALESCE(
    (SELECT count(*)::int
     FROM anchored
     WHERE anchor >= current_date - 1
       AND wear_date = anchor - rn),
    0);
$function$
;

CREATE OR REPLACE FUNCTION public.consume_rpc_rate_limit(p_rpc_name text, p_max_calls integer DEFAULT 60, p_window_seconds integer DEFAULT 60)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();
  v_window_age interval := make_interval(secs => p_window_seconds);
  v_current_count integer;
BEGIN
  IF v_user_id IS NULL THEN
    -- Anonymous / service_role: not rate-limited at this layer.
    RETURN true;
  END IF;

  INSERT INTO public.rpc_rate_limit AS rrl (user_id, rpc_name, window_start, call_count)
  VALUES (v_user_id, p_rpc_name, v_now, 1)
  ON CONFLICT (user_id, rpc_name) DO UPDATE
  SET
    window_start = CASE
      WHEN rrl.window_start < (v_now - v_window_age) THEN v_now
      ELSE rrl.window_start
    END,
    call_count = CASE
      WHEN rrl.window_start < (v_now - v_window_age) THEN 1
      ELSE rrl.call_count + 1
    END
  RETURNING rrl.call_count INTO v_current_count;

  RETURN v_current_count <= p_max_calls;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.fragrances_validate_image_url()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.image_url IS NOT NULL AND NEW.image_url <> '')
     OR (TG_OP = 'UPDATE' AND NEW.image_url IS DISTINCT FROM OLD.image_url) THEN
    IF NOT public.is_allowed_fragrance_image_url(NEW.image_url) THEN
      RAISE EXCEPTION 'image_url must be on cdn.fragella.com or Supabase Storage'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_image_slugs()
 RETURNS TABLE(fid text, slug text)
 LANGUAGE sql
 SET search_path TO 'public', 'pg_catalog'
AS $function$
  SELECT id::text, regexp_replace(image_url, '^https://cdn\.fragella\.com/images/', '')
  FROM public.fragrances
  WHERE image_url IS NOT NULL
  ORDER BY id;
$function$
;

CREATE OR REPLACE FUNCTION public.get_trending_fragrances(p_category text, p_days integer DEFAULT NULL::integer)
 RETURNS TABLE(fragrance_id uuid, name text, brand text, image_url text, cnt bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_cutoff timestamptz := CASE
    WHEN p_days IS NULL THEN '-infinity'::timestamptz
    ELSE now() - make_interval(days => p_days)
  END;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT public.consume_rpc_rate_limit('get_trending_fragrances', 60, 60) THEN
    RAISE EXCEPTION 'rate_limit_exceeded: 60 calls/min on get_trending_fragrances'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_category = 'worn' THEN
    RETURN QUERY
      SELECT f.id, f.name, f.brand, f.image_url, count(*)::bigint
      FROM public.wear_logs w
      JOIN public.fragrances f ON f.id = w.fragrance_id
      WHERE w.wear_date >= v_cutoff::date
        AND f.is_approved
      GROUP BY f.id, f.name, f.brand, f.image_url
      ORDER BY count(*) DESC, f.name ASC
      LIMIT 20;
  ELSIF p_category = 'added' THEN
    RETURN QUERY
      SELECT f.id, f.name, f.brand, f.image_url, count(*)::bigint
      FROM public.user_collections uc
      JOIN public.fragrances f ON f.id = uc.fragrance_id
      WHERE uc.date_added >= v_cutoff
        AND f.is_approved
      GROUP BY f.id, f.name, f.brand, f.image_url
      ORDER BY count(*) DESC, f.name ASC
      LIMIT 20;
  ELSIF p_category = 'reviewed' THEN
    RETURN QUERY
      SELECT f.id, f.name, f.brand, f.image_url, count(*)::bigint
      FROM public.reviews r
      JOIN public.fragrances f ON f.id = r.fragrance_id
      WHERE r.created_at >= v_cutoff
        AND f.is_approved
      GROUP BY f.id, f.name, f.brand, f.image_url
      ORDER BY count(*) DESC, f.name ASC
      LIMIT 20;
  ELSE
    RAISE EXCEPTION 'invalid_category: %', p_category;
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', 'Fragrance Lover'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_allowed_avatar_url(url text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_catalog'
AS $function$
  SELECT url IS NULL OR url = '' OR (
    url ~ ('^https://(' ||
      'i\.gravatar\.com' ||
      '|lh3\.googleusercontent\.com' ||
      '|avatars\.githubusercontent\.com' ||
      '|xyktbygztvpadrhawvur\.supabase\.co' ||
    ')/')
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_allowed_fragrance_image_url(url text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_catalog'
AS $function$
  SELECT url IS NULL OR url = '' OR (
    url ~ ('^https://(' ||
      'cdn\.fragella\.com' ||
      '|xyktbygztvpadrhawvur\.supabase\.co' ||
    ')/')
  );
$function$
;

CREATE OR REPLACE FUNCTION public.match_fragrances(query_embedding vector, match_count integer DEFAULT 20, exclude_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, score double precision)
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  IF NOT public.consume_rpc_rate_limit('match_fragrances', 60, 60) THEN
    RAISE EXCEPTION 'rate_limit_exceeded: 60 calls/min on match_fragrances'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
    SELECT
      f.id,
      (1 - (f.embedding <=> query_embedding))::double precision AS score
    FROM public.fragrances f
    WHERE f.embedding IS NOT NULL
      AND (exclude_id IS NULL OR f.id <> exclude_id)
    ORDER BY f.embedding <=> query_embedding
    LIMIT match_count;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.profiles_validate_avatar_url()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.avatar_url IS NOT NULL AND NEW.avatar_url <> '')
     OR (TG_OP = 'UPDATE' AND NEW.avatar_url IS DISTINCT FROM OLD.avatar_url) THEN
    IF NOT public.is_allowed_avatar_url(NEW.avatar_url) THEN
      RAISE EXCEPTION 'avatar_url must be on an allowed CDN (Gravatar, Google, GitHub, or Supabase Storage)'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

-- ── 7. Views ──
CREATE VIEW public.analytics_dau AS
 SELECT date_trunc('day'::text, created_at)::date AS day,
    count(DISTINCT session_id) AS sessions,
    count(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL) AS unique_users,
    count(*) AS total_events
   FROM analytics_events
  GROUP BY (date_trunc('day'::text, created_at)::date)
  ORDER BY (date_trunc('day'::text, created_at)::date) DESC;

CREATE VIEW public.analytics_devices AS
 SELECT device_type,
    count(DISTINCT session_id) AS sessions,
    count(*) AS events
   FROM analytics_events
  WHERE created_at > (now() - '30 days'::interval)
  GROUP BY device_type
  ORDER BY (count(DISTINCT session_id)) DESC;

CREATE VIEW public.analytics_event_counts AS
 SELECT event_name,
    count(*) AS total,
    count(DISTINCT session_id) AS unique_sessions,
    count(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL) AS unique_users
   FROM analytics_events
  WHERE created_at > (now() - '30 days'::interval)
  GROUP BY event_name
  ORDER BY (count(*)) DESC;

CREATE VIEW public.analytics_signup_funnel AS
 SELECT count(DISTINCT session_id) FILTER (WHERE event_name = 'page_view'::text AND page_path = '/'::text) AS visited_home,
    count(DISTINCT session_id) FILTER (WHERE event_name = 'landing_cta_click'::text) AS clicked_cta,
    count(DISTINCT session_id) FILTER (WHERE event_name = 'sign_up'::text) AS signed_up,
    count(DISTINCT session_id) FILTER (WHERE event_name = 'complete_onboarding'::text) AS completed_onboarding,
    count(DISTINCT session_id) FILTER (WHERE event_name = 'add_to_collection'::text) AS added_to_collection
   FROM analytics_events
  WHERE created_at > (now() - '30 days'::interval);

CREATE VIEW public.analytics_top_fragrances AS
 SELECT event_data ->> 'fragrance_id'::text AS fragrance_id,
    event_data ->> 'brand'::text AS brand,
    event_data ->> 'name'::text AS name,
    count(*) AS views,
    count(DISTINCT user_id) AS unique_viewers
   FROM analytics_events
  WHERE event_name = 'view_fragrance'::text AND created_at > (now() - '30 days'::interval)
  GROUP BY (event_data ->> 'fragrance_id'::text), (event_data ->> 'brand'::text), (event_data ->> 'name'::text)
  ORDER BY (count(*)) DESC
 LIMIT 50;

CREATE VIEW public.analytics_top_pages AS
 SELECT page_path,
    count(*) AS views,
    count(DISTINCT session_id) AS unique_sessions
   FROM analytics_events
  WHERE event_name = 'page_view'::text AND created_at > (now() - '30 days'::interval)
  GROUP BY page_path
  ORDER BY (count(*)) DESC;

CREATE VIEW public.analytics_top_searches AS
 SELECT event_data ->> 'query'::text AS search_term,
    count(*) AS searches,
    avg((event_data ->> 'results_count'::text)::integer) AS avg_results
   FROM analytics_events
  WHERE event_name = 'search'::text AND created_at > (now() - '30 days'::interval)
  GROUP BY (event_data ->> 'query'::text)
  ORDER BY (count(*)) DESC
 LIMIT 50;

-- ── 8. Triggers ──
CREATE TRIGGER trg_analytics_rate_limit BEFORE INSERT ON public.analytics_events FOR EACH ROW EXECUTE FUNCTION check_analytics_rate_limit();
CREATE TRIGGER fragrances_image_url_validate BEFORE INSERT OR UPDATE OF image_url ON public.fragrances FOR EACH ROW EXECUTE FUNCTION fragrances_validate_image_url();
CREATE TRIGGER profiles_avatar_url_validate BEFORE INSERT OR UPDATE OF avatar_url ON public.profiles FOR EACH ROW EXECUTE FUNCTION profiles_validate_avatar_url();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_scent_boards_updated_at BEFORE UPDATE ON public.scent_boards FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- auth.users triggers (cross-schema; part of app behaviour)
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Event triggers (app-owned only; Supabase platform event
-- triggers like pgrst_ddl_watch ship with every project)
CREATE EVENT TRIGGER ensure_rls ON ddl_command_end WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO') EXECUTE FUNCTION rls_auto_enable();

-- ── 9. Row Level Security ──
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blind_buys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fragrance_dupes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fragrance_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fragrances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.layering_combos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.layering_stacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_extras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rpc_rate_limit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scent_board_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scent_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.top_shelf ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wear_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xp_ledger ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can insert analytics events" ON public.analytics_events
  FOR INSERT TO public
  WITH CHECK (((user_id IS NULL) OR (auth.uid() = user_id)));

CREATE POLICY "Users can read own events" ON public.analytics_events
  FOR SELECT TO public
  USING ((auth.uid() = user_id));

CREATE POLICY "Users can add blind buys" ON public.blind_buys
  FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Users can delete their blind buys" ON public.blind_buys
  FOR DELETE TO public
  USING ((auth.uid() = user_id));

CREATE POLICY "Users can update their blind buys" ON public.blind_buys
  FOR UPDATE TO public
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Users can view their own blind buys" ON public.blind_buys
  FOR SELECT TO public
  USING ((auth.uid() = user_id));

CREATE POLICY "Users can delete own list items" ON public.custom_list_items
  FOR DELETE TO public
  USING ((EXISTS ( SELECT 1
   FROM custom_lists
  WHERE ((custom_lists.id = custom_list_items.list_id) AND (custom_lists.user_id = auth.uid())))));

CREATE POLICY "Users can insert own list items" ON public.custom_list_items
  FOR INSERT TO public
  WITH CHECK ((EXISTS ( SELECT 1
   FROM custom_lists
  WHERE ((custom_lists.id = custom_list_items.list_id) AND (custom_lists.user_id = auth.uid())))));

CREATE POLICY "Users can update own list items" ON public.custom_list_items
  FOR UPDATE TO public
  USING ((EXISTS ( SELECT 1
   FROM custom_lists
  WHERE ((custom_lists.id = custom_list_items.list_id) AND (custom_lists.user_id = auth.uid())))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM custom_lists
  WHERE ((custom_lists.id = custom_list_items.list_id) AND (custom_lists.user_id = auth.uid())))));

CREATE POLICY "Users can view own list items" ON public.custom_list_items
  FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM custom_lists
  WHERE ((custom_lists.id = custom_list_items.list_id) AND (custom_lists.user_id = auth.uid())))));

CREATE POLICY "Users can delete own lists" ON public.custom_lists
  FOR DELETE TO public
  USING ((auth.uid() = user_id));

CREATE POLICY "Users can insert own lists" ON public.custom_lists
  FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Users can update own lists" ON public.custom_lists
  FOR UPDATE TO public
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Users can view own lists" ON public.custom_lists
  FOR SELECT TO public
  USING ((auth.uid() = user_id));

CREATE POLICY "Users can delete own decants" ON public.decants
  FOR DELETE TO public
  USING ((auth.uid() = user_id));

CREATE POLICY "Users can insert own decants" ON public.decants
  FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Users can update own decants" ON public.decants
  FOR UPDATE TO public
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Users can view own decants" ON public.decants
  FOR SELECT TO public
  USING ((auth.uid() = user_id));

CREATE POLICY "Anyone can view dupe connections" ON public.fragrance_dupes
  FOR SELECT TO public
  USING (true);

CREATE POLICY "Authenticated users can submit dupes" ON public.fragrance_dupes
  FOR INSERT TO public
  WITH CHECK ((auth.uid() = submitted_by));

CREATE POLICY "Submitters can update their dupes" ON public.fragrance_dupes
  FOR UPDATE TO public
  USING ((auth.uid() = submitted_by))
  WITH CHECK ((auth.uid() = submitted_by));

CREATE POLICY "All authenticated users can view tags" ON public.fragrance_tags
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can delete own tags" ON public.fragrance_tags
  FOR DELETE TO authenticated
  USING ((auth.uid() = user_id));

CREATE POLICY "Users can insert own tags" ON public.fragrance_tags
  FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Anyone can read approved fragrances" ON public.fragrances
  FOR SELECT TO authenticated
  USING ((is_approved = true));

CREATE POLICY "Users can insert fragrances" ON public.fragrances
  FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = submitted_by));

CREATE POLICY "Users can update fragrances they submitted" ON public.fragrances
  FOR UPDATE TO authenticated
  USING ((auth.uid() = submitted_by))
  WITH CHECK ((auth.uid() = submitted_by));

CREATE POLICY "Users can delete own journal entries" ON public.journal_entries
  FOR DELETE TO public
  USING ((auth.uid() = user_id));

CREATE POLICY "Users can insert own journal entries" ON public.journal_entries
  FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Users can read own journal entries" ON public.journal_entries
  FOR SELECT TO public
  USING ((auth.uid() = user_id));

CREATE POLICY "Users can update own journal entries" ON public.journal_entries
  FOR UPDATE TO public
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Users can delete own combos" ON public.layering_combos
  FOR DELETE TO public
  USING ((auth.uid() = user_id));

CREATE POLICY "Users can insert own combos" ON public.layering_combos
  FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Users can update own combos" ON public.layering_combos
  FOR UPDATE TO public
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Users can view own combos" ON public.layering_combos
  FOR SELECT TO public
  USING ((auth.uid() = user_id));

CREATE POLICY "Users can delete own stacks" ON public.layering_stacks
  FOR DELETE TO authenticated
  USING ((auth.uid() = user_id));

CREATE POLICY "Users can insert own stacks" ON public.layering_stacks
  FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Users can update own stacks" ON public.layering_stacks
  FOR UPDATE TO authenticated
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Users can view own stacks" ON public.layering_stacks
  FOR SELECT TO authenticated
  USING (((auth.uid() = user_id) OR (is_public = true)));

CREATE POLICY "Anyone can view profile extras" ON public.profile_extras
  FOR SELECT TO public
  USING (true);

CREATE POLICY "Users can insert their own profile extras" ON public.profile_extras
  FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Users can update their own profile extras" ON public.profile_extras
  FOR UPDATE TO public
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Anyone can view profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = id));

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING ((auth.uid() = id))
  WITH CHECK ((auth.uid() = id));

CREATE POLICY "Anyone can view review likes" ON public.review_likes
  FOR SELECT TO public
  USING (true);

CREATE POLICY "Users can like reviews" ON public.review_likes
  FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Users can unlike reviews" ON public.review_likes
  FOR DELETE TO public
  USING ((auth.uid() = user_id));

CREATE POLICY "Users can delete own reviews" ON public.reviews
  FOR DELETE TO authenticated
  USING ((auth.uid() = user_id));

CREATE POLICY "Users can insert own reviews" ON public.reviews
  FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Users can update own reviews" ON public.reviews
  FOR UPDATE TO authenticated
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Users can view all reviews" ON public.reviews
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can delete board items" ON public.scent_board_items
  FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM scent_boards
  WHERE ((scent_boards.id = scent_board_items.board_id) AND (scent_boards.user_id = auth.uid())))));

CREATE POLICY "Users can insert board items" ON public.scent_board_items
  FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM scent_boards
  WHERE ((scent_boards.id = scent_board_items.board_id) AND (scent_boards.user_id = auth.uid())))));

CREATE POLICY "Users can update board items" ON public.scent_board_items
  FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM scent_boards
  WHERE ((scent_boards.id = scent_board_items.board_id) AND (scent_boards.user_id = auth.uid())))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM scent_boards
  WHERE ((scent_boards.id = scent_board_items.board_id) AND (scent_boards.user_id = auth.uid())))));

CREATE POLICY "Users can view board items" ON public.scent_board_items
  FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM scent_boards
  WHERE ((scent_boards.id = scent_board_items.board_id) AND ((scent_boards.user_id = auth.uid()) OR (scent_boards.is_public = true))))));

CREATE POLICY "Users can delete own boards" ON public.scent_boards
  FOR DELETE TO authenticated
  USING ((auth.uid() = user_id));

CREATE POLICY "Users can insert own boards" ON public.scent_boards
  FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Users can update own boards" ON public.scent_boards
  FOR UPDATE TO authenticated
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Users can view own boards" ON public.scent_boards
  FOR SELECT TO authenticated
  USING (((auth.uid() = user_id) OR (is_public = true)));

CREATE POLICY "Anyone can view top shelves" ON public.top_shelf
  FOR SELECT TO public
  USING (true);

CREATE POLICY "Users can manage their own top shelf" ON public.top_shelf
  FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Users can remove from their own top shelf" ON public.top_shelf
  FOR DELETE TO public
  USING ((auth.uid() = user_id));

CREATE POLICY "Users can update their own top shelf" ON public.top_shelf
  FOR UPDATE TO public
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Users can block others" ON public.user_blocks
  FOR INSERT TO public
  WITH CHECK ((auth.uid() = blocker_id));

CREATE POLICY "Users can unblock others" ON public.user_blocks
  FOR DELETE TO public
  USING ((auth.uid() = blocker_id));

CREATE POLICY "Users can view their own blocks" ON public.user_blocks
  FOR SELECT TO public
  USING ((auth.uid() = blocker_id));

CREATE POLICY "Users can join challenges" ON public.user_challenges
  FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Users can leave challenges" ON public.user_challenges
  FOR DELETE TO public
  USING ((auth.uid() = user_id));

CREATE POLICY "Users can update their challenge progress" ON public.user_challenges
  FOR UPDATE TO public
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Users can view all challenge progress" ON public.user_challenges
  FOR SELECT TO public
  USING (true);

CREATE POLICY "Users can delete own collection" ON public.user_collections
  FOR DELETE TO authenticated
  USING ((auth.uid() = user_id));

CREATE POLICY "Users can insert own collection" ON public.user_collections
  FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Users can update own collection" ON public.user_collections
  FOR UPDATE TO authenticated
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Users can view own collection" ON public.user_collections
  FOR SELECT TO authenticated
  USING ((auth.uid() = user_id));

CREATE POLICY "Users can follow others" ON public.user_follows
  FOR INSERT TO public
  WITH CHECK ((auth.uid() = follower_id));

CREATE POLICY "Users can unfollow" ON public.user_follows
  FOR DELETE TO public
  USING ((auth.uid() = follower_id));

CREATE POLICY "Users can view all follows" ON public.user_follows
  FOR SELECT TO public
  USING (true);

CREATE POLICY "Users can delete own signals" ON public.user_signals
  FOR DELETE TO public
  USING ((auth.uid() = user_id));

CREATE POLICY "Users can insert own signals" ON public.user_signals
  FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Users can update own signals" ON public.user_signals
  FOR UPDATE TO public
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Users can view own signals" ON public.user_signals
  FOR SELECT TO public
  USING ((auth.uid() = user_id));

CREATE POLICY "Users can delete own wear logs" ON public.wear_logs
  FOR DELETE TO authenticated
  USING ((auth.uid() = user_id));

CREATE POLICY "Users can insert own wear logs" ON public.wear_logs
  FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Users can update own wear logs" ON public.wear_logs
  FOR UPDATE TO authenticated
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Users can view own wear logs" ON public.wear_logs
  FOR SELECT TO authenticated
  USING ((auth.uid() = user_id));

CREATE POLICY "Users can view own xp entries" ON public.xp_ledger
  FOR SELECT TO authenticated
  USING ((auth.uid() = user_id));

-- ── 10. Privileges (normalised: revoke app roles, re-grant live ACLs) ──
REVOKE ALL ON public.analytics_dau FROM anon, authenticated;
REVOKE ALL ON public.analytics_devices FROM anon, authenticated;
REVOKE ALL ON public.analytics_event_counts FROM anon, authenticated;
REVOKE ALL ON public.analytics_events FROM anon, authenticated;
REVOKE ALL ON public.analytics_signup_funnel FROM anon, authenticated;
REVOKE ALL ON public.analytics_top_fragrances FROM anon, authenticated;
REVOKE ALL ON public.analytics_top_pages FROM anon, authenticated;
REVOKE ALL ON public.analytics_top_searches FROM anon, authenticated;
REVOKE ALL ON public.blind_buys FROM anon, authenticated;
REVOKE ALL ON public.custom_list_items FROM anon, authenticated;
REVOKE ALL ON public.custom_lists FROM anon, authenticated;
REVOKE ALL ON public.decants FROM anon, authenticated;
REVOKE ALL ON public.fragrance_dupes FROM anon, authenticated;
REVOKE ALL ON public.fragrance_tags FROM anon, authenticated;
REVOKE ALL ON public.fragrances FROM anon, authenticated;
REVOKE ALL ON public.journal_entries FROM anon, authenticated;
REVOKE ALL ON public.layering_combos FROM anon, authenticated;
REVOKE ALL ON public.layering_stacks FROM anon, authenticated;
REVOKE ALL ON public.profile_extras FROM anon, authenticated;
REVOKE ALL ON public.profiles FROM anon, authenticated;
REVOKE ALL ON public.review_likes FROM anon, authenticated;
REVOKE ALL ON public.reviews FROM anon, authenticated;
REVOKE ALL ON public.rpc_rate_limit FROM anon, authenticated;
REVOKE ALL ON public.scent_board_items FROM anon, authenticated;
REVOKE ALL ON public.scent_boards FROM anon, authenticated;
REVOKE ALL ON public.top_shelf FROM anon, authenticated;
REVOKE ALL ON public.user_blocks FROM anon, authenticated;
REVOKE ALL ON public.user_challenges FROM anon, authenticated;
REVOKE ALL ON public.user_collections FROM anon, authenticated;
REVOKE ALL ON public.user_follows FROM anon, authenticated;
REVOKE ALL ON public.user_signals FROM anon, authenticated;
REVOKE ALL ON public.wear_logs FROM anon, authenticated;
REVOKE ALL ON public.xp_ledger FROM anon, authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON public.analytics_dau TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON public.analytics_dau TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON public.analytics_devices TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON public.analytics_devices TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON public.analytics_event_counts TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON public.analytics_event_counts TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.analytics_events TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.analytics_events TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON public.analytics_signup_funnel TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON public.analytics_signup_funnel TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON public.analytics_top_fragrances TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON public.analytics_top_fragrances TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON public.analytics_top_pages TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON public.analytics_top_pages TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON public.analytics_top_searches TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON public.analytics_top_searches TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.blind_buys TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.blind_buys TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.custom_list_items TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.custom_list_items TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.custom_lists TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.custom_lists TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.decants TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.decants TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.fragrance_dupes TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.fragrance_dupes TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.fragrance_tags TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.fragrance_tags TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.fragrances TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.fragrances TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.journal_entries TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.journal_entries TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.layering_combos TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.layering_combos TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.layering_stacks TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.layering_stacks TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.profile_extras TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.profile_extras TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.profiles TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.profiles TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.review_likes TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.review_likes TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.reviews TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.reviews TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.scent_board_items TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.scent_board_items TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.scent_boards TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.scent_boards TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.top_shelf TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.top_shelf TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.user_blocks TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.user_blocks TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.user_challenges TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.user_challenges TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.user_collections TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.user_collections TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.user_follows TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.user_follows TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.user_signals TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.user_signals TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.wear_logs TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.wear_logs TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.xp_ledger TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.xp_ledger TO authenticated;

-- Column-level grants
GRANT UPDATE (display_name, avatar_url, updated_at) ON public.profiles TO authenticated;

-- Function privileges (app functions only; normalise then re-grant)
REVOKE ALL ON FUNCTION award_xp(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION check_analytics_rate_limit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION claim_challenge(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION compute_level_from_xp(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION compute_wear_streak(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION consume_rpc_rate_limit(text,integer,integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION fragrances_validate_image_url() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION get_image_slugs() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION get_trending_fragrances(text,integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION is_allowed_avatar_url(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION is_allowed_fragrance_image_url(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION match_fragrances(vector,integer,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION profiles_validate_avatar_url() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION rls_auto_enable() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION update_updated_at_column() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION award_xp(text) TO authenticated;
GRANT EXECUTE ON FUNCTION award_xp(text) TO service_role;
GRANT EXECUTE ON FUNCTION check_analytics_rate_limit() TO anon;
GRANT EXECUTE ON FUNCTION check_analytics_rate_limit() TO authenticated;
GRANT EXECUTE ON FUNCTION check_analytics_rate_limit() TO service_role;
GRANT EXECUTE ON FUNCTION claim_challenge(text) TO authenticated;
GRANT EXECUTE ON FUNCTION claim_challenge(text) TO service_role;
GRANT EXECUTE ON FUNCTION compute_level_from_xp(integer) TO anon;
GRANT EXECUTE ON FUNCTION compute_level_from_xp(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION compute_level_from_xp(integer) TO service_role;
GRANT EXECUTE ON FUNCTION compute_wear_streak(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION consume_rpc_rate_limit(text,integer,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION consume_rpc_rate_limit(text,integer,integer) TO service_role;
GRANT EXECUTE ON FUNCTION fragrances_validate_image_url() TO service_role;
GRANT EXECUTE ON FUNCTION get_image_slugs() TO service_role;
GRANT EXECUTE ON FUNCTION get_trending_fragrances(text,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_trending_fragrances(text,integer) TO service_role;
GRANT EXECUTE ON FUNCTION handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION is_allowed_avatar_url(text) TO anon;
GRANT EXECUTE ON FUNCTION is_allowed_avatar_url(text) TO authenticated;
GRANT EXECUTE ON FUNCTION is_allowed_avatar_url(text) TO service_role;
GRANT EXECUTE ON FUNCTION is_allowed_fragrance_image_url(text) TO anon;
GRANT EXECUTE ON FUNCTION is_allowed_fragrance_image_url(text) TO authenticated;
GRANT EXECUTE ON FUNCTION is_allowed_fragrance_image_url(text) TO service_role;
GRANT EXECUTE ON FUNCTION match_fragrances(vector,integer,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION match_fragrances(vector,integer,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION profiles_validate_avatar_url() TO service_role;
GRANT EXECUTE ON FUNCTION rls_auto_enable() TO service_role;
GRANT EXECUTE ON FUNCTION update_updated_at_column() TO anon;
GRANT EXECUTE ON FUNCTION update_updated_at_column() TO authenticated;
GRANT EXECUTE ON FUNCTION update_updated_at_column() TO service_role;
