import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SubRatingBars } from './SubRatingBars'
import { ReviewLikeButton } from './ReviewLikeButton'
import { useAuth } from '@/contexts/AuthContext'
import type { Review } from '@/types/database'
import { getIconChar } from '@/lib/iconUtils'

const SEASON_LABELS: Record<string, string> = {
  spring: 'Spring',
  summer: 'Summer',
  autumn: 'Autumn',
  winter: 'Winter',
}

const OCCASION_LABELS: Record<string, string> = {
  casual: 'Casual',
  office: 'Office',
  date_night: 'Date Night',
  night_out: 'Night Out',
  special_event: 'Special Event',
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

interface EnhancedReviewCardProps {
  review: Review
  isVerifiedOwner: boolean
  onEdit?: () => void
  onDelete?: () => void
}

export function EnhancedReviewCard({ review, isVerifiedOwner, onEdit, onDelete }: EnhancedReviewCardProps) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const isOwnReview = user?.id === review.user_id
  const avatarUrl = review.profile?.avatar_url
  const displayName = review.profile?.display_name || 'Anonymous'
  const initials = displayName.charAt(0).toUpperCase()

  const hasSubRatings =
    (review.scent_rating && review.scent_rating > 0) ||
    (review.longevity_rating && review.longevity_rating > 0) ||
    (review.sillage_rating && review.sillage_rating > 0) ||
    (review.value_rating && review.value_rating > 0)

  const hasTags =
    (review.season_tags && review.season_tags.length > 0) ||
    (review.occasion_tags && review.occasion_tags.length > 0)

  return (
    <div className="p-5 bg-surface-container rounded-sm space-y-3">
      {/* Header: avatar, name, badge, date, stars, menu */}
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button
            onClick={() => navigate(`/u/${review.user_id}`)}
            className="flex-shrink-0 hover:opacity-80 transition-transform"
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center text-xs font-bold text-secondary/60">
                {initials}
              </div>
            )}
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => navigate(`/u/${review.user_id}`)}
                className="text-xs font-bold text-on-surface truncate hover:opacity-80"
              >
                {displayName}
              </button>
              {isVerifiedOwner && (
                <div className="flex items-center gap-0.5 flex-shrink-0" title="Verified Owner">
                  <span className="text-primary text-[12px]">?</span>
                </div>
              )}
            </div>
            <p className="text-[9px] text-secondary/60">{timeAgo(review.created_at)}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Star rating */}
          <div className="flex text-primary">
            {Array.from({ length: 5 }).map((_, i) => (
              <span key={i} className="text-[14px]">★</span>
            ))}
          </div>

          {/* Own review menu */}
          {isOwnReview && (onEdit || onDelete) && (
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-secondary/50 hover:bg-surface-container-highest hover:opacity-80 transition-all"
                aria-label="Review options"
              >
                <span>⋮</span>
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-[var(--z-dropdown)]" onClick={() => { setMenuOpen(false); setConfirmDelete(false) }} />
                  <div className="absolute right-0 top-8 z-[var(--z-dropdown)] bg-surface-container-low rounded-sm shadow-xl py-1 min-w-[140px] border border-outline-variant/10">
                    {onEdit && (
                      <button
                        onClick={() => { setMenuOpen(false); onEdit() }}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-on-surface hover:bg-surface-container active:bg-surface-container-highest transition-colors"
                      >
                        <span className="text-secondary">✎</span>
                        Edit Review
                      </button>
                    )}
                    {onDelete && !confirmDelete && (
                      <button
                        onClick={() => setConfirmDelete(true)}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-red-400 hover:bg-red-500/5 active:bg-red-500/10 transition-colors"
                      >
                        <span>✕</span>
                        Delete Review
                      </button>
                    )}
                    {onDelete && confirmDelete && (
                      <button
                        onClick={() => { setMenuOpen(false); setConfirmDelete(false); onDelete() }}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-red-400 font-bold hover:bg-red-500/10 transition-colors"
                      >
                        <span>?</span>
                        Confirm Delete
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Review title */}
      {review.title && (
        <h4 className="text-sm font-bold text-on-surface">{review.title}</h4>
      )}

      {/* Review text */}
      {review.review_text && (
        <p className="text-[13px] text-secondary/90 leading-relaxed italic">
          &ldquo;{review.review_text}&rdquo;
        </p>
      )}

      {/* Sub-rating bars */}
      {hasSubRatings && (
        <div className="pt-1">
          <SubRatingBars
            scent={review.scent_rating}
            longevity={review.longevity_rating}
            sillage={review.sillage_rating}
            value={review.value_rating}
          />
        </div>
      )}

      {/* Season & Occasion tags */}
      {hasTags && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {review.season_tags?.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 rounded-full bg-primary/8 text-[9px] text-primary/70 font-medium"
            >
              {SEASON_LABELS[tag] || tag}
            </span>
          ))}
          {review.occasion_tags?.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 rounded-full bg-surface-container-highest text-[9px] text-secondary/60 font-medium"
            >
              {OCCASION_LABELS[tag] || tag.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      )}

      {/* Would recommend */}
      {review.would_recommend !== null && (
        <div className="flex items-center gap-1.5 pt-0.5">
          <span>{getIconChar(review.would_recommend ? 'thumb_up' : 'thumb_down')}</span>
          <span className="text-[9px] text-secondary/50">
            {review.would_recommend ? 'Would recommend' : 'Would not recommend'}
          </span>
        </div>
      )}

      {/* Actions: like */}
      <div className="flex items-center gap-3 pt-1">
        <ReviewLikeButton reviewId={review.id} />
      </div>
    </div>
  )
}
