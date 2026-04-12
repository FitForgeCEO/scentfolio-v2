import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import type { Fragrance } from '@/types/database'
import { getIconChar } from '@/lib/iconUtils'

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
        <span className="text-5xl text-primary/30">?</span>
        <p className="text-secondary/60 text-sm">Sign in to get personalised recommendations</p>
      </main>
    )
  }

  return (
    <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen">
      {/* Header */}
      <section className="text-center mb-6">
        <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-3">
          <span className="text-3xl text-primary">?</span>
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
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-sm text-[10px] font-bold uppercase tracking-wider transition-all hover:opacity-80 ${
              tab === t.key ? 'bg-primary/15 text-primary' : 'bg-surface-container text-secondary/50'
            }`}
          >
            <span>{getIconChar(t.icon)}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-1.5">{[1,2,3].map(i => <div key={i} className="h-1 rounded-sm bg-primary/20 animate-pulse" style={{ width: `${60 - i * 14}px` }} />)}</div>
        </div>
      ) : recs.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16">
          <span className="text-4xl text-secondary/20">?</span>
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
              className="w-full bg-surface-container rounded-sm p-4 flex items-start gap-4 hover:opacity-80 transition-transform text-left"
            >
              <div className="w-14 h-14 rounded-sm overflow-hidden bg-surface-container-low flex-shrink-0">
                {rec.fragrance.image_url ? (
                  <img src={rec.fragrance.image_url} alt={rec.fragrance.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-secondary/20">?</span>
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
                  <span className="text-primary">★</span>
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
