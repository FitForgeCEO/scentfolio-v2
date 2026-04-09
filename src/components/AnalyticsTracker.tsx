import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { trackPageView } from '@/lib/analytics'

/**
 * Invisible component that fires a page_view event on every route change.
 * Must be rendered inside <BrowserRouter>.
 */
export function AnalyticsTracker() {
  const location = useLocation()

  useEffect(() => {
    trackPageView(location.pathname)
  }, [location.pathname])

  return null
}
