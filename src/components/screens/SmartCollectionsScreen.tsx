import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import type { Fragrance } from '@/types/database'
import { getIconChar } from '@/lib/iconUtils'

interface SmartCollection {
  key: string
  title: string
  icon: string
  description: string
  fragrances: (Fragrance & { extra?: string })[]
  empty: string
}

export function SmartCollectionsScreen() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [collections, setCollections] = useState<SmartCollection[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    fetchSmartCollections()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function fetchSmartCollections() {
    const now = new Date()
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

    const [collRes, wearsRes, ratingsRes] = await Promise.all([
      supabase.from('user_collections').select('fragrance_id, date_added, personal_rating, fragrance:fragrances(*)').eq('user_id', user!.id).eq('status', 'own'),
      supabase.from('wear_logs').select('fragrance_id, wear_date').eq('user_id', user!.id).gte('wear_date', ninetyDaysAgo),
      supabase.from('user_collections').select('fragrance_id, personal_rating, fragrance:fragrances(*)').eq('user_id', user!.id).eq('status', 'own').not('personal_rating', 'is', null),
    ])

    type CollRow = { fragrance_id: string; date_added: string; personal_rating: number | null; fragrance: Fragrance | null }
    type WearRow = { fragrance_id: string; wear_date: string }
    type RatedRow = { fragrance_id: string; personal_rating: number | null; fragrance: Fragrance | null }

    const coll = (collRes.data ?? []) as unknown as CollRow[]
    const wears = (wearsRes.data ?? []) as unknown as WearRow[]
    const rated = (ratingsRes.data ?? []) as unknown as RatedRow[]

    // Build wear count map (last 90 days)
    const wearCount = new Map<string, number>()
    wears.forEach(w => wearCount.set(w.fragrance_id, (wearCount.get(w.fragrance_id) ?? 0) + 1))

    // Last worn date map
    const lastWorn = new Map<string, string>()
    wears.forEach(w => {
      const existing = lastWorn.get(w.fragrance_id)
      if (!existing || w.wear_date > existing) lastWorn.set(w.fragrance_id, w.wear_date)
    })

    const results: SmartCollection[] = []

    // 1. Not worn in 90 days
    const forgotten = coll
      .filter(c => c.fragrance && !wearCount.has(c.fragrance_id))
      .map(c => ({ ...c.fragrance!, extra: `Added ${new Date(c.date_added).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}` }))
    results.push({ key: 'forgotten', title: 'Forgotten Gems', icon: 'hourglass_empty', description: 'Not worn in the last 90 days', fragrances: forgotten, empty: 'You\'ve worn everything recently!' })

    // 2. Top rated but rarely worn
    const underappreciated = rated
      .filter(r => r.personal_rating && r.personal_rating >= 4 && r.fragrance && (wearCount.get(r.fragrance_id) ?? 0) <= 1)
      .sort((a, b) => (b.personal_rating ?? 0) - (a.personal_rating ?? 0))
      .map(r => ({ ...r.fragrance!, extra: `★ ${r.personal_rating} — only ${wearCount.get(r.fragrance_id) ?? 0} wears` }))
    results.push({ key: 'underappreciated', title: 'Underappreciated', icon: 'star_half', description: 'Rated ★4+ but barely worn', fragrances: underappreciated, empty: 'You wear your favourites well!' })

    // 3. New additions this month
    const newThisMonth = coll
      .filter(c => c.fragrance && c.date_added >= thisMonth)
      .sort((a, b) => b.date_added.localeCompare(a.date_added))
      .map(c => ({ ...c.fragrance!, extra: `Added ${new Date(c.date_added).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` }))
    results.push({ key: 'new', title: 'New This Month', icon: 'new_releases', description: 'Recently added to your collection', fragrances: newThisMonth, empty: 'No new additions this month' })

    // 4. Current season rotation
    const month = now.getMonth()
    let currentSeason: string
    if (month >= 2 && month <= 4) currentSeason = 'SPRING'
    else if (month >= 5 && month <= 7) currentSeason = 'SUMMER'
    else if (month >= 8 && month <= 10) currentSeason = 'FALL'
    else currentSeason = 'WINTER'

    const seasonDisplay = currentSeason === 'FALL' ? 'Autumn' : currentSeason.charAt(0) + currentSeason.slice(1).toLowerCase()

    const seasonalPicks = coll
      .filter(c => {
        if (!c.fragrance?.season_ranking) return false
        const sr = c.fragrance.season_ranking.find(s => s.name.toUpperCase() === currentSeason || (currentSeason === 'FALL' && s.name.toUpperCase() === 'AUTUMN'))
        return sr && sr.score >= 3
      })
      .sort((a, b) => {
        const scoreA = a.fragrance?.season_ranking?.find(s => s.name.toUpperCase() === currentSeason || (currentSeason === 'FALL' && s.name.toUpperCase() === 'AUTUMN'))?.score ?? 0
        const scoreB = b.fragrance?.season_ranking?.find(s => s.name.toUpperCase() === currentSeason || (currentSeason === 'FALL' && s.name.toUpperCase() === 'AUTUMN'))?.score ?? 0
        return scoreB - scoreA
      })
      .map(c => ({ ...c.fragrance!, extra: `${seasonDisplay} score: ${c.fragrance?.season_ranking?.find(s => s.name.toUpperCase() === currentSeason || (currentSeason === 'FALL' && s.name.toUpperCase() === 'AUTUMN'))?.score ?? '?'}/5` }))
    results.push({ key: 'seasonal', title: `${seasonDisplay} Rotation`, icon: 'wb_sunny', description: `Best picks for ${seasonDisplay.toLowerCase()}`, fragrances: seasonalPicks, empty: `No ${seasonDisplay.toLowerCase()} fragrances found` })

    // 5. Heavy rotation (most worn last 30 days)
    const recentWears = wears.filter(w => w.wear_date >= thirtyDaysAgo)
    const recentCount = new Map<string, number>()
    recentWears.forEach(w => recentCount.set(w.fragrance_id, (recentCount.get(w.fragrance_id) ?? 0) + 1))
    const heavyRotation = [...recentCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([fid, count]) => {
        const c = coll.find(c => c.fragrance_id === fid)
        return c?.fragrance ? { ...c.fragrance, extra: `${count} wears this month` } : null
      })
      .filter(Boolean) as (Fragrance & { extra?: string })[]
    results.push({ key: 'heavy', title: 'Heavy Rotation', icon: 'replay', description: 'Most worn in the last 30 days', fragrances: heavyRotation, empty: 'No wears in the last 30 days' })

    setCollections(results)
    setLoading(false)
  }

  if (!user) {
    return (
      <main className="pt-24 pb-32 px-6 flex flex-col items-center justify-center min-h-screen gap-4">
        <span className="text-5xl text-primary/30">?</span>
        <p className="text-secondary/60 text-sm">Sign in to see smart collections</p>
      </main>
    )
  }

  if (loading) {
    return (
      <main className="pt-24 pb-32 px-6 flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-1.5">{[1,2,3].map(i => <div key={i} className="h-1 rounded-sm bg-primary/20 animate-pulse" style={{ width: `${60 - i * 14}px` }} />)}</div>
      </main>
    )
  }

  return (
    <main className="pt-24 pb-32 px-4 max-w-[430px] mx-auto min-h-screen space-y-4">
      <div className="text-center mb-2">
        <p className="text-[10px] text-secondary/50">Auto-generated from your collection & habits</p>
      </div>

      {collections.map(col => {
        const isExpanded = expanded === col.key
        const count = col.fragrances.length
        return (
          <div key={col.key} className="bg-surface-container rounded-sm overflow-hidden">
            <button
              onClick={() => setExpanded(isExpanded ? null : col.key)}
              className="w-full flex items-center gap-3 p-4 active:bg-surface-container-high transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-sm bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-primary">{getIconChar(col.icon)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-on-surface font-medium">{col.title}</p>
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-primary/15 text-primary font-bold">{count}</span>
                </div>
                <p className="text-[10px] text-secondary/50">{col.description}</p>
              </div>
              <span className="text-secondary/40">{getIconChar(isExpanded ? 'expand_less' : 'expand_more')}</span>
            </button>

            {isExpanded && (
              <div className="px-4 pb-4 animate-fade-in">
                {count === 0 ? (
                  <p className="text-xs text-secondary/40 text-center py-4">{col.empty}</p>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {col.fragrances.slice(0, 15).map(f => (
                      <button
                        key={f.id}
                        onClick={() => navigate(`/fragrance/${f.id}`)}
                        className="w-full flex items-center gap-3 p-2 rounded-sm hover:bg-surface-container-high transition-colors text-left hover:opacity-80"
                      >
                        <div className="w-10 h-10 rounded-sm overflow-hidden bg-surface-container-low flex-shrink-0">
                          {f.image_url ? (
                            <img src={f.image_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <span className="text-primary/20">?</span>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-on-surface font-medium truncate">{f.name}</p>
                          <p className="text-[9px] text-secondary/50">{f.brand}</p>
                        </div>
                        {f.extra && <span className="text-[9px] text-primary/60 whitespace-nowrap">{f.extra}</span>}
                      </button>
                    ))}
                    {count > 15 && <p className="text-[10px] text-secondary/40 text-center">+{count - 15} more</p>}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </main>
  )
}
