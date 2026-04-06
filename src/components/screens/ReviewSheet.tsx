import { useState } from 'react'
import { Icon } from '../ui/Icon'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { awardXP, XP_AWARDS } from '@/lib/xp'
import type { Fragrance } from '@/types/database'

const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter']
const OCCASIONS = ['Casual', 'Office', 'Date Night', 'Night Out', 'Special Event']

interface ReviewSheetProps {
  isOpen: boolean
  onClose: () => void
  fragrance: Fragrance
  isOwner: boolean
  onSubmitted?: () => void
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

export function ReviewSheet({ isOpen, onClose, fragrance, isOwner, onSubmitted }: ReviewSheetProps) {
  const { user } = useAuth()
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
        setError("You've already reviewed this fragrance.")
      } else {
        setError('Something went wrong. Please try again.')
      }
      return
    }

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
    <div className="fixed inset-0 z-[60] flex flex-col justify-end">
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
                <Icon name="verified" filled className="text-primary text-sm" />
                <span className="text-[9px] uppercase tracking-[0.15em] text-primary font-bold">Verified Owner</span>
              </div>
            )}
            {!isOwner && (
              <p className="text-[10px] text-secondary/60 mt-1">
                Add this to your collection to get the verified badge
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center text-on-surface-variant active:scale-90 transition-transform"
          >
            <Icon name="close" size={20} />
          </button>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-8 space-y-7 pb-10">
          {/* Fragrance Card */}
          <div className="flex items-center gap-4 bg-surface-container p-4 rounded-2xl">
            <div className="w-12 h-12 bg-surface-container-highest rounded-lg overflow-hidden flex-shrink-0">
              {fragrance.image_url ? (
                <img src={fragrance.image_url} alt={fragrance.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Icon name="water_drop" className="text-secondary/30" size={20} />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-[0.15em] text-primary font-bold">{fragrance.brand}</p>
              <h3 className="text-lg font-headline text-on-surface truncate">{fragrance.name}</h3>
            </div>
          </div>

          {/* Overall Rating (required) */}
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

          {/* Error message */}
          {error && (
            <div className="bg-red-500/10 text-red-400 text-xs font-medium px-4 py-3 rounded-xl text-center">
              {error}
            </div>
          )}

          {/* Submit */}
          <div className="pt-2 flex flex-col items-center gap-4">
            {success ? (
              <div className="w-full py-4 bg-primary/20 text-primary font-bold uppercase tracking-[0.15em] rounded-2xl text-center flex items-center justify-center gap-2">
                <Icon name="check_circle" filled className="text-xl" />
                REVIEW SUBMITTED!
              </div>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="w-full py-4 gold-gradient text-on-primary font-bold uppercase tracking-[0.15em] rounded-2xl ambient-glow active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {saving ? 'SUBMITTING...' : !user ? 'SIGN IN TO REVIEW' : 'SUBMIT REVIEW'}
              </button>
            )}
            {isOwner && (
              <div className="flex items-center gap-2">
                <Icon name="verified" filled className="text-primary text-sm" />
                <span className="text-[10px] font-bold tracking-[0.1em] text-primary">VERIFIED OWNER REVIEW</span>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
