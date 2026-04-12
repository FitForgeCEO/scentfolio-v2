import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ReviewLikeButtonBatch } from '../ui/ReviewLikeButton'
import { SubRatingBars } from '../ui/SubRatingBars'
import { useReviewLikeCounts } from '@/hooks/useReviewLikes'
import { supabase } from '@/lib/supabase'
import { ReviewShareCard } from '../ui/ReviewShareCard'
import { FragranceImage } from '../ui/FragranceImage'
import { getIconChar } from '@/lib/iconUtils'

interface FeedItem {
  id: string
  user_id: string
  user_display_name: string
  user_avatar: string | null
  user_level: number
  overall_rating: number
  scent_rating: number | null
  longevity_rating: number | null
  sillage_rating: number | null
  value_rating: number | null
  review_text: string | null
  title: string | null
  created_at: string
  fragrance: { id: string; name: string; brand: string; image_url: string | null } | null
  is_verified_owner: boolean
}

interface ActivityEntry {
  id: string
  type: 'wear' | 'collection_add' | 'review'
  user_id: string
  user_display_name: string
  user_avatar: string | null
  fragrance_name: string
  fragrance_brand: string
  fragrance_id: string
  created_at: string
  extra?: string
}

export function CommunityFeedScreen() {
  const navigate = useNavigate()
  const [items, setItems] = useState<FeedItem[]>([])
  const [activityItems, setActivityItems] = useState<ActivityEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'reviews' | 'activity'>('reviews')
  const [sharingReview, setSharingReview] = useState<FeedItem | null>(null)
  const reviewIds = useMemo(() => items.map(i => i.id), [items])
  const { counts: likeCounts, userLiked, toggleLike } = useReviewLikeCounts(reviewIds)

  useEffect(() => {
    fetchFeed()
  }, [tab])

  async function fetchActivityFeed() {
    const entries: ActivityEntry[] = []
    type Prof = { id: string; display_name: string; avatar_url: string | null }
    const profileCache = new Map<string, Prof>()

    async function resolveProfiles(userIds: string[]) {
      const missing = userIds.filter(id => !profileCache.has(id))
      if (missing.length > 0) {
        const { data } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url')
          .in('id', missing)
        for (const p of (data ?? []) as Prof[]) profileCache.set(p.id, p)
      }
    }

    // Recent wears (community-wide)
    try {
      const { data: wears } = await supabase
        .from('wear_logs')
        .select('id, user_id, wear_date, occasion, created_at, fragrance:fragrances(id, name, brand)')
        .order('created_at', { ascending: false })
        .limit(20)

      type WearRow = { id: string; user_id: string; wear_date: string; occasion: string | null; created_at: string; fragrance: { id: string; name: string; brand: string } | null }
      const wearRows = (wears ?? []) as unknown as WearRow[]
      await resolveProfiles(wearRows.map(w => w.user_id))

      for (const w of wearRows) {
        if (!w.fragrance) continue
        const prof = profileCache.get(w.user_id)
        entries.push({
          id: `wear-${w.id}`,
          type: 'wear',
          user_id: w.user_id,
          user_display_name: prof?.display_name ?? 'Someone',
          user_avatar: prof?.avatar_url ?? null,
          fragrance_name: w.fragrance.name,
          fragrance_brand: w.fragrance.brand,
          fragrance_id: w.fragrance.id,
          created_at: w.created_at,
          extra: w.occasion ?? undefined,
        })
      }
    } catch { /* graceful */ }

    // Recent collection adds
    try {
      const { data: adds } = await supabase
        .from('user_collections')
        .select('id, user_id, status, date_added, fragrance:fragrances(id, name, brand)')
        .eq('status', 'owned')
        .order('date_added', { ascending: false })
        .limit(15)

      type CollRow = { id: string; user_id: string; status: string; date_added: string; fragrance: { id: string; name: string; brand: string } | null }
      const collRows = (adds ?? []) as unknown as CollRow[]
      await resolveProfiles(collRows.map(c => c.user_id))

      for (const c of collRows) {
        if (!c.fragrance) continue
        const prof = profileCache.get(c.user_id)
        entries.push({
          id: `coll-${c.id}`,
          type: 'collection_add',
          user_id: c.user_id,
          user_display_name: prof?.display_name ?? 'Someone',
          user_avatar: prof?.avatar_url ?? null,
          fragrance_name: c.fragrance.name,
          fragrance_brand: c.fragrance.brand,
          fragrance_id: c.fragrance.id,
          created_at: c.date_added,
        })
      }
    } catch { /* graceful */ }

    // Recent reviews (brief — no full text, just that someone reviewed)
    try {
      const { data: reviews } = await supabase
        .from('reviews')
        .select('id, user_id, overall_rating, created_at, fragrance:fragrances(id, name, brand)')
        .order('created_at', { ascending: false })
        .limit(15)

      type RevRow = { id: string; user_id: string; overall_rating: number; created_at: string; fragrance: { id: string; name: string; brand: string } | null }
      const revRows = (reviews ?? []) as unknown as RevRow[]
      await resolveProfiles(revRows.map(r => r.user_id))

      for (const r of revRows) {
        if (!r.fragrance) continue
        const prof = profileCache.get(r.user_id)
        entries.push({
          id: `rev-${r.id}`,
          type: 'review',
          user_id: r.user_id,
          user_display_name: prof?.display_name ?? 'Someone',
          user_avatar: prof?.avatar_url ?? null,
          fragrance_name: r.fragrance.name,
          fragrance_brand: r.fragrance.brand,
          fragrance_id: r.fragrance.id,
          created_at: r.created_at,
          extra: `${r.overall_rating}/5`,
        })
      }
    } catch { /* graceful */ }

    // Sort by time descending
    entries.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    setActivityItems(entries.slice(0, 40))
  }

  async function fetchFeed() {
    setLoading(true)
    if (tab === 'activity') {
      await fetchActivityFeed()
      setLoading(false)
      return
    }
    if (tab === 'reviews') {
      const { data } = await supabase
        .from('reviews')
        .select('id, overall_rating, scent_rating, longevity_rating, sillage_rating, value_rating, review_text, title, created_at, user_id, fragrance_id, fragrance:fragrances(id, name, brand, image_url)')
        .not('review_text', 'is', null)
        .order('created_at', { ascending: false })
        .limit(30)

      type Row = { id: string; overall_rating: number; scent_rating: number | null; longevity_rating: number | null; sillage_rating: number | null; value_rating: number | null; review_text: string | null; title: string | null; created_at: string; user_id: string; fragrance_id: string; fragrance: { id: string; name: string; brand: string; image_url: string | null } | null }
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

      // Check verified ownership — which reviewers own the fragrance they reviewed
      const ownerPairs = rows.map((r) => ({ user_id: r.user_id, fragrance_id: r.fragrance_id }))
      const ownerSet = new Set<string>()
      if (ownerPairs.length > 0) {
        try {
          const { data: collections } = await supabase
            .from('user_collections')
            .select('user_id, fragrance_id')
            .in('user_id', userIds)
          if (collections) {
            for (const c of collections as { user_id: string; fragrance_id: string }[]) {
              ownerSet.add(`${c.user_id}:${c.fragrance_id}`)
            }
          }
        } catch { /* graceful fallback */ }
      }

      setItems(rows.map((r) => {
        const prof = profileMap.get(r.user_id)
        return {
          id: r.id,
          user_id: r.user_id,
          user_display_name: prof?.display_name ?? 'Anonymous',
          user_avatar: prof?.avatar_url ?? null,
          user_level: prof?.level ?? 1,
          overall_rating: r.overall_rating,
          scent_rating: r.scent_rating,
          longevity_rating: r.longevity_rating,
          sillage_rating: r.sillage_rating,
          value_rating: r.value_rating,
          review_text: r.review_text,
          title: r.title,
          created_at: r.created_at,
          fragrance: r.fragrance,
          is_verified_owner: ownerSet.has(`${r.user_id}:${r.fragrance_id}`),
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

      {/* Explore People button */}
      <button
        onClick={() => navigate('/people')}
        className="w-full flex items-center justify-center gap-2 bg-surface-container rounded-sm py-3 mb-4 hover:opacity-80 transition-transform"
      >
        <span className="text-primary">?</span>
        <span className="text-xs font-bold uppercase tracking-wider text-primary">Explore People</span>
      </button>

      <div className="flex gap-2 mb-6">
        {[
          { key: 'reviews' as const, label: 'Reviews', icon: 'rate_review' },
          { key: 'activity' as const, label: 'Activity', icon: 'group' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-sm text-[10px] font-bold uppercase tracking-wider transition-all hover:opacity-80 ${
              tab === t.key ? 'bg-primary/15 text-primary' : 'bg-surface-container text-secondary/50'
            }`}
          >
            <span>{getIconChar(t.icon)}</span>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-1.5">{[1,2,3].map(i => <div key={i} className="h-1 rounded-sm bg-primary/20 animate-pulse" style={{ width: `${60 - i * 14}px` }} />)}</div>
        </div>
      ) : tab === 'activity' ? (
        activityItems.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-16">
            <span className="text-4xl text-secondary/20">?</span>
            <p className="text-sm text-secondary/50">No community activity yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {activityItems.map((entry) => {
              const typeConfig = {
                wear: { icon: 'air', color: 'text-blue-400', verb: 'wore' },
                collection_add: { icon: 'add_circle', color: 'text-emerald-400', verb: 'added' },
                review: { icon: 'rate_review', color: 'text-amber-400', verb: 'reviewed' },
              }[entry.type]
              return (
                <button
                  key={entry.id}
                  onClick={() => navigate(`/fragrance/${entry.fragrance_id}`)}
                  className="w-full text-left bg-surface-container rounded-sm px-4 py-3 flex items-center gap-3 hover:opacity-80 transition-transform"
                >
                  <div className="w-9 h-9 rounded-full bg-surface-container-highest/60 flex items-center justify-center flex-shrink-0">
                    <span>{getIconChar(typeConfig.icon)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-on-surface leading-tight">
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/u/${entry.user_id}`) }}
                        className="font-medium hover:text-primary transition-colors"
                      >
                        {entry.user_display_name}
                      </button>
                      {' '}{typeConfig.verb}{' '}
                      <span className="font-medium">{entry.fragrance_name}</span>
                    </p>
                    <p className="text-[10px] text-secondary/40 mt-0.5">
                      {entry.fragrance_brand}
                      {entry.extra ? ` · ${entry.extra}` : ''}
                      {' · '}{timeAgo(entry.created_at)}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        )
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16">
          <span className="text-4xl text-secondary/20">?</span>
          <p className="text-sm text-secondary/50">No community reviews yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <div key={item.id} className="bg-surface-container rounded-sm p-4 space-y-3">
              {/* User Header */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigate(`/u/${item.user_id}`)}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
                >
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                    {item.user_avatar ? (
                      <img src={item.user_avatar} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <span className="text-xs font-bold text-primary">{item.user_display_name[0]?.toUpperCase()}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm text-on-surface font-medium truncate">{item.user_display_name}</p>
                      {item.is_verified_owner && (
                        <span className="text-primary text-[12px] flex-shrink-0">?</span>
                      )}
                    </div>
                    <p className="text-[9px] text-secondary/40">Level {item.user_level} · {timeAgo(item.created_at)}</p>
                  </div>
                </button>
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span key={i} className={i < item.overall_rating ? 'text-primary' : 'text-secondary/20'}>★</span>
                  ))}
                </div>
              </div>

              {/* Fragrance */}
              {item.fragrance && (
                <button
                  onClick={() => navigate(`/fragrance/${item.fragrance!.id}`)}
                  className="flex items-center gap-3 w-full text-left hover:opacity-80 transition-transform"
                >
                  <FragranceImage
                    src={item.fragrance.image_url}
                    alt={item.fragrance.name}
                    size="sm"
                    className="w-10 h-10 rounded-sm flex-shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-[9px] uppercase tracking-[0.1em] text-secondary/50">{item.fragrance.brand}</p>
                    <p className="text-sm text-on-surface font-medium truncate">{item.fragrance.name}</p>
                  </div>
                </button>
              )}

              {/* Review Title */}
              {item.title && (
                <p className="text-sm font-bold text-on-surface">{item.title}</p>
              )}

              {/* Review Text */}
              {item.review_text && (
                <p className="text-sm text-on-surface/70 leading-relaxed line-clamp-3">{item.review_text}</p>
              )}

              {/* Sub-ratings (compact) */}
              <SubRatingBars
                scent={item.scent_rating}
                longevity={item.longevity_rating}
                sillage={item.sillage_rating}
                value={item.value_rating}
                compact
              />

              {/* Actions */}
              <div className="flex items-center gap-4">
                <ReviewLikeButtonBatch
                  reviewId={item.id}
                  liked={userLiked.has(item.id)}
                  count={likeCounts[item.id] ?? 0}
                  onToggle={toggleLike}
                />
                <button
                  onClick={() => setSharingReview(item)}
                  className="flex items-center gap-1.5 text-[10px] text-secondary/40 hover:text-primary transition-colors hover:opacity-80"
                >
                  <span>↗</span>
                  Share
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {sharingReview && (
        <ReviewShareCard
          reviewerName={sharingReview.user_display_name}
          fragranceName={sharingReview.fragrance?.name ?? 'Unknown'}
          fragranceBrand={sharingReview.fragrance?.brand ?? ''}
          fragranceImage={sharingReview.fragrance?.image_url ?? null}
          rating={sharingReview.overall_rating}
          reviewText={sharingReview.review_text}
          onClose={() => setSharingReview(null)}
        />
      )}
    </main>
  )
}
