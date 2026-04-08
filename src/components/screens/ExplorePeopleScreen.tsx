import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../ui/Icon'
import { FollowButton } from '../ui/FollowButton'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

interface UserCard {
  id: string
  display_name: string
  avatar_url: string | null
  level: number
  xp: number
  collection_count: number
  review_count: number
}

export function ExplorePeopleScreen() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<UserCard[]>([])
  const [suggested, setSuggested] = useState<UserCard[]>([])
  const [active, setActive] = useState<UserCard[]>([])
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)

  // Fetch suggested users (most active, exclude self)
  useEffect(() => {
    const fetchSuggested = async () => {
      try {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url, level, xp')
          .order('xp', { ascending: false })
          .limit(30)

        if (!profiles) { setLoading(false); return }

        const userIds = profiles.map(p => p.id).filter(id => id !== user?.id)

        const [collCounts, reviewCounts] = await Promise.all([
          supabase
            .from('user_collections')
            .select('user_id')
            .in('user_id', userIds)
            .eq('status', 'own'),
          supabase
            .from('reviews')
            .select('user_id')
            .in('user_id', userIds),
        ])

        const collMap = new Map<string, number>()
        for (const r of collCounts.data ?? []) {
          collMap.set(r.user_id, (collMap.get(r.user_id) ?? 0) + 1)
        }
        const revMap = new Map<string, number>()
        for (const r of reviewCounts.data ?? []) {
          revMap.set(r.user_id, (revMap.get(r.user_id) ?? 0) + 1)
        }

        const cards: UserCard[] = profiles
          .filter(p => p.id !== user?.id)
          .map(p => ({
            id: p.id,
            display_name: p.display_name ?? 'Collector',
            avatar_url: p.avatar_url,
            level: p.level ?? 1,
            xp: p.xp ?? 0,
            collection_count: collMap.get(p.id) ?? 0,
            review_count: revMap.get(p.id) ?? 0,
          }))

        // Split: suggested (top XP), active (most reviews)
        setSuggested(cards.slice(0, 12))
        setActive([...cards].sort((a, b) => b.review_count - a.review_count).filter(c => c.review_count > 0).slice(0, 12))
      } catch {
        // Graceful fallback
      }
      setLoading(false)
    }

    fetchSuggested()
  }, [user])

  // Search users by name
  const handleSearch = useCallback(async (q: string) => {
    setQuery(q)
    if (q.trim().length < 2) { setResults([]); return }

    setSearching(true)
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, level, xp')
        .ilike('display_name', `%${q.trim()}%`)
        .neq('id', user?.id ?? '')
        .limit(20)

      if (data) {
        setResults(data.map(p => ({
          id: p.id,
          display_name: p.display_name ?? 'Collector',
          avatar_url: p.avatar_url,
          level: p.level ?? 1,
          xp: p.xp ?? 0,
          collection_count: 0,
          review_count: 0,
        })))
      }
    } catch {
      // Graceful fallback
    }
    setSearching(false)
  }, [user])

  const renderUserRow = (u: UserCard) => (
    <div key={u.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl">
      <button
        onClick={() => navigate(`/u/${u.id}`)}
        className="flex items-center gap-3 flex-1 min-w-0 text-left active:opacity-70 transition-opacity"
      >
        <div className="w-11 h-11 rounded-full overflow-hidden flex-shrink-0 bg-surface-container-highest">
          {u.avatar_url ? (
            <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-surface-container-highest">
              <span className="font-headline text-sm text-primary">{u.display_name[0]?.toUpperCase()}</span>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-on-surface font-medium truncate">{u.display_name}</p>
          <div className="flex items-center gap-2 text-[9px] text-secondary/40">
            <span>Level {u.level}</span>
            {u.collection_count > 0 && (
              <>
                <span>·</span>
                <span>{u.collection_count} bottles</span>
              </>
            )}
            {u.review_count > 0 && (
              <>
                <span>·</span>
                <span>{u.review_count} reviews</span>
              </>
            )}
          </div>
        </div>
      </button>
      <FollowButton targetUserId={u.id} compact />
    </div>
  )

  const showSearch = query.trim().length >= 2

  return (
    <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen">
      {/* Search bar */}
      <div className="relative mb-6">
        <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary/40" size={18} />
        <input
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search by name..."
          className="w-full bg-surface-container rounded-xl pl-10 pr-4 py-3 text-sm text-on-surface placeholder:text-secondary/30 focus:outline-none focus:ring-1 focus:ring-primary/30"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setResults([]) }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary/40 active:text-secondary"
          >
            <Icon name="close" size={16} />
          </button>
        )}
      </div>

      {/* Search results */}
      {showSearch && (
        <section className="mb-8">
          {searching ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : results.length === 0 ? (
            <div className="py-8 text-center">
              <Icon name="person_search" className="text-3xl text-secondary/20 mb-2" />
              <p className="text-xs text-secondary/40">No users found for "{query}"</p>
            </div>
          ) : (
            <div className="space-y-1">
              <h3 className="text-[9px] uppercase tracking-[0.15em] text-secondary/40 font-bold mb-3 px-3">RESULTS</h3>
              {results.map(renderUserRow)}
            </div>
          )}
        </section>
      )}

      {/* Browse sections (hidden during search) */}
      {!showSearch && (
        <>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2.5 animate-pulse">
                  <div className="w-11 h-11 rounded-full bg-surface-container-highest" />
                  <div className="flex-1">
                    <div className="h-3 bg-surface-container-highest rounded w-28 mb-1.5" />
                    <div className="h-2 bg-surface-container-highest rounded w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* Top collectors */}
              {suggested.length > 0 && (
                <section className="mb-8">
                  <h3 className="text-[9px] uppercase tracking-[0.15em] text-secondary/40 font-bold mb-3 px-3">
                    TOP COLLECTORS
                  </h3>
                  <div className="space-y-1">
                    {suggested.map(renderUserRow)}
                  </div>
                </section>
              )}

              {/* Most active reviewers */}
              {active.length > 0 && (
                <section className="mb-8">
                  <h3 className="text-[9px] uppercase tracking-[0.15em] text-secondary/40 font-bold mb-3 px-3">
                    ACTIVE REVIEWERS
                  </h3>
                  <div className="space-y-1">
                    {active.map(renderUserRow)}
                  </div>
                </section>
              )}

              {/* Empty state */}
              {suggested.length === 0 && active.length === 0 && (
                <div className="py-16 text-center">
                  <Icon name="group" className="text-5xl text-primary/15 mb-4" />
                  <p className="text-sm text-secondary/50">No other collectors yet</p>
                  <p className="text-xs text-secondary/30 mt-1">Be the first to invite friends!</p>
                </div>
              )}
            </>
          )}
        </>
      )}
    </main>
  )
}
