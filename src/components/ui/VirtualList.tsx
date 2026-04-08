import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react'

interface VirtualListProps<T> {
  items: T[]
  itemHeight: number
  overscan?: number
  renderItem: (item: T, index: number) => ReactNode
  className?: string
  /** Max height before virtualisation kicks in */
  threshold?: number
}

/**
 * Simple virtual scrolling list for long collections.
 * Only renders visible items + overscan buffer.
 * Falls back to normal rendering for small lists.
 */
export function VirtualList<T>({
  items,
  itemHeight,
  overscan = 5,
  renderItem,
  className = '',
  threshold = 30,
}: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [containerHeight, setContainerHeight] = useState(0)

  // If list is small enough, render normally
  if (items.length <= threshold) {
    return (
      <div className={className}>
        {items.map((item, i) => renderItem(item, i))}
      </div>
    )
  }

  const totalHeight = items.length * itemHeight

  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      setScrollTop(containerRef.current.scrollTop)
    }
  }, [])

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const resizeObserver = new ResizeObserver(() => {
      setContainerHeight(el.clientHeight)
    })
    resizeObserver.observe(el)
    setContainerHeight(el.clientHeight)

    return () => resizeObserver.disconnect()
  }, [])

  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
  const endIndex = Math.min(
    items.length,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan,
  )

  const visibleItems = items.slice(startIndex, endIndex)

  return (
    <div
      ref={containerRef}
      className={`overflow-y-auto ${className}`}
      onScroll={handleScroll}
      style={{ maxHeight: '70vh' }}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ position: 'absolute', top: startIndex * itemHeight, width: '100%' }}>
          {visibleItems.map((item, i) => renderItem(item, startIndex + i))}
        </div>
      </div>
    </div>
  )
}
