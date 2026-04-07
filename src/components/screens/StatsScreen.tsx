import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../ui/Icon'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import type { Fragrance } from '@/types/database'

interface StatsData {
  // Collection growth
  monthlyGrowth: { month: string; count: number }[]
  totalOwned: number
  // Wearing patterns
  weekdayWears: { day: string; count: number }[]
  topWorn: { fragrance: Fragrance; count: number }[]
  totalWears: number
  // Taste profile
  topFamilies: { family: string; count: number }[]
  topBrands: { brand: string; count: number }[]
  concentrationBreakdown: { type: string; count: number }[]
  avgRating: number
  // Diversity score
  diversityScore: number
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function StatsScreen() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { setLoading(false); return }

    async function fetchStats() {
      // Collection with fragrances
      const { data: collections } = await supabase
        .from('user_collections')
        .select('date_added, personal_rating, fragrance:fragrances(*)')
        .eq('user_id', user!.id)
        .eq('status', 'own')
        .order('date_added', { ascending: true })

      // Wear logs
      const { data: wears } = await supabase
        .from('wear_logs')
        .select('wear_date, fragrance_id, fragrance:fragrances(id, name, brand, image_url)')
        .eq('user_id', user!.id)
        .order('wear_date', { ascending: false })

      type CollRow = { date_added: string; personal_rating: number | null; fragrance: Fragrance | null }
      type WearRow = { wear_date: string; fragrance_id: string; fragrance: { id: string; name: string; brand: string; image_url: string | null } | null }

      const collRows = (collections ?? []) as CollRow[]
      const wearRows = (wears ?? []) as WearRow[]

      // Monthly growth (last 6 months)
      const monthCounts = new Map<string, number>()
      const now = new Date()
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        monthCounts.set(d.toISOString().slice(0, 7), 0)
      }
      collRows.forEach((c) => {
        const m = c.date_added.slice(0, 7)
        if (monthCounts.has(m)) monthCounts.set(m, (monthCounts.get(m) ?? 0) + 1)
      })
      const monthlyGrowth = [...monthCounts.entries()].map(([month, count]) => ({
        month: new Date(month + '-01').toLocaleDateString('en-GB', { month: 'short' }),
        count,
      }))

      // Weekday wearing patterns
      const weekdayCounts = new Array(7).fill(0)
      wearRows.forEach((w) => {
        const d = new Date(w.wear_date)
        const day = (d.getDay() + 6) % 7 // Mon=0
        weekdayCounts[day]++
      })
      const weekdayWears = WEEKDAYS.map((day, i) => ({ day, count: weekdayCounts[i] }))

      // Top worn fragrances
      const wearCounts = new Map<string, { fragrance: Fragrance; count: number }>()
      wearRows.forEach((w) => {
        if (!w.fragrance) return
        const key = w.fragrance.id
        if (!wearCounts.has(key)) wearCounts.set(key, { fragrance: w.fragrance as unknown as Fragrance, count: 0 })
        wearCounts.get(key)!.count++
      })
      const topWorn = [...wearCounts.values()].sort((a, b) => b.count - a.count).slice(0, 5)

      // Taste profile
      const familyCounts = new Map<string, number>()
      const brandCounts = new Map<string, number>()
      const concCounts = new Map<string, number>()
      let ratingSum = 0, ratingCount = 0

      collRows.forEach((c) => {
        if (c.fragrance?.note_family) {
          familyCounts.set(c.fragrance.note_family, (familyCounts.get(c.fragrance.note_family) ?? 0) + 1)
        }
        if (c.fragrance?.brand) {
          brandCounts.set(c.fragrance.brand, (brandCounts.get(c.fragrance.brand) ?? 0) + 1)
        }
        if (c.fragrance?.concentration) {
          concCounts.set(c.fragrance.concentration, (concCounts.get(c.fragrance.concentration) ?? 0) + 1)
        }
        if (c.personal_rating) { ratingSum += c.personal_rating; ratingCount++ }
      })

      const topFamilies = [...familyCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([family, count]) => ({ family, count }))

      const topBrands = [...brandCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([brand, count]) => ({ brand, count }))

      const concentrationBreakdown = [...concCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([type, count]) => ({ type, count }))

      // Diversity score (0-100): based on unique families / total, unique brands / total
      const total = collRows.length || 1
      const familyDiversity = Math.min(familyCounts.size / 10, 1) * 50
      const brandDiversity = Math.min(brandCounts.size / total, 1) * 50
      const diversityScore = Math.round(familyDiversity + brandDiversity)

      setData({
        monthlyGrowth,
        totalOwned: collRows.length,
        weekdayWears,
        topWorn,
        totalWears: wearRows.length,
        topFamilies,
        topBrands,
        concentrationBreakdown,
        avgRating: ratingCount > 0 ? ratingSum / ratingCount : 0,
        diversityScore,
      })
      setLoading(false)
    }

    fetchStats()
  }, [user])

  if (!user) {
    return (
      <main className="pt-24 pb-32 px-6 flex flex-col items-center justify-center min-h-screen gap-4">
        <Icon name="analytics" className="text-5xl text-primary/30" />
        <p className="text-secondary/60 text-sm">Sign in to see your stats</p>
        <button onClick={() => navigate('/profile')} className="gold-gradient text-on-primary-container px-6 py-3 rounded-xl font-label text-[10px] font-bold uppercase tracking-widest">
          Sign In
        </button>
      </main>
    )
  }

  if (loading || !data) {
    return (
      <main className="pt-24 pb-32 px-6 flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </main>
    )
  }

  const maxGrowth = Math.max(...data.monthlyGrowth.map((m) => m.count), 1)
  const maxWeekday = Math.max(...data.weekdayWears.map((d) => d.count), 1)
  const maxFamily = Math.max(...data.topFamilies.map((f) => f.count), 1)

  return (
    <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen space-y-8">
      {/* KPI Cards */}
      <section className="grid grid-cols-3 gap-3">
        <div className="bg-surface-container rounded-xl p-4 text-center">
          <Icon name="water_drop" className="text-primary/60 text-xl mb-1" />
          <p className="font-headline text-2xl">{data.totalOwned}</p>
          <p className="text-[9px] text-secondary/50 uppercase tracking-wider">Owned</p>
        </div>
        <div className="bg-surface-container rounded-xl p-4 text-center">
          <Icon name="checkroom" className="text-tertiary/60 text-xl mb-1" />
          <p className="font-headline text-2xl">{data.totalWears}</p>
          <p className="text-[9px] text-secondary/50 uppercase tracking-wider">Total Wears</p>
        </div>
        <div className="bg-surface-container rounded-xl p-4 text-center">
          <Icon name="star" filled className="text-primary/60 text-xl mb-1" />
          <p className="font-headline text-2xl">{data.avgRating > 0 ? data.avgRating.toFixed(1) : '—'}</p>
          <p className="text-[9px] text-secondary/50 uppercase tracking-wider">Avg Rating</p>
        </div>
      </section>

      {/* Diversity Score */}
      <section className="bg-surface-container rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Icon name="diversity_3" className="text-primary" />
            <h3 className="text-[10px] uppercase tracking-[0.15em] text-primary font-bold">NOSE DIVERSITY</h3>
          </div>
          <span className="font-headline text-xl text-primary">{data.diversityScore}/100</span>
        </div>
        <div className="h-2 w-full bg-surface-container-highest rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${data.diversityScore}%`,
              background: data.diversityScore >= 70 ? '#aad0ae' : data.diversityScore >= 40 ? '#e5c276' : '#ffb4ab',
            }}
          />
        </div>
        <p className="text-[10px] text-secondary/50 mt-2">
          {data.diversityScore >= 70 ? 'Adventurous nose — you explore widely!' : data.diversityScore >= 40 ? 'Good variety — room to explore more families' : 'Try branching out into new note families'}
        </p>
      </section>

      {/* Collection Growth Chart */}
      <section className="bg-surface-container rounded-xl p-5">
        <h3 className="text-[10px] uppercase tracking-[0.15em] text-primary font-bold mb-4">COLLECTION GROWTH</h3>
        <div className="flex items-end gap-2 h-28">
          {data.monthlyGrowth.map((m) => (
            <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[9px] text-secondary/40">{m.count || ''}</span>
              <div
                className="w-full bg-primary/20 rounded-t-md transition-all duration-500"
                style={{ height: `${(m.count / maxGrowth) * 80}px`, minHeight: m.count > 0 ? '4px' : '1px' }}
              >
                <div
                  className="w-full h-full bg-primary/60 rounded-t-md"
                  style={{ opacity: m.count > 0 ? 1 : 0.2 }}
                />
              </div>
              <span className="text-[9px] text-secondary/50">{m.month}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Weekday Wearing Patterns */}
      <section className="bg-surface-container rounded-xl p-5">
        <h3 className="text-[10px] uppercase tracking-[0.15em] text-primary font-bold mb-4">WHEN YOU WEAR</h3>
        <div className="flex items-end gap-2 h-24">
          {data.weekdayWears.map((d) => (
            <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[9px] text-secondary/40">{d.count || ''}</span>
              <div
                className="w-full rounded-t-md transition-all duration-500"
                style={{
                  height: `${(d.count / maxWeekday) * 64}px`,
                  minHeight: d.count > 0 ? '4px' : '1px',
                  backgroundColor: d.count === maxWeekday ? 'var(--color-primary)' : 'rgba(229, 194, 118, 0.3)',
                }}
              />
              <span className="text-[9px] text-secondary/50">{d.day}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Most Worn */}
      {data.topWorn.length > 0 && (
        <section className="bg-surface-container rounded-xl p-5">
          <h3 className="text-[10px] uppercase tracking-[0.15em] text-primary font-bold mb-4">MOST WORN</h3>
          <div className="space-y-3">
            {data.topWorn.map((item, i) => (
              <button
                key={item.fragrance.id}
                onClick={() => navigate(`/fragrance/${item.fragrance.id}`)}
                className="w-full flex items-center gap-3 text-left active:scale-[0.98] transition-transform"
              >
                <span className="text-[10px] text-primary font-bold w-5">{i + 1}</span>
                <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-surface-container-highest">
                  {item.fragrance.image_url ? (
                    <img src={item.fragrance.image_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Icon name="water_drop" className="text-secondary/30" size={16} />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] uppercase tracking-wider text-primary/70 font-bold">{item.fragrance.brand}</p>
                  <p className="text-sm text-on-surface truncate">{item.fragrance.name}</p>
                </div>
                <span className="text-[10px] text-secondary/60">{item.count} wears</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Note Families */}
      {data.topFamilies.length > 0 && (
        <section className="bg-surface-container rounded-xl p-5">
          <h3 className="text-[10px] uppercase tracking-[0.15em] text-primary font-bold mb-4">TOP NOTE FAMILIES</h3>
          <div className="space-y-3">
            {data.topFamilies.map((f) => (
              <div key={f.family} className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-xs text-on-surface">{f.family}</span>
                  <span className="text-[10px] text-secondary/50">{f.count}</span>
                </div>
                <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${(f.count / maxFamily) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Concentration Breakdown */}
      {data.concentrationBreakdown.length > 0 && (
        <section className="bg-surface-container rounded-xl p-5">
          <h3 className="text-[10px] uppercase tracking-[0.15em] text-primary font-bold mb-4">CONCENTRATIONS</h3>
          <div className="flex flex-wrap gap-2">
            {data.concentrationBreakdown.map((c) => (
              <div key={c.type} className="bg-surface-container-highest px-3 py-2 rounded-full">
                <span className="text-xs text-on-surface font-medium">{c.type}</span>
                <span className="text-[10px] text-primary ml-2 font-bold">{c.count}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Top Brands */}
      {data.topBrands.length > 0 && (
        <section className="bg-surface-container rounded-xl p-5">
          <h3 className="text-[10px] uppercase tracking-[0.15em] text-primary font-bold mb-4">TOP BRANDS</h3>
          <div className="grid grid-cols-2 gap-2">
            {data.topBrands.map((b, i) => (
              <div key={b.brand} className="flex items-center gap-2 bg-surface-container-highest px-3 py-2.5 rounded-xl">
                <span className="text-[10px] text-primary font-bold">{i + 1}</span>
                <span className="text-xs text-on-surface truncate flex-1">{b.brand}</span>
                <span className="text-[10px] text-secondary/50">{b.count}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  )
}
