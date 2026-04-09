import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { setupOnlineSync } from './lib/offlineQueue'
import { trackEvent } from './lib/analytics'
import { scheduleDailyReminder, getNotificationSettings } from './lib/notifications'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
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
