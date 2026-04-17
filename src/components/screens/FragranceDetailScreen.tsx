import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect, useCallback, useMemo, type CSSProperties } from 'react'
import { useFragranceDetail, useFragranceReviews, useFragranceTags } from '@/hooks/useFragrances'
import { useSimilarFragrances } from '@/hooks/useSimilarFragrances'
import { useFragranceThumbs } from '@/hooks/useFragranceThumbs'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { LogWearSheet } from './LogWearSheet'
import { ReviewSheet } from './ReviewSheet'
import { EditReviewSheet } from './EditReviewSheet'
import { hapticMedium } from '@/lib/haptics'
import { FragranceImage } from '../ui/FragranceImage'
import { AccordsRadar } from '../fragrance/AccordsRadar'
import { awardXP } from '@/lib/xp'
import { trackEvent, AnalyticsEvents } from '@/lib/analytics'
import { useToast } from '@/contexts/ToastContext'
import { useUserFragranceTags } from '@/hooks/useUserTags'
import { ShareCardSheet } from '../ui/ShareCard'
import { useReviewOwners, useDeleteReview } from '@/hooks/useReviewEnhancements'
import type { ReviewSortOption } from '@/hooks/useReviewEnhancements'
import type { Review } from '@/types/database'
import { addRecentlyViewed } from '@/lib/recentlyViewed'
import { FragranceNotesPyramid } from '../fragrance/FragranceNotesPyramid'

/* ── Noir helpers ── */

function accordToPercent(level: string): number {
  switch (level) {
    case 'Dominant': return 95
    case 'Prominent': return 75
    case 'Moderate': return 50
    default: return 30
  }
}

// 0 → "0 / V", 1 → "I / V", ... 5 → "V / V"
function toRomanOutOfFive(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return ''
  const rounded = Math.max(0, Math.min(5, Math.round(n)))
  const romans = ['0', 'I', 'II', 'III', 'IV', 'V']
  return `${romans[rounded]} / V`
}

// Year → Roman (for attribution: MMXXVI, MMXXV, MMXXIV)
function yearToRoman(dateStr: string): string {
  const year = new Date(dateStr).getFullYear()
  if (!isFinite(year)) return ''
  let n = year
  const map: [number, string][] = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
    [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ]
  let out = ''
  for (const [v, r] of map) {
    while (n >= v) { out += r; n -= v }
  }
  return out
}

// 1–5 → italic serif word for longevity
function longevityWord(n: number | null): string {
  if (n == null) return ''
  if (n >= 4.5) return 'eternal.'
  if (n >= 3.5) return 'long.'
  if (n >= 2.5) return 'moderate.'
  if (n >= 1.5) return 'brief.'
  return 'fleeting.'
}

// 1–5 → italic serif word for sillage
function sillageWord(n: number | null): string {
  if (n == null) return ''
  if (n >= 4.5) return 'an arrival.'
  if (n >= 3.5) return 'a presence.'
  if (n >= 2.5) return 'close.'
  if (n >= 1.5) return 'intimate.'
  return 'a whisper.'
}

// Format notes array as italic serif prose: "bergamot, green mandarin & pink pepper."
function notesProse(notes: string[] | null | undefined): string {
  if (!notes || notes.length === 0) return ''
  const lower = notes.map((n) => n.toLowerCase())
  if (lower.length === 1) return `${lower[0]}.`
  if (lower.length === 2) return `${lower[0]} & ${lower[1]}.`
  return `${lower.slice(0, -1).join(', ')} & ${lower[lower.length - 1]}.`
}

// Format tags as italic serif prose: "autumnal, smoky, melancholic and nocturnal."
function tagsProse(tags: string[]): string {
  if (tags.length === 0) return ''
  const lower = tags.map((t) => t.toLowerCase())
  if (lower.length === 1) return `${lower[0]}.`
  if (lower.length === 2) return `${lower[0]} and ${lower[1]}.`
  return `${lower.slice(0, -1).join(', ')} and ${lower[lower.length - 1]}.`
}

// First letter of brand, used as the italic serif plate sigil
function brandSigil(brand: string): string {
  if (!brand) return 'S'
  return brand.trim().charAt(0).toUpperCase()
}

// Season ranking → prose with opacity spans
// active: score > 0.66, neutral: 0.33–0.66, negative: < 0.33
type Ranked = { name: string; opacity: 'high' | 'mid' | 'low' }
function rankedList(items: { name: string; score: number }[] | null): Ranked[] {
  if (!items) return []
  return items.map((i) => ({
    name: i.name.toLowerCase(),
    opacity: i.score > 0.66 ? 'high' : i.score > 0.33 ? 'mid' : 'low',
  }))
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
  const kindredIds = useMemo(() => similarFragrances.map((sr) => sr.fragrance.id), [similarFragrances])
  const { thumbs: kindredThumbs, setThumb: setKindredThumb, isAuthed: kindredAuthed } =
    useFragranceThumbs(kindredIds, 'kindred_works')
  const { tags: userTags, setTags: setUserTags } = useUserFragranceTags(id)

  const reviewerIds = useMemo(() => reviews.map((r) => r.user_id), [reviews])
  const ownerIds = useReviewOwners(id, reviewerIds)
  const { deleteReview } = useDeleteReview(refetchReviews)

  const { showToast } = useToast()
  const [collectionStatus, setCollectionStatus] = useState<string | null>(null)
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [logSheetOpen, setLogSheetOpen] = useState(false)
  const [reviewSheetOpen, setReviewSheetOpen] = useState(false)
  const [editingReview, setEditingReview] = useState<Review | null>(null)
  const [shareCardOpen, setShareCardOpen] = useState(false)

  // Personal tag input draft
  const [tagDraft, setTagDraft] = useState('')

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

    const previousStatus = collectionStatus
    setCollectionStatus(status)
    setSaving(true)

    // Detect wishlist → owned promotion for bespoke voicing + XP reward.
    const isPromotion = previousStatus === 'wishlist' && status === 'own'

    try {
      if (previousStatus) {
        const { error } = await supabase
          .from('user_collections')
          .update({ status })
          .eq('user_id', user.id)
          .eq('fragrance_id', id)
        if (error) throw error
        if (isPromotion) {
          await awardXP(user.id, 'PROMOTE_TO_OWNED')
        }
      } else {
        const { error } = await supabase
          .from('user_collections')
          .insert({ user_id: user.id, fragrance_id: id, status })
        if (error) throw error
        await awardXP(user.id, 'ADD_TO_COLLECTION')
      }
      hapticMedium()
      trackEvent(AnalyticsEvents.ADD_TO_COLLECTION, { fragrance_id: id, status, was_update: !!previousStatus })
      const voiced =
        isPromotion ? 'Acquired · +10 XP'
        : status === 'own' ? 'filed on your own shelf.'
        : status === 'wishlist' ? 'moved to your wishlist.'
        : status === 'sampled' ? 'marked as sampled.'
        : status === 'sold' ? 'released from the shelf.'
        : 'shelf updated.'
      showToast(voiced, 'success', isPromotion ? 'check_circle' : undefined)
    } catch {
      setCollectionStatus(previousStatus)
      showToast('could not update the shelf.', 'error')
    }
    setSaving(false)
  }, [user, id, collectionStatus, navigate, showToast])

  if (loading || !frag) {
    return (
      <main className="pt-24 pb-32 px-6 min-h-screen bg-background">
        {/* Skeleton loading — editorial hairline rows, no spinner */}
        <div className="space-y-8 max-w-[430px] mx-auto animate-pulse">
          <div className="h-px w-3/4" style={{ background: 'linear-gradient(to right, rgba(229,194,118,0.3) 0%, transparent 60%)' }} />
          <div className="h-4 w-1/3 bg-surface-container-highest/40 rounded-sm" />
          <div className="h-8 w-2/3 bg-surface-container-highest/40 rounded-sm" />
          <div className="h-px w-3/4" style={{ background: 'linear-gradient(to right, rgba(229,194,118,0.3) 0%, transparent 60%)' }} />
          <div className="h-4 w-1/2 bg-surface-container-highest/40 rounded-sm" />
          <div className="h-px w-3/4" style={{ background: 'linear-gradient(to right, rgba(229,194,118,0.3) 0%, transparent 60%)' }} />
        </div>
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

  // Top 3 accords as italic serif prose
  const topAccordsProse = accords.length
    ? `${accords.slice(0, 3).map((a) => a.name.toLowerCase()).join(', ')} — in that order.`
    : ''

  const seasons = rankedList(frag.season_ranking || null)
  const occasions = rankedList((frag.occasion_ranking || null)?.map((o) => ({
    name: o.name.replace(/_/g, ' '),
    score: o.score,
  })) || null)

  const longevityPct = frag.longevity ? Math.max(0, Math.min(100, Math.round((frag.longevity / 5) * 100))) : 0
  const sillagePct = frag.sillage ? Math.max(0, Math.min(100, Math.round((frag.sillage / 5) * 100))) : 0

  const kicker = 'text-[10px] font-bold tracking-[0.25em] text-primary/60 uppercase font-label'
  const hairline: CSSProperties = {
    background: 'linear-gradient(to right, rgba(229,194,118,0.4) 0%, rgba(229,194,118,0.1) 40%, transparent 100%)',
  }

  const ambientGlow = (position: string): CSSProperties => ({
    position: 'absolute',
    width: 300,
    height: 300,
    pointerEvents: 'none',
    opacity: 0.07,
    background: 'radial-gradient(circle, #e5c276 0%, transparent 70%)',
    filter: 'blur(80px)',
    ...(position === 'tl' ? { top: -50, left: -50 }
      : position === 'tr' ? { top: -50, right: -50 }
      : position === 'bl' ? { bottom: -50, left: -50 }
      : { bottom: -50, right: -50 }),
  })

  return (
    <main className="pb-24 relative overflow-hidden bg-background">
      {/* Ambient gold lifts — no lines, only light */}
      <div style={ambientGlow('tl')} />
      <div style={ambientGlow('tr')} />

      {/* ═══════════════════════════════════════════════════════
          DEPARTMENT 1 — THE PLATE
          The catalogue plate: brand sigil, editorial framing, no noise.
          ═══════════════════════════════════════════════════════ */}
      <section className="relative w-full aspect-[4/5] overflow-hidden">
        <FragranceImage
          src={frag.image_url}
          alt={`${frag.brand} ${frag.name}`}
          noteFamily={frag.note_family}
          size="lg"
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Vignette lift, no border */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-transparent to-transparent" />

        {/* Plate sigil — the house initial, italic serif, oversized */}
        <div className="absolute top-6 left-6 pointer-events-none">
          <span
            className="font-headline italic text-primary/25 leading-none select-none"
            style={{ fontSize: '140px' }}
          >
            {brandSigil(frag.brand)}
          </span>
        </div>

        {/* Back — typographic, no icon, no rounded-full */}
        <button
          onClick={() => navigate(-1)}
          aria-label="Return"
          className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center bg-surface/40 backdrop-blur-xl rounded-sm transition-colors hover:bg-surface/60"
        >
          <span className="font-headline text-on-background text-lg leading-none">←</span>
        </button>
      </section>

      {/* ═══════════════════════════════════════════════════════
          DEPARTMENT 2 — THE CAPTION
          The caption panel: house, title italic, year in roman, concentration.
          ═══════════════════════════════════════════════════════ */}
      <section className="px-8 pt-8 pb-6 relative">
        <p className={kicker}>The House</p>
        <p className="mt-2 text-xs font-semibold tracking-[0.15em] uppercase text-on-background/80">
          {frag.brand}
        </p>

        <h1 className="mt-4 font-headline italic text-5xl leading-[1.05] text-on-background tracking-tight">
          {frag.name}
        </h1>

        <div className="mt-4 flex items-baseline gap-3 text-secondary/70 text-xs italic font-headline">
          {frag.year_released != null && (
            <span className="tracking-widest">{yearToRoman(String(frag.year_released))}</span>
          )}
          {frag.year_released != null && frag.concentration && (
            <span className="text-primary/40">·</span>
          )}
          {frag.concentration && (
            <span className="tracking-[0.2em] uppercase text-[10px] font-label not-italic font-bold text-primary/70">
              {frag.concentration}
            </span>
          )}
        </div>

        {/* Gradient hairline rule — no 1px line */}
        <div className="mt-8 h-px" style={hairline} />
      </section>

      {/* ═══════════════════════════════════════════════════════
          DEPARTMENT 3 — THE DOSSIER
          The action row — italic serif text only. No icons, no circles.
          Add-to-shelf expands in place as a sub-row.
          ═══════════════════════════════════════════════════════ */}
      <section className="px-8 py-4 relative">
        <p className={kicker}>The Dossier</p>

        <div className="mt-4 flex items-baseline gap-6">
          {/* ARCHIVE — add to shelf */}
          <button
            onClick={() => {
              if (!user) { navigate('/profile'); return }
              setAddMenuOpen(!addMenuOpen)
            }}
            disabled={saving}
            aria-label={collectionStatus ? `Shelf: ${collectionStatus}` : 'File on a shelf'}
            className="group bg-transparent border-none"
          >
            <span className={`font-headline italic text-base transition-colors ${
              collectionStatus
                ? 'text-primary'
                : 'text-on-background/60 group-hover:text-on-background'
            }`}>
              {collectionStatus ? collectionStatus : 'archive'}
            </span>
          </button>

          <span className="text-primary/30 font-headline italic">·</span>

          {/* LOG */}
          <button
            onClick={() => setLogSheetOpen(true)}
            className="group bg-transparent border-none"
            aria-label="Log a wear"
          >
            <span className="font-headline italic text-base text-on-background/60 group-hover:text-on-background transition-colors">
              log
            </span>
          </button>

          <span className="text-primary/30 font-headline italic">·</span>

          {/* REVIEW */}
          <button
            onClick={() => {
              if (!user) { navigate('/profile'); return }
              setReviewSheetOpen(true)
            }}
            className="group bg-transparent border-none"
            aria-label="Write an appreciation"
          >
            <span className="font-headline italic text-base text-on-background/60 group-hover:text-on-background transition-colors">
              appraise
            </span>
          </button>

          <span className="text-primary/30 font-headline italic">·</span>

          {/* SHARE */}
          <button
            onClick={() => setShareCardOpen(true)}
            className="group bg-transparent border-none"
            aria-label="Share card"
          >
            <span className="font-headline italic text-base text-on-background/60 group-hover:text-on-background transition-colors">
              share
            </span>
          </button>
        </div>

        {/* Sub-row — add-to-shelf expanded in place */}
        {addMenuOpen && (
          <div className="mt-5 grid grid-cols-4 gap-2 animate-fade-in">
            {(['own', 'wishlist', 'sampled', 'sold'] as const).map((status) => (
              <button
                key={status}
                onClick={() => handleAddToCollection(status)}
                className={`py-2.5 rounded-sm text-[10px] font-label tracking-[0.15em] uppercase font-bold transition-all ${
                  collectionStatus === status
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container-highest/60 text-on-background/70 hover:text-on-background'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        )}

        <div className="mt-8 h-px" style={hairline} />
      </section>

      {/* ═══════════════════════════════════════════════════════
          THE PERFUME PYRAMID
          Visual pyramid with custom note icons — the shareable hero.
          ═══════════════════════════════════════════════════════ */}
      <FragranceNotesPyramid
        notesTop={frag.notes_top ?? undefined}
        notesHeart={frag.notes_heart ?? undefined}
        notesBase={frag.notes_base ?? undefined}
      />
      {(frag.notes_top?.length || frag.notes_heart?.length || frag.notes_base?.length) && (
        <div className="px-8"><div className="h-px" style={hairline} /></div>
      )}

      {/* ═══════════════════════════════════════════════════════
          DEPARTMENT 4 — THE COMPOSITION
          The accord radar, with italic serif gloss on what dominates.
          ═══════════════════════════════════════════════════════ */}
      {accords.length > 0 && (
        <section className="px-8 py-8 relative">
          <p className={kicker}>The Composition</p>
          <h2 className="mt-3 font-headline italic text-2xl text-on-background leading-tight">
            The signature reads as…
          </h2>
          <p className="mt-2 font-headline italic text-base text-primary/80 leading-relaxed">
            {topAccordsProse}
          </p>

          <div className="mt-6">
            <AccordsRadar accords={accords} />
          </div>

          <div className="mt-8 h-px" style={hairline} />
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════
          DEPARTMENT 5 — THE THREE MOVEMENTS
          Top / Heart / Base as italic prose, no boxes, no cards.
          ═══════════════════════════════════════════════════════ */}
      {(frag.notes_top?.length || frag.notes_heart?.length || frag.notes_base?.length) && (
        <section className="px-8 py-8 relative">
          <p className={kicker}>The Three Movements</p>
          <h2 className="mt-3 font-headline italic text-2xl text-on-background leading-tight">
            Read from the top.
          </h2>

          <div className="mt-6 space-y-6">
            {frag.notes_top && frag.notes_top.length > 0 && (
              <div>
                <p className="text-[9px] tracking-[0.3em] uppercase font-label font-bold text-primary/60">I. The Overture</p>
                <p className="mt-2 font-headline italic text-lg text-on-background/90 leading-relaxed">
                  {notesProse(frag.notes_top)}
                </p>
              </div>
            )}
            {frag.notes_heart && frag.notes_heart.length > 0 && (
              <div>
                <p className="text-[9px] tracking-[0.3em] uppercase font-label font-bold text-primary/60">II. The Heart</p>
                <p className="mt-2 font-headline italic text-lg text-on-background/90 leading-relaxed">
                  {notesProse(frag.notes_heart)}
                </p>
              </div>
            )}
            {frag.notes_base && frag.notes_base.length > 0 && (
              <div>
                <p className="text-[9px] tracking-[0.3em] uppercase font-label font-bold text-primary/60">III. The Drydown</p>
                <p className="mt-2 font-headline italic text-lg text-on-background/90 leading-relaxed">
                  {notesProse(frag.notes_base)}
                </p>
              </div>
            )}
          </div>

          <div className="mt-8 h-px" style={hairline} />
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════
          DEPARTMENT 6 — THE READINGS
          Longevity & sillage: italic serif words, sharp-edge 2px bars.
          ═══════════════════════════════════════════════════════ */}
      {(frag.longevity != null || frag.sillage != null) && (
        <section className="px-8 py-8 relative">
          <p className={kicker}>The Readings</p>

          <div className="mt-5 grid grid-cols-2 gap-8">
            {frag.longevity != null && (
              <div>
                <p className="text-[10px] tracking-[0.25em] uppercase font-label font-bold text-on-background/50">Longevity</p>
                <p className="mt-2 font-headline italic text-2xl text-on-background leading-tight">
                  {longevityWord(frag.longevity)}
                </p>
                {/* Sharp-edge 2px bar — no rounded-full */}
                <div className="mt-4 h-[2px] w-full bg-surface-container-highest/50 relative overflow-hidden">
                  <div
                    className="absolute left-0 top-0 h-full bg-gradient-to-r from-primary/80 to-primary"
                    style={{ width: `${longevityPct}%` }}
                  />
                </div>
              </div>
            )}
            {frag.sillage != null && (
              <div>
                <p className="text-[10px] tracking-[0.25em] uppercase font-label font-bold text-on-background/50">Sillage</p>
                <p className="mt-2 font-headline italic text-2xl text-on-background leading-tight">
                  {sillageWord(frag.sillage)}
                </p>
                <div className="mt-4 h-[2px] w-full bg-surface-container-highest/50 relative overflow-hidden">
                  <div
                    className="absolute left-0 top-0 h-full bg-gradient-to-r from-primary/80 to-primary"
                    style={{ width: `${sillagePct}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="mt-10 h-px" style={hairline} />
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════
          DEPARTMENT 7 — A NOTE ON OCCASION
          Season & occasion as italic prose with opacity spans.
          ═══════════════════════════════════════════════════════ */}
      {(seasons.length > 0 || occasions.length > 0) && (
        <section className="px-8 py-8 relative">
          <p className={kicker}>A Note on Occasion</p>
          <h2 className="mt-3 font-headline italic text-2xl text-on-background leading-tight">
            When to wear it.
          </h2>

          {seasons.length > 0 && (
            <p className="mt-5 font-headline italic text-lg leading-relaxed">
              <span className="text-primary/60 not-italic text-[10px] font-label font-bold tracking-[0.25em] uppercase mr-2">Season</span>
              {seasons.map((s, i) => (
                <span
                  key={s.name}
                  className={
                    s.opacity === 'high' ? 'text-on-background'
                    : s.opacity === 'mid' ? 'text-on-background/55'
                    : 'text-on-background/25'
                  }
                >
                  {s.name}{i < seasons.length - 1 ? ', ' : '.'}
                </span>
              ))}
            </p>
          )}

          {occasions.length > 0 && (
            <p className="mt-4 font-headline italic text-lg leading-relaxed">
              <span className="text-primary/60 not-italic text-[10px] font-label font-bold tracking-[0.25em] uppercase mr-2">Occasion</span>
              {occasions.map((o, i) => (
                <span
                  key={o.name}
                  className={
                    o.opacity === 'high' ? 'text-on-background'
                    : o.opacity === 'mid' ? 'text-on-background/55'
                    : 'text-on-background/25'
                  }
                >
                  {o.name}{i < occasions.length - 1 ? ', ' : '.'}
                </span>
              ))}
            </p>
          )}

          <div className="mt-8 h-px" style={hairline} />
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════
          DEPARTMENT 8 — FILED BY THE HOUSE
          Aesthetic tags as italic serif prose, not pill chips.
          ═══════════════════════════════════════════════════════ */}
      {tags.length > 0 && (
        <section className="px-8 py-8 relative">
          <p className={kicker}>Filed by the House</p>
          <p className="mt-4 font-headline italic text-xl text-on-background/90 leading-relaxed">
            {tagsProse(tags)}
          </p>
          <div className="mt-8 h-px" style={hairline} />
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════
          DEPARTMENT 9 — FILED BY THE KEEPER
          User's personal tags — inline italic serif input, gradient hairline.
          ═══════════════════════════════════════════════════════ */}
      {user && collectionStatus && (
        <section className="px-8 py-8 relative">
          <p className={kicker}>Filed by the Keeper</p>
          <p className="mt-3 text-xs italic text-on-background/50 font-headline">
            your private annotations, for this bottle alone.
          </p>

          {userTags.length > 0 && (
            <p className="mt-4 font-headline italic text-lg leading-relaxed text-on-background/85">
              {userTags.map((t, i) => (
                <span key={t}>
                  {t.toLowerCase()}
                  {i < userTags.length - 1 ? ', ' : '.'}
                  {' '}
                  <button
                    onClick={() => setUserTags(userTags.filter((x) => x !== t))}
                    className="align-baseline not-italic text-[10px] tracking-widest uppercase text-primary/50 hover:text-primary/80 transition-colors"
                    aria-label={`Remove ${t}`}
                  >
                    ×
                  </button>
                  {i < userTags.length - 1 && ' '}
                </span>
              ))}
            </p>
          )}

          <form
            className="mt-5 flex items-baseline gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              const next = tagDraft.trim().toLowerCase()
              if (next && !userTags.includes(next) && userTags.length < 15) {
                setUserTags([...userTags, next])
              }
              setTagDraft('')
            }}
          >
            <span className="text-primary/50 font-headline italic text-lg">+</span>
            <input
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              placeholder="a word of your own…"
              className="flex-1 bg-transparent py-1 font-headline italic text-lg text-on-background placeholder:text-on-background/30 focus:outline-none transition-colors"
              style={{
                border: 'none',
                borderBottom: 'none',
                backgroundImage: 'linear-gradient(to right, rgba(229,194,118,0.25) 0%, rgba(229,194,118,0.08) 50%, transparent 100%)',
                backgroundSize: '100% 1px',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'bottom',
              }}
              maxLength={30}
            />
          </form>

          <div className="mt-8 h-px" style={hairline} />
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════
          DEPARTMENT 10 — KINDRED WORKS
          Similar fragrances — horizontal catalogue rail with
          italic serif reason line. No percentage badge.
          ═══════════════════════════════════════════════════════ */}
      {!similarLoading && similarFragrances.length > 0 && (
        <section className="px-8 py-8 relative">
          <p className={kicker}>Kindred Works</p>
          <h2 className="mt-3 font-headline italic text-2xl text-on-background leading-tight">
            Also in the drawer…
          </h2>

          <div className="mt-6 -mx-8 px-8 flex gap-5 overflow-x-auto no-scrollbar pb-3">
            {similarFragrances.map((sr, kidx) => {
              const thumb = kindredThumbs[sr.fragrance.id] ?? null
              const goKindred = () => {
                trackEvent(AnalyticsEvents.RECOMMENDER_CLICK, {
                  source: 'kindred_works',
                  position: kidx,
                  fragrance_id: sr.fragrance.id,
                })
                navigate(`/fragrance/${sr.fragrance.id}`)
              }
              return (
                <div
                  key={sr.fragrance.id}
                  role="button"
                  tabIndex={0}
                  onClick={goKindred}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      goKindred()
                    }
                  }}
                  className="flex-shrink-0 w-[140px] text-left transition-opacity hover:opacity-80 group cursor-pointer"
                >
                  <div className="relative aspect-[3/4] rounded-sm overflow-hidden bg-surface-container-low mb-3">
                    <FragranceImage
                      src={sr.fragrance.image_url}
                      alt={sr.fragrance.name}
                      noteFamily={sr.fragrance.note_family}
                      size="md"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent" />
                    {kindredAuthed && (
                      <div className="absolute bottom-1.5 right-1.5 flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          aria-label="More like this"
                          aria-pressed={thumb === 'up'}
                          onClick={(e) => { e.stopPropagation(); void setKindredThumb(sr.fragrance.id, 'up') }}
                          className={`w-6 h-6 grid place-items-center rounded-full backdrop-blur-sm transition-colors ${
                            thumb === 'up'
                              ? 'bg-background/80 text-primary'
                              : 'bg-background/40 text-on-background/60 hover:text-on-background'
                          }`}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M7 10v12" />
                            <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H7V10l4.34-8.66a1.93 1.93 0 0 1 3.66.54Z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          aria-label="Less like this"
                          aria-pressed={thumb === 'down'}
                          onClick={(e) => { e.stopPropagation(); void setKindredThumb(sr.fragrance.id, 'down') }}
                          className={`w-6 h-6 grid place-items-center rounded-full backdrop-blur-sm transition-colors ${
                            thumb === 'down'
                              ? 'bg-background/80 text-primary'
                              : 'bg-background/40 text-on-background/60 hover:text-on-background'
                          }`}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M17 14V2" />
                            <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H17v12l-4.34 8.66a1.93 1.93 0 0 1-3.66-.54Z" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="text-[9px] uppercase tracking-[0.2em] font-label font-bold text-primary/60">{sr.fragrance.brand}</p>
                  <p className="mt-1 font-headline italic text-base text-on-background leading-tight">{sr.fragrance.name}</p>
                  {sr.reasons.length > 0 && (
                    <p className="mt-1.5 font-headline italic text-[11px] text-on-background/50 leading-snug">
                      {sr.reasons[0].toLowerCase()}.
                    </p>
                  )}
                </div>
              )
            })}
          </div>

          <div className="mt-8 h-px" style={hairline} />
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════
          DEPARTMENT 11 — THE RECEPTION
          Reviews as editorial blockquotes. IV/V roman rating.
          Sort row in italic serif words. Edit/delete as italic words.
          ═══════════════════════════════════════════════════════ */}
      {reviews.length > 0 && (
        <section className="px-8 py-8 relative">
          <p className={kicker}>The Reception</p>
          <h2 className="mt-3 font-headline italic text-2xl text-on-background leading-tight">
            {reviews.length === 1 ? 'one appreciation.' : `${reviews.length} appreciations.`}
          </h2>

          {/* Sort row — italic serif words, not pills */}
          <div className="mt-5 flex items-baseline gap-4 text-xs font-headline italic">
            <span className="text-primary/50 not-italic text-[10px] font-label font-bold tracking-[0.25em] uppercase">Order</span>
            {([
              { key: 'newest', label: 'newest' },
              { key: 'oldest', label: 'oldest' },
              { key: 'highest', label: 'highest' },
              { key: 'lowest', label: 'lowest' },
            ] as { key: ReviewSortOption; label: string }[]).map((opt) => (
              <button
                key={opt.key}
                onClick={() => setReviewSort(opt.key)}
                className={`transition-colors ${
                  reviewSort === opt.key
                    ? 'text-primary'
                    : 'text-on-background/40 hover:text-on-background/70'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="mt-8 space-y-10">
            {reviews.map((review) => {
              const isOwner = ownerIds.has(review.user_id)
              const canEdit = user?.id === review.user_id
              const ratingRoman = review.overall_rating != null ? toRomanOutOfFive(review.overall_rating) : ''
              const yearRoman = review.created_at ? yearToRoman(review.created_at) : ''
              const byline = (review as unknown as { user_name?: string }).user_name || 'a keeper'
              return (
                <blockquote key={review.id} className="relative">
                  {/* Opening quote mark, italic serif */}
                  <span
                    aria-hidden="true"
                    className="absolute -top-4 -left-2 font-headline italic text-primary/15 select-none pointer-events-none"
                    style={{ fontSize: '48px', lineHeight: 1 }}
                  >
                    &ldquo;
                  </span>

                  {review.review_text && (
                    <p className="relative font-headline italic text-lg text-on-background/90 leading-relaxed">
                      {review.review_text}
                    </p>
                  )}

                  <footer className="mt-4 flex items-baseline gap-3 text-[11px] font-headline italic text-on-background/50">
                    <span className="not-italic text-[10px] font-label font-bold tracking-[0.2em] uppercase text-primary/60">
                      — {byline}
                    </span>
                    {isOwner && (
                      <span className="not-italic text-[9px] tracking-widest uppercase text-primary/50">
                        · keeper of this bottle
                      </span>
                    )}
                    {yearRoman && <span className="tracking-widest">· {yearRoman}</span>}
                    {ratingRoman && (
                      <span className="ml-auto tracking-widest text-primary/70">{ratingRoman}</span>
                    )}
                  </footer>

                  {canEdit && (
                    <div className="mt-3 flex items-baseline gap-4 text-[11px] font-headline italic">
                      <button
                        onClick={() => setEditingReview(review)}
                        className="text-primary/60 hover:text-primary transition-colors"
                      >
                        revise
                      </button>
                      <button
                        onClick={() => {
                          deleteReview(review.id)
                          showToast('appreciation withdrawn.', 'success')
                        }}
                        className="text-on-background/40 hover:text-on-background/70 transition-colors"
                      >
                        withdraw
                      </button>
                    </div>
                  )}
                </blockquote>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Floating sheets — preserved exactly ── */}
      <LogWearSheet isOpen={logSheetOpen} onClose={() => setLogSheetOpen(false)} fragrance={frag} />
      <ReviewSheet
        isOpen={reviewSheetOpen}
        onClose={() => setReviewSheetOpen(false)}
        fragrance={frag}
        isOwner={collectionStatus === 'own'}
        onSubmitted={refetchReviews}
        onEditExisting={(existing) => setEditingReview(existing)}
      />
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
    </main>
  )
}
