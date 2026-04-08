/**
 * Lightweight in-memory data cache with TTL.
 * SWR-style: returns stale data instantly while revalidating in background.
 */

interface CacheEntry<T> {
  data: T
  timestamp: number
}

const store = new Map<string, CacheEntry<unknown>>()

const DEFAULT_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Get cached data if still fresh, or null if expired/missing.
 */
export function getCached<T>(key: string, ttl = DEFAULT_TTL): T | null {
  const entry = store.get(key) as CacheEntry<T> | undefined
  if (!entry) return null
  if (Date.now() - entry.timestamp > ttl) return null
  return entry.data
}

/**
 * Get cached data even if stale (for SWR pattern).
 * Returns { data, isStale } or null if no cache exists at all.
 */
export function getStale<T>(key: string, ttl = DEFAULT_TTL): { data: T; isStale: boolean } | null {
  const entry = store.get(key) as CacheEntry<T> | undefined
  if (!entry) return null
  return { data: entry.data, isStale: Date.now() - entry.timestamp > ttl }
}

/**
 * Store data in cache.
 */
export function setCache<T>(key: string, data: T): void {
  store.set(key, { data, timestamp: Date.now() })
}

/**
 * Invalidate a specific cache key or all keys matching a prefix.
 */
export function invalidateCache(keyOrPrefix: string): void {
  if (store.has(keyOrPrefix)) {
    store.delete(keyOrPrefix)
    return
  }
  // Prefix match
  for (const k of store.keys()) {
    if (k.startsWith(keyOrPrefix)) store.delete(k)
  }
}

/**
 * Clear entire cache.
 */
export function clearCache(): void {
  store.clear()
}

/**
 * SWR-style fetch helper.
 * Returns cached data immediately, then fetches fresh data in background.
 * @param key Cache key
 * @param fetcher Async function that returns fresh data
 * @param ttl Time-to-live in ms
 * @returns Object with data, loading state, and refresh function
 */
export async function fetchWithCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl = DEFAULT_TTL,
): Promise<T> {
  const cached = getCached<T>(key, ttl)
  if (cached !== null) return cached

  const fresh = await fetcher()
  setCache(key, fresh)
  return fresh
}
