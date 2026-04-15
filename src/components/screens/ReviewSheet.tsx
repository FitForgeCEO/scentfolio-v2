import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { awardXP } from '@/lib/xp'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import type { Fragrance, Review } from '@/types/database'

const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter']
const OCCASIONS = ['Casual', 'Office', 'Date Night', 'Night Out', 'Special Event']
const ROMAN = ['I', 'II', 'III', 'IV', 'V'] as const

interface ReviewSheetProps {
  isOpen: boolean
  onClose: () => void
  fragrance: Fragrance
  isOwner: boolean
  onSubmitted?: () => void
  /**
   * Called when the keeper confirms they want to edit their existing review.
   * The fresh row is fetched directly by ReviewSheet's pre-check and handed
   * back here so the parent doesn't have to hunt for it in a (possibly
   * paginated or stale) local reviews list.
   */
  onEditExisting?: (existing: Review) => void
}

function RomanRating({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-[10px] uppercase tracking-[0.15em] text-secondary font-bold">{label}</span>
      <div className="flex gap-1">
        {ROMAN.map((numeral, i) => {
          const star = i + 1
          return (
            <button
              key={numeral}
              type="button"
              onClick={() => onChange(star === value ? 0 : star)}
              className={`w-7 h-7 flex items-center justify-center rounded-sm text-xs font-serif italic transition-opacity hover:opacity-80 ${
                star <= value
                  ? 'text-primary bg-primary/15 font-bold'
                  : 'text-surface-container-highest bg-transparent'
              }`}
            >
              {numeral}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function ReviewSheet({ isOpen, onClose, fragrance, isOwner, onSubmitted, onEditExisting }: ReviewSheetProps) {
  const { user } = useAuth()
  const trapRef = useFocusTrap(isOpen, onClose)
  const [isDuplicate, setIsDuplicate] = useState(false)
  const [checkingExisting, setCheckingExisting] = useState(true)
  const [existingReview, setExistingReview] = useState<Review | null>(null)
  const hasExistingReview = existingReview !== null
  const [overall, setOverall] = useState(0)
  const [longevity, setLongevity] = useState(0)
  const [sillage, setSillage] = useState(0)
  const [scent, setScent] = useState(0)
  const [valueRating, setValueRating] = useState(0)
  const [title, setTitle] = useState('')
  const [reviewText, setReviewText] = useState('')
  const [selectedSeasons, setSelectedSeasons] = useState<string[]>([])
  const [selectedOccasions, setSelectedOccasions] = useState<string[]>([])
  const [wouldRecommend, setWouldRecommend] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Pre-check for existing review when sheet opens, so we don't make the user
  // fill the whole form just to discover a unique-constraint violation. We
  // fetch the full row (not just `id`) so the Edit CTA can hand it straight
  // to EditReviewSheet without re-querying or depending on a paginated
  // `reviews` list in the parent.
  useEffect(() => {
    if (!isOpen || !user) {
      setCheckingExisting(false)
      return
    }
    let cancelled = false
    setCheckingExisting(true)
    setExistingReview(null)
    supabase
      .from('reviews')
      .select('*')
      .eq('user_id', user.id)
      .eq('fragrance_id', fragrance.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        setExistingReview((data as Review | null) ?? null)
        setCheckingExisting(false)
      })
    return () => { cancelled = true }
  }, [isOpen, user, fragrance.id])

  if (!isOpen) return null

  const canSubmit = overall > 0 && !saving

  const toggleTag = (tag: string, list: string[], setter: (v: string[]) => void) => {
    setter(list.includes(tag) ? list.filter((t) => t !== tag) : [...list, tag])
  }

  const handleSubmit = async () => {
    if (!user || !canSubmit) return
    setSaving(true)
    setError(null)

    const { error: insertError } = await supabase.from('reviews').insert({
      user_id: user.id,
      fragrance_id: fragrance.id,
      overall_rating: overall,
      longevity_rating: longevity || null,
      sillage_rating: sillage || null,
      scent_rating: scent || null,
      value_rating: valueRating || null,
      title: title.trim() || null,
      review_text: reviewText.trim() || null,
      season_tags: selectedSeasons.length > 0 ? selectedSeasons : null,
      occasion_tags: selectedOccasions.length > 0 ? selectedOccasions : null,
      would_recommend: wouldRecommend,
    })

    setSaving(false)

    if (insertError) {
      if (insertError.code === '23505') {
        setIsDuplicate(true)
        setError("You've already written a review for this fragrance.")
        // Race-safe fetch: the pre-check didn't catch this row (sheet was
        // already open when it was written elsewhere), so grab it now so
        // the Edit CTA has something real to hand to EditReviewSheet.
        const { data: raced } = await supabase
          .from('reviews')
          .select('*')
          .eq('user_id', user.id)
          .eq('fragrance_id', fragrance.id)
          .maybeSingle()
        if (raced) setExistingReview(raced as Review)
      } else {
        setIsDuplicate(false)
        setError('Something went wrong. Please try again.')
      }
      return
    }
    setIsDuplicate(false)

    // Award XP
    await awardXP(user.id, 'WRITE_REVIEW')

    setSuccess(true)
    setTimeout(() => {
      setSuccess(false)
      onSubmitted?.()
      onClose()
      // Reset form
      setOverall(0)
      setLongevity(0)
      setSillage(0)
      setScent(0)
      setValueRating(0)
      setTitle('')
      setReviewText('')
      setSelectedSeasons([])
      setSelectedOccasions([])
      setWouldRecommend(null)
    }, 1200)
  }

  return (
    <div ref={trapRef} className="fixed inset-0 z-[var(--z-sheet)] flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="Write a review">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Sheet */}
      <section className="relative w-full max-h-[85vh] bg-surface-container-low rounded-t-[2.5rem] sheet-shadow flex flex-col overflow-hidden animate-slide-up">
        {/* Drag Handle */}
        <div className="flex justify-center py-4">
          <div className="w-12 h-1 bg-surface-container-highest rounded-full" />
        </div>

        {/* Header */}
        <header className="px-8 pb-4 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-headline font-bold text-on-surface leading-tight">Write a Review</h1>
            {isOwner && (
              <div className="flex items-center gap-1.5 mt-2">
                <span className="text-primary text-sm italic">✦</span>
                <span className="text-[9px] uppercase tracking-[0.15em] text-primary font-bold">Verified Owner</span>
              </div>
            )}
            {!isOwner && (
              <p className="text-[10px] text-secondary/60 mt-1 italic">
                Add this to your collection to earn the verified badge
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-10 h-10 rounded-sm bg-surface-container-highest flex items-center justify-center text-on-surface-variant transition-opacity hover:opacity-80"
          >
            <span className="text-sm">×</span>
          </button>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-8 space-y-7 pb-10">
          {checkingExisting ? (
            <div className="py-16 flex items-center justify-center">
              <p className="font-headline italic text-on-surface-variant/50 text-sm">Checking…</p>
            </div>
          ) : hasExistingReview ? (
            <div className="py-8 space-y-6 text-center">
              <div className="flex items-center gap-4 bg-surface-container p-4 rounded-sm text-left">
                <div className="w-12 h-12 bg-surface-container-highest rounded-sm overflow-hidden flex-shrink-0">
                  {fragrance.image_url ? (
                    <img src={fragrance.image_url} alt={fragrance.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-secondary/30 text-xs italic">—</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.15em] text-primary font-bold">{fragrance.brand}</p>
                  <h3 className="text-lg font-headline text-on-surface truncate">{fragrance.name}</h3>
                </div>
              </div>

              <div className="space-y-3 pt-4">
                <span className="text-[10px] tracking-[0.3em] text-primary/60 uppercase">Already on the page</span>
                <div className="w-10 h-px bg-primary/30 mx-auto" />
                <p className="font-headline italic text-on-surface/80 text-base leading-relaxed max-w-xs mx-auto">
                  You've written a review for this one.
                </p>
              </div>

              <div className="pt-4 space-y-3">
                {onEditExisting && existingReview && (
                  <button
                    type="button"
                    onClick={() => {
                      const row = existingReview
                      onClose()
                      onEditExisting(row)
                    }}
                    className="w-full py-4 gold-gradient text-on-primary font-bold uppercase tracking-[0.15em] rounded-sm ambient-glow transition-opacity hover:opacity-90"
                  >
                    EDIT YOUR REVIEW
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="font-headline italic text-sm text-on-surface-variant/60 hover:text-on-surface transition-colors"
                >
                  close
                </button>
              </div>
            </div>
          ) : (
          <>
          {/* Fragrance Card */}
          <div className="flex items-center gap-4 bg-surface-container p-4 rounded-sm">
            <div className="w-12 h-12 bg-surface-container-highest rounded-sm overflow-hidden flex-shrink-0">
              {fragrance.image_url ? (
                <img src={fragrance.image_url} alt={fragrance.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-secondary/30 text-xs italic">—</span>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-[0.15em] text-primary font-bold">{fragrance.brand}</p>
              <h3 className="text-lg font-headline text-on-surface truncate">{fragrance.name}</h3>
            </div>
          </div>

          {/* Overall Rating (required) — roman numeral selector */}
          <div className="space-y-4">
            <label className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">
              Overall Rating <span className="text-red-400">*</span>
            </label>
            <div className="flex justify-center gap-2">
              {ROMAN.map((numeral, i) => {
                const star = i + 1
                return (
                  <button
                    key={numeral}
                    type="button"
                    onClick={() => setOverall(star === overall ? 0 : star)}
                    className={`w-10 h-10 flex items-center justify-center rounded-sm text-base font-serif italic transition-opacity hover:opacity-80 ${
                      star <= overall
                        ? 'text-primary bg-primary/15 font-bold'
                        : 'text-surface-container-highest bg-surface-container'
                    }`}
                  >
                    {numeral}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Sub-ratings */}
          <div className="space-y-4 bg-surface-container p-5 rounded-sm">
            <RomanRating label="Scent" value={scent} onChange={setScent} />
            <RomanRating label="Longevity" value={longevity} onChange={setLongevity} />
            <RomanRating label="Sillage" value={sillage} onChange={setSillage} />
            <RomanRating label="Value" value={valueRating} onChange={setValueRating} />
          </div>

          {/* Title */}
          <div className="space-y-3">
            <label className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Sum it up in a few words..."
              maxLength={100}
              className="w-full bg-surface-container border-none text-on-surface placeholder:text-on-surface-variant/40 rounded-sm px-4 py-3.5 text-sm focus:ring-1 focus:ring-primary/30 focus:outline-none"
            />
          </div>

          {/* Review Text */}
          <div className="space-y-3">
            <label className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">Your Review</label>
            <textarea
              className="w-full bg-surface-container border-none text-on-surface placeholder:text-on-surface-variant/40 rounded-sm p-4 text-sm focus:ring-1 focus:ring-primary/30 focus:outline-none resize-none"
              placeholder="What do you love (or not) about this fragrance?"
              rows={4}
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
            />
          </div>

          {/* Season Tags */}
          <div className="space-y-3">
            <label className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">Best Seasons</label>
            <div className="flex flex-wrap gap-2">
              {SEASONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleTag(s.toLowerCase(), selectedSeasons, setSelectedSeasons)}
                  className={`px-4 py-2.5 rounded-sm text-xs transition-colors ${
                    selectedSeasons.includes(s.toLowerCase())
                      ? 'bg-primary text-on-primary font-semibold'
                      : 'bg-surface-container-highest text-on-surface-variant'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Occasion Tags */}
          <div className="space-y-3">
            <label className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">Best Occasions</label>
            <div className="flex flex-wrap gap-2">
              {OCCASIONS.map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => toggleTag(o.toLowerCase().replace(/ /g, '_'), selectedOccasions, setSelectedOccasions)}
                  className={`px-4 py-2.5 rounded-sm text-xs transition-colors ${
                    selectedOccasions.includes(o.toLowerCase().replace(/ /g, '_'))
                      ? 'bg-primary text-on-primary font-semibold'
                      : 'bg-surface-container-highest text-on-surface-variant'
                  }`}
                >
                  {o}
                </button>
              ))}
            </div>
          </div>

          {/* Would Recommend */}
          <div className="space-y-3">
            <label className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">Would You Recommend?</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setWouldRecommend(wouldRecommend === true ? null : true)}
                className={`flex-1 py-3 rounded-sm text-xs font-bold tracking-wider flex items-center justify-center gap-2 transition-opacity hover:opacity-80 ${
                  wouldRecommend === true
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container-highest text-on-surface-variant'
                }`}
              >
                YES
              </button>
              <button
                type="button"
                onClick={() => setWouldRecommend(wouldRecommend === false ? null : false)}
                className={`flex-1 py-3 rounded-sm text-xs font-bold tracking-wider flex items-center justify-center gap-2 transition-opacity hover:opacity-80 ${
                  wouldRecommend === false
                    ? 'bg-red-500/80 text-white'
                    : 'bg-surface-container-highest text-on-surface-variant'
                }`}
              >
                NO
              </button>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div
              role="alert"
              className={`text-xs font-medium px-4 py-3 rounded-sm text-center ${
                isDuplicate ? 'bg-primary/10 text-primary' : 'bg-red-500/10 text-red-400'
              }`}
            >
              <p>{error}</p>
              {isDuplicate && onEditExisting && existingReview && (
                <button
                  type="button"
                  onClick={() => {
                    const row = existingReview
                    onClose()
                    onEditExisting(row)
                  }}
                  className="mt-2 inline-block font-bold tracking-[0.15em] uppercase text-[10px] underline underline-offset-4 hover:opacity-80 transition-opacity"
                >
                  Edit your review
                </button>
              )}
              {isDuplicate && (!onEditExisting || !existingReview) && (
                <p className="mt-1 italic opacity-80">You can edit it from the fragrance page.</p>
              )}
            </div>
          )}

          {/* Submit */}
          <div className="pt-2 flex flex-col items-center gap-4">
            {success ? (
              <div role="status" aria-live="polite" className="w-full py-4 bg-primary/20 text-primary font-bold uppercase tracking-[0.15em] rounded-sm text-center flex items-center justify-center gap-2">
                <span className="text-lg">✓</span>
                REVIEW SUBMITTED!
              </div>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="w-full py-4 gold-gradient text-on-primary font-bold uppercase tracking-[0.15em] rounded-sm ambient-glow transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {saving ? 'SUBMITTING...' : !user ? 'SIGN IN TO REVIEW' : 'SUBMIT REVIEW'}
              </button>
            )}
            {isOwner && (
              <div className="flex items-center gap-2">
                <span className="text-primary text-sm italic">✦</span>
                <span className="text-[10px] font-bold tracking-[0.1em] text-primary">VERIFIED OWNER REVIEW</span>
              </div>
            )}
          </div>
          </>
          )}
        </div>
      </section>
    </div>
  )
}
