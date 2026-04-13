import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { getIconChar } from '@/lib/iconUtils'
import {
  getNotifications,
  markRead,
  markAllRead,
  clearAllNotifications,
  subscribeNotifications,
  type AppNotification,
} from '@/lib/notificationStore'

// ── Activity item from Supabase ───────────────────────────────────

interface ActivityItem {
  id: string
  type: 'wear' | 'review' | 'collection_add' | 'collection_remove' | 'decant'
  title: string
  subtitle: string
  icon: string
  iconColor: string
  timestamp: string
  href?: string
}

type Tab = 'notifications' | 'activity'

export function ActivityFeedScreen() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('notifications')
  const [notifications, setNotifications] = useState<AppNotification[]>(getNotifications)
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [loadingActivity, setLoadingActivity] = useState(false)

  // Subscribe to notification changes
  useEffect(() => {
    const unsub = subscribeNotifications(() => setNotifications(getNotifications()))
    return unsub
  }, [])

  // Fetch activity from Supabase
  useEffect(() => {
    if (!user || tab !== 'activity') return
    setLoadingActivity(true)

    const fetchActivity = async () => {
      const items: ActivityItem[] = []

      // Recent wears
      const { data: wears } = await supabase
        .from('wear_logs')
        .select('id, wear_date, created_at, fragrance:fragrances(name, brand)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)

      type WearRow = { id: string; wear_date: string; created_at: string; fragrance: { name: string; brand: string } | null }
      if (wears) {
        for (const w of wears as unknown as WearRow[]) {
          if (!w.fragrance) continue
          items.push({
            id: `wear-${w.id}`,
            type: 'wear',
            title: `Wore ${w.fragrance.name}`,
            subtitle: w.fragrance.brand,
            icon: 'air',
            iconColor: 'text-blue-400',
            timestamp: w.created_at,
            href: '/calendar',
          })
        }
      }

      // Recent reviews
      const { data: reviews } = await supabase
        .from('reviews')
        .select('id, overall_rating, created_at, fragrance:fragrances(name, brand)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(15)

      type ReviewRow = { id: string; overall_rating: number; created_at: string; fragrance: { name: string; brand: string } | null }
      if (reviews) {
        for (const r of reviews as unknown as ReviewRow[]) {
          if (!r.fragrance) continue
          items.push({
            id: `review-${r.id}`,
            type: 'review',
            title: `Reviewed ${r.fragrance.name}`,
            subtitle: `${r.overall_rating}/5 — ${r.fragrance.brand}`,
            icon: 'rate_review',
            iconColor: 'text-amber-400',
            timestamp: r.created_at,
          })
        }
      }

      // Recent collection adds
      const { data: collection } = await supabase
        .from('user_collections')
        .select('id, status, date_added, fragrance:fragrances(id, name, brand)')
        .eq('user_id', user.id)
        .order('date_added', { ascending: false })
        .limit(20)

      type CollRow = { id: string; status: string; date_added: string; fragrance: { id: string; name: string; brand: string } | null }
      if (collection) {
        for (const c of collection as unknown as CollRow[]) {
          if (!c.fragrance) continue
          items.push({
            id: `coll-${c.id}`,
            type: 'collection_add',
            title: c.status === 'wishlist' ? `Added ${c.fragrance.name} to wishlist` : `Added ${c.fragrance.name}`,
            subtitle: c.fragrance.brand,
            icon: c.status === 'wishlist' ? 'favorite' : 'add_circle',
            iconColor: c.status === 'wishlist' ? 'text-pink-400' : 'text-emerald-400',
            timestamp: c.date_added,
            href: `/fragrance/${c.fragrance.id}`,
          })
        }
      }

      // Sort all by timestamp descending
      items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      setActivity(items)
      setLoadingActivity(false)
    }

    fetchActivity()
  }, [user, tab])

  // Group items by date
  const groupedNotifications = useMemo(() => groupByDate(notifications, (n) => n.createdAt), [notifications])
  const groupedActivity = useMemo(() => groupByDate(activity, (a) => a.timestamp), [activity])

  const unreadCount = notifications.filter((n) => !n.read).length

  if (!user) {
    return (
      <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen flex flex-col items-center justify-center">
        <span className="text-4xl text-primary/20 mb-4">⊙</span>
        <h3 className="font-headline text-xl text-on-surface mb-2">Sign in to view activity</h3>
        <button onClick={() => navigate('/profile')} className="gold-gradient text-on-primary-container px-8 py-3 rounded-sm font-label text-[10px] font-bold uppercase tracking-widest hover:opacity-80 transition-all shadow-lg mt-4">
          SIGN IN
        </button>
      </main>
    )
  }

  return (
    <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen space-y-5">
      {/* Tab bar */}
      <div className="flex gap-2 bg-surface-container rounded-sm p-1">
        <button
          onClick={() => setTab('notifications')}
          className={`flex-1 py-2.5 rounded-sm text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
            tab === 'notifications'
              ? 'bg-primary/15 text-primary'
              : 'text-secondary/50 active:bg-surface-container-highest/40'
          }`}
        >
          Notifications
          {unreadCount > 0 && (
            <span className="min-w-[18px] h-[18px] rounded-full bg-primary text-on-primary text-[10px] font-bold flex items-center justify-center px-1">
              {unreadCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('activity')}
          className={`flex-1 py-2.5 rounded-sm text-xs font-bold uppercase tracking-widest transition-all ${
            tab === 'activity'
              ? 'bg-primary/15 text-primary'
              : 'text-secondary/50 active:bg-surface-container-highest/40'
          }`}
        >
          Activity
        </button>
      </div>

      {/* Notifications tab */}
      {tab === 'notifications' && (
        <>
          {/* Actions bar */}
          {notifications.length > 0 && (
            <div className="flex items-center justify-between">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-[10px] text-primary font-bold uppercase tracking-wider hover:opacity-80 transition-transform"
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={() => { clearAllNotifications(); setNotifications([]) }}
                className="text-[10px] text-secondary/40 font-bold uppercase tracking-wider hover:opacity-80 transition-transform ml-auto"
              >
                Clear all
              </button>
            </div>
          )}

          {notifications.length === 0 ? (
            <EmptyState icon="notifications_none" message="No notifications yet" sub="We'll let you know about milestones and tips" />
          ) : (
            Object.entries(groupedNotifications).map(([date, items]) => (
              <section key={date} className="space-y-1">
                <h4 className="text-[10px] uppercase tracking-[0.15em] font-label text-secondary/50 px-1 mb-2">{date}</h4>
                {items.map((notif) => (
                  <NotificationRow key={notif.id} notif={notif} navigate={navigate} />
                ))}
              </section>
            ))
          )}
        </>
      )}

      {/* Activity tab */}
      {tab === 'activity' && (
        <>
          {loadingActivity ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-surface-container rounded-sm p-4 animate-pulse flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-surface-container-highest" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-surface-container-highest rounded w-3/4" />
                    <div className="h-2 bg-surface-container-highest rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : activity.length === 0 ? (
            <EmptyState icon="history" message="No activity yet" sub="Start adding fragrances and logging wears" />
          ) : (
            Object.entries(groupedActivity).map(([date, items]) => (
              <section key={date} className="space-y-1">
                <h4 className="text-[10px] uppercase tracking-[0.15em] font-label text-secondary/50 px-1 mb-2">{date}</h4>
                {items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => item.href && navigate(item.href)}
                    className="w-full text-left bg-surface-container rounded-sm px-4 py-3 flex items-center gap-3 hover:opacity-80 transition-transform"
                  >
                    <div className="w-9 h-9 rounded-full bg-surface-container-highest/60 flex items-center justify-center flex-shrink-0">
                      <span>{getIconChar(item.icon)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-on-surface font-medium truncate">{item.title}</p>
                      <p className="text-[11px] text-secondary/50 truncate">{item.subtitle}</p>
                    </div>
                    <p className="text-[10px] text-secondary/30 flex-shrink-0">{formatShortTime(item.timestamp)}</p>
                  </button>
                ))}
              </section>
            ))
          )}
        </>
      )}
    </main>
  )
}

// ── Sub-components ────────────────────────────────────────────────

function NotificationRow({ notif, navigate }: { notif: AppNotification; navigate: (path: string) => void }) {
  const _typeColor: Record<string, string> = {
    achievement: 'text-amber-400',
    milestone: 'text-primary',
    tip: 'text-blue-400',
    streak: 'text-orange-400',
    collection: 'text-emerald-400',
    system: 'text-primary',
  }
  void _typeColor

  return (
    <button
      onClick={() => {
        markRead(notif.id)
        if (notif.href) navigate(notif.href)
      }}
      className={`w-full text-left rounded-sm px-4 py-3 flex items-start gap-3 hover:opacity-80 transition-all ${
        !notif.read ? 'bg-primary/5 border border-primary/10' : 'bg-surface-container'
      }`}
    >
      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
        !notif.read ? 'bg-primary/10' : 'bg-surface-container-highest/60'
      }`}>
        <span>{getIconChar(notif.icon)}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-sm leading-tight ${!notif.read ? 'text-on-surface font-medium' : 'text-on-surface/70'}`}>
            {notif.title}
          </p>
          {!notif.read && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />}
        </div>
        <p className="text-[11px] text-secondary/50 mt-0.5 line-clamp-2">{notif.body}</p>
        <p className="text-[10px] text-secondary/30 mt-1">{formatShortTime(notif.createdAt)}</p>
      </div>
    </button>
  )
}

function EmptyState({ icon, message, sub }: { icon: string; message: string; sub: string }) {
  return (
    <div className="py-16 text-center">
      <span className="text-4xl text-secondary/15 mb-3 block mx-auto">{getIconChar(icon)}</span>
      <p className="text-sm text-secondary/40 font-medium">{message}</p>
      <p className="text-[11px] text-secondary/25 mt-1">{sub}</p>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────

function formatShortTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function groupByDate<T>(items: T[], getDate: (item: T) => string): Record<string, T[]> {
  const groups: Record<string, T[]> = {}
  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)

  for (const item of items) {
    const dateStr = getDate(item).slice(0, 10)
    let label: string
    if (dateStr === today) label = 'Today'
    else if (dateStr === yesterday) label = 'Yesterday'
    else label = new Date(dateStr).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

    if (!groups[label]) groups[label] = []
    groups[label].push(item)
  }
  return groups
}

  return groups
}
