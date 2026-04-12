import { useReviewLike } from '@/hooks/useReviewLikes'
import { hapticMedium } from '@/lib/haptics'

interface ReviewLikeButtonProps {
  reviewId: string
}

export function ReviewLikeButton({ reviewId }: ReviewLikeButtonProps) {
  const { liked, count, toggleLike } = useReviewLike(reviewId)

  const handleClick = async () => {
    hapticMedium()
    await toggleLike()
  }

  return (
    <button
      onClick={handleClick}
      className={`flex items-center gap-1 text-[10px] transition-colors hover:opacity-80 ${
        liked ? 'text-primary' : 'text-secondary/40 hover:text-secondary/60'
      }`}
    >
      <span>♡</span>
      {count > 0 && <span>{count}</span>}
    </button>
  )
}

/** Batch version for feed views — takes pre-fetched state */
export function ReviewLikeButtonBatch({
  reviewId,
  liked,
  count,
  onToggle,
}: {
  reviewId: string
  liked: boolean
  count: number
  onToggle: (reviewId: string) => void
}) {
  const handleClick = () => {
    hapticMedium()
    onToggle(reviewId)
  }

  return (
    <button
      onClick={handleClick}
      className={`flex items-center gap-1 text-[10px] transition-colors hover:opacity-80 ${
        liked ? 'text-primary' : 'text-secondary/40 hover:text-secondary/60'
      }`}
    >
      <span>♡</span>
      {count > 0 && <span>{count}</span>}
    </button>
  )
}
