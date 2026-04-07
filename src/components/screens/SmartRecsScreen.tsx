import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../ui/Icon'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import type { Fragrance } from '@/types/database'

interface ScoredFragrance {
  fragrance: Fragrance
  score: number
  reasons: string[]
}

export function SmartRecsScreen() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [recs, setRecs] = useState<ScoredFragrance[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'for-you' | 'similar' | 'explore'>('for-you')

  useEffect(() => {
    if (!user) { setLoading(false); return }
    computeRecs()
  }, [user, tab])

  async function computeRecs() {
    setLoading(true)

    // Get user's collection with full fragrance details
    const { data: collection } = await supabase
      .from('user_collections')
      .select('fragrance_id, personal_rating, status, fragrance:fragrances(*)')
      .eq('user_id', user!.id)

    type CollRow = { fragrance_id: string; personal_rating: number | null; status: string; fragrance: Fragrance | null }
    const coll = (collection ?? []) as unknown as CollRow[]
    const ownedFrags = coll.filter((c) => c.fragrance).map((c) => c.fragrance!)
    const ownedIds = new Set(coll.map((c) => c.fragrance_id))

    if (ownedFrags.length === 0) {
      setLoading(false)
      return
    }

    // Compute user taste profile
    const brandCounts = new Map<string, number>()
    const familyCounts = new Map<string, number>()
    const noteCounts = new Map<string, number>()
    const ratedFrags = coll.filter((c) => c.personal_rating && c.personal_rating >= 4)

    for (const f of ownedFrags) {
      brandCounts.set(f.brand, (brandCounts.get(f.brand) ?? 0) + 1)
      if (f.note_family) familyCounts.set(f.note_family, (familyCounts.get(f.note_family) ?? 0) + 1)
      for (const note of [...(f.notes_top ?? []), ...(f.notes_heart ?? []), ...(f.notes_base ?? [])]) {
        noteCounts.set(note.toLowerCase(), (noteCounts.get(note.toLowerCase()) ?? 0) + 1)
      }
    }

    const topFamilies = [...familyCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([f]) => f)
    const topBrands = [...brandCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([b]) => b)
    const topNotes = [...noteCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([n]) => n)

    // Fetch candidates (not in collection)
    let query = supabase.from('fragrances').select('*').limit(200)

    if (tab === 'for-you') {
      // Fetch from top families
      if (topFamilies.length > 0) {
        query = query.in('note_family', topFamilies)
      }
    } else if (tab === 'similar') {
      // Fetch from same brands as highly rated
      const highBrands = ratedFrags.map((c) => c.fragrance?.brand).filter(Boolean) as string[]
      if (highBrands.length > 0) {
        query = query.in('brand', [...new Set(highBrands)])
      }
    } else {
      // Explore: get from families user DOESN'T own
      const ownedFamilies = [...familyCounts.keys()]
      if (ownedFamilies.length > 0) {
        query = query.not('note_family', 'in', `(${ownedFamilies.join(',')})`)
      }
    }

    const { data: candidates } = await query
    if (!candidates) { setLoading(false); return }

    // Score each candidate
    const scored: ScoredFragrance[] = []
    for (const frag of candidates as Fragrance[]) {
      if (ownedIds.has(frag.id)) continue

      let score = 0
      const reasons: string[] = []

      // Note family affinity
      if (frag.note_family && familyCounts.has(frag.note_family)) {
        const affinity = familyCounts.get(frag.note_family)!
        score += affinity * 15
        reasons.push(`You love ${frag.note_family} fragrances`)
      }

      // Shared notes
      const fragNotes = [...(frag.notes_top ?? []), ...(frag.notes_heart ?? []), ...(frag.notes_base ?? [])].map((n) => n.toLowerCase())
      let sharedNoteCount = 0
      for (const n of fragNotes) {
        if (noteCounts.has(n)) sharedNoteCount++
      }
      if (sharedNoteCount >= 3) {
        score += sharedNoteCount * 5
        reasons.push(`${sharedNoteCount} notes in common with your favourites`)
      }

      // Brand affinity
      if (topBrands.includes(frag.brand)) {
        score += 10
        reasons.push(`You own ${brandCounts.get(frag.brand)} from ${frag.brand}`)
      }

      // Community rating bonus
      if (frag.rating && Number(frag.rating) >= 4) {
        score += Number(frag.rating) * 3
        if (Number(frag.rating) >= 4.5) reasons.push('Highly rated by community')
      }

      // Explore bonus for novelty
      if (tab === 'explore') {
        score += 20
        if (!familyCounts.has(frag.note_family ?? '')) {
          reasons.push('New note family for you')
        }
      }

      if (score > 0 && reasons.length > 0) {
        scored.push({ fragrance: frag, score, reasons })
      }
    }

    scored.sort((a, b) => b.score - a.score)
    setRecs(scored.slice(0, 20))
    setLoading(false)
  }

  if (!user) {
    return (
      <main className="pt-24 pb-32 px-6 flex flex-col items-center justify-center min-h-screen gap-4">
        <Icon name="auto_awesome" className="text-5xl text-primary/30" />
        <p className="text-secondary/60 text-sm">Sign in to get personalised recommendations</p>
      </main>
    )
  }

  return (
    <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen">
      {/* Header */}
      <section className="text-center mb-6">
        <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-3">
          <Icon name="auto_awesome" filled className="text-3xl text-primary" />
        </div>
        <h2 className="font-headline text-xl mb-1">Smart Recommendations</h2>
        <p className="text-[10px] text-secondary/50">Based on your collection and taste profile</p>
      </section>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {[
          { key: 'for-you' as const, label: 'For You', icon: 'favorite' },
          { key: 'similar' as const, label: 'Similar', icon: 'content_copy' },
          { key: 'explore' as const, label: 'Explore', icon: 'explore' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 ${
              tab === t.key ? 'bg-primary/15 text-primary' : 'bg-surface-container text-secondary/50'
            }`}
          >
            <Icon name={t.icon} size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : recs.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16">
          <Icon name="search_off" className="text-4xl text-secondary/20" />
          <p className="text-sm text-secondary/50">
            {tab === 'explore' ? 'Add more fragrances to get diverse recommendations' : 'Add fragrances to your collection to unlock recommendations'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {recs.map((rec) => (
            <button
              key={rec.fragrance.id}
              onClick={() => navigate(`/fragrance/${rec.fragrance.id}`)}
              className="w-full bg-surface-container rounded-xl p-4 flex items-start gap-4 active:scale-[0.98] transition-transform text-left"
            >
              <div className="w-14 h-14 rounded-lg overflow-hidden bg-surface-container-low flex-shrink-0">
                {rec.fragrance.image_url ? (
                  <img src={rec.fragrance.image_url} alt={rec.fragrance.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Icon name="water_drop" className="text-secondary/20" size={24} />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[9px] uppercase tracking-[0.1em] text-secondary/50">{rec.fragrance.brand}</p>
                <p className="text-sm text-on-surface font-medium">{rec.fragrance.name}</p>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {rec.reasons.slice(0, 2).map((r, i) => (
                    <span key={i} className="text-[8px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                      {r}
                    </span>
                  ))}
                </div>
              </div>
              {rec.fragrance.rating && (
                <div className="flex items-center gap-0.5">
                  <Icon name="star" filled className="text-primary" size={12} />
                  <span className="text-[10px] text-primary font-semibold">{Number(rec.fragrance.rating).toFixed(1)}</span>
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </main>
  )
}
