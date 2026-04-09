import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

/**
 * Check which reviewers own the fragrance (have it in their collection).
 * Returns a Set of user_ids who are verified owners.
 */
export function useReviewOwners(fragranceId: string | undefined, reviewerIds: string[]) {
  const [ownerIds, setOwnerIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!fragranceId || reviewerIds.length === 0) {
      setOwnerIds(new Set())
      return
    }

    supabase
      .from('user_collections')
      .select('user_id')
      .eq('fragrance_id', fragranceId)
      .in('user_id', reviewerIds)
      .then(({ data }) => {
        if (data) {
          setOwnerIds(new Set(data.map((d) => d.user_id)))
        }
      })
  }, [fragranceId, reviewerIds.join(',')])

  return ownerIds
}

/**
 * Delete a review by ID (only own reviews).
 */
export function useDeleteReview(onDeleted?: () => void) {
  const { user } = useAuth()
  const [deleting, setDeleting] = useState(false)

  const deleteReview = useCallback(async (reviewId: string) => {
    if (!user) return
    setDeleting(true)
    try {
      const { error } = await supabase
        .from('reviews')
        .delete()
        .eq('id', reviewId)
        .eq('user_id', user.id)

      if (!error) {
        onDeleted?.()
      }
    } catch {
      /* silent */
    } finally {
      setDeleting(false)
    }
  }, [user, onDeleted])

  return { deleteReview, deleting }
}

/**
 * Update a review (only own reviews).
 */
export function useUpdateReview(onUpdated?: () => void) {
  const { user } = useAuth()
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updateReview = useCallback(async (reviewId: string, updates: {
    overall_rating: number
    longevity_rating: number | null
    sillage_rating: number | null
    scent_rating: number | null
    value_rating: number | null
    title: string | null
    review_text: string | null
    season_tags: string[] | null
    occasion_tags: string[] | null
    would_recommend: boolean | null
  }) => {
    if (!user) return false
    setUpdating(true)
    setError(null)

    try {
      const { error: updateError } = await supabase
        .from('reviews')
        .update(updates)
        .eq('id', reviewId)
        .eq('user_id', user.id)

      if (updateError) {
        setError('Failed to update review. Please try again.')
        return false
      }

      onUpdated?.()
      return true
    } catch {
      setError('Something went wrong.')
      return false
    } finally {
      setUpdating(false)
    }
  }, [user, onUpdated])

  return { updateReview, updating, error }
}

export type ReviewSortOption = 'newest' | 'oldest' | 'highest' | 'lowest' | 'most_liked'
