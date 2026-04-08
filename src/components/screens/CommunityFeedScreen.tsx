import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../ui/Icon'
import { supabase } from '@/lib/supabase'

interface FeedItem {
  id: string
  user_display_name: string
  user_avatar: string | null
  user_level: number
  overall_rating: number
  review_text: string | null
  title: string | null
  created_at: string
  fragrance: { id: string; name: string; brand: string; image_url: string | null } | null
}

export function CommunityFeedScreen() {
  const navigate = useNavigate()
  const [items, setItems] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'reviews' | 'activity'>('reviews')

  useEffect(() => {
    fetchFeed()
  }, [tab])

  async function fetchFeed() {
    setLoading(true)
    if (tab === 'reviews') {
      const { data } = await supabase
        .from('reviews')
        .select('id, overall_rating, review_text, title, created_at, user_id, fragrance:fragrances(id, name, brand, image_url)')
        .not('review_text', 'is', null)
        .order('created_at', { ascending: false })
        .limit(30)

      type Row = { id: string; overall_rating: number; review_text: string | null; title: string | null; created_at: string; user_id: string; fragrance: { id: string; name: string; brand: string; image_url: string | null } | null }
      const rows = (data ?? []) as unknown as Row[]

      // Fetch profiles for all user_ids
      const userIds = [...new Set(rows.map((r) => r.user_id))]
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, level')
        .in('id', userIds)

      type Prof = { id: string; display_name: string; avatar_url: string | null; level: number }
      const profileMap = new Map<string, Prof>()
      for (const p of (profiles ?? []) as Prof[]) {
        profileMap.set(p.id, p)
      }

      setItems(rows.map((r) => {
        const prof = profileMap.get(r.user_id)
        return {
          id: r.id,
          user_display_name: prof?.display_name ?? 'Anonymous',
          user_avatar: prof?.avatar_url ?? null,
          user_level: prof?.level ?? 1,
          overall_rating: r.overall_rating,
          review_text: r.review_text,
          title: r.title,
          created_at: r.created_at,
          fragrance: r.fragrance,
        }
      }))
    }
    setLoading(false)
  }

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    if (days < 7) return `${days}d ago`
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }

  return (
    <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen">
      <section className="text-center mb-6">
        <h2 className="font-headline text-xl mb-1">Community</h2>
        <p className="text-[10px] text-secondary/50">See what others are saying</p>
      </section>

      <div className="flex gap-2 mb-6">
        {[
          { key: 'reviews' as const, label: 'Reviews', icon: 'rate_review' },
          { key: 'activity' as const, label: 'Activity', icon: 'group' },
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

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16">
          <Icon name="forum" className="text-4xl text-secondary/20" />
          <p className="text-sm text-secondary/50">No community activity yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <div key={item.id} className="bg-surface-container rounded-xl p-4 space-y-3">
              {/* User Header */}
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  {item.user_avatar ? (
                    <img src={item.user_avatar} alt="" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <span className="text-xs font-bold text-primary">{item.user_display_name[0]?.toUpperCase()}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-on-surface font-medium truncate">{item.user_display_name}</p>
                  <p className="text-[9px] text-secondary/40">Level {item.user_level} · {timeAgo(item.created_at)}</p>
                </div>
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Icon
                      key={i}
                      name="star"
                      filled={i < item.overall_rating}
                      className={i < item.overall_rating ? 'text-primary' : 'text-secondary/20'}
                      size={12}
                    />
                  ))}
                </div>
              </div>

              {/* Fragrance */}
              {item.fragrance && (
                <button
                  onClick={() => navigate(`/fragrance/${item.fragrance!.id}`)}
                  className="flex items-center gap-3 w-full text-left active:scale-[0.98] transition-transform"
                >
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-surface-container-low flex-shrink-0">
                    {item.fragrance.image_url ? (
                      <img src={item.fragrance.image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Icon name="water_drop" className="text-secondary/20" size={16} />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] uppercase tracking-[0.1em] text-secondary/50">{item.fragrance.brand}</p>
                    <p className="text-sm text-on-surface font-medium truncate">{item.fragrance.name}</p>
                  </div>
                </button>
              )}

              {/* Review Text */}
              {item.review_text && (
                <p className="text-sm text-on-surface/70 leading-relaxed line-clamp-3">{item.review_text}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
