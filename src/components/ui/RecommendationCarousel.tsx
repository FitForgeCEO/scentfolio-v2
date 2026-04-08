import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from './Icon'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { findSimilarToCollection } from '@/lib/similarity'
import type { Fragrance } from '@/types/database'

interface CollectionItem {
  fragrance: Fragrance | null
  personal_rating: number | null
}

interface ScoredRec {
  fragrance: Fragrance
  score: number
  reasons: string[]
}

/**
 * "You might also like" horizontal carousel.
 * Uses the similarity engine to recommend fragrances
 * based on the user's entire collection.
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
    // Get user's owned collection
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

    // Get IDs to exclude
    const ownedIds = new Set(owned.map(f => f.id))

    // Fetch candidate pool — top rated fragrances not in collection
    const { data: candidates } = await supabase
      .from('fragrances')
      .select('*')
      .not('image_url', 'is', null)
      .not('rating', 'is', null)
      .order('rating', { ascending: false })
      .limit(100)

    const pool = (candidates ?? []).filter(c => !ownedIds.has((c as Fragrance).id)) as Fragrance[]

    // Score using similarity engine
    const results = findSimilarToCollection(owned, pool, 10)

    setRecs(results.map(r => ({
      fragrance: r.fragrance,
      score: r.score,
      reasons: r.reasons,
    })))
    setLoading(false)
  }

  if (!user || loading || recs.length === 0) return null

  return (
    <section className="space-y-3 mt-8">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] uppercase tracking-[0.15em] font-label text-secondary font-bold">YOU MIGHT ALSO LIKE</h3>
        <div className="flex items-center gap-1 text-primary/50">
          <Icon name="auto_awesome" size={14} />
          <span className="text-[9px] uppercase tracking-wider">Based on your taste</span>
        </div>
      </div>
      <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-6 px-6 pb-2">
        {recs.map((rec) => (
          <button
            key={rec.fragrance.id}
            onClick={() => navigate(`/fragrance/${rec.fragrance.id}`)}
            className="flex-shrink-0 w-[110px] text-left active:scale-95 transition-transform"
          >
            <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-surface-container-highest mb-2">
              {rec.fragrance.image_url ? (
                <img src={rec.fragrance.image_url} alt={rec.fragrance.name} className="w-full h-full object-cover" loading="lazy" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Icon name="water_drop" className="text-secondary/30" size={24} />
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
