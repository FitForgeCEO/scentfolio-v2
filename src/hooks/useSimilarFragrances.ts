import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { findSimilar } from '@/lib/similarity'
import type { Fragrance } from '@/types/database'

export interface SimilarResult {
  fragrance: Fragrance
  score: number
  reasons: string[]
}

/**
 * Find similar fragrances using the multi-signal similarity engine.
 * Fetches candidates with same note_family or top-rated, then scores
 * them using accord overlap, note matching, brand, concentration, etc.
 */
export function useSimilarFragrances(fragrance: Fragrance | null, limit = 8) {
  const [data, setData] = useState<SimilarResult[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!fragrance) { setData([]); setLoading(false); return }
    setLoading(true)
    fetchAndScore(fragrance, limit).then(results => {
      setData(results)
      setLoading(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fragrance?.id, limit])

  return { data, loading }
}

async function fetchAndScore(source: Fragrance, limit: number): Promise<SimilarResult[]> {
  // Strategy: fetch a broader pool of candidates, then score with similarity engine
  const noteFamily = source.note_family
  const brand = source.brand

  // Fetch candidates — same note family + same brand + top rated
  const queries = [
    // Same note family
    noteFamily
      ? supabase
          .from('fragrances')
          .select('*')
          .eq('note_family', noteFamily)
          .neq('id', source.id)
          .not('image_url', 'is', null)
          .order('rating', { ascending: false, nullsFirst: false })
          .limit(30)
      : null,
    // Same brand
    supabase
      .from('fragrances')
      .select('*')
      .eq('brand', brand)
      .neq('id', source.id)
      .not('image_url', 'is', null)
      .order('rating', { ascending: false, nullsFirst: false })
      .limit(15),
    // Top rated as fallback pool
    supabase
      .from('fragrances')
      .select('*')
      .neq('id', source.id)
      .not('image_url', 'is', null)
      .not('rating', 'is', null)
      .order('rating', { ascending: false })
      .limit(20),
  ]

  const results = await Promise.all(queries.filter(Boolean).map(q => q!.then(r => r.data ?? [])))

  // Deduplicate
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

  // Score using similarity engine
  const scored = findSimilar(source, candidates, limit, 10)

  return scored.map(s => ({
    fragrance: s.fragrance,
    score: s.score,
    reasons: s.reasons,
  }))
}
