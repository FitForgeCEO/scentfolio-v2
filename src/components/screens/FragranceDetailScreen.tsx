import { useParams, useNavigate } from 'react-router-dom'
import type React from 'react'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { Icon } from '../ui/Icon'
import { useFragranceDetail, useFragranceReviews, useFragranceTags } from '@/hooks/useFragrances'
import { useSimilarFragrances } from '@/hooks/useSimilarFragrances'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { LogWearSheet } from './LogWearSheet'
import { ReviewSheet } from './ReviewSheet'
import { EditReviewSheet } from './EditReviewSheet'
import { hapticMedium } from '@/lib/haptics'
import { FragranceImage } from '../ui/FragranceImage'
import { FragranceNotesPyramid } from '../fragrance/FragranceNotesPyramid'
import { AccordsRadar } from '../fragrance/AccordsRadar'
import { awardXP } from '@/lib/xp'
import { trackEvent, AnalyticsEvents } from '@/lib/analytics'
import { useToast } from '@/contexts/ToastContext'
import { TagInput } from '../ui/TagInput'
import { useUserFragranceTags, useAllUserTags } from '@/hooks/useUserTags'
import { ShareCardSheet } from '../ui/ShareCard'
import { EnhancedReviewCard } from '../ui/EnhancedReviewCard'
import { useReviewOwners, useDeleteReview } from '@/hooks/useReviewEnhancements'
import type { ReviewSortOption } from '@/hooks/useReviewEnhancements'
import type { Review } from '@/types/database'
import { addRecentlyViewed } from '@/lib/recentlyViewed'

/* ── Season & Occasion icon maps ── */
const SEASON_ICONS: Record<string, React.ReactNode> = {
  SPRING: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
      <circle cx="12" cy="12" r="4" fill="currentColor" opacity="0.15"/>
    </svg>
  ),
  SUMMER: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" fill="currentColor" opacity="0.2"/>
      <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  ),
  FALL: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 20A7 7 0 0 1 9.8 6.9C15.5 4.9 17 3.5 19 2c1 2 2 4.5 2 8 0 5.5-4.5 10-10 10Z" fill="currentColor" opacity="0.12"/>
      <path d="M11 20A7 7 0 0 1 9.8 6.9C15.5 4.9 17 3.5 19 2c1 2 2 4.5 2 8 0 5.5-4.5 10-10 10Z"/>
      <path d="M11 20V8"/>
    </svg>
  ),
  AUTUMN: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 20A7 7 0 0 1 9.8 6.9C15.5 4.9 17 3.5 19 2c1 2 2 4.5 2 8 0 5.5-4.5 10-10 10Z" fill="currentColor" opacity="0.12"/>
      <path d="M11 20A7 7 0 0 1 9.8 6.9C15.5 4.9 17 3.5 19 2c1 2 2 4.5 2 8 0 5.5-4.5 10-10 10Z"/>
      <path d="M11 20V8"/>
    </svg>
  ),
  WINTER: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="2" x2="12" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/>
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/><line x1="19.07" y1="4.93" x2="4.93" y2="19.07"/>
      <circle cx="12" cy="12" r="2" fill="currentColor" opacity="0.2"/>
    </svg>
  ),
}

const OCCASION_ICONS: Record<string, React.ReactNode> = {
  CASUAL: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.38 3.46L16 2 12 5.5 8 2l-4.38 1.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23Z"/>
    </svg>
  ),
  OFFICE: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
    </svg>
  ),
  'DATE NIGHT': (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" fill="currentColor" opacity="0.12"/>
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
    </svg>
  ),
  'NIGHT OUT': (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" fill="currentColor" opacity="0.12"/>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/>
    </svg>
  ),
  'SPECIAL EVENT': (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="currentColor" opacity="0.12"/>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  ),
  DAILY: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  SPORT: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 6.5L17.5 17.5M6.5 17.5L17.5 6.5"/>
      <circle cx="12" cy="12" r="10"/>
    </svg>
  ),
  BUSINESS: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
    </svg>
  ),
  LEISURE: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  EVENING: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" fill="currentColor" opacity="0.12"/>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/>
    </svg>
  ),
}

function getSeasonIcon(name: string): React.ReactNode {
  return SEASON_ICONS[name] || null
}

function getOccasionIcon(name: string): React.ReactNode {
  // Try exact, then partial
  if (OCCASION_ICONS[name]) return OCCASION_ICONS[name]
  for (const [key, icon] of Object.entries(OCCASION_ICONS)) {
    if (name.includes(key) || key.includes(name)) return icon
  }
  return null
}

function accordToPercent(level: string): number {
  switch (level) {
    case 'Dominant': return 95
    case 'Prominent': return 75
    case 'Moderate': return 50
    default: return 30
  }
}

export function FragranceDetailScreen() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: frag, loading } = useFragranceDetail(id)
  const [reviewSort, setReviewSort] = useState<ReviewSortOption>('newest')
  const { data: reviews, refetch: refetchReviews } = useFragranceReviews(id, reviewSort)
  const { data: tags } = useFragranceTags(id)
  const { data: similarFragrances, loading: similarLoading } = useSimilarFragrances(frag ?? null)
  const { tags: userTags, setTags: setUserTags } = useUserFragranceTags(id)
  const { tags: allUserTags } = useAllUserTags()

  // Verified owner badges — check which reviewers own this fragrance
  const reviewerIds = useMemo(() => reviews.map((r) => r.user_id), [reviews])
  const ownerIds = useReviewOwners(id, reviewerIds)
  const { deleteReview } = useDeleteReview(refetchReviews)

  const { showToast } = useToast()
  // Collection status
  const [collectionStatus, setCollectionStatus] = useState<string | null>(null)
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [logSheetOpen, setLogSheetOpen] = useState(false)
  const [reviewSheetOpen, setReviewSheetOpen] = useState(false)
  const [editingReview, setEditingReview] = useState<Review | null>(null)
  const [shareCardOpen, setShareCardOpen] = useState(false)

  // Track recently viewed + analytics
  useEffect(() => {
    if (frag) {
      addRecentlyViewed({ id: frag.id, name: frag.name, brand: frag.brand, image_url: frag.image_url })
      trackEvent(AnalyticsEvents.VIEW_FRAGRANCE, { fragrance_id: frag.id, brand: frag.brand, name: frag.name })
    }
  }, [frag])

  useEffect(() => {
    if (!user || !id) return
    supabase
      .from('user_collections')
      .select('status')
      .eq('user_id', user.id)
      .eq('fragrance_id', id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setCollectionStatus(data.status)
      })
  }, [user, id])

  const handleAddToCollection = useCallback(async (status: string) => {
    if (!user) { navigate('/profile'); return }
    if (!id) return
    setAddMenuOpen(false)

    // Optimistic update
    const previousStatus = collectionStatus
    setCollectionStatus(status)
    setSaving(true)

    try {
      if (previousStatus) {
        const { error } = await supabase
          .from('user_collections')
          .update({ status })
          .eq('user_id', user.id)
          .eq('fragrance_id', id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('user_collections')
          .insert({ user_id: user.id, fragrance_id: id, status })
        if (error) throw error
        await awardXP(user.id, 'ADD_TO_COLLECTION')
      }
      hapticMedium()
      trackEvent(AnalyticsEvents.ADD_TO_COLLECTION, { fragrance_id: id, status, was_update: !!previousStatus })
      showToast(
        previousStatus
          ? `Moved to ${status}`
          : `Added to ${status}`,
        'success',
        status === 'wishlist' ? 'favorite' : 'check_circle'
      )
    } catch {
      // Rollback on failure
      setCollectionStatus(previousStatus)
      showToast('Failed to update collection', 'error')
    }
    setSaving(false)
  }, [user, id, collectionStatus, navigate, showToast])

  if (loading || !frag) {
    return (
      <main className="pt-24 pb-32 px-6 flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </main>
    )
  }

  // Build accords from main_accords_percentage
  const accords = frag.main_accords_percentage
    ? Object.entries(frag.main_accords_percentage)
        .map(([name, level]) => ({ name: name.toUpperCase(), value: accordToPercent(level) }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6)
    : (frag.accords || []).slice(0, 6).map((a, i) => ({ name: a.toUpperCase(), value: 90 - i * 12 }))

  // Season/occasion from rankings
  const seasons = (frag.season_ranking || []).map((s) => ({
    name: s.name.toUpperCase(),
    active: s.score > 0.5,
  }))

  const occasions = (frag.occasion_ranking || []).map((o) => ({
    name: o.name.replace(/_/g, ' ').toUpperCase(),
    active: o.score > 0.5,
  }))

  const longevityFilled = frag.longevity ? Math.round(frag.longevity * 2) : null
  const sillageFilled = frag.sillage ? Math.round(frag.sillage * 2) : null

  return (
    <main className="pb-24">
      {/* Hero Section */}
      <section className="relative w-full aspect-[4/5] overflow-hidden">
        <FragranceImage
          src={frag.image_url}
          alt={`${frag.brand} ${frag.name}`}
          noteFamily={frag.note_family}
          size="lg"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/30 to-transparent" />
        <div className="absolute bottom-8 left-6 right-6 flex justify-between items-end">
          <div className="space-y-1">
            <p className="text-[10px] font-bold tracking-[0.2em] text-primary/80 uppercase">{frag.brand}</p>
            <h2 className="text-4xl font-headline italic leading-tight text-on-surface">{frag.name}</h2>
            {frag.concentration && (
              <div className="mt-3 inline-block bg-surface-container-highest/60 backdrop-blur-md px-3 py-1 rounded-full">
                <span className="text-[9px] font-bold tracking-widest text-secondary uppercase">
                  {frag.concentration}
                </span>
              </div>
            )}
          </div>
          {frag.rating && (
            <div className="flex items-center gap-1.5 bg-primary/20 backdrop-blur-md px-3 py-1.5 rounded-full mb-1">
              <Icon name="star" filled className="text-primary text-sm" />
              <span className="text-sm font-bold text-primary">{Number(frag.rating).toFixed(1)}</span>
            </div>
          )}
        </div>
      </section>

      {/* Action Bar */}
      <section className="bg-surface-container px-6 py-5 flex justify-between items-center relative">
        {/* ADD button with dropdown */}
        <div className="relative flex flex-col items-center gap-2">
          <button
            onClick={() => {
              if (!user) { navigate('/profile'); return }
              setAddMenuOpen(!addMenuOpen)
            }}
            disabled={saving}
            aria-label={collectionStatus ? `Collection status: ${collectionStatus}` : 'Add to collection'}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-surface-container-highest active:scale-90 transition-transform"
          >
            <Icon
              name={collectionStatus ? 'check' : 'add'}
              className={collectionStatus ? 'text-primary' : 'text-secondary'}
            />
          </button>
          <span className={`text-[9px] tracking-widest uppercase font-bold ${collectionStatus ? 'text-primary' : 'text-secondary/60'}`}>
            {collectionStatus ? collectionStatus.toUpperCase() : 'ADD'}
          </span>

          {/* Dropdown */}
          {addMenuOpen && (
            <>
              <div className="fixed inset-0 z-[var(--z-sticky)]" onClick={() => setAddMenuOpen(false)} />
              <div className="absolute top-12 left-1/2 -translate-x-1/2 z-[var(--z-dropdown)] bg-surface-container-highest rounded-xl py-2 min-w-[140px] shadow-xl border border-outline-variant/10">
                {['own', 'wishlist', 'sampled', 'sold'].map((status) => (
                  <button
                    key={status}
                    onClick={() => handleAddToCollection(status)}
                    className={`w-full text-left px-4 py-2.5 text-xs font-medium transition-colors ${
                      collectionStatus === status
                        ? 'text-primary bg-primary/10'
                        : 'text-on-surface hover:bg-surface-container'
                    }`}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                    {collectionStatus === status && (
                      <Icon name="check" className="float-right text-primary text-sm" />
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* LOG button */}
        <button
          className="flex flex-col items-center gap-2 group bg-transparent border-none"
          onClick={() => setLogSheetOpen(true)}
        >
          <div className="w-10 h-10 flex items-center justify-center rounded-full bg-surface-container-highest group-active:scale-90 transition-transform">
            <Icon name="calendar_today" className="text-secondary" />
          </div>
          <span className="text-[9px] tracking-widest uppercase font-bold text-secondary/60">LOG</span>
        </button>

        {/* REVIEW button */}
        <button
          className="flex flex-col items-center gap-2 group bg-transparent border-none"
          onClick={() => {
            if (!user) { navigate('/profile'); return }
            setReviewSheetOpen(true)
          }}
        >
          <div className="w-10 h-10 flex items-center justify-center rounded-full bg-surface-container-highest group-active:scale-90 transition-transform">
            <Icon name="rate_review" className="text-secondary" />
          </div>
          <span className="text-[9px] tracking-widest uppercase font-bold text-secondary/60">REVIEW</span>
        </button>

        <button
          className="flex flex-col items-center gap-2 group"
          onClick={() => setShareCardOpen(true)}
        >
          <div className="w-10 h-10 flex items-center justify-center rounded-full bg-surface-container-highest group-active:scale-90 transition-transform">
            <Icon name="share" className="text-secondary" />
          </div>
          <span className="text-[9px] tracking-widest uppercase font-bold text-secondary/60">SHARE</span>
        </button>
      </section>

      {/* Log Wear Bottom Sheet */}
      <LogWearSheet isOpen={logSheetOpen} onClose={() => setLogSheetOpen(false)} fragrance={frag} />

      {/* Review Sheet */}
      <ReviewSheet
        isOpen={reviewSheetOpen}
        onClose={() => setReviewSheetOpen(false)}
        fragrance={frag}
        isOwner={collectionStatus === 'own'}
        onSubmitted={refetchReviews}
      />

      {/* Edit Review Sheet */}
      {editingReview && (
        <EditReviewSheet
          isOpen={!!editingReview}
          onClose={() => setEditingReview(null)}
          review={editingReview}
          onUpdated={refetchReviews}
        />
      )}

      {shareCardOpen && (
        <ShareCardSheet fragrance={frag} onClose={() => setShareCardOpen(false)} />
      )}

      <div className="px-6 mt-10 space-y-12">
        {/* Accords — Radar Chart */}
        {accords.length > 0 && (
          <section>
            <h3 className="text-[11px] font-bold tracking-[0.15em] text-primary uppercase mb-6">ACCORDS</h3>
            <AccordsRadar accords={accords} />
          </section>
        )}

        {/* Notes Pyramid */}
        <FragranceNotesPyramid
          notesTop={frag.notes_top ?? undefined}
          notesHeart={frag.notes_heart ?? undefined}
          notesBase={frag.notes_base ?? undefined}
        />

        {/* Performance */}
        {(longevityFilled || sillageFilled) && (
          <section>
            <h3 className="text-[11px] font-bold tracking-[0.15em] text-primary uppercase mb-6">PERFORMANCE</h3>
            <div className="grid grid-cols-2 gap-8">
              {longevityFilled && (
                <div className="space-y-3">
                  <p className="text-[10px] font-bold tracking-widest text-secondary/60">LONGEVITY</p>
                  <div className="flex gap-1">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <div key={i} className={`h-1 flex-1 ${i < longevityFilled ? 'bg-primary' : 'bg-surface-container-highest'}`} />
                    ))}
                  </div>
                  <p className="text-xs text-on-surface-variant italic">{frag.longevity}/5</p>
                </div>
              )}
              {sillageFilled && (
                <div className="space-y-3">
                  <p className="text-[10px] font-bold tracking-widest text-secondary/60">SILLAGE</p>
                  <div className="flex gap-1">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <div key={i} className={`h-1 flex-1 ${i < sillageFilled ? 'bg-primary' : 'bg-surface-container-highest'}`} />
                    ))}
                  </div>
                  <p className="text-xs text-on-surface-variant italic">{frag.sillage}/5</p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Season / Occasion */}
        {(seasons.length > 0 || occasions.length > 0) && (
          <section className="space-y-8">
            {seasons.length > 0 && (
              <div>
                <h3 className="text-[11px] font-bold tracking-[0.15em] text-primary uppercase mb-4">SEASON</h3>
                <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                  {seasons.map((s) => (
                    <div
                      key={s.name}
                      className={`flex items-center gap-2 px-4 py-3 rounded-xl bg-surface-container border text-[10px] font-bold tracking-widest shrink-0 transition-all ${
                        s.active ? 'border-primary text-primary' : 'border-outline-variant/30 text-secondary/60'
                      }`}
                    >
                      {getSeasonIcon(s.name)}
                      {s.name}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {occasions.length > 0 && (
              <div>
                <h3 className="text-[11px] font-bold tracking-[0.15em] text-primary uppercase mb-4">OCCASION</h3>
                <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                  {occasions.map((o) => (
                    <div
                      key={o.name}
                      className={`flex items-center gap-2 px-4 py-3 rounded-xl bg-surface-container border text-[10px] font-bold tracking-widest shrink-0 transition-all ${
                        o.active ? 'border-primary text-primary' : 'border-outline-variant/30 text-secondary/60'
                      }`}
                    >
                      {getOccasionIcon(o.name)}
                      {o.name}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Aesthetic Tags */}
        {tags.length > 0 && (
          <section>
            <div className="mb-6">
              <h3 className="text-[11px] font-bold tracking-[0.15em] text-primary uppercase">AESTHETIC TAGS</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span key={tag} className="px-4 py-2 rounded-full bg-surface-container-highest text-xs text-on-surface-variant">
                  {tag}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* My Tags — user's personal tags */}
        {user && collectionStatus && (
          <section>
            <div className="mb-4">
              <h3 className="text-[11px] font-bold tracking-[0.15em] text-primary uppercase">MY TAGS</h3>
            </div>
            <TagInput
              tags={userTags}
              onChange={setUserTags}
              suggestions={allUserTags}
              placeholder="Add personal tag..."
              maxTags={15}
            />
          </section>
        )}

        {/* Similar Fragrances — powered by similarity engine */}
        {!similarLoading && similarFragrances.length > 0 && (
          <section>
            <h3 className="text-[11px] font-bold tracking-[0.15em] text-primary uppercase mb-6">SIMILAR FRAGRANCES</h3>
            <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
              {similarFragrances.map((sr) => (
                <button
                  key={sr.fragrance.id}
                  onClick={() => navigate(`/fragrance/${sr.fragrance.id}`)}
                  className="flex-shrink-0 w-[120px] text-left active:scale-95 transition-transform"
                >
                  <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-surface-container-low mb-2">
                    <FragranceImage
                      src={sr.fragrance.image_url}
                      alt={sr.fragrance.name}
                      noteFamily={sr.fragrance.note_family}
                      size="md"
                      className="w-full h-full object-cover"
                    />
                    {/* Match score badge */}
                    <div className="absolute top-1.5 right-1.5 bg-black/60 backdrop-blur-sm rounded-full px-2 py-0.5">
                      <span className="text-[9px] text-primary font-bold">{sr.score}%</span>
                    </div>
                  </div>
                  <p className="text-[9px] uppercase tracking-[0.1em] font-label text-secondary/60">{sr.fragrance.brand}</p>
                  <p className="text-xs font-medium text-on-surface truncate">{sr.fragrance.name}</p>
                  {sr.reasons.length > 0 && (
                    <p className="text-[9px] text-secondary/50 truncate mt-0.5">{sr.reasons[0]}</p>
                  )}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Reviews */}
        {reviews.length > 0 && (
          <section>
            <div className="mb-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-bold tracking-[0.15em] text-primary uppercase">
                  REVIEWS ({reviews.length})
                </h3>
              </div>
              {/* Sort controls */}
              <div className="flex gap-2 mt-3 overflow-x-auto no-scrollbar">
                {([
                  { key: 'newest', label: 'Newest' },
                  { key: 'oldest', label: 'Oldest' },
                  { key: 'highest', label: 'Highest' },
                  { key: 'lowest', label: 'Lowest' },
                ] as { key: ReviewSortOption; label: string }[]).map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setReviewSort(opt.key)}
                    className={`px-3 py-1.5 rounded-full text-[10px] font-bold tracking-wider whitespace-nowrap transition-colors ${
                      reviewSort === opt.key
                        ? 'bg-primary text-on-primary'
                        : 'bg-surface-container-highest text-secondary/60'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              {reviews.map((review) => (
                <EnhancedReviewCard
                  key={review.id}
                  review={review}
                  isVerifiedOwner={ownerIds.has(review.user_id)}
                  onEdit={user?.id === review.user_id ? () => setEditingReview(review) : undefined}
                  onDelete={user?.id === review.user_id ? () => {
                    deleteReview(review.id)
                    showToast('Review deleted', 'success')
                  } : undefined}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
