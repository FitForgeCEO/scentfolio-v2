import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

interface WearEntry {
  wear_date: string
  fragrance_id: string
  fragrance_name: string
  fragrance_brand: string
  image_url: string | null
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfWeek(year: number, month: number): number {
  const d = new Date(year, month, 1).getDay()
  return d === 0 ? 6 : d - 1 // Monday = 0
}

export function WearCalendarScreen() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [wears, setWears] = useState<Map<string, WearEntry[]>>(new Map())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { setLoading(false); return }

    const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${getDaysInMonth(year, month)}`

    supabase
      .from('wear_logs')
      .select('wear_date, fragrance_id, fragrance:fragrances(name, brand, image_url)')
      .eq('user_id', user.id)
      .gte('wear_date', startDate)
      .lte('wear_date', endDate)
      .order('wear_date', { ascending: true })
      .then(({ data }) => {
        type Row = { wear_date: string; fragrance_id: string; fragrance: { name: string; brand: string; image_url: string | null } | null }
        const byDate = new Map<string, WearEntry[]>()
        for (const row of (data ?? []) as unknown as Row[]) {
          const entry: WearEntry = {
            wear_date: row.wear_date,
            fragrance_id: row.fragrance_id,
            fragrance_name: row.fragrance?.name ?? 'Unknown',
            fragrance_brand: row.fragrance?.brand ?? '',
            image_url: row.fragrance?.image_url ?? null,
          }
          const existing = byDate.get(row.wear_date) ?? []
          existing.push(entry)
          byDate.set(row.wear_date, existing)
        }
        setWears(byDate)
        setLoading(false)
      })
  }, [user, year, month])

  const goToPrevMonth = () => {
    if (month === 0) { setMonth(11); setYear(year - 1) }
    else setMonth(month - 1)
    setSelectedDate(null)
  }

  const goToNextMonth = () => {
    if (month === 11) { setMonth(0); setYear(year + 1) }
    else setMonth(month + 1)
    setSelectedDate(null)
  }

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfWeek(year, month)
  const todayStr = now.toISOString().slice(0, 10)
  const totalWears = Array.from(wears.values()).reduce((s, entries) => s + entries.length, 0)
  const daysWorn = wears.size
  const selectedWears = selectedDate ? wears.get(selectedDate) ?? [] : []

  if (!user) {
    return (
      <main className="pt-24 pb-32 px-6 flex flex-col items-center justify-center min-h-screen gap-4">
        <span className="text-5xl text-primary/30">?</span>
        <p className="text-secondary/60 text-sm">Sign in to see your wear calendar</p>
      </main>
    )
  }

  return (
    <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen">
      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={goToPrevMonth} className="p-2 rounded-full hover:opacity-80 transition-transform">
          <span className="text-on-surface">?</span>
        </button>
        <div className="text-center">
          <h2 className="font-headline text-xl">{MONTHS[month]}</h2>
          <p className="text-[10px] text-secondary/50">{year}</p>
        </div>
        <button onClick={goToNextMonth} className="p-2 rounded-full hover:opacity-80 transition-transform">
          <span className="text-on-surface">?</span>
        </button>
      </div>

      {/* Stats Row */}
      <div className="flex gap-3 mb-6">
        <div className="flex-1 bg-surface-container rounded-sm p-3 text-center">
          <p className="font-headline text-lg text-primary">{totalWears}</p>
          <p className="text-[9px] text-secondary/50 uppercase tracking-wider">Total Wears</p>
        </div>
        <div className="flex-1 bg-surface-container rounded-sm p-3 text-center">
          <p className="font-headline text-lg text-primary">{daysWorn}</p>
          <p className="text-[9px] text-secondary/50 uppercase tracking-wider">Days Worn</p>
        </div>
        <div className="flex-1 bg-surface-container rounded-sm p-3 text-center">
          <p className="font-headline text-lg text-primary">
            {daysInMonth > 0 ? Math.round((daysWorn / daysInMonth) * 100) : 0}%
          </p>
          <p className="text-[9px] text-secondary/50 uppercase tracking-wider">Coverage</p>
        </div>
      </div>

      {/* Calendar Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-1.5">{[1,2,3].map(i => <div key={i} className="h-1 rounded-sm bg-primary/20 animate-pulse" style={{ width: `${60 - i * 14}px` }} />)}</div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-7 gap-1 mb-1">
            {DAYS.map((d) => (
              <div key={d} className="text-center text-[9px] text-secondary/40 uppercase tracking-wider py-1">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 mb-6">
            {/* Empty cells for offset */}
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square" />
            ))}

            {/* Day cells */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const dayWears = wears.get(dateStr)
              const isToday = dateStr === todayStr
              const isSelected = dateStr === selectedDate
              const wearCount = dayWears?.length ?? 0

              return (
                <button
                  key={day}
                  onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                  className={`aspect-square rounded-sm flex flex-col items-center justify-center relative transition-all hover:opacity-80 ${
                    isSelected ? 'bg-primary/20 ring-2 ring-primary' :
                    isToday ? 'bg-surface-container ring-1 ring-primary/40' :
                    'bg-surface-container/50'
                  }`}
                >
                  <span className={`text-xs font-medium ${
                    isSelected ? 'text-primary' :
                    isToday ? 'text-primary' :
                    'text-on-surface/70'
                  }`}>
                    {day}
                  </span>
                  {wearCount > 0 && (
                    <div className="flex gap-0.5 mt-0.5">
                      {Array.from({ length: Math.min(wearCount, 3) }).map((_, di) => (
                        <div key={di} className="w-1 h-1 rounded-full bg-primary" />
                      ))}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </>
      )}

      {/* Selected Day Detail */}
      {selectedDate && (
        <section className="space-y-3 animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="text-primary">?</span>
            <h3 className="text-sm font-medium text-on-surface">
              {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
            </h3>
          </div>
          {selectedWears.length === 0 ? (
            <div className="bg-surface-container rounded-sm p-6 text-center">
              <p className="text-sm text-secondary/50">No wears logged</p>
            </div>
          ) : (
            selectedWears.map((w, i) => (
              <button
                key={i}
                onClick={() => navigate(`/fragrance/${w.fragrance_id}`)}
                className="w-full bg-surface-container rounded-sm p-4 flex items-center gap-4 hover:opacity-80 transition-transform text-left"
              >
                <div className="w-12 h-12 rounded-sm overflow-hidden bg-surface-container-low flex-shrink-0">
                  {w.image_url ? (
                    <img src={w.image_url} alt={w.fragrance_name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-secondary/20">?</span>
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] uppercase tracking-[0.1em] text-secondary/50">{w.fragrance_brand}</p>
                  <p className="text-sm text-on-surface font-medium truncate">{w.fragrance_name}</p>
                </div>
                <span className="text-secondary/30">?</span>
              </button>
            ))
          )}
        </section>
      )}

      {/* Legend */}
      <div className="mt-8 flex items-center justify-center gap-4 text-[9px] text-secondary/40">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
          <span>Fragrance worn</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded ring-1 ring-primary/40" />
          <span>Today</span>
        </div>
      </div>
    </main>
  )
}
