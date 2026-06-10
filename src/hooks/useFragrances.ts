import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { getStale, setCache } from '@/lib/cache'
import type { Fragrance, UserCollection, Review } from '@/types/database'
import type { ReviewSortOption } from './useReviewEnhancements'

/**
 * Strip characters that are syntax inside PostgREST's .or() filter grammar.
 * Commas separate conditions and parentheses group them, so a search like
 * "Angel (Men)" or "1,000" would otherwise produce a malformed filter -> 400.
 */
export function sanitizeSearchTerm(term: string): string {
  return term.replace(/[,()"]/g, ' ').trim()
}

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
  const reqRef = useRef(0)

  const fetch = useCallback(() => {
    const reqId = ++reqRef.current
    setLoading(true)
    setError(null)
    supabase
      .from('fragrances')
      .select('*')
      .not('rating', 'is', null)
      .order('rating', { ascending: false })
      .limit(limit)
      .then(({ data, error }) => {
        if (reqId !== reqRef.current) return
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
  const reqRef = useRef(0)

  const fetch = useCallback(() => {
    const reqId = ++reqRef.current
    if (!id) {
      setData(null)
      setLoading(false)
      return
    }
    // Reset so navigating A -> B shows a skeleton, not A's data under B's URL
    setData(null)
    setLoading(true)
    setError(null)
    supabase
      .from('fragrances')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (reqId !== reqRef.current) return
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
  const reqRef = useRef(0)

  useEffect(() => {
    // Bump even on the early return so an in-flight response from a prior
    // query can't repopulate results after the box was cleared.
    const reqId = ++reqRef.current
    const term = sanitizeSearchTerm(query)
    if (term.length < 2) {
      setData([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    supabase
      .from('fragrances')
      .select('*')
      .or(`name.ilike.%${term}%,brand.ilike.%${term}%`)
      .order('rating', { ascending: false, nullsFirst: false })
      .limit(limit)
      .then(({ data, error }) => {
        if (reqId !== reqRef.current) return
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
  const reqRef = useRef(0)

  const fetch = useCallback(() => {
    const reqId = ++reqRef.current
    setLoading(true)
    setError(null)
    supabase
      .from('fragrances')
      .select('*', { count: 'exact' })
      .order('rating', { ascending: false, nullsFirst: false })
      .range(page * pageSize, (page + 1) * pageSize - 1)
      .then(({ data, error, count: total }) => {
        if (reqId !== reqRef.current) return
        if (error) setError(error.message)
        else if (data) setData(data as Fragrance[])
        if (typeof total === 'number') setCount(total)
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
  const reqRef = useRef(0)

  const fetchReviews = useCallback(() => {
    const reqId = ++reqRef.current
    if (!fragranceId) {
      setData([])
      setLoading(false)
      return
    }
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
        if (reqId !== reqRef.current) return
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
  const reqRef = useRef(0)

  const fetch = useCallback(() => {
    const reqId = ++reqRef.current
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
        if (reqId !== reqRef.current) return
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
  const reqRef = useRef(0)

  useEffect(() => {
    const reqId = ++reqRef.current
    if (!fragranceId) {
      setData([])
      setLoading(false)
      return
    }
    setError(null)
    supabase
      .from('fragrance_tags')
      .select('tag')
      .eq('fragrance_id', fragranceId)
      .then(({ data, error }) => {
        if (reqId !== reqRef.current) return
        if (error) setError(error.message)
        else if (data) setData([...new Set(data.map((t) => t.tag))])
        setLoading(false)
      })
  }, [fragranceId])

  return { data, loading, error }
}
