/**
 * useFragranceThumbs — React hook wrapping the user_signals thumbs API.
 *
 * Loads existing thumb state for a batch of fragrance IDs, and exposes
 * an optimistic setThumb() that rolls back on error.
 *
 * Surfaces using this hook (today and planned):
 *   * FragranceDetailScreen — 'kindred_works'
 *   * DiscoverScreen        — 'discover'               (step 7)
 *   * CollectionScreen      — 'collection_carousel'    (step 8)
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import {
  fetchThumbs,
  setThumb as writeThumb,
  type ThumbState,
} from '@/lib/signals'

export function useFragranceThumbs(
  fragranceIds: string[],
  surface: string,
) {
  const { user } = useAuth()
  const [thumbs, setThumbs] = useState<Record<string, ThumbState>>({})
  const [loading, setLoading] = useState(false)

  // Stable key so we refetch only when the set of IDs changes, not every
  // render (the parent often passes a fresh array each render).
  const idsKey = fragranceIds.slice().sort().join('|')

  // Track the latest request to drop stale responses on rapid id changes.
  const reqRef = useRef(0)

  useEffect(() => {
    if (!user || fragranceIds.length === 0) {
      setThumbs({})
      setLoading(false)
      return
    }
    const reqId = ++reqRef.current
    setLoading(true)
    fetchThumbs(user.id, fragranceIds)
      .then((res) => {
        if (reqRef.current !== reqId) return
        setThumbs(res)
      })
      .catch((e) => {
        // Non-fatal — thumbs just won't hydrate. Log for observability.
        console.warn('[useFragranceThumbs] fetch failed:', e)
      })
      .finally(() => {
        if (reqRef.current === reqId) setLoading(false)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, user?.id])

  /**
   * Optimistically set the thumb for a fragrance. If the target matches
   * the current state, toggles it off (clears the thumb).
   *
   * Returns the new committed state for the caller's convenience. If the
   * DB write fails, rolls back to the prior state and returns that.
   */
  const setThumb = useCallback(
    async (fragranceId: string, target: Exclude<ThumbState, null>): Promise<ThumbState> => {
      if (!user) return null

      const prev = thumbs[fragranceId] ?? null
      const next: ThumbState = prev === target ? null : target

      // Optimistic
      setThumbs((s) => ({ ...s, [fragranceId]: next }))

      try {
        await writeThumb(user.id, fragranceId, next, surface)
        return next
      } catch (e) {
        // Rollback
        console.warn('[useFragranceThumbs] write failed, rolling back:', e)
        setThumbs((s) => ({ ...s, [fragranceId]: prev }))
        return prev
      }
    },
    [thumbs, user, surface],
  )

  return { thumbs, setThumb, loading, isAuthed: Boolean(user) }
}
