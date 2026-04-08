/**
 * Review likes system hooks.
 * Uses the review_likes table: { user_id, review_id, created_at }
 * Falls back gracefully if table doesn't exist yet.
 */

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

/** Check if current user liked a review + total like count */
export function useReviewLike(reviewId: string) {
  const { user } = useAuth()
  const [liked, setLiked] = useState(false)
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      try {
        const [countRes, likedRes] = await Promise.all([
          supabase
            .from('review_likes')
            .select('id', { count: 'exact', head: true })
            .eq('review_id', reviewId),
          user
            ? supabase
                .from('review_likes')
                .select('id')
                .eq('review_id', reviewId)
                .eq('user_id', user.id)
                .maybeSingle()
            : Promise.resolve({ data: null }),
        ])
        setCount(countRes.count ?? 0)
        setLiked(!!likedRes.data)
      } catch {
        // Table might not exist
      }
      setLoading(false)
    }
    fetch()
  }, [reviewId, user])

  const toggleLike = useCallback(async () => {
    if (!user) return
    try {
      if (liked) {
        await supabase
          .from('review_likes')
          .delete()
          .eq('review_id', reviewId)
          .eq('user_id', user.id)
        setLiked(false)
        setCount((c) => Math.max(0, c - 1))
      } else {
        await supabase
          .from('review_likes')
          .insert({ review_id: reviewId, user_id: user.id })
        setLiked(true)
        setCount((c) => c + 1)
      }
    } catch {
      // Graceful fallback
    }
  }, [user, reviewId, liked])

  return { liked, count, loading, toggleLike }
}

/** Batch fetch like counts for multiple reviews (for feed/list views) */
export function useReviewLikeCounts(reviewIds: string[]) {
  const { user } = useAuth()
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [userLiked, setUserLiked] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (reviewIds.length === 0) return

    const fetch = async () => {
      try {
        // Fetch all likes for these reviews
        const { data } = await supabase
          .from('review_likes')
          .select('review_id, user_id')
          .in('review_id', reviewIds)

        if (data) {
          const countMap: Record<string, number> = {}
          const liked = new Set<string>()

          for (const row of data) {
            countMap[row.review_id] = (countMap[row.review_id] ?? 0) + 1
            if (user && row.user_id === user.id) {
              liked.add(row.review_id)
            }
          }

          setCounts(countMap)
          setUserLiked(liked)
        }
      } catch {
        // Table might not exist
      }
    }

    fetch()
  }, [reviewIds.join(','), user])

  const toggleLike = useCallback(async (reviewId: string) => {
    if (!user) return
    try {
      const isLiked = userLiked.has(reviewId)
      if (isLiked) {
        await supabase
          .from('review_likes')
          .delete()
          .eq('review_id', reviewId)
          .eq('user_id', user.id)
        setUserLiked((prev) => { const s = new Set(prev); s.delete(reviewId); return s })
        setCounts((prev) => ({ ...prev, [reviewId]: Math.max(0, (prev[reviewId] ?? 0) - 1) }))
      } else {
        await supabase
          .from('review_likes')
          .insert({ review_id: reviewId, user_id: user.id })
        setUserLiked((prev) => new Set(prev).add(reviewId))
        setCounts((prev) => ({ ...prev, [reviewId]: (prev[reviewId] ?? 0) + 1 }))
      }
    } catch {
      // Graceful fallback
    }
  }, [user, userLiked])

  return { counts, userLiked, toggleLike }
}
