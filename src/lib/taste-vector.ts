/**
 * Taste-vector / centroid-based personalised recommender for Discover's
 * "Inscribed for You" department AND Collection's "You Might Also Like"
 * RecommendationCarousel.
 *
 * Extends the hybrid recommender pattern from useSimilarFragrances.ts to
 * collection-scoped recommendations. Rather than seeding the `match_fragrances`
 * RPC with a single fragrance, we seed it with the weighted centroid of the
 * user's owned-and-rated embeddings.
 *
 * Behaviour mirrors useSimilarFragrances.ts:
 *   - Flag-gated on VITE_ENABLE_VECTOR_RECOMMENDER (default OFF).
 *   - Flag OFF or cold-start path -> original heuristic (byte-identical to
 *     pre-17-April 2026 findSimilarToCollection over the rating-top-80 pool).
 *   - Flag ON + >=1 owned embedding -> weighted centroid -> match_fragrances
 *     -> heuristic rescore -> 0.6 * vector + 0.4 * (heuristic/100) combine.
 *
 * Two public entries serve two different surfaces:
 *   - fetchPersonalisedRecs(owned, limit): Fragrance[]
 *       For DiscoverScreen's "For You" shelf which does not render scores or
 *       reasons; accepts a plain Fragrance[] so the caller does not need to
 *       know about the scoring shape.
 *   - fetchPersonalisedRecsScored(owned, limit): ScoredRec[]
 *       For CollectionScreen's RecommendationCarousel which renders a score
 *       percent badge and the first reason line; returns the richer
 *       {fragrance, score: 0-100, reasons: string[]} shape.
 *
 * See notes/recommender-design.md Section 4.3 (centroid construction) and
 * Section 11 steps 7 and 8.
 */

import { supabase } from '@/lib/supabase'
import {
  computeSimilarity,
  findSimilarToCollection,
} from '@/lib/similarity'
import type { Fragrance } from '@/types/database'

export type OwnedItem = Fragrance & { rating?: number | null }

export type ScoredRec = {
  fragrance: Fragrance
  score: number          // 0-100, comparable across heuristic and hybrid paths
  reasons: string[]
}

// ---------------------------------------------------------------------------
// Feature flag -- same as useSimilarFragrances.ts so one env flip controls
// every recommender surface.
// ---------------------------------------------------------------------------
const VECTOR_RECOMMENDER_ENABLED =
  import.meta.env.VITE_ENABLE_VECTOR_RECOMMENDER === 'true'

const VECTOR_WEIGHT = 0.6
const HEURISTIC_WEIGHT = 0.4
const VECTOR_CANDIDATE_POOL = 40        // RPC top-N semantic neighbours
const HEURISTIC_CANDIDATE_POOL = 80     // rating-ordered pool for fallback
const UNRATED_WEIGHT = 0.6              // matches findSimilarToCollection idiom

/**
 * Public entry for Fragrance[]-shape consumers (DiscoverScreen).
 * Thin wrapper over fetchPersonalisedRecsScored that strips score/reasons.
 */
export async function fetchPersonalisedRecs(
  owned: OwnedItem[],
  limit = 10,
): Promise<Fragrance[]> {
  const scored = await fetchPersonalisedRecsScored(owned, limit)
  return scored.map(s => s.fragrance)
}

/**
 * Public entry for ScoredRec[]-shape consumers (RecommendationCarousel).
 * Uses the hybrid path when the flag is on AND we can build a centroid from
 * at least one owned embedding; otherwise falls back to the heuristic.
 *
 * Never throws -- degrades silently to heuristic on any internal failure so
 * the calling surface never breaks the UI.
 */
export async function fetchPersonalisedRecsScored(
  owned: OwnedItem[],
  limit = 10,
): Promise<ScoredRec[]> {
  if (owned.length === 0) return []

  if (VECTOR_RECOMMENDER_ENABLED) {
    try {
      const hybrid = await fetchHybrid(owned, limit)
      if (hybrid.length > 0) return hybrid
      // Fall through to heuristic on cold-start (no owned embeddings yet).
    } catch (e) {
      console.warn(
        '[fetchPersonalisedRecsScored] vector path failed, falling back:',
        e,
      )
    }
  }

  return fetchHeuristic(owned, limit)
}

// ---------------------------------------------------------------------------
// PostgREST returns pgvector columns as strings like "[0.1,0.2,...]". Parse
// that (or pass through a pre-parsed number[]) into a plain number[] for
// centroid arithmetic. Returns null for nulls, malformed strings, or non-
// numeric arrays so the caller can cleanly skip the row.
// ---------------------------------------------------------------------------
function parseEmbedding(raw: string | number[] | null | undefined): number[] | null {
  if (raw == null) return null
  let arr: unknown
  if (typeof raw === 'string') {
    if (raw.length === 0) return null
    try { arr = JSON.parse(raw) } catch { return null }
  } else {
    arr = raw
  }
  if (!Array.isArray(arr) || arr.length === 0) return null
  // Validate every element is finite; NaN/Infinity would poison the centroid.
  const out = new Array<number>(arr.length)
  for (let i = 0; i < arr.length; i++) {
    const n = arr[i]
    if (typeof n !== 'number' || !Number.isFinite(n)) return null
    out[i] = n
  }
  return out
}

// ---------------------------------------------------------------------------
// Weighted element-wise centroid. Exported for unit-testability; no caller
// outside this module needs it today.
// ---------------------------------------------------------------------------
export function computeCentroid(
  vectors: number[][],
  weights: number[],
): number[] {
  if (vectors.length === 0 || vectors.length !== weights.length) return []
  const dim = vectors[0].length
  if (dim === 0) return []

  const totalWeight = weights.reduce((sum, w) => sum + w, 0)
  if (totalWeight <= 0) return []

  const centroid = new Array<number>(dim).fill(0)
  for (let i = 0; i < vectors.length; i++) {
    const v = vectors[i]
    const w = weights[i]
    if (v.length !== dim) continue   // skip malformed -- never throw
    for (let d = 0; d < dim; d++) {
      centroid[d] += v[d] * w
    }
  }
  for (let d = 0; d < dim; d++) {
    centroid[d] /= totalWeight
  }
  return centroid
}

// ---------------------------------------------------------------------------
// Heuristic path -- unchanged from pre-17-April 2026 DiscoverScreen body.
// findSimilarToCollection already returns {fragrance, score, reasons} so we
// pass it straight through.
// ---------------------------------------------------------------------------
async function fetchHeuristic(
  owned: OwnedItem[],
  limit: number,
): Promise<ScoredRec[]> {
  const ownedIds = new Set(owned.map(f => f.id))
  const { data: candidates } = await supabase
    .from('fragrances')
    .select('*')
    .not('rating', 'is', null)
    .order('rating', { ascending: false })
    .limit(HEURISTIC_CANDIDATE_POOL)

  const pool = (candidates ?? []).filter(
    c => !ownedIds.has((c as Fragrance).id),
  ) as Fragrance[]

  return findSimilarToCollection(owned, pool, limit)
}

// ---------------------------------------------------------------------------
// Hybrid path -- weighted centroid of owned embeddings -> match_fragrances
// RPC -> heuristic rescore -> 0.6/0.4 combine. Returns [] on cold-start
// (no owned embeddings) so the caller falls through to heuristic.
//
// Score axis: combined is 0-1 internally, normalised to 0-100 on exit so the
// RecommendationCarousel badge renders a comparable percentage to the
// heuristic fallback (which already outputs 0-100 via findSimilarToCollection).
//
// Reasons: collected union-of-reasons across all owned seeds that scored
// against this candidate, matching the findSimilarToCollection idiom. Keeps
// hybrid and heuristic outputs shape-identical downstream.
// ---------------------------------------------------------------------------
async function fetchHybrid(
  owned: OwnedItem[],
  limit: number,
): Promise<ScoredRec[]> {
  // 1. Pull embeddings for the owned set. Some rows may not have been
  //    embedded yet (e.g., newly user-submitted fragrances) -- skip those.
  //
  //    NOTE: PostgREST returns pgvector columns as JSON STRINGS (e.g.
  //    "[0.1,0.2,...]"), not as JSON number arrays. We must parse them into
  //    number[] here before doing centroid arithmetic -- otherwise v[d] reads
  //    a character and the centroid collapses to NaN, which serialises back
  //    to the RPC as [null,null,...] and Postgres 400s on the vector cast.
  const ownedIds = owned.map(o => o.id)
  const { data: embedRows, error: embedErr } = await supabase
    .from('fragrances')
    .select('id, embedding')
    .in('id', ownedIds)
  if (embedErr) throw embedErr

  const embeddingById = new Map<string, number[]>()
  for (const row of (embedRows ?? []) as { id: string; embedding: string | number[] | null }[]) {
    const parsed = parseEmbedding(row.embedding)
    if (parsed) embeddingById.set(row.id, parsed)
  }
  if (embeddingById.size === 0) return []   // full cold start

  // 2. Build weighted centroid (rating/5, fallback UNRATED_WEIGHT).
  const vectors: number[][] = []
  const weights: number[] = []
  for (const o of owned) {
    const emb = embeddingById.get(o.id)
    if (!emb) continue
    vectors.push(emb)
    weights.push(o.rating ? o.rating / 5 : UNRATED_WEIGHT)
  }
  const centroid = computeCentroid(vectors, weights)
  if (centroid.length === 0) return []

  // 3. RPC for top-N semantic neighbours. exclude_id is single-valued, so we
  //    exclude the full owned set client-side instead.
  const { data: matches, error: matchErr } = await supabase.rpc('match_fragrances', {
    query_embedding: centroid,
    match_count: VECTOR_CANDIDATE_POOL,
    exclude_id: null,
  })
  if (matchErr) throw matchErr
  const vectorMatches = (matches ?? []) as { id: string; score: number }[]
  if (vectorMatches.length === 0) return []

  const ownedIdSet = new Set(ownedIds)
  const filtered = vectorMatches.filter(m => !ownedIdSet.has(m.id))
  if (filtered.length === 0) return []

  // 4. Hydrate (RLS enforces is_approved -- some rows may drop out).
  const ids = filtered.map(m => m.id)
  const { data: rows, error: rowErr } = await supabase
    .from('fragrances')
    .select('*')
    .in('id', ids)
  if (rowErr) throw rowErr
  const candidates = (rows ?? []) as Fragrance[]
  const candidateById = new Map(candidates.map(c => [c.id, c]))

  // 5. Heuristic rescore: max rating-weighted computeSimilarity over the
  //    owned set, union of reasons across all owned that hit the candidate.
  //    Mirrors findSimilarToCollection's scoring idiom so the combined
  //    output stays comparable with the heuristic fall-through.
  const vectorScoreById = new Map(filtered.map(m => [m.id, m.score]))

  const scored: ScoredRec[] = []
  for (const id of ids) {
    const cand = candidateById.get(id)
    if (!cand) continue

    let heuristicMax = 0
    const reasonSet = new Set<string>()
    for (const o of owned) {
      const weight = o.rating ? o.rating / 5 : UNRATED_WEIGHT
      const { score: sim, reasons } = computeSimilarity(o, cand)
      reasons.forEach(r => reasonSet.add(r))
      const weighted = sim * weight
      if (weighted > heuristicMax) heuristicMax = weighted
    }

    const vectorScore = vectorScoreById.get(id) ?? 0
    const heuristicScore = heuristicMax / 100           // 0-100 -> 0-1
    const combined =
      VECTOR_WEIGHT * vectorScore + HEURISTIC_WEIGHT * heuristicScore

    scored.push({
      fragrance: cand,
      score: Math.round(combined * 100),                // 0-1 -> 0-100
      reasons: [...reasonSet],
    })
  }

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, limit)
}
