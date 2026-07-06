import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { trackPageView } from '@/lib/analytics'
import { captureUtmContext } from '@/lib/utm'

/**
 * Invisible component that fires a page_view event on every route change.
 * Must be rendered inside <BrowserRouter>.
 */
export function AnalyticsTracker() {
  const location = useLocation()

  useEffect(() => {
    trackPageView(location.pathname)
  }, [location.pathname])

  // UTM params can arrive via client-side navigation (e.g. the Signature
  // Audit signup CTA navigates to /auth?utm_source=...), which never
  // re-runs main.tsx. First-touch guard inside makes this idempotent.
  useEffect(() => {
    if (location.search) captureUtmContext(location.search)
  }, [location.search])

  return null
}
