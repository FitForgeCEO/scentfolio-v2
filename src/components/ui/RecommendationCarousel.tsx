import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import {
  fetchPersonalisedRecsScored,
  type ScoredRec,
} from '@/lib/taste-vector'
import { trackEvent, AnalyticsEvents } from '@/lib/analytics'
import type { Fragrance } from '@/types/database'

interface CollectionItem {
  fragrance: Fragrance | null
  personal_rating: number | null
}

/**
 * "You might also like" horizontal carousel.
 *
 * Delegates to fetchPersonalisedRecsScored which encapsulates both the
 * flag-gated hybrid vector path (VITE_ENABLE_VECTOR_RECOMMENDER) and the
 * heuristic fallback. Score (0-100) and reasons[] are rendered as a badge
 * and a single-line tag below the title.
 *
 * See notes/recommender-design.md Section 11 step 8.
 */
export function RecommendationCarousel() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [recs, setRecs] = useState<ScoredRec[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    fetchRecs()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function fetchRecs() {
    // Pull the user's owned collection as the taste-vector seed.
    const { data: collData } = await supabase
      .from('user_collections')
      .select('personal_rating, fragrance:fragrances(*)')
      .eq('user_id', user!.id)
      .eq('status', 'own')

    const coll = (collData ?? []) as unknown as CollectionItem[]
    const owned = coll
      .filter(c => c.fragrance)
      .map(c => ({ ...c.fragrance!, rating: c.personal_rating }))

    if (owned.length === 0) { setLoading(false); return }

    // fetchPersonalisedRecsScored handles: flag check, cold-start fallback,
    // centroid -> match_fragrances -> heuristic rescore -> 0.6/0.4 combine.
    // Never throws -- degrades silently to heuristic on any internal failure.
    const results = await fetchPersonalisedRecsScored(owned, 10)
    setRecs(results)
    setLoading(false)
  }

  if (!user || loading || recs.length === 0) return null

  return (
    <section className="space-y-3 mt-8">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] uppercase tracking-[0.15em] font-label text-secondary font-bold">YOU MIGHT ALSO LIKE</h3>
        <div className="flex items-center gap-1 text-primary/50">
          <span>?</span>
          <span className="text-[9px] uppercase tracking-wider">Based on your taste</span>
        </div>
      </div>
      <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-6 px-6 pb-2">
        {recs.map((rec, idx) => (
          <button
            key={rec.fragrance.id}
            onClick={() => {
              trackEvent(AnalyticsEvents.RECOMMENDER_CLICK, {
                source: 'collection_carousel',
                position: idx,
                fragrance_id: rec.fragrance.id,
              })
              navigate(`/fragrance/${rec.fragrance.id}`)
            }}
            className="flex-shrink-0 w-[110px] text-left hover:opacity-80 transition-transform"
          >
            <div className="relative aspect-[3/4] rounded-sm overflow-hidden bg-surface-container-highest mb-2">
              {rec.fragrance.image_url ? (
                <img src={rec.fragrance.image_url} alt={rec.fragrance.name} className="w-full h-full object-cover" loading="lazy" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-secondary/30">?</span>
                </div>
              )}
              <div className="absolute top-1.5 right-1.5 bg-black/60 backdrop-blur-sm rounded-full px-2 py-0.5">
                <span className="text-[8px] text-primary font-bold">{rec.score}%</span>
              </div>
            </div>
            <p className="text-[9px] uppercase tracking-[0.1em] font-label text-secondary/60">{rec.fragrance.brand}</p>
            <p className="text-[11px] font-medium text-on-surface truncate">{rec.fragrance.name}</p>
            {rec.reasons.length > 0 && (
              <p className="text-[9px] text-primary/60 truncate mt-0.5">{rec.reasons[0]}</p>
            )}
          </button>
        ))}
      </div>
    </section>
  )
}
