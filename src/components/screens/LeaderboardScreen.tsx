import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../ui/Icon'
import { supabase } from '@/lib/supabase'

interface LeaderboardEntry {
  fragrance_id: string
  name: string
  brand: string
  image_url: string | null
  count: number
}

type Period = '7d' | '30d' | 'all'
type Category = 'worn' | 'added' | 'reviewed'

export function LeaderboardScreen() {
  const navigate = useNavigate()
  const [period, setPeriod] = useState<Period>('7d')
  const [category, setCategory] = useState<Category>('worn')
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLeaderboard()
  }, [period, category])

  async function fetchLeaderboard() {
    setLoading(true)

    const now = new Date()
    const cutoff = period === '7d'
      ? new Date(now.getTime() - 7 * 86400000).toISOString()
      : period === '30d'
        ? new Date(now.getTime() - 30 * 86400000).toISOString()
        : '2000-01-01'

    let table: string
    let dateCol: string

    if (category === 'worn') {
      table = 'wear_logs'
      dateCol = 'wear_date'
    } else if (category === 'added') {
      table = 'user_collections'
      dateCol = 'date_added'
    } else {
      table = 'reviews'
      dateCol = 'created_at'
    }

    const { data } = await supabase
      .from(table)
      .select('fragrance_id, fragrance:fragrances(id, name, brand, image_url)')
      .gte(dateCol, cutoff)
      .limit(500)

    type Row = { fragrance_id: string; fragrance: { id: string; name: string; brand: string; image_url: string | null } | null }
    const rows = (data ?? []) as unknown as Row[]

    // Count by fragrance
    const countMap = new Map<string, { name: string; brand: string; image_url: string | null; count: number }>()
    for (const row of rows) {
      if (!row.fragrance) continue
      const existing = countMap.get(row.fragrance_id)
      if (existing) {
        existing.count++
      } else {
        countMap.set(row.fragrance_id, {
          name: row.fragrance.name,
          brand: row.fragrance.brand,
          image_url: row.fragrance.image_url,
          count: 1,
        })
      }
    }

    const sorted = [...countMap.entries()]
      .map(([fragrance_id, data]) => ({ fragrance_id, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20)

    setEntries(sorted)
    setLoading(false)
  }

  const categoryLabels: Record<Category, { label: string; icon: string; unit: string }> = {
    worn: { label: 'Most Worn', icon: 'checkroom', unit: 'wears' },
    added: { label: 'Most Added', icon: 'add_circle', unit: 'adds' },
    reviewed: { label: 'Most Reviewed', icon: 'rate_review', unit: 'reviews' },
  }

  return (
    <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen">
      <section className="text-center mb-6">
        <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-3">
          <Icon name="leaderboard" filled className="text-3xl text-primary" />
        </div>
        <h2 className="font-headline text-xl mb-1">Trending</h2>
        <p className="text-[10px] text-secondary/50">What the community is into right now</p>
      </section>

      {/* Category Tabs */}
      <div className="flex gap-2 mb-4">
        {(['worn', 'added', 'reviewed'] as Category[]).map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 ${
              category === c ? 'bg-primary/15 text-primary' : 'bg-surface-container text-secondary/50'
            }`}
          >
            <Icon name={categoryLabels[c].icon} size={12} />
            {categoryLabels[c].label.split(' ')[1]}
          </button>
        ))}
      </div>

      {/* Period Toggle */}
      <div className="flex gap-1 bg-surface-container rounded-xl p-1 mb-6">
        {(['7d', '30d', 'all'] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
              period === p ? 'bg-primary text-on-primary-container' : 'text-secondary/50'
            }`}
          >
            {p === '7d' ? 'This Week' : p === '30d' ? 'This Month' : 'All Time'}
          </button>
        ))}
      </div>

      {/* Leaderboard */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16">
          <Icon name="trending_up" className="text-4xl text-secondary/20" />
          <p className="text-sm text-secondary/50">No data for this period yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry, idx) => (
            <button
              key={entry.fragrance_id}
              onClick={() => navigate(`/fragrance/${entry.fragrance_id}`)}
              className="w-full bg-surface-container rounded-xl p-3 flex items-center gap-3 active:scale-[0.98] transition-transform text-left"
            >
              {/* Rank */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                idx === 0 ? 'bg-primary/20' : idx === 1 ? 'bg-primary/10' : idx === 2 ? 'bg-primary/5' : 'bg-surface-container-low'
              }`}>
                <span className={`text-xs font-bold ${idx < 3 ? 'text-primary' : 'text-secondary/50'}`}>
                  {idx + 1}
                </span>
              </div>

              {/* Image */}
              <div className="w-11 h-11 rounded-lg overflow-hidden bg-surface-container-low flex-shrink-0">
                {entry.image_url ? (
                  <img src={entry.image_url} alt={entry.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Icon name="water_drop" className="text-secondary/20" size={18} />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <p className="text-[9px] uppercase tracking-[0.1em] text-secondary/50">{entry.brand}</p>
                <p className="text-sm text-on-surface font-medium truncate">{entry.name}</p>
              </div>

              {/* Count */}
              <div className="text-right flex-shrink-0">
                <p className="font-headline text-lg text-primary">{entry.count}</p>
                <p className="text-[8px] text-secondary/40 uppercase">{categoryLabels[category].unit}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </main>
  )
}
