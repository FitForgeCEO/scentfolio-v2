import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { findSimilar, computeSimilarity } from '@/lib/similarity'
import type { Fragrance } from '@/types/database'

export interface SimilarResult {
  fragrance: Fragrance
  score: number
  reasons: string[]
}

/**
 * Hybrid recommender, behind VITE_ENABLE_VECTOR_RECOMMENDER.
 *
 * When the flag is OFF (default) or the seed fragrance has no embedding yet,
 * this falls back to the original multi-signal heuristic path -- identical
 * behaviour to pre-17-April 2026.
 *
 * When the flag is ON AND the seed has an embedding, we call the
 * `match_fragrances` RPC to pull a broader semantic candidate pool, then
 * rescore each candidate with the existing heuristic (so `reasons[]` still
 * populates) and combine as:
 *
 *     final = 0.6 * vector_score + 0.4 * (heuristic_score / 100)
 *
 * See notes/recommender-design.md §4 for rationale behind the 60/40 split.
 *
 * Concurrency: guards against duplicate fetches per (id, limit) key and
 * ignores stale responses via reqRef. Fixes the double-fetch observed
 * post-step-6 (notes/recommender-design.md §11 open observation) where
 * the effect re-fired on auth hydration / lazy-chunk mount sequencing,
 * producing two RPC calls per FragranceDetailScreen visit where one
 * would suffice.
 */
export function useSimilarFragrances(fragrance: Fragrance | null, limit = 8) {
  const [data, setData] = useState<SimilarResult[]>([])
  const [loading, setLoading] = useState(true)
  // Tracks the latest request so stale async responses are discarded if
  // the seed changes (or the component unmounts) mid-flight.
  const reqRef = useRef(0)
  // Tracks the last (id, limit) pair we successfully kicked off a fetch
  // for, so a duplicate effect invocation with identical inputs is a
  // no-op rather than a second network call.
  const lastKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (!fragrance) {
      lastKeyRef.current = null
      setData([])
      setLoading(false)
      return
    }
    const key = `${fragrance.id}::${limit}`
    if (lastKeyRef.current === key) return  // dedupe -- already fetched
    lastKeyRef.current = key

    const reqId = ++reqRef.current
    setLoading(true)
    fetchAndScore(fragrance, limit).then(results => {
      if (reqRef.current !== reqId) return  // stale -- a newer fetch has superseded
      setData(results)
      setLoading(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fragrance?.id, limit])

  return { data, loading }
}

// ---------------------------------------------------------------------------
// Feature flag. Defaults to OFF. Enable per deploy by setting
//   VITE_ENABLE_VECTOR_RECOMMENDER=true
// in the environment before `vite build` / `vite dev`.
// ---------------------------------------------------------------------------
const VECTOR_RECOMMENDER_ENABLED =
  import.meta.env.VITE_ENABLE_VECTOR_RECOMMENDER === 'true'

const VECTOR_WEIGHT = 0.6
const HEURISTIC_WEIGHT = 0.4
const VECTOR_CANDIDATE_POOL = 40  // pull a wider pool from the RPC so the
                                  // heuristic has room to re-rank before we
                                  // slice to `limit`.

async function fetchAndScore(source: Fragrance, limit: number): Promise<SimilarResult[]> {
  // ---- Hybrid path ---------------------------------------------------------
  if (VECTOR_RECOMMENDER_ENABLED) {
    try {
      const hybrid = await fetchHybrid(source, limit)
      if (hybrid.length > 0) return hybrid
      // Fall through to heuristic if the seed has no embedding or the RPC
      // returned nothing (cold-start / backfill-miss). Never surface an
      // empty list when the heuristic could still produce results.
    } catch (e) {
      // Log but degrade gracefully -- the UI should never break because
      // pgvector was temporarily unavailable.
      console.warn('[useSimilarFragrances] vector path failed, falling back:', e)
    }
  }

  return fetchHeuristic(source, limit)
}

// ---------------------------------------------------------------------------
// Heuristic path -- unchanged from pre-17-April 2026.
// ---------------------------------------------------------------------------
async function fetchHeuristic(source: Fragrance, limit: number): Promise<SimilarResult[]> {
  const noteFamily = source.note_family
  const brand = source.brand

  const queries = [
    noteFamily
      ? supabase
          .from('fragrances')
          .select('*')
          .eq('note_family', noteFamily)
          .neq('id', source.id)
          .order('rating', { ascending: false, nullsFirst: false })
          .limit(30)
      : null,
    supabase
      .from('fragrances')
      .select('*')
      .eq('brand', brand)
      .neq('id', source.id)
      .order('rating', { ascending: false, nullsFirst: false })
      .limit(15),
    supabase
      .from('fragrances')
      .select('*')
      .neq('id', source.id)
      .not('rating', 'is', null)
      .order('rating', { ascending: false })
      .limit(20),
  ]

  const results = await Promise.all(queries.filter(Boolean).map(q => q!.then(r => r.data ?? [])))

  const seen = new Set<string>()
  const candidates: Fragrance[] = []
  for (const batch of results) {
    for (const f of batch as Fragrance[]) {
      if (!seen.has(f.id)) {
        seen.add(f.id)
        candidates.push(f)
      }
    }
  }

  const scored = findSimilar(source, candidates, limit, 10)
  return scored.map(s => ({
    fragrance: s.fragrance,
    score: s.score,
    reasons: s.reasons,
  }))
}

// ---------------------------------------------------------------------------
// Hybrid path -- uses match_fragrances RPC for semantic candidates, then
// re-scores with the existing heuristic so `reasons[]` still populates and
// combines the two scores with VECTOR_WEIGHT / HEURISTIC_WEIGHT.
// Returns [] if the seed has no embedding (graceful cold-start).
// ---------------------------------------------------------------------------
async function fetchHybrid(source: Fragrance, limit: number): Promise<SimilarResult[]> {
  // 1. Get the seed's embedding (not exposed on the Fragrance type).
  const { data: seedRow, error: seedErr } = await supabase
    .from('fragrances')
    .select('embedding')
    .eq('id', source.id)
    .maybeSingle<{ embedding: number[] | null }>()
  if (seedErr) throw seedErr
  const seedEmbedding = seedRow?.embedding
  if (!seedEmbedding) return []  // cold start -- fall through to heuristic

  // 2. Call the RPC for top-N semantic neighbours.
  const { data: matches, error: matchErr } = await supabase.rpc('match_fragrances', {
    query_embedding: seedEmbedding,
    match_count: VECTOR_CANDIDATE_POOL,
    exclude_id: source.id,
  })
  if (matchErr) throw matchErr
  const vectorMatches = (matches ?? []) as { id: string; score: number }[]
  if (vectorMatches.length === 0) return []

  // 3. Hydrate full Fragrance rows for those IDs (respects RLS is_approved).
  const ids = vectorMatches.map(m => m.id)
  const { data: rows, error: rowErr } = await supabase
    .from('fragrances')
    .select('*')
    .in('id', ids)
  if (rowErr) throw rowErr
  const candidates = (rows ?? []) as Fragrance[]
  const candidateById = new Map(candidates.map(c => [c.id, c]))

  // 4. For each vector match, also compute the heuristic score against the
  //    seed so we keep `reasons[]`. Then combine the two scores.
  const vectorScoreById = new Map(vectorMatches.map(m => [m.id, m.score]))

  const scored: SimilarResult[] = []
  for (const id of ids) {
    const cand = candidateById.get(id)
    if (!cand) continue   // RLS dropped it (is_approved = false)

    const { score: heuristicRaw, reasons } = computeSimilarity(source, cand)
    const vectorScore = vectorScoreById.get(id) ?? 0
    const heuristicScore = heuristicRaw / 100  // normalise 0-100 -> 0-1

    const combined =
      VECTOR_WEIGHT * vectorScore + HEURISTIC_WEIGHT * heuristicScore

    scored.push({
      fragrance: cand,
      // Expose on 0-100 scale so downstream UI (badges, progress bars) keeps
      // the same axis as the heuristic-only path.
      score: Math.round(combined * 100),
      reasons,
    })
  }

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, limit)
}
