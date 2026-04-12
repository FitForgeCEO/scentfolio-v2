import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getIconChar } from '@/lib/iconUtils'
import {
  getNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
  removeNotification,
  subscribeNotifications,
  type AppNotification,
} from '@/lib/notificationStore'

// ── Bell button with badge ────────────────────────────────────────

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(getUnreadCount)

  useEffect(() => {
    const unsub = subscribeNotifications(() => setUnread(getUnreadCount()))
    return unsub
  }, [])

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications${unread > 0 ? ` — ${unread} unread` : ''}`}
        className="relative w-10 h-10 flex items-center justify-center hover:opacity-80 transition-transform"
      >
        <span className="text-primary">{getIconChar(unread > 0 ? 'notifications_active' : 'notifications')}</span>
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[18px] h-[18px] rounded-full bg-error text-white text-[10px] font-bold flex items-center justify-center px-1 animate-scale-in">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && <NotificationPanel onClose={() => setOpen(false)} />}
    </>
  )
}

// ── Dropdown panel ────────────────────────────────────────────────

function NotificationPanel({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const panelRef = useRef<HTMLDivElement>(null)
  const [notifications, setNotifications] = useState<AppNotification[]>(getNotifications)

  // Refresh on store changes
  useEffect(() => {
    const unsub = subscribeNotifications(() => setNotifications(getNotifications()))
    return unsub
  }, [])

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    // Delay to avoid catching the bell click itself
    const timer = setTimeout(() => document.addEventListener('click', handleClick), 10)
    return () => { clearTimeout(timer); document.removeEventListener('click', handleClick) }
  }, [onClose])

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  const handleItemClick = useCallback((notif: AppNotification) => {
    markRead(notif.id)
    if (notif.href) {
      navigate(notif.href)
      onClose()
    }
  }, [navigate, onClose])

  const handleRemove = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    removeNotification(id)
  }, [])

  const handleMarkAllRead = useCallback(() => {
    markAllRead()
  }, [])

  const typeColor: Record<string, string> = {
    achievement: 'text-amber-400',
    milestone: 'text-primary',
    tip: 'text-blue-400',
    streak: 'text-orange-400',
    collection: 'text-emerald-400',
    system: 'text-primary',
  }

  const formatTime = (iso: string): string => {
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    if (days < 7) return `${days}d ago`
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Notifications"
      className="absolute top-14 right-2 w-[340px] max-h-[460px] bg-surface-container-low rounded-sm shadow-2xl border border-surface-container-highest/20 z-[var(--z-dropdown)] overflow-hidden animate-scale-in"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-container-highest/20">
        <h3 className="font-headline text-sm text-on-surface font-bold tracking-wide">Notifications</h3>
        <div className="flex items-center gap-2">
          {notifications.some((n) => !n.read) && (
            <button
              onClick={handleMarkAllRead}
              className="text-[10px] text-primary font-bold uppercase tracking-wider hover:text-primary/80 transition-colors"
            >
              Mark all read
            </button>
          )}
          <button
            onClick={() => { navigate('/activity'); onClose() }}
            className="text-[10px] text-secondary/60 font-bold uppercase tracking-wider hover:text-secondary transition-colors"
          >
            View all
          </button>
        </div>
      </div>

      {/* Notification list */}
      <div className="overflow-y-auto max-h-[380px] scrollbar-thin">
        {notifications.length === 0 ? (
          <div className="py-12 text-center">
            <span className="text-3xl text-secondary/20 mb-2 block mx-auto">⊙</span>
            <p className="text-xs text-secondary/40">No notifications yet</p>
          </div>
        ) : (
          notifications.map((notif) => (
            <button
              key={notif.id}
              onClick={() => handleItemClick(notif)}
              className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors hover:bg-surface-container/40 active:bg-surface-container ${
                !notif.read ? 'bg-primary/5' : ''
              }`}
            >
              {/* Icon */}
              <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                !notif.read ? 'bg-primary/10' : 'bg-surface-container'
              }`}>
                <span>{getIconChar(notif.icon)}</span>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className={`text-sm leading-tight ${!notif.read ? 'text-on-surface font-medium' : 'text-on-surface/70'}`}>
                    {notif.title}
                  </p>
                  {!notif.read && (
                    <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                  )}
                </div>
                <p className="text-[11px] text-secondary/50 mt-0.5 line-clamp-2">{notif.body}</p>
                <p className="text-[10px] text-secondary/30 mt-1">{formatTime(notif.createdAt)}</p>
              </div>

              {/* Remove */}
              <button
                onClick={(e) => handleRemove(e, notif.id)}
                className="w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:opacity-100 focus:opacity-100 text-secondary/30 hover:text-secondary/60 transition-opacity flex-shrink-0 mt-0.5"
                aria-label="Remove notification"
              >
                <span>✕</span>
              </button>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
