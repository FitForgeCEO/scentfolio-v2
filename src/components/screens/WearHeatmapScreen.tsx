import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../ui/Icon'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

interface WearDay {
  date: string     // YYYY-MM-DD
  count: number
  fragrances: string[]
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function getIntensity(count: number, max: number): string {
  if (count === 0) return 'bg-surface-container'
  const ratio = count / Math.max(max, 1)
  if (ratio <= 0.25) return 'bg-primary/20'
  if (ratio <= 0.5) return 'bg-primary/40'
  if (ratio <= 0.75) return 'bg-primary/65'
  return 'bg-primary'
}

type TimeRange = '3m' | '6m' | '1y'

export function WearHeatmapScreen() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [wearDays, setWearDays] = useState<WearDay[]>([])
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState<TimeRange>('6m')
  const [hoveredDay, setHoveredDay] = useState<WearDay | null>(null)

  // Fetch wear logs
  useEffect(() => {
    if (!user) { setLoading(false); return }

    const months = timeRange === '3m' ? 3 : timeRange === '6m' ? 6 : 12
    const startDate = new Date()
    startDate.setMonth(startDate.getMonth() - months)
    const startStr = startDate.toISOString().slice(0, 10)

    supabase
      .from('wear_logs')
      .select('wear_date, fragrance:fragrances(name)')
      .eq('user_id', user.id)
      .gte('wear_date', startStr)
      .order('wear_date', { ascending: true })
      .then(({ data }) => {
        if (!data) { setLoading(false); return }
        type Row = { wear_date: string; fragrance: { name: string } | null }
        const rows = data as unknown as Row[]

        const dayMap: Record<string, WearDay> = {}
        for (const row of rows) {
          const d = row.wear_date
          if (!dayMap[d]) dayMap[d] = { date: d, count: 0, fragrances: [] }
          dayMap[d].count++
          if (row.fragrance) dayMap[d].fragrances.push(row.fragrance.name)
        }
        setWearDays(Object.values(dayMap))
        setLoading(false)
      })
  }, [user, timeRange])

  // Build calendar grid
  const { grid, monthLabels, maxCount, stats } = useMemo(() => {
    const months = timeRange === '3m' ? 3 : timeRange === '6m' ? 6 : 12
    const end = new Date()
    const start = new Date()
    start.setMonth(start.getMonth() - months)
    // Align start to Monday
    const dayOfWeek = start.getDay()
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    start.setDate(start.getDate() + mondayOffset)

    const dayMap: Record<string, WearDay> = {}
    for (const wd of wearDays) dayMap[wd.date] = wd

    const weeks: Array<Array<WearDay | null>> = []
    let currentWeek: Array<WearDay | null> = []
    const labels: Array<{ week: number; label: string }> = []
    let lastMonth = -1
    let maxC = 0

    const cursor = new Date(start)
    let weekIdx = 0

    while (cursor <= end) {
      const iso = cursor.toISOString().slice(0, 10)
      const dow = cursor.getDay()
      const mondayIdx = dow === 0 ? 6 : dow - 1 // Mon=0, Sun=6

      if (mondayIdx === 0 && currentWeek.length > 0) {
        weeks.push(currentWeek)
        currentWeek = []
        weekIdx++
      }

      // Month labels
      const m = cursor.getMonth()
      if (m !== lastMonth) {
        labels.push({ week: weekIdx, label: MONTHS_SHORT[m] })
        lastMonth = m
      }

      const entry = dayMap[iso] || { date: iso, count: 0, fragrances: [] }
      if (entry.count > maxC) maxC = entry.count
      currentWeek.push(entry)
      cursor.setDate(cursor.getDate() + 1)
    }
    if (currentWeek.length > 0) weeks.push(currentWeek)

    // Stats
    const totalWears = wearDays.reduce((s, d) => s + d.count, 0)
    const activeDays = wearDays.filter((d) => d.count > 0).length
    const totalDays = Math.round((end.getTime() - start.getTime()) / 86400000)
    const consistency = totalDays > 0 ? Math.round((activeDays / totalDays) * 100) : 0

    // Day-of-week distribution
    const dowCounts = [0, 0, 0, 0, 0, 0, 0]
    for (const wd of wearDays) {
      const d = new Date(wd.date)
      const idx = d.getDay() === 0 ? 6 : d.getDay() - 1
      dowCounts[idx] += wd.count
    }
    const maxDow = Math.max(...dowCounts, 1)

    return {
      grid: weeks,
      monthLabels: labels,
      maxCount: maxC,
      stats: { totalWears, activeDays, consistency, dowCounts, maxDow },
    }
  }, [wearDays, timeRange])

  if (!user) {
    return (
      <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen flex flex-col items-center justify-center">
        <Icon name="calendar_month" className="text-4xl text-primary/20 mb-4" />
        <h3 className="font-headline text-xl text-on-surface mb-2">Sign in to view your heatmap</h3>
        <button onClick={() => navigate('/profile')} className="gold-gradient text-on-primary-container px-8 py-3 rounded-xl font-label text-[10px] font-bold uppercase tracking-widest active:scale-95 transition-all shadow-lg mt-4">SIGN IN</button>
      </main>
    )
  }

  return (
    <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen space-y-6">
      {/* Time range tabs */}
      <div className="flex gap-2 bg-surface-container rounded-xl p-1">
        {(['3m', '6m', '1y'] as TimeRange[]).map((r) => (
          <button
            key={r}
            onClick={() => setTimeRange(r)}
            className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
              timeRange === r ? 'bg-primary/15 text-primary' : 'text-secondary/50'
            }`}
          >
            {r === '3m' ? '3 Months' : r === '6m' ? '6 Months' : '1 Year'}
          </button>
        ))}
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-surface-container rounded-xl p-3 text-center">
          <p className="text-xl font-headline text-primary font-bold">{stats.totalWears}</p>
          <p className="text-[9px] text-secondary/50 uppercase tracking-widest">Wears</p>
        </div>
        <div className="bg-surface-container rounded-xl p-3 text-center">
          <p className="text-xl font-headline text-on-surface font-bold">{stats.activeDays}</p>
          <p className="text-[9px] text-secondary/50 uppercase tracking-widest">Active days</p>
        </div>
        <div className="bg-surface-container rounded-xl p-3 text-center">
          <p className="text-xl font-headline text-primary font-bold">{stats.consistency}%</p>
          <p className="text-[9px] text-secondary/50 uppercase tracking-widest">Consistency</p>
        </div>
      </div>

      {/* Heatmap */}
      {loading ? (
        <div className="bg-surface-container rounded-xl p-6 animate-pulse h-[180px]" />
      ) : (
        <section className="bg-surface-container rounded-2xl p-4 overflow-x-auto scrollbar-hide">
          <h3 className="text-[10px] uppercase tracking-[0.15em] font-label text-secondary/60 mb-3">WEAR ACTIVITY</h3>

          {/* Month labels */}
          <div className="flex gap-0 ml-8 mb-1" style={{ minWidth: grid.length * 14 }}>
            {monthLabels.map((m, i) => (
              <span
                key={i}
                className="text-[9px] text-secondary/40 absolute"
                style={{ left: m.week * 14 + 32 }}
              >
                {m.label}
              </span>
            ))}
          </div>

          <div className="flex gap-0 mt-4 relative">
            {/* Day labels */}
            <div className="flex flex-col gap-[2px] mr-1 flex-shrink-0">
              {DAYS.map((d, i) => (
                <span key={d} className={`text-[8px] text-secondary/30 h-[12px] flex items-center ${i % 2 === 1 ? 'invisible' : ''}`}>
                  {d}
                </span>
              ))}
            </div>

            {/* Weeks */}
            <div className="flex gap-[2px]">
              {grid.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-[2px]">
                  {Array.from({ length: 7 }).map((_, di) => {
                    const day = week[di]
                    if (!day) return <div key={di} className="w-[12px] h-[12px]" />
                    return (
                      <div
                        key={di}
                        className={`w-[12px] h-[12px] rounded-[2px] transition-all cursor-pointer hover:ring-1 hover:ring-primary/50 ${getIntensity(day.count, maxCount)}`}
                        onMouseEnter={() => setHoveredDay(day)}
                        onMouseLeave={() => setHoveredDay(null)}
                        onClick={() => day.count > 0 && navigate('/calendar')}
                        title={`${day.date}: ${day.count} wear${day.count !== 1 ? 's' : ''}`}
                      />
                    )
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-2 mt-4 justify-end">
            <span className="text-[9px] text-secondary/30">Less</span>
            <div className="w-[12px] h-[12px] rounded-[2px] bg-surface-container-highest" />
            <div className="w-[12px] h-[12px] rounded-[2px] bg-primary/20" />
            <div className="w-[12px] h-[12px] rounded-[2px] bg-primary/40" />
            <div className="w-[12px] h-[12px] rounded-[2px] bg-primary/65" />
            <div className="w-[12px] h-[12px] rounded-[2px] bg-primary" />
            <span className="text-[9px] text-secondary/30">More</span>
          </div>

          {/* Tooltip */}
          {hoveredDay && hoveredDay.count > 0 && (
            <div className="mt-3 bg-surface-container-highest rounded-xl px-3 py-2">
              <p className="text-xs text-on-surface font-medium">
                {new Date(hoveredDay.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                {' — '}{hoveredDay.count} wear{hoveredDay.count !== 1 ? 's' : ''}
              </p>
              <p className="text-[10px] text-secondary/50 mt-0.5 line-clamp-1">
                {hoveredDay.fragrances.join(', ')}
              </p>
            </div>
          )}
        </section>
      )}

      {/* Day of Week Distribution */}
      <section className="bg-surface-container rounded-2xl p-4">
        <h3 className="text-[10px] uppercase tracking-[0.15em] font-label text-secondary/60 mb-4">BUSIEST DAYS</h3>
        <div className="space-y-2">
          {DAYS.map((day, i) => (
            <div key={day} className="flex items-center gap-3">
              <span className="text-[10px] text-secondary/50 w-8 text-right">{day}</span>
              <div className="flex-1 h-5 bg-surface-container-highest rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary/60 rounded-full transition-all duration-500"
                  style={{ width: `${(stats.dowCounts[i] / stats.maxDow) * 100}%` }}
                />
              </div>
              <span className="text-[10px] text-on-surface font-bold w-6 text-right">{stats.dowCounts[i]}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Cost Per Wear */}
      <CostPerWearSection userId={user.id} />

      {/* Quick Links */}
      <div className="flex gap-3">
        <button
          onClick={() => navigate('/calendar')}
          className="flex-1 bg-surface-container rounded-xl px-4 py-3 flex items-center gap-2 active:scale-[0.98] transition-transform"
        >
          <Icon name="calendar_month" className="text-primary" size={18} />
          <span className="text-xs text-on-surface font-medium">Calendar</span>
        </button>
        <button
          onClick={() => navigate('/stats')}
          className="flex-1 bg-surface-container rounded-xl px-4 py-3 flex items-center gap-2 active:scale-[0.98] transition-transform"
        >
          <Icon name="analytics" className="text-primary" size={18} />
          <span className="text-xs text-on-surface font-medium">Full Stats</span>
        </button>
      </div>
    </main>
  )
}

// ── Cost Per Wear Section ─────────────────────────────────────────

function CostPerWearSection({ userId }: { userId: string }) {
  const [items, setItems] = useState<Array<{
    name: string; brand: string; image_url: string | null
    price: number; wearCount: number; costPerWear: number; fragranceId: string
  }>>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const fetch = async () => {
      // Get owned fragrances with prices
      const { data: collection } = await supabase
        .from('user_collections')
        .select('fragrance_id, fragrance:fragrances(id, name, brand, image_url, price_value)')
        .eq('user_id', userId)
        .eq('status', 'own')

      if (!collection) { setLoading(false); return }

      type CollRow = { fragrance_id: string; fragrance: { id: string; name: string; brand: string; image_url: string | null; price_value: string | null } | null }
      const rows = collection as unknown as CollRow[]

      // Get wear counts
      const { data: wears } = await supabase
        .from('wear_logs')
        .select('fragrance_id')
        .eq('user_id', userId)

      const wearCounts: Record<string, number> = {}
      if (wears) {
        for (const w of wears) {
          wearCounts[w.fragrance_id] = (wearCounts[w.fragrance_id] || 0) + 1
        }
      }

      const results = rows
        .filter((r) => r.fragrance && Number(r.fragrance.price_value) > 0)
        .map((r) => {
          const f = r.fragrance!
          const price = Number(f.price_value) || 0
          const wearCount = wearCounts[f.id] || 0
          const costPerWear = wearCount > 0 ? price / wearCount : price
          return { name: f.name, brand: f.brand, image_url: f.image_url, price, wearCount, costPerWear, fragranceId: f.id }
        })
        .sort((a, b) => a.costPerWear - b.costPerWear)
        .slice(0, 8)

      setItems(results)
      setLoading(false)
    }

    fetch()
  }, [userId])

  if (loading || items.length === 0) return null

  return (
    <section className="bg-surface-container rounded-2xl p-4">
      <h3 className="text-[10px] uppercase tracking-[0.15em] font-label text-secondary/60 mb-4">COST PER WEAR</h3>
      <div className="space-y-2">
        {items.map((item, i) => (
          <button
            key={item.fragranceId}
            onClick={() => navigate(`/fragrance/${item.fragranceId}`)}
            className="w-full flex items-center gap-3 active:bg-surface-container-highest/30 transition-colors rounded-lg px-1 py-1.5 text-left"
          >
            <span className="text-[10px] text-secondary/30 font-bold w-5 text-center">{i + 1}</span>
            <div className="w-8 h-8 rounded-md overflow-hidden bg-surface-container-highest flex-shrink-0">
              {item.image_url ? (
                <img src={item.image_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center"><Icon name="water_drop" className="text-secondary/20" size={14} /></div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-on-surface font-medium truncate">{item.name}</p>
              <p className="text-[10px] text-secondary/40">{item.brand}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className={`text-xs font-bold ${item.wearCount > 0 ? 'text-emerald-400' : 'text-secondary/40'}`}>
                £{item.costPerWear.toFixed(0)}/wear
              </p>
              <p className="text-[9px] text-secondary/30">{item.wearCount} wear{item.wearCount !== 1 ? 's' : ''}</p>
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}
