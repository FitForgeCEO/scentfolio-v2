/**
 * Push notification management.
 * Handles permission requests, subscription, and local scheduled notifications.
 *
 * Note: For full push notification support, you'd need a backend to store
 * subscriptions and send pushes. This module handles the client side and
 * also provides local notification scheduling via the Notification API.
 */

export type NotificationPermission = 'granted' | 'denied' | 'default'

/** Check if notifications are supported */
export function isNotificationSupported(): boolean {
  return 'Notification' in window && 'serviceWorker' in navigator
}

/** Get current permission status */
export function getNotificationPermission(): NotificationPermission {
  if (!isNotificationSupported()) return 'denied'
  return Notification.permission as NotificationPermission
}

/** Request notification permission */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) return 'denied'
  const result = await Notification.requestPermission()
  return result as NotificationPermission
}

/** Show a local notification via the service worker */
export async function showLocalNotification(
  title: string,
  options: {
    body: string
    icon?: string
    badge?: string
    url?: string
    tag?: string
    actions?: { action: string; title: string }[]
  }
): Promise<boolean> {
  if (getNotificationPermission() !== 'granted') return false

  try {
    const reg = await navigator.serviceWorker.ready
    await reg.showNotification(title, {
      body: options.body,
      icon: options.icon ?? '/icons/icon-192x192.png',
      badge: options.badge ?? '/icons/icon-96x96.png',
      tag: options.tag ?? 'scentfolio-local',
      data: { url: options.url ?? '/' },
      actions: options.actions,
      // vibrate & renotify are valid on mobile but not in TS NotificationOptions
      ...({ vibrate: [100, 50, 100], renotify: true } as NotificationOptions),
    } as NotificationOptions)
    return true
  } catch {
    return false
  }
}

// ── Notification settings stored in localStorage ───────────────────

interface NotificationSettings {
  enabled: boolean
  dailyReminder: boolean
  dailyReminderTime: string // "HH:MM" format
  streakReminder: boolean
  weeklyDigest: boolean
}

const SETTINGS_KEY = 'scentfolio-notification-settings'

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: false,
  dailyReminder: true,
  dailyReminderTime: '20:00',
  streakReminder: true,
  weeklyDigest: false,
}

export function getNotificationSettings(): NotificationSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY)
    if (stored) return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) }
  } catch {
    // ignore
  }
  return DEFAULT_SETTINGS
}

export function saveNotificationSettings(settings: Partial<NotificationSettings>): NotificationSettings {
  const current = getNotificationSettings()
  const updated = { ...current, ...settings }
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated))
  return updated
}

// ── Local notification scheduling ──────────────────────────────────
// Uses setTimeout for in-session reminders. For persistent scheduling,
// you'd need a server-side push system.

let dailyReminderTimeout: ReturnType<typeof setTimeout> | null = null

export function scheduleDailyReminder(): void {
  if (dailyReminderTimeout) clearTimeout(dailyReminderTimeout)

  const settings = getNotificationSettings()
  if (!settings.enabled || !settings.dailyReminder) return

  const [hours, minutes] = settings.dailyReminderTime.split(':').map(Number)
  const now = new Date()
  const target = new Date()
  target.setHours(hours, minutes, 0, 0)

  // If time has passed today, schedule for tomorrow
  if (target <= now) {
    target.setDate(target.getDate() + 1)
  }

  const delay = target.getTime() - now.getTime()

  dailyReminderTimeout = setTimeout(() => {
    showLocalNotification('What did you wear today?', {
      body: 'Log your fragrance to keep your streak going 🔥',
      url: '/',
      tag: 'daily-reminder',
      actions: [
        { action: 'log', title: 'Log Now' },
        { action: 'dismiss', title: 'Later' },
      ],
    })

    // Reschedule for the next day
    scheduleDailyReminder()
  }, delay)
}

export function cancelDailyReminder(): void {
  if (dailyReminderTimeout) {
    clearTimeout(dailyReminderTimeout)
    dailyReminderTimeout = null
  }
}
