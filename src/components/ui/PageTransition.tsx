import { useRef, useEffect, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Wraps route content with a subtle fade-slide transition on navigation.
 * Uses CSS animations triggered by key change on the location pathname.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const location = useLocation()
  const ref = useRef<HTMLDivElement>(null)
  const prevPath = useRef(location.pathname)

  useEffect(() => {
    if (prevPath.current !== location.pathname && ref.current) {
      // Trigger re-animation
      ref.current.style.animation = 'none'
      // Force reflow
      void ref.current.offsetHeight
      ref.current.style.animation = ''
      prevPath.current = location.pathname
    }
  }, [location.pathname])

  return (
    <div ref={ref} className="animate-page-enter" id="main-content" role="main">
      {children}
    </div>
  )
}
