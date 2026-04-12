import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { InlineError } from '../ui/InlineError'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import type { Fragrance, UserCollection, WearLog } from '@/types/database'

type CollectionItem = UserCollection & { fragrance: Fragrance }

interface InsightsData {
  collection: CollectionItem[]
  wearLogs: (WearLog & { fragrance: Fragrance })[]
}

interface BrandBreakdown { brand: string; count: number; percentage: number }
interface ConcentrationBreakdown { type: string; count: number; percentage: number }
interface FamilyBreakdown { family: string; count: number; percentage: number }
interface SeasonBreakdown { season: string; score: number }
interface NegletedItem { item: CollectionItem; daysSinceWorn: number | null; totalWears: number }

export function InsightsScreen() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [data, setData] = useState<InsightsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(() => {
    if (!user) { setLoading(false); return }
    setLoading(true)
    setError(null)

    Promise.all([
      supabase
        .from('user_collections')
        .select('*, fragrance:fragrances(*)')
        .eq('user_id', user.id)
        .eq('status', 'own'),
      supabase
        .from('wear_logs')
        .select('*, fragrance:fragrances(*)')
        .eq('user_id', user.id)
        .order('wear_date', { ascending: false }),
    ]).then(([collRes, wearRes]) => {
      if (collRes.error) { setError(collRes.error.message); setLoading(false); return }
      if (wearRes.error) { setError(wearRes.error.message); setLoading(false); return }
      setData({
        collection: (collRes.data ?? []) as CollectionItem[],
        wearLogs: (wearRes.data ?? []) as (WearLog & { fragrance: Fragrance })[],
      })
      setLoading(false)
    })
  }, [user])

  useEffect(() => { fetchData() }, [fetchData])

  if (!user) {
    return (
      <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen flex flex-col items-center justify-center">
        <div className="w-16 h-16 rounded-sm bg-surface-container flex items-center justify-center mb-5">
          <span className="text-3xl text-primary/40 font-serif italic">I</span>
        </div>
        <h3 className="font-headline text-xl text-on-surface mb-2">Sign in to see insights</h3>
        <p className="text-sm text-secondary/60 text-center mb-6">Get a deep breakdown of your fragrance collection.</p>
        <button onClick={() => navigate('/profile')} className="gold-gradient text-on-primary px-8 py-3 rounded-sm font-label text-[10px] font-bold uppercase tracking-widest transition-opacity hover:opacity-90 ambient-glow">SIGN IN</button>
      </main>
    )
  }

  if (error) return <main className="pt-24 pb-32 px-6"><InlineError message="Couldn't load insights" onRetry={fetchData} /></main>

  if (loading || !data) {
    return (
      <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen">
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 rounded-sm bg-surface-container animate-pulse" />
          ))}
        </div>
      </main>
    )
  }

  const { collection, wearLogs } = data
  if (collection.length === 0) {
    return (
      <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen flex flex-col items-center justify-center">
        <div className="w-20 h-20 rounded-sm bg-surface-container flex items-center justify-center mb-6">
          <span className="text-primary/40 text-4xl font-serif italic">I</span>
        </div>
        <h3 className="font-headline text-xl text-on-surface mb-2 text-center">No insights yet</h3>
        <p className="text-sm text-secondary/60 text-center mb-8 max-w-[280px]">Add fragrances to your collection to see your taste profile, wearing patterns, and more.</p>
        <button onClick={() => navigate('/explore')} className="gold-gradient text-on-primary px-8 py-3 rounded-sm font-label text-[10px] font-bold uppercase tracking-widest transition-opacity hover:opacity-90 ambient-glow">EXPLORE</button>
      </main>
    )
  }

  // Compute insights
  const totalOwned = collection.length
  const totalWears = wearLogs.length
  const avgRating = collection.reduce((sum, c) => sum + (Number(c.fragrance.rating) || 0), 0) / totalOwned
  const uniqueWorn = new Set(wearLogs.map((w) => w.fragrance_id)).size
  const costPerWear = totalWears > 0 ? (totalOwned / totalWears).toFixed(1) : '—'

  // Brand breakdown
  const brandMap = new Map<string, number>()
  collection.forEach((c) => { brandMap.set(c.fragrance.brand, (brandMap.get(c.fragrance.brand) || 0) + 1) })
  const brands: BrandBreakdown[] = [...brandMap.entries()]
    .map(([brand, count]) => ({ brand, count, percentage: Math.round((count / totalOwned) * 100) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  // Concentration breakdown
  const concMap = new Map<string, number>()
  collection.forEach((c) => {
    const type = c.fragrance.concentration || 'Unknown'
    concMap.set(type, (concMap.get(type) || 0) + 1)
  })
  const concentrations: ConcentrationBreakdown[] = [...concMap.entries()]
    .map(([type, count]) => ({ type, count, percentage: Math.round((count / totalOwned) * 100) }))
    .sort((a, b) => b.count - a.count)

  // Note family breakdown
  const familyMap = new Map<string, number>()
  collection.forEach((c) => {
    const fam = c.fragrance.note_family || 'Unknown'
    familyMap.set(fam, (familyMap.get(fam) || 0) + 1)
  })
  const families: FamilyBreakdown[] = [...familyMap.entries()]
    .map(([family, count]) => ({ family, count, percentage: Math.round((count / totalOwned) * 100) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  // Season affinity (avg season scores across collection)
  const seasonScores = new Map<string, number[]>()
  collection.forEach((c) => {
    c.fragrance.season_ranking?.forEach((s) => {
      if (!seasonScores.has(s.name)) seasonScores.set(s.name, [])
      seasonScores.get(s.name)!.push(s.score)
    })
  })
  const seasons: SeasonBreakdown[] = [...seasonScores.entries()]
    .map(([season, scores]) => ({ season, score: scores.reduce((a, b) => a + b, 0) / scores.length }))
    .sort((a, b) => b.score - a.score)

  // Most neglected (owned but rarely/never worn)
  const wearCountMap = new Map<string, { count: number; lastWorn: string }>()
  wearLogs.forEach((w) => {
    const existing = wearCountMap.get(w.fragrance_id)
    if (!existing) {
      wearCountMap.set(w.fragrance_id, { count: 1, lastWorn: w.wear_date })
    } else {
      existing.count++
      if (w.wear_date > existing.lastWorn) existing.lastWorn = w.wear_date
    }
  })
  const neglected: NegletedItem[] = collection
    .map((item) => {
      const wearInfo = wearCountMap.get(item.fragrance.id)
      const daysSinceWorn = wearInfo
        ? Math.floor((Date.now() - new Date(wearInfo.lastWorn).getTime()) / 86400000)
        : null
      return { item, daysSinceWorn, totalWears: wearInfo?.count ?? 0 }
    })
    .sort((a, b) => a.totalWears - b.totalWears)
    .slice(0, 5)

  // Most worn (from wear logs)
  const wornRanking = [...wearCountMap.entries()]
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 5)
    .map(([fid, info]) => {
      const log = wearLogs.find((w) => w.fragrance_id === fid)
      return { fragrance: log?.fragrance, count: info.count }
    })
    .filter((w) => w.fragrance)

  return (
    <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen space-y-8">
      <header>
        <h2 className="font-headline text-3xl text-on-surface leading-tight mb-1">Collection Insights</h2>
        <p className="font-body text-sm text-secondary opacity-70">Your taste, decoded</p>
      </header>

      {/* Quick Stats */}
      <section className="grid grid-cols-3 gap-3">
        <StatCard label="OWNED" value={totalOwned.toString()} />
        <StatCard label="AVG RATING" value={avgRating.toFixed(1)} />
        <StatCard label="TOTAL WEARS" value={totalWears.toString()} />
      </section>

      <section className="grid grid-cols-2 gap-3">
        <StatCard label="UNIQUE WORN" value={`${uniqueWorn}/${totalOwned}`} />
        <StatCard label="BOTTLES / WEAR" value={costPerWear} />
      </section>

      {/* Top Brands */}
      {brands.length > 0 && (
        <section className="bg-surface-container rounded-sm p-5 space-y-4">
          <h3 className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">TOP BRANDS</h3>
          <div className="space-y-3">
            {brands.map((b) => (
              <div key={b.brand}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-on-surface">{b.brand}</span>
                  <span className="text-[10px] text-secondary/60">{b.count} ({b.percentage}%)</span>
                </div>
                <div className="h-1.5 bg-surface-container-highest overflow-hidden">
                  <div className="h-full bg-primary transition-all duration-500" style={{ width: `${b.percentage}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Note Family Breakdown */}
      {families.length > 0 && (
        <section className="bg-surface-container rounded-sm p-5 space-y-4">
          <h3 className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">SCENT PROFILE</h3>
          <div className="flex flex-wrap gap-2">
            {families.map((f) => (
              <span key={f.family} className="flex items-center gap-1.5 bg-surface-container-highest px-3 py-2 rounded-sm">
                <span className="text-xs text-on-surface font-medium">{f.family}</span>
                <span className="text-[10px] text-primary font-bold">{f.percentage}%</span>
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Concentration Breakdown */}
      {concentrations.length > 0 && (
        <section className="bg-surface-container rounded-sm p-5 space-y-4">
          <h3 className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">CONCENTRATION</h3>
          <div className="space-y-3">
            {concentrations.map((c) => (
              <div key={c.type}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-on-surface">{c.type}</span>
                  <span className="text-[10px] text-secondary/60">{c.count} ({c.percentage}%)</span>
                </div>
                <div className="h-1.5 bg-surface-container-highest overflow-hidden">
                  <div className="h-full bg-tertiary transition-all duration-500" style={{ width: `${c.percentage}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Season Affinity */}
      {seasons.length > 0 && (
        <section className="bg-surface-container rounded-sm p-5 space-y-4">
          <h3 className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">SEASON AFFINITY</h3>
          <div className="grid grid-cols-2 gap-3">
            {seasons.map((s) => (
              <div key={s.season} className="bg-surface-container-highest rounded-sm p-3 text-center">
                <p className="text-[10px] uppercase tracking-widest text-secondary/60 mb-1">{s.season}</p>
                <p className="text-xl font-headline text-on-surface font-bold">{(s.score * 100).toFixed(0)}%</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Most Worn */}
      {wornRanking.length > 0 && (
        <section className="bg-surface-container rounded-sm p-5 space-y-4">
          <h3 className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">MOST WORN</h3>
          <div className="space-y-3">
            {wornRanking.map((w, i) => (
              <button
                key={w.fragrance!.id}
                onClick={() => navigate(`/fragrance/${w.fragrance!.id}`)}
                className="w-full flex items-center gap-3 py-1 text-left transition-opacity hover:opacity-80"
              >
                <span className="text-lg font-headline text-primary/40 w-6 text-center">{i + 1}</span>
                <div className="w-10 h-10 rounded-sm overflow-hidden flex-shrink-0 bg-surface-container-highest">
                  {w.fragrance!.image_url && (
                    <img src={w.fragrance!.image_url} alt={w.fragrance!.name} className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] uppercase tracking-[0.15em] text-primary/70 font-bold">{w.fragrance!.brand}</p>
                  <p className="text-sm text-on-surface truncate">{w.fragrance!.name}</p>
                </div>
                <span className="text-xs text-primary font-bold">{w.count}x</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Most Neglected */}
      {neglected.length > 0 && (
        <section className="bg-surface-container rounded-sm p-5 space-y-4">
          <h3 className="text-[10px] uppercase tracking-[0.2em] text-error/60 font-bold">MOST NEGLECTED</h3>
          <div className="space-y-3">
            {neglected.map((n) => (
              <button
                key={n.item.id}
                onClick={() => navigate(`/fragrance/${n.item.fragrance.id}`)}
                className="w-full flex items-center gap-3 py-1 text-left transition-opacity hover:opacity-80"
              >
                <div className="w-10 h-10 rounded-sm overflow-hidden flex-shrink-0 bg-surface-container-highest">
                  {n.item.fragrance.image_url && (
                    <img src={n.item.fragrance.image_url} alt={n.item.fragrance.name} className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] uppercase tracking-[0.15em] text-primary/70 font-bold">{n.item.fragrance.brand}</p>
                  <p className="text-sm text-on-surface truncate">{n.item.fragrance.name}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-on-surface font-medium">{n.totalWears}x worn</p>
                  <p className="text-[10px] text-secondary/50">
                    {n.daysSinceWorn !== null ? `${n.daysSinceWorn}d ago` : 'Never worn'}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
    </main>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface-container rounded-sm p-4 flex flex-col items-center justify-center text-center">
      <p className="text-xl font-headline text-on-surface font-bold">{value}</p>
      <p className="text-[8px] uppercase tracking-[0.2em] text-secondary/50 font-bold mt-0.5">{label}</p>
    </div>
  )
}
