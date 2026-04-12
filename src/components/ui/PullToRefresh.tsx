import { useCallback, useRef, useState, type ReactNode } from 'react'

const THRESHOLD = 80

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void
  children: ReactNode
  disabled?: boolean
}

/**
 * Pull-to-refresh wrapper for mobile screens.
 * Wraps content and shows a spinner when pulled down.
 */
export function PullToRefresh({ onRefresh, children, disabled = false }: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startY = useRef(0)
  const pulling = useRef(false)

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled || refreshing) return
    // Only trigger if at top of page
    if (window.scrollY > 0) return
    startY.current = e.touches[0].clientY
    pulling.current = true
  }, [disabled, refreshing])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pulling.current || disabled || refreshing) return
    const delta = e.touches[0].clientY - startY.current
    if (delta > 0) {
      setPullDistance(Math.min(delta * 0.5, 120))
    } else {
      setPullDistance(0)
    }
  }, [disabled, refreshing])

  const handleTouchEnd = useCallback(async () => {
    if (!pulling.current || disabled) return
    pulling.current = false
    if (pullDistance >= THRESHOLD && !refreshing) {
      setRefreshing(true)
      setPullDistance(THRESHOLD)
      try { await onRefresh() } catch { /* swallow */ }
      setRefreshing(false)
    }
    setPullDistance(0)
  }, [pullDistance, refreshing, disabled, onRefresh])

  const progress = Math.min(pullDistance / THRESHOLD, 1)

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      {(pullDistance > 0 || refreshing) && (
        <div
          className="flex justify-center items-center overflow-hidden transition-[height] duration-200"
          style={{ height: refreshing ? 48 : pullDistance > 10 ? pullDistance : 0 }}
        >
          <span
            className={`text-primary text-sm ${refreshing ? 'animate-pulse' : ''}`}
            style={{ opacity: progress }}
          >↻</span>
        </div>
      )}
      {children}
    </div>
  )
}
