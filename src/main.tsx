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

// Set up offline → online sync for queued wear logs
setupOnlineSync()

// Resume daily reminder scheduling if enabled
const notifSettings = getNotificationSettings()
if (notifSettings.enabled && notifSettings.dailyReminder) {
  scheduleDailyReminder()
}
