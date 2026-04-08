/**
 * Hooks for managing user's personal tags on fragrances.
 * Tags are stored in the fragrance_tags table (user_id, fragrance_id, tag).
 */

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

/** Get all tags a user has applied to a specific fragrance */
export function useUserFragranceTags(fragranceId: string | undefined) {
  const { user } = useAuth()
  const [tags, setTags] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const fetchTags = useCallback(async () => {
    if (!user || !fragranceId) { setLoading(false); return }
    const { data } = await supabase
      .from('fragrance_tags')
      .select('tag')
      .eq('user_id', user.id)
      .eq('fragrance_id', fragranceId)
    if (data) setTags(data.map((t) => t.tag))
    setLoading(false)
  }, [user, fragranceId])

  useEffect(() => { fetchTags() }, [fetchTags])

  const setUserTags = useCallback(async (newTags: string[]) => {
    if (!user || !fragranceId) return

    // Delete all existing tags for this fragrance
    await supabase
      .from('fragrance_tags')
      .delete()
      .eq('user_id', user.id)
      .eq('fragrance_id', fragranceId)

    // Insert new tags
    if (newTags.length > 0) {
      await supabase
        .from('fragrance_tags')
        .insert(newTags.map((tag) => ({
          user_id: user.id,
          fragrance_id: fragranceId,
          tag,
        })))
    }

    setTags(newTags)
  }, [user, fragranceId])

  return { tags, loading, setTags: setUserTags, refetch: fetchTags }
}

/** Get ALL unique tags a user has ever used (for suggestions) */
export function useAllUserTags() {
  const { user } = useAuth()
  const [tags, setTags] = useState<string[]>([])
  const [tagCounts, setTagCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { setLoading(false); return }

    supabase
      .from('fragrance_tags')
      .select('tag')
      .eq('user_id', user.id)
      .then(({ data }) => {
        if (data) {
          const counts: Record<string, number> = {}
          for (const row of data) {
            counts[row.tag] = (counts[row.tag] || 0) + 1
          }
          setTagCounts(counts)
          // Sort by frequency descending
          const sorted = Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .map(([tag]) => tag)
          setTags(sorted)
        }
        setLoading(false)
      })
  }, [user])

  return { tags, tagCounts, loading }
}

/** Get fragrances by tag for a user */
export function useFragrancesByTag(tag: string | null) {
  const { user } = useAuth()
  const [fragranceIds, setFragranceIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user || !tag) { setFragranceIds([]); return }
    setLoading(true)

    supabase
      .from('fragrance_tags')
      .select('fragrance_id')
      .eq('user_id', user.id)
      .eq('tag', tag)
      .then(({ data }) => {
        if (data) setFragranceIds(data.map((r) => r.fragrance_id))
        setLoading(false)
      })
  }, [user, tag])

  return { fragranceIds, loading }
}
