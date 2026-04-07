import { useState, useRef, useCallback, useEffect } from 'react'

const THRESHOLD = 80

interface PullToRefreshOptions {
  onRefresh: () => Promise<void> | void
  /** Disable pull-to-refresh (e.g. when a modal is open) */
  disabled?: boolean
}

/**
 * Pull-to-refresh hook for mobile.
 * Returns a ref to attach to the scrollable container,
 * plus state for rendering the pull indicator.
 */
export function usePullToRefresh({ onRefresh, disabled = false }: PullToRefreshOptions) {
  const [pulling, setPulling] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startY = useRef(0)
  const containerRef = useRef<HTMLElement | null>(null)

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (disabled || refreshing) return
    const el = containerRef.current
    if (!el || el.scrollTop > 0) return
    startY.current = e.touches[0].clientY
    setPulling(true)
  }, [disabled, refreshing])

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!pulling || disabled || refreshing) return
    const delta = e.touches[0].clientY - startY.current
    if (delta > 0) {
      setPullDistance(Math.min(delta * 0.5, 120))
    }
  }, [pulling, disabled, refreshing])

  const handleTouchEnd = useCallback(async () => {
    if (!pulling || disabled) return
    if (pullDistance >= THRESHOLD && !refreshing) {
      setRefreshing(true)
      setPullDistance(THRESHOLD)
      try { await onRefresh() } catch { /* swallow */ }
      setRefreshing(false)
    }
    setPulling(false)
    setPullDistance(0)
  }, [pulling, pullDistance, refreshing, disabled, onRefresh])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    el.addEventListener('touchstart', handleTouchStart, { passive: true })
    el.addEventListener('touchmove', handleTouchMove, { passive: true })
    el.addEventListener('touchend', handleTouchEnd)

    return () => {
      el.removeEventListener('touchstart', handleTouchStart)
      el.removeEventListener('touchmove', handleTouchMove)
      el.removeEventListener('touchend', handleTouchEnd)
    }
  }, [handleTouchStart, handleTouchMove, handleTouchEnd])

  return {
    containerRef,
    pullDistance,
    refreshing,
    isPulling: pulling && pullDistance > 0,
  }
}
