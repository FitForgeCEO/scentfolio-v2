import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Fragrance } from '@/types/database'

/**
 * Find similar fragrances based on matching accords.
 * Strategy: fetch fragrances that share the same note_family,
 * then rank by accord overlap.
 */
export function useSimilarFragrances(fragrance: Fragrance | null, limit = 6) {
  const [data, setData] = useState<Fragrance[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!fragrance) { setData([]); setLoading(false); return }

    setLoading(true)

    // Get the fragrance's accords for matching
    const sourceAccords = fragrance.accords ?? []
    const noteFamily = fragrance.note_family

    // Build query: same note family OR similar accords, excluding self
    let q = supabase
      .from('fragrances')
      .select('*')
      .neq('id', fragrance.id)
      .not('image_url', 'is', null)
      .not('rating', 'is', null)

    if (noteFamily) {
      q = q.eq('note_family', noteFamily)
    }

    q.order('rating', { ascending: false, nullsFirst: false })
      .limit(30) // Fetch more, then re-rank client-side
      .then(({ data: candidates }) => {
        if (!candidates || candidates.length === 0) {
          // Fallback: just top-rated
          supabase
            .from('fragrances')
            .select('*')
            .neq('id', fragrance.id)
            .not('image_url', 'is', null)
            .not('rating', 'is', null)
            .order('rating', { ascending: false })
            .limit(limit)
            .then(({ data: fallback }) => {
              setData((fallback ?? []) as Fragrance[])
              setLoading(false)
            })
          return
        }

        // Score by accord overlap
        const scored = (candidates as Fragrance[]).map((c) => {
          const cAccords = c.accords ?? []
          const overlap = sourceAccords.filter((a) =>
            cAccords.some((ca) => ca.toLowerCase() === a.toLowerCase())
          ).length
          return { fragrance: c, score: overlap }
        })

        scored.sort((a, b) => b.score - a.score)
        setData(scored.slice(0, limit).map((s) => s.fragrance))
        setLoading(false)
      })
  }, [fragrance?.id, limit])

  return { data, loading }
}
