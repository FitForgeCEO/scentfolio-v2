/**
 * Taste-vector / centroid-based personalised recommender for Discover's
 * "Inscribed for You" department.
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
 * Returns `Fragrance[]` rather than scored results because DiscoverScreen
 * does not render scores or reasons in the "For You" department. If a future
 * surface (e.g. CollectionScreen RecommendationCarousel, step 8) wants badge
 * data, lift this module to a SimilarResult[] variant.
 *
 * See notes/recommender-design.md Section 4.3 (centroid construction) and
 * Section 11 step 7.
 */

import { supabase } from '@/lib/supabase'
import { computeSimilarity, findSimilarToCollection } from '@/lib/similarity'
import type { Fragrance } from '@/types/database'

export type OwnedItem = Fragrance & { rating?: number | null }

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
 * Public entry. Returns up to `limit` personalised fragrance recommendations
 * for the caller's owned collection. Uses the hybrid path when the flag is
 * on AND we can build a centroid from at least one owned embedding;
 * otherwise falls back to the heuristic.
 *
 * Never throws -- degrades silently to heuristic on any internal failure so
 * DiscoverScreen's "For You" shelf never breaks the UI.
 */
export async function fetchPersonalisedRecs(
  owned: OwnedItem[],
  limit = 10,
): Promise<Fragrance[]> {
  if (owned.length === 0) return []

  if (VECTOR_RECOMMENDER_ENABLED) {
    try {
      const hybrid = await fetchHybrid(owned, limit)
      if (hybrid.length > 0) return hybrid
      // Fall through to heuristic on cold-start (no owned embeddings yet).
    } catch (e) {
      console.warn('[fetchPersonalisedRecs] vector path failed, falling back:', e)
    }
  }

  return fetchHeuristic(owned, limit)
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
// Extracted here verbatim so DiscoverScreen can delegate entirely to this
// module.
// ---------------------------------------------------------------------------
async function fetchHeuristic(
  owned: OwnedItem[],
  limit: number,
): Promise<Fragrance[]> {
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

  const personalised = findSimilarToCollection(owned, pool, limit)
  return personalised.map(p => p.fragrance)
}

// ---------------------------------------------------------------------------
// Hybrid path -- weighted centroid of owned embeddings -> match_fragrances
// RPC -> heuristic rescore -> 0.6/0.4 combine. Returns [] on cold-start
// (no owned embeddings) so the caller falls through to heuristic.
// ---------------------------------------------------------------------------
async function fetchHybrid(
  owned: OwnedItem[],
  limit: number,
): Promise<Fragrance[]> {
  // 1. Pull embeddings for the owned set. Some rows may not have been
  //    embedded yet (e.g., newly user-submitted fragrances) -- skip those.
  const ownedIds = owned.map(o => o.id)
  const { data: embedRows, error: embedErr } = await supabase
    .from('fragrances')
    .select('id, embedding')
    .in('id', ownedIds)
  if (embedErr) throw embedErr

  const embeddingById = new Map<string, number[]>()
  for (const row of (embedRows ?? []) as { id: string; embedding: number[] | null }[]) {
    if (row.embedding && row.embedding.length > 0) {
      embeddingById.set(row.id, row.embedding)
    }
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
  //    owned set. Mirrors findSimilarToCollection's scoring idiom so the
  //    combined score stays comparable to the heuristic fall-through.
  const vectorScoreById = new Map(filtered.map(m => [m.id, m.score]))

  const scored: { fragrance: Fragrance; score: number }[] = []
  for (const id of ids) {
    const cand = candidateById.get(id)
    if (!cand) continue

    let heuristicMax = 0
    for (const o of owned) {
      const weight = o.rating ? o.rating / 5 : UNRATED_WEIGHT
      const { score } = computeSimilarity(o, cand)
      const weighted = score * weight
      if (weighted > heuristicMax) heuristicMax = weighted
    }

    const vectorScore = vectorScoreById.get(id) ?? 0
    const heuristicScore = heuristicMax / 100   // normalise 0-100 -> 0-1
    const combined =
      VECTOR_WEIGHT * vectorScore + HEURISTIC_WEIGHT * heuristicScore

    scored.push({ fragrance: cand, score: combined })
  }

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, limit).map(s => s.fragrance)
}
