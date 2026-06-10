import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { getIconChar } from '@/lib/iconUtils'

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

    // Server-side aggregate. The old direct table queries ran under
    // owner-scoped RLS, so "trending" only ever counted the current
    // user's own rows. get_trending_fragrances (SECURITY DEFINER,
    // migration 20260610100000) aggregates across all users and returns
    // fragrance-level counts only.
    const days = period === '7d' ? 7 : period === '30d' ? 30 : null
    const { data, error } = await supabase.rpc('get_trending_fragrances', {
      p_category: category,
      p_days: days,
    })

    type Row = { fragrance_id: string; name: string; brand: string; image_url: string | null; cnt: number }
    if (error || !data) {
      setEntries([])
      setLoading(false)
      return
    }

    setEntries(
      (data as Row[]).map((r) => ({
        fragrance_id: r.fragrance_id,
        name: r.name,
        brand: r.brand,
        image_url: r.image_url,
        count: Number(r.cnt),
      }))
    )
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
          <span className="text-3xl text-primary">?</span>
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
            className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-sm text-[10px] font-bold uppercase tracking-wider transition-all hover:opacity-80 ${
              category === c ? 'bg-primary/15 text-primary' : 'bg-surface-container text-secondary/50'
            }`}
          >
            <span>{getIconChar(categoryLabels[c].icon)}</span>
            {categoryLabels[c].label.split(' ')[1]}
          </button>
        ))}
      </div>

      {/* Period Toggle */}
      <div className="flex gap-1 bg-surface-container rounded-sm p-1 mb-6">
        {(['7d', '30d', 'all'] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`flex-1 py-2 rounded-sm text-[10px] font-bold uppercase tracking-wider transition-all ${
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
          <div className="flex flex-col items-center gap-1.5">{[1,2,3].map(i => <div key={i} className="h-1 rounded-sm bg-primary/20 animate-pulse" style={{ width: `${60 - i * 14}px` }} />)}</div>
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16">
          <span className="text-4xl text-secondary/20">?</span>
          <p className="text-sm text-secondary/50">No data for this period yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry, idx) => (
            <button
              key={entry.fragrance_id}
              onClick={() => navigate(`/fragrance/${entry.fragrance_id}`)}
              className="w-full bg-surface-container rounded-sm p-3 flex items-center gap-3 hover:opacity-80 transition-transform text-left"
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
              <div className="w-11 h-11 rounded-sm overflow-hidden bg-surface-container-low flex-shrink-0">
                {entry.image_url ? (
                  <img src={entry.image_url} alt={entry.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-secondary/20">?</span>
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
