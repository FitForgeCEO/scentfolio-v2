import { useState, useEffect } from 'react'
import { Icon } from '../ui/Icon'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { useUpdateReview } from '@/hooks/useReviewEnhancements'
import type { Review } from '@/types/database'

const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter']
const OCCASIONS = ['Casual', 'Office', 'Date Night', 'Night Out', 'Special Event']

interface EditReviewSheetProps {
  isOpen: boolean
  onClose: () => void
  review: Review
  onUpdated?: () => void
}

function StarRating({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-[10px] uppercase tracking-[0.15em] text-secondary font-bold">{label}</span>
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star === value ? 0 : star)}
            className="p-0.5 active:scale-110 transition-transform"
          >
            <Icon
              name="star"
              filled={star <= value}
              className={`text-xl ${star <= value ? 'text-primary' : 'text-surface-container-highest'}`}
            />
          </button>
        ))}
      </div>
    </div>
  )
}

export function EditReviewSheet({ isOpen, onClose, review, onUpdated }: EditReviewSheetProps) {
  const trapRef = useFocusTrap(isOpen, onClose)
  const { updateReview, updating, error } = useUpdateReview(onUpdated)

  const [overall, setOverall] = useState(review.overall_rating)
  const [longevity, setLongevity] = useState(review.longevity_rating ?? 0)
  const [sillage, setSillage] = useState(review.sillage_rating ?? 0)
  const [scent, setScent] = useState(review.scent_rating ?? 0)
  const [valueRating, setValueRating] = useState(review.value_rating ?? 0)
  const [title, setTitle] = useState(review.title ?? '')
  const [reviewText, setReviewText] = useState(review.review_text ?? '')
  const [selectedSeasons, setSelectedSeasons] = useState<string[]>(review.season_tags ?? [])
  const [selectedOccasions, setSelectedOccasions] = useState<string[]>(review.occasion_tags ?? [])
  const [wouldRecommend, setWouldRecommend] = useState<boolean | null>(review.would_recommend ?? null)
  const [success, setSuccess] = useState(false)

  // Reset form when review changes
  useEffect(() => {
    if (isOpen) {
      setOverall(review.overall_rating)
      setLongevity(review.longevity_rating ?? 0)
      setSillage(review.sillage_rating ?? 0)
      setScent(review.scent_rating ?? 0)
      setValueRating(review.value_rating ?? 0)
      setTitle(review.title ?? '')
      setReviewText(review.review_text ?? '')
      setSelectedSeasons(review.season_tags ?? [])
      setSelectedOccasions(review.occasion_tags ?? [])
      setWouldRecommend(review.would_recommend ?? null)
      setSuccess(false)
    }
  }, [isOpen, review])

  if (!isOpen) return null

  const canSubmit = overall > 0 && !updating

  const toggleTag = (tag: string, list: string[], setter: (v: string[]) => void) => {
    setter(list.includes(tag) ? list.filter((t) => t !== tag) : [...list, tag])
  }

  const handleSubmit = async () => {
    if (!canSubmit) return

    const ok = await updateReview(review.id, {
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

    if (ok) {
      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
        onClose()
      }, 1000)
    }
  }

  return (
    <div ref={trapRef} className="fixed inset-0 z-[var(--z-sheet)] flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="Edit review">
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
            <h1 className="text-3xl font-headline font-bold text-on-surface leading-tight">Edit Review</h1>
            <p className="text-[10px] text-secondary/60 mt-1">Update your thoughts on this fragrance</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center text-on-surface-variant active:scale-90 transition-transform"
          >
            <Icon name="close" size={20} />
          </button>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-8 space-y-7 pb-10">
          {/* Overall Rating */}
          <div className="space-y-4">
            <label className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">
              Overall Rating <span className="text-red-400">*</span>
            </label>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setOverall(star === overall ? 0 : star)}
                  className="p-1 active:scale-110 transition-transform"
                >
                  <Icon
                    name="star"
                    filled={star <= overall}
                    className={`text-3xl ${star <= overall ? 'text-primary' : 'text-surface-container-highest'}`}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Sub-ratings */}
          <div className="space-y-4 bg-surface-container p-5 rounded-2xl">
            <StarRating label="Scent" value={scent} onChange={setScent} />
            <StarRating label="Longevity" value={longevity} onChange={setLongevity} />
            <StarRating label="Sillage" value={sillage} onChange={setSillage} />
            <StarRating label="Value" value={valueRating} onChange={setValueRating} />
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
              className="w-full bg-surface-container border-none text-on-surface placeholder:text-on-surface-variant/40 rounded-2xl px-4 py-3.5 text-sm focus:ring-1 focus:ring-primary/30 focus:outline-none"
            />
          </div>

          {/* Review Text */}
          <div className="space-y-3">
            <label className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">Your Review</label>
            <textarea
              className="w-full bg-surface-container border-none text-on-surface placeholder:text-on-surface-variant/40 rounded-2xl p-4 text-sm focus:ring-1 focus:ring-primary/30 focus:outline-none resize-none"
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
                  className={`px-4 py-2.5 rounded-full text-xs transition-colors ${
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
                  className={`px-4 py-2.5 rounded-full text-xs transition-colors ${
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
                className={`flex-1 py-3 rounded-full text-xs font-bold tracking-wider flex items-center justify-center gap-2 transition-all ${
                  wouldRecommend === true
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container-highest text-on-surface-variant'
                }`}
              >
                <Icon name="thumb_up" size={16} />
                YES
              </button>
              <button
                type="button"
                onClick={() => setWouldRecommend(wouldRecommend === false ? null : false)}
                className={`flex-1 py-3 rounded-full text-xs font-bold tracking-wider flex items-center justify-center gap-2 transition-all ${
                  wouldRecommend === false
                    ? 'bg-red-500/80 text-white'
                    : 'bg-surface-container-highest text-on-surface-variant'
                }`}
              >
                <Icon name="thumb_down" size={16} />
                NO
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div role="alert" className="bg-red-500/10 text-red-400 text-xs font-medium px-4 py-3 rounded-xl text-center">
              {error}
            </div>
          )}

          {/* Submit */}
          <div className="pt-2">
            {success ? (
              <div role="status" aria-live="polite" className="w-full py-4 bg-primary/20 text-primary font-bold uppercase tracking-[0.15em] rounded-2xl text-center flex items-center justify-center gap-2">
                <Icon name="check_circle" filled className="text-xl" />
                REVIEW UPDATED!
              </div>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="w-full py-4 gold-gradient text-on-primary font-bold uppercase tracking-[0.15em] rounded-2xl ambient-glow active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {updating ? 'SAVING...' : 'SAVE CHANGES'}
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
