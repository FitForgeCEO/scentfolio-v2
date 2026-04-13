import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { getStale, setCache } from '@/lib/cache'
import type { Fragrance, UserCollection, Review } from '@/types/database'
import type { ReviewSortOption } from './useReviewEnhancements'

/** Fetch top-rated fragrances for trending section (cached 5 min) */
export function useTrendingFragrances(limit = 6) {
  const cacheKey = `trending_${limit}`
  const [data, setData] = useState<Fragrance[]>(() => {
    const cached = getStale<Fragrance[]>(cacheKey)
    return cached?.data ?? []
  })
  const [loading, setLoading] = useState(() => {
    const cached = getStale<Fragrance[]>(cacheKey)
    return !cached || cached.isStale
  })
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(() => {
    setLoading(true)
    setError(null)
    supabase
      .from('fragrances')
      .select('*')
      .not('rating', 'is', null)
      .order('rating', { ascending: false })
      .limit(limit)
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else if (data) {
          const typed = data as Fragrance[]
          setData(typed)
          setCache(cacheKey, typed)
        }
        setLoading(false)
      })
  }, [limit, cacheKey])

  useEffect(() => { fetch() }, [fetch])

  return { data, loading, error, retry: fetch }
}

/** Fetch a single fragrance by ID */
export function useFragranceDetail(id: string | undefined) {
  const [data, setData] = useState<Fragrance | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(() => {
    if (!id) return
    setLoading(true)
    setError(null)
    supabase
      .from('fragrances')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else if (data) setData(data as Fragrance)
        setLoading(false)
      })
  }, [id])

  useEffect(() => { fetch() }, [fetch])

  return { data, loading, error, retry: fetch }
}

/** Search fragrances by name or brand */
export function useFragranceSearch(query: string, limit = 20) {
  const [data, setData] = useState<Fragrance[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (query.length < 2) {
      setData([])
      return
    }
    setLoading(true)
    setError(null)
    supabase
      .from('fragrances')
      .select('*')
      .or(`name.ilike.%${query}%,brand.ilike.%${query}%`)
      .order('rating', { ascending: false, nullsFirst: false })
      .limit(limit)
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else if (data) setData(data as Fragrance[])
        setLoading(false)
      })
  }, [query, limit])

  return { data, loading, error }
}

/** Browse fragrances with pagination for Explore/Collection */
export function useFragrancesBrowse(page = 0, pageSize = 20) {
  const [data, setData] = useState<Fragrance[]>([])
  const [loading, setLoading] = useState(true)
  const [count, setCount] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(() => {
    setLoading(true)
    setError(null)
    supabase
      .from('fragrances')
      .select('*', { count: 'exact' })
      .order('rating', { ascending: false, nullsFirst: false })
      .range(page * pageSize, (page + 1) * pageSize - 1)
      .then(({ data, error, count: total }) => {
        if (error) setError(error.message)
        else if (data) setData(data as Fragrance[])
        if (total) setCount(total)
        setLoading(false)
      })
  }, [page, pageSize])

  useEffect(() => { fetch() }, [fetch])

  return { data, loading, count, error, retry: fetch }
}

/** Get reviews for a fragrance with sorting support */
export function useFragranceReviews(fragranceId: string | undefined, sort: ReviewSortOption = 'newest') {
  const [data, setData] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchReviews = useCallback(() => {
    if (!fragranceId) return
    setLoading(true)
    setError(null)

    let query = supabase
      .from('reviews')
      .select('*, profile:profiles(display_name, avatar_url)')
      .eq('fragrance_id', fragranceId)

    // Apply sort order
    switch (sort) {
      case 'oldest':
        query = query.order('created_at', { ascending: true })
        break
      case 'highest':
        query = query.order('overall_rating', { ascending: false }).order('created_at', { ascending: false })
        break
      case 'lowest':
        query = query.order('overall_rating', { ascending: true }).order('created_at', { ascending: false })
        break
      case 'newest':
      default:
        query = query.order('created_at', { ascending: false })
        break
    }

    query
      .limit(50)
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else if (data) setData(data as unknown as Review[])
        setLoading(false)
      })
  }, [fragranceId, sort])

  useEffect(() => { fetchReviews() }, [fetchReviews])

  return { data, loading, error, refetch: fetchReviews }
}

/** Fetch user collection with joined fragrance data */
export function useUserCollection(userId: string | undefined) {
  const [data, setData] = useState<(UserCollection & { fragrance: Fragrance })[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(() => {
    if (!userId) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    supabase
      .from('user_collections')
      .select('*, fragrance:fragrances(*)')
      .eq('user_id', userId)
      .order('date_added', { ascending: false })
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else if (data) setData(data as any)
        setLoading(false)
      })
  }, [userId])

  useEffect(() => { fetch() }, [fetch])

  return { data, loading, error, retry: fetch }
}

/** Get aesthetic tags for a fragrance */
export function useFragranceTags(fragranceId: string | undefined) {
  const [data, setData] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!fragranceId) return
    setError(null)
    supabase
      .from('fragrance_tags')
      .select('tag')
      .eq('fragrance_id', fragranceId)
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else if (data) setData([...new Set(data.map((t) => t.tag))])
        setLoading(false)
      })
  }, [fragranceId])

  return { data, loading, error }
}
