import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import type { Fragrance } from '@/types/database'
import { getIconChar } from '@/lib/iconUtils'

interface TimelineEvent {
  id: string
  type: 'added' | 'first_wear' | 'review' | 'milestone'
  date: string
  fragrance?: Fragrance
  title: string
  subtitle: string
  icon: string
  iconColor: string
}

const MILESTONES: Record<number, { title: string; icon: string }> = {
  1: { title: 'First fragrance added!', icon: 'celebration' },
  5: { title: 'Shelf is filling up — 5 bottles', icon: 'shelves' },
  10: { title: 'Double digits — 10 fragrances', icon: 'inventory_2' },
  25: { title: 'Serious collector — 25 fragrances', icon: 'workspace_premium' },
  50: { title: 'Perfume palace — 50 fragrances', icon: 'castle' },
}

export function TimelineScreen() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'added' | 'first_wear' | 'review'>('all')

  useEffect(() => {
    if (!user) { setLoading(false); return }

    async function fetchTimeline() {
      const allEvents: TimelineEvent[] = []

      // 1. Collection additions
      const { data: collections } = await supabase
        .from('user_collections')
        .select('id, date_added, status, fragrance:fragrances(*)')
        .eq('user_id', user!.id)
        .eq('status', 'own')
        .order('date_added', { ascending: true })

      type CollRow = { id: string; date_added: string; status: string; fragrance: Fragrance | null }
      let addedCount = 0
      ;((collections ?? []) as unknown as CollRow[]).forEach((c) => {
        addedCount++
        allEvents.push({
          id: `added-${c.id}`,
          type: 'added',
          date: c.date_added,
          fragrance: c.fragrance ?? undefined,
          title: c.fragrance ? `${c.fragrance.brand} — ${c.fragrance.name}` : 'Unknown fragrance',
          subtitle: 'Added to collection',
          icon: 'add_circle',
          iconColor: 'text-primary',
        })

        // Check for milestones
        if (MILESTONES[addedCount]) {
          allEvents.push({
            id: `milestone-${addedCount}`,
            type: 'milestone',
            date: c.date_added,
            title: MILESTONES[addedCount].title,
            subtitle: `Collection milestone`,
            icon: MILESTONES[addedCount].icon,
            iconColor: 'text-primary',
          })
        }
      })

      // 2. First wears (earliest wear_date per fragrance)
      const { data: wears } = await supabase
        .from('wear_logs')
        .select('id, wear_date, fragrance:fragrances(*)')
        .eq('user_id', user!.id)
        .order('wear_date', { ascending: true })

      type WearRow = { id: string; wear_date: string; fragrance: Fragrance | null }
      const seenFragrances = new Set<string>()
      ;((wears ?? []) as unknown as WearRow[]).forEach((w) => {
        const fId = (w.fragrance as Fragrance | null)?.id
        if (fId && !seenFragrances.has(fId)) {
          seenFragrances.add(fId)
          allEvents.push({
            id: `firstwear-${w.id}`,
            type: 'first_wear',
            date: w.wear_date,
            fragrance: w.fragrance ?? undefined,
            title: w.fragrance ? `${w.fragrance.brand} — ${w.fragrance.name}` : 'Unknown',
            subtitle: 'First time wearing',
            icon: 'checkroom',
            iconColor: 'text-tertiary',
          })
        }
      })

      // 3. Reviews
      const { data: reviews } = await supabase
        .from('reviews')
        .select('id, created_at, overall_rating, fragrance:fragrances(*)')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: true })

      type ReviewRow = { id: string; created_at: string; overall_rating: number; fragrance: Fragrance | null }
      ;((reviews ?? []) as unknown as ReviewRow[]).forEach((r) => {
        allEvents.push({
          id: `review-${r.id}`,
          type: 'review',
          date: r.created_at.slice(0, 10),
          fragrance: r.fragrance ?? undefined,
          title: r.fragrance ? `${r.fragrance.brand} — ${r.fragrance.name}` : 'Unknown',
          subtitle: `Rated ${r.overall_rating}/5`,
          icon: 'rate_review',
          iconColor: 'text-secondary',
        })
      })

      // Sort by date descending (newest first)
      allEvents.sort((a, b) => b.date.localeCompare(a.date))
      setEvents(allEvents)
      setLoading(false)
    }

    fetchTimeline()
  }, [user])

  if (!user) {
    return (
      <main className="pt-24 pb-32 px-6 flex flex-col items-center justify-center min-h-screen gap-4">
        <span className="text-5xl text-primary/30">?</span>
        <p className="text-secondary/60 text-sm">Sign in to see your journey</p>
        <button onClick={() => navigate('/profile')} className="gold-gradient text-on-primary-container px-6 py-3 rounded-sm font-label text-[10px] font-bold uppercase tracking-widest">
          Sign In
        </button>
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

  const filtered = filter === 'all' ? events : events.filter((e) => e.type === filter)

  // Group by month
  const grouped = new Map<string, TimelineEvent[]>()
  filtered.forEach((e) => {
    const key = e.date.slice(0, 7) // YYYY-MM
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(e)
  })

  const filters: { key: typeof filter; label: string; icon: string }[] = [
    { key: 'all', label: 'All', icon: 'timeline' },
    { key: 'added', label: 'Added', icon: 'add_circle' },
    { key: 'first_wear', label: 'First Wears', icon: 'checkroom' },
    { key: 'review', label: 'Reviews', icon: 'rate_review' },
  ]

  return (
    <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen">
      {/* Header stats */}
      <section className="text-center mb-6">
        <h2 className="font-headline text-2xl mb-1">Your Journey</h2>
        <p className="text-[10px] uppercase tracking-[0.15em] text-secondary/60">{events.length} moments captured</p>
      </section>

      {/* Filters */}
      <div className="flex gap-2 mb-6 overflow-x-auto no-scrollbar -mx-6 px-6">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-[11px] font-medium whitespace-nowrap transition-all ${
              filter === f.key ? 'bg-primary text-on-primary' : 'bg-surface-container text-secondary/70'
            }`}
          >
            <span>{getIconChar(f.icon)}</span>
            <span>{f.label}</span>
          </button>
        ))}
      </div>

      {/* Timeline */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <span className="text-4xl text-secondary/20 mb-3">?</span>
          <p className="text-secondary/40 text-sm">No events yet — start building your story</p>
        </div>
      ) : (
        <div className="space-y-8">
          {[...grouped.entries()].map(([monthKey, monthEvents]) => {
            const d = new Date(monthKey + '-01')
            const monthLabel = d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
            return (
              <section key={monthKey}>
                <h3 className="text-[10px] uppercase tracking-[0.15em] text-primary font-bold mb-3 sticky top-20 bg-background py-1 z-10">
                  {monthLabel}
                </h3>
                <div className="relative">
                  {/* Vertical line */}
                  <div className="absolute left-[23px] top-2 bottom-2 w-px bg-outline-variant/30" />

                  <div className="space-y-1">
                    {monthEvents.map((event) => (
                      <button
                        key={event.id}
                        onClick={() => event.fragrance && navigate(`/fragrance/${event.fragrance.id}`)}
                        disabled={!event.fragrance}
                        className="w-full flex items-start gap-4 p-3 rounded-sm text-left active:bg-surface-container transition-colors relative"
                      >
                        {/* Timeline dot */}
                        <div className={`w-[14px] h-[14px] rounded-full flex-shrink-0 mt-1 flex items-center justify-center z-[1] ${
                          event.type === 'milestone' ? 'bg-primary' : 'bg-surface-container-highest ring-2 ring-outline-variant/30'
                        }`}>
                          {event.type === 'milestone' && (
                            <span className="text-on-primary">{getIconChar(event.icon)}</span>
                          )}
                        </div>

                        {/* Image or icon */}
                        {event.fragrance?.image_url ? (
                          <div className="w-10 h-10 rounded-sm overflow-hidden flex-shrink-0 bg-surface-container-highest">
                            <img src={event.fragrance.image_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-sm flex-shrink-0 bg-surface-container flex items-center justify-center">
                            <span>{getIconChar(event.icon)}</span>
                          </div>
                        )}

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-on-surface font-medium truncate">{event.title}</p>
                          <div className="flex items-center gap-2">
                            <span>{getIconChar(event.icon)}</span>
                            <span className="text-[10px] text-secondary/50">{event.subtitle}</span>
                          </div>
                        </div>

                        {/* Date */}
                        <span className="text-[9px] text-secondary/40 flex-shrink-0 mt-1">
                          {formatDate(event.date)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            )
          })}
        </div>
      )}
    </main>
  )
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
