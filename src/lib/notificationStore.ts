/**
 * In-app notification store.
 * Manages notification items persisted to localStorage with read/unread state.
 * Distinct from push notifications (lib/notifications.ts handles those).
 */

export type NotificationType =
  | 'achievement'
  | 'milestone'
  | 'tip'
  | 'streak'
  | 'collection'
  | 'system'

export interface AppNotification {
  id: string
  type: NotificationType
  title: string
  body: string
  icon: string          // Material Symbol name
  href?: string         // Navigation target
  read: boolean
  createdAt: string     // ISO string
}

const STORE_KEY = 'scentfolio-notifications'
const MAX_NOTIFICATIONS = 50

// ── Persistence ───────────────────────────────────────────────────

function load(): AppNotification[] {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (raw) return JSON.parse(raw) as AppNotification[]
  } catch { /* ignore */ }
  return []
}

function save(items: AppNotification[]): void {
  localStorage.setItem(STORE_KEY, JSON.stringify(items.slice(0, MAX_NOTIFICATIONS)))
}

// ── Public API ────────────────────────────────────────────────────

let listeners: Array<() => void> = []

function notify() {
  listeners.forEach((fn) => fn())
}

/** Subscribe to notification changes. Returns unsubscribe fn. */
export function subscribeNotifications(fn: () => void): () => void {
  listeners.push(fn)
  return () => { listeners = listeners.filter((l) => l !== fn) }
}

/** Get all notifications (newest first) */
export function getNotifications(): AppNotification[] {
  return load()
}

/** Get unread count */
export function getUnreadCount(): number {
  return load().filter((n) => !n.read).length
}

/** Add a new notification */
export function addNotification(
  notif: Omit<AppNotification, 'id' | 'read' | 'createdAt'>
): AppNotification {
  const item: AppNotification = {
    ...notif,
    id: crypto.randomUUID(),
    read: false,
    createdAt: new Date().toISOString(),
  }
  const items = load()
  items.unshift(item)
  save(items)
  notify()
  return item
}

/** Mark a single notification as read */
export function markRead(id: string): void {
  const items = load()
  const idx = items.findIndex((n) => n.id === id)
  if (idx >= 0 && !items[idx].read) {
    items[idx].read = true
    save(items)
    notify()
  }
}

/** Mark all notifications as read */
export function markAllRead(): void {
  const items = load()
  let changed = false
  for (const n of items) {
    if (!n.read) { n.read = true; changed = true }
  }
  if (changed) { save(items); notify() }
}

/** Remove a notification */
export function removeNotification(id: string): void {
  const items = load().filter((n) => n.id !== id)
  save(items)
  notify()
}

/** Clear all notifications */
export function clearAllNotifications(): void {
  save([])
  notify()
}

// ── Smart notification generators ─────────────────────────────────

/** Generate a welcome notification for new users */
export function generateWelcomeNotification(): void {
  const items = load()
  if (items.some((n) => n.type === 'system' && n.title.includes('Welcome'))) return
  addNotification({
    type: 'system',
    title: 'Welcome to ScentFolio',
    body: 'Start by adding your first fragrance to your collection.',
    icon: 'waving_hand',
    href: '/explore',
  })
}

/** Generate a streak milestone notification */
export function generateStreakNotification(streakDays: number): void {
  if (streakDays < 3) return
  const milestones = [3, 7, 14, 30, 50, 100, 365]
  if (!milestones.includes(streakDays)) return
  const items = load()
  if (items.some((n) => n.title.includes(`${streakDays}-Day`))) return
  addNotification({
    type: 'streak',
    title: `${streakDays}-Day Streak!`,
    body: `You've logged your fragrance ${streakDays} days in a row. Keep it going!`,
    icon: 'local_fire_department',
    href: '/stats',
  })
}

/** Generate a collection milestone notification */
export function generateCollectionMilestone(count: number): void {
  const milestones = [1, 5, 10, 25, 50, 100, 250]
  if (!milestones.includes(count)) return
  const items = load()
  if (items.some((n) => n.title.includes(`${count} Fragrance`))) return
  addNotification({
    type: 'collection',
    title: count === 1 ? 'First Fragrance Added!' : `${count} Fragrances!`,
    body: count === 1
      ? 'Your collection has begun. Add more to unlock insights.'
      : `Your collection has reached ${count} fragrances. Impressive!`,
    icon: count >= 50 ? 'diamond' : 'inventory_2',
    href: '/collection',
  })
}

/** Generate a random tip (max once per day) */
export function generateDailyTip(): void {
  const items = load()
  const today = new Date().toISOString().slice(0, 10)
  if (items.some((n) => n.type === 'tip' && n.createdAt.startsWith(today))) return

  const tips = [
    { title: 'Try the Layering Lab', body: 'Combine two fragrances to create something unique.', icon: 'science', href: '/layering-lab' },
    { title: 'Check Your Wear Calendar', body: 'See patterns in what you wear and when.', icon: 'calendar_month', href: '/calendar' },
    { title: 'Explore by Note Family', body: 'Discover fragrances grouped by their dominant notes.', icon: 'spa', href: '/notes' },
    { title: 'Collection Health Check', body: 'See how balanced and diverse your collection is.', icon: 'monitor_heart', href: '/collection-health' },
    { title: 'Share Your Profile Card', body: 'Create a shareable card showing your fragrance identity.', icon: 'share', href: '/profile-card' },
    { title: 'Rate More Fragrances', body: 'Better ratings lead to better recommendations.', icon: 'star', href: '/quick-rate' },
    { title: 'Discover New Scents', body: 'Find fragrances similar to ones you love.', icon: 'explore', href: '/discover' },
    { title: 'Set Up a Board', body: 'Organise fragrances into themed collections.', icon: 'dashboard', href: '/boards' },
  ]

  const tip = tips[Math.floor(Math.random() * tips.length)]
  addNotification({ type: 'tip', ...tip })
}
