import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { setupOnlineSync } from './lib/offlineQueue'
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

// Set up offline → online sync for queued wear logs
setupOnlineSync()

// Resume daily reminder scheduling if enabled
const notifSettings = getNotificationSettings()
if (notifSettings.enabled && notifSettings.dailyReminder) {
  scheduleDailyReminder()
}
