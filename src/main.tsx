import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import './index.css'
import App from './App.tsx'
import { setupOnlineSync } from './lib/offlineQueue'
import { trackEvent } from './lib/analytics'
import { scheduleDailyReminder, getNotificationSettings } from './lib/notifications'

// ── Sentry: production error logging ────────────────────────────────────────
// Only enabled in prod builds so dev errors don't pollute the quota.
// sendDefaultPii=false — we don't auto-collect IPs; privacy-first, on-brand.
Sentry.init({
  dsn: 'https://095ae2225eb1e5a91e299ed8f627f5a9@o4511223238033408.ingest.de.sentry.io/4511223250747472',
  enabled: import.meta.env.PROD,
  environment: import.meta.env.MODE,
  sendDefaultPii: false,
  tracesSampleRate: 0.1,
  // Ignore noisy browser extensions and network blips
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications',
    'Non-Error promise rejection captured',
  ],
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sentry.ErrorBoundary
      fallback={
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#191210',
          color: '#e8dfd3',
          fontFamily: 'serif',
          padding: '2rem',
          textAlign: 'center',
        }}>
          <h1 style={{ fontSize: '2rem', marginBottom: '1rem', fontStyle: 'italic' }}>
            A page has come loose.
          </h1>
          <p style={{ opacity: 0.7, maxWidth: '32rem', marginBottom: '2rem' }}>
            Something went wrong. The binding has been notified. Please refresh to return to the volume.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: 'linear-gradient(135deg, #d4a574, #b8894f)',
              color: '#191210',
              border: 'none',
              padding: '0.75rem 2rem',
              fontSize: '0.75rem',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              borderRadius: '2px',
            }}
          >
            Refresh
          </button>
        </div>
      }
    >
      <App />
    </Sentry.ErrorBoundary>
  </StrictMode>,
)

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

// Global error tracking — catches errors outside React tree
window.addEventListener('error', (e) => {
  trackEvent('app_error', {
    message: e.message,
    filename: e.filename,
    lineno: e.lineno,
    colno: e.colno,
    type: 'uncaught',
  })
})
window.addEventListener('unhandledrejection', (e) => {
  trackEvent('app_error', {
    message: String(e.reason),
    type: 'unhandled_rejection',
  })
})

// Global image error handler — shows branded placeholder for broken fragrance images
document.addEventListener('error', (e) => {
  const el = e.target
  if (el instanceof HTMLImageElement && !el.dataset.fallback) {
    el.dataset.fallback = '1'
    el.style.background = 'linear-gradient(135deg, #261e1b 0%, #191210 100%)'
    el.style.objectFit = 'contain'
    // Use a tiny inline SVG as placeholder (gold bottle silhouette)
    el.src = 'data:image/svg+xml,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">' +
      '<rect width="100" height="100" fill="#261e1b"/>' +
      '<path d="M42 20h16v8H42zm-4 8h24v4H38zm-2 4h28l4 48H36z" fill="#3c3330"/>' +
      '<path d="M46 24h8v4h-8z" fill="#4d4639"/>' +
      '</svg>'
    )
  }
}, true) // capture phase — catches errors before they bubble

// Set up offline → online sync for queued wear logs
setupOnlineSync()

// Resume daily reminder scheduling if enabled
const notifSettings = getNotificationSettings()
if (notifSettings.enabled && notifSettings.dailyReminder) {
  scheduleDailyReminder()
}
