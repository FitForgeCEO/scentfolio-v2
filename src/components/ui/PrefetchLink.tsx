import { useCallback, useRef, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * Route-to-chunk mapping for prefetching.
 * Maps route paths to their dynamic import functions.
 */
const ROUTE_CHUNKS: Record<string, () => Promise<unknown>> = {
  '/': () => Promise.resolve(), // eagerly loaded — no-op
  '/collection': () => Promise.resolve(), // eagerly loaded
  '/explore': () => Promise.resolve(), // eagerly loaded
  '/profile': () => Promise.resolve(), // eagerly loaded
  '/layering-lab': () => import('@/components/screens/LayeringLabScreen'),
  '/search': () => import('@/components/screens/SearchScreen'),
  '/discover': () => import('@/components/screens/DiscoverScreen'),
  '/settings': () => import('@/components/screens/SettingsScreen'),
  '/wear-predictions': () => import('@/components/screens/WearPredictionsScreen'),
  '/collection-health': () => import('@/components/screens/CollectionHealthScreen'),
  '/badges': () => import('@/components/screens/BadgesScreen'),
  '/smart-collections': () => import('@/components/screens/SmartCollectionsScreen'),
  '/data': () => import('@/components/screens/DataManagementScreen'),
  '/year-wrapped': () => import('@/components/screens/YearInFragranceScreen'),
  '/daily': () => import('@/components/screens/FragranceOfDayScreen'),
  '/weather': () => import('@/components/screens/WeatherMatchScreen'),
  '/activity': () => import('@/components/screens/ActivityFeedScreen'),
  '/tags': () => import('@/components/screens/TagManagerScreen'),
  '/heatmap': () => import('@/components/screens/WearHeatmapScreen'),
}

const prefetched = new Set<string>()

function prefetchRoute(path: string) {
  if (prefetched.has(path)) return
  const chunk = ROUTE_CHUNKS[path]
  if (chunk) {
    prefetched.add(path)
    chunk() // Fire and forget — Vite caches the module
  }
}

interface PrefetchLinkProps {
  to: string
  children: ReactNode
  className?: string
  onClick?: () => void
}

/**
 * Navigation link that prefetches the route chunk on hover/focus.
 * Improves perceived performance for common navigation paths.
 */
export function PrefetchLink({ to, children, className = '', onClick }: PrefetchLinkProps) {
  const navigate = useNavigate()
  const prefetchTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const handleMouseEnter = useCallback(() => {
    prefetchTimer.current = setTimeout(() => prefetchRoute(to), 100)
  }, [to])

  const handleMouseLeave = useCallback(() => {
    clearTimeout(prefetchTimer.current)
  }, [])

  const handleFocus = useCallback(() => {
    prefetchRoute(to)
  }, [to])

  const handleClick = useCallback(() => {
    if (onClick) onClick()
    navigate(to)
  }, [to, navigate, onClick])

  return (
    <button
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onClick={handleClick}
      className={className}
    >
      {children}
    </button>
  )
}

/**
 * Programmatic prefetch — call when you know the user will navigate soon.
 */
export { prefetchRoute }
