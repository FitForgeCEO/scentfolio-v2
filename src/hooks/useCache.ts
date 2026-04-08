import { useState, useEffect, useCallback, useRef } from 'react'
import { getStale, setCache } from '@/lib/cache'

interface UseCacheOptions {
  /** Time-to-live in ms (default 5 min) */
  ttl?: number
  /** Whether to fetch on mount (default true) */
  enabled?: boolean
}

interface UseCacheResult<T> {
  data: T | null
  loading: boolean
  stale: boolean
  error: Error | null
  refetch: () => void
}

/**
 * SWR-style hook: returns stale data instantly, fetches fresh in background.
 * @param key Unique cache key
 * @param fetcher Async function returning data
 * @param options TTL, enabled flag
 */
export function useCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: UseCacheOptions = {},
): UseCacheResult<T> {
  const { ttl = 5 * 60 * 1000, enabled = true } = options
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [stale, setStale] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const fetch = useCallback(async () => {
    // Return stale data immediately
    const cached = getStale<T>(key, ttl)
    if (cached) {
      setData(cached.data)
      setStale(cached.isStale)
      if (!cached.isStale) {
        setLoading(false)
        return
      }
      // Data is stale — continue to refetch but show stale data
      setLoading(false)
    }

    try {
      const fresh = await fetcherRef.current()
      setCache(key, fresh)
      setData(fresh)
      setStale(false)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Fetch failed'))
    } finally {
      setLoading(false)
    }
  }, [key, ttl])

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }
    fetch()
  }, [fetch, enabled])

  return { data, loading, stale, error, refetch: fetch }
}
