/**
 * ScentFolio — user_signals data layer.
 *
 * Backs the thumbs-up / thumbs-down UI on recommendation surfaces
 * (starting with FragranceDetailScreen's Kindred Works, later
 * DiscoverScreen + CollectionScreen RecommendationCarousel).
 *
 * Schema reference: supabase/migrations/20260417000000_create_user_signals.sql
 *   * UNIQUE (user_id, fragrance_id, signal_type) → a single user may hold
 *     at most one row per (fragrance, signal_type). They can simultaneously
 *     hold 'saved' AND 'thumbs_up', but not two 'thumbs_up' rows.
 *   * signal_type CHECK ∈ ('thumbs_up', 'thumbs_down', 'saved', 'worn').
 *   * RLS locks all four operations to auth.uid() = user_id.
 *
 * Thumbs-direction invariant (enforced at this layer, not the DB):
 *   A user may NOT hold both 'thumbs_up' and 'thumbs_down' on the same
 *   fragrance. Flipping from one to the other is a DELETE-then-INSERT,
 *   sequenced so the UI never flickers through a neutral state.
 *
 * See notes/recommender-design.md §6 for the rationale behind the
 * schema choices this file consumes.
 */

import { supabase } from './supabase'
import { trackEvent, AnalyticsEvents } from './analytics'

// ── Types ────────────────────────────────────────────────────────────

/**
 * The DB-level signal_type values. Only the two thumb directions are
 * exposed via the UI today; 'saved' and 'worn' are carried here for
 * completeness and future use.
 */
export type SignalType = 'thumbs_up' | 'thumbs_down' | 'saved' | 'worn'

/** UI-friendly thumb state. `null` means no thumb recorded. */
export type ThumbState = 'up' | 'down' | null

const THUMB_TYPES: SignalType[] = ['thumbs_up', 'thumbs_down']

function thumbStateToType(state: Exclude<ThumbState, null>): SignalType {
  return state === 'up' ? 'thumbs_up' : 'thumbs_down'
}

function typeToThumbState(type: SignalType): ThumbState {
  if (type === 'thumbs_up') return 'up'
  if (type === 'thumbs_down') return 'down'
  return null
}

// ── Reads ────────────────────────────────────────────────────────────

/**
 * Load the current thumb state (up / down / null) for every fragrance in
 * `fragranceIds`, for the given user. Returns a map keyed by fragrance_id;
 * fragrances with no signal are simply absent from the map (caller should
 * treat missing as `null`).
 *
 * One round-trip regardless of list length. Respects RLS.
 */
export async function fetchThumbs(
  userId: string,
  fragranceIds: string[],
): Promise<Record<string, ThumbState>> {
  if (fragranceIds.length === 0) return {}

  const { data, error } = await supabase
    .from('user_signals')
    .select('fragrance_id, signal_type')
    .eq('user_id', userId)
    .in('fragrance_id', fragranceIds)
    .in('signal_type', THUMB_TYPES)

  if (error) throw error

  const out: Record<string, ThumbState> = {}
  for (const row of (data ?? []) as { fragrance_id: string; signal_type: SignalType }[]) {
    const s = typeToThumbState(row.signal_type)
    if (s) out[row.fragrance_id] = s
  }
  return out
}

// ── Writes ───────────────────────────────────────────────────────────

/**
 * Set (or clear) the thumb for a given fragrance.
 *
 *   next = 'up'   → ensure a single 'thumbs_up' row, clear any 'thumbs_down'
 *   next = 'down' → ensure a single 'thumbs_down' row, clear any 'thumbs_up'
 *   next = null   → clear both thumbs
 *
 * Idempotent at the row level thanks to the composite UNIQUE. Fires a
 * `recommender_thumbs` analytics event on every call so we can later
 * measure engagement by surface.
 *
 * `surface` is free-form (e.g. 'kindred_works', 'discover', 'collection')
 * and is stamped into the analytics event for attribution.
 */
export async function setThumb(
  userId: string,
  fragranceId: string,
  next: ThumbState,
  surface: string,
): Promise<void> {
  // Always clear the opposite direction first. If `next` is null, this
  // clears both directions; if `next` is a direction, this clears the
  // other one. Single DELETE covers both cases.
  const toDelete: SignalType[] =
    next === null
      ? THUMB_TYPES
      : [next === 'up' ? 'thumbs_down' : 'thumbs_up']

  const { error: delErr } = await supabase
    .from('user_signals')
    .delete()
    .eq('user_id', userId)
    .eq('fragrance_id', fragranceId)
    .in('signal_type', toDelete)
  if (delErr) throw delErr

  if (next !== null) {
    const { error: upErr } = await supabase
      .from('user_signals')
      .upsert(
        {
          user_id: userId,
          fragrance_id: fragranceId,
          signal_type: thumbStateToType(next),
        },
        { onConflict: 'user_id,fragrance_id,signal_type', ignoreDuplicates: true },
      )
    if (upErr) throw upErr
  }

  trackEvent(AnalyticsEvents.RECOMMENDER_THUMBS, {
    fragrance_id: fragranceId,
    direction: next,           // 'up' | 'down' | null (null = cleared)
    surface,
  })
}
