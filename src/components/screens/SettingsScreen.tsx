import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../ui/Icon'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/contexts/ToastContext'
import {
  isNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
  getNotificationSettings,
  saveNotificationSettings,
  scheduleDailyReminder,
  cancelDailyReminder,
} from '@/lib/notifications'
import { useTheme } from '@/contexts/ThemeContext'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import type { Profile } from '@/types/database'

const CURRENCIES = ['GBP', 'USD', 'EUR', 'CAD', 'AUD', 'JPY', 'CHF'] as const
type Currency = (typeof CURRENCIES)[number]

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  GBP: '£', USD: '$', EUR: '€', CAD: 'CA$', AUD: 'A$', JPY: '¥', CHF: 'CHF',
}

interface UserSettings {
  preferred_currency: Currency
  season_auto_detect: boolean
  default_size_type: string
}

const STORAGE_KEY = 'scentfolio-settings'

function loadSettings(): UserSettings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as UserSettings
  } catch { /* ignore */ }
  return { preferred_currency: 'GBP', season_auto_detect: true, default_size_type: 'full' }
}

function saveSettings(s: UserSettings) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
}

export function SettingsScreen() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const toast = useToast()
  const { theme, toggleTheme } = useTheme()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<UserSettings>(loadSettings)
  const [editNameOpen, setEditNameOpen] = useState(false)
  const [deletingData, setDeletingData] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  // Notification settings
  const [notifSettings, setNotifSettings] = useState(getNotificationSettings)
  const [notifPermission, setNotifPermission] = useState(getNotificationPermission)

  const handleEnableNotifications = async () => {
    const perm = await requestNotificationPermission()
    setNotifPermission(perm)
    if (perm === 'granted') {
      const updated = saveNotificationSettings({ enabled: true })
      setNotifSettings(updated)
      scheduleDailyReminder()
      toast.showToast('Notifications enabled', 'success')
    } else {
      toast.showToast('Permission denied — enable in browser settings', 'error')
    }
  }

  const handleToggleNotifSetting = (key: 'dailyReminder' | 'streakReminder' | 'weeklyDigest') => {
    const updated = saveNotificationSettings({ [key]: !notifSettings[key] })
    setNotifSettings(updated)
    if (key === 'dailyReminder') {
      updated.dailyReminder ? scheduleDailyReminder() : cancelDailyReminder()
    }
  }

  const handleChangeReminderTime = (time: string) => {
    const updated = saveNotificationSettings({ dailyReminderTime: time })
    setNotifSettings(updated)
    scheduleDailyReminder()
  }

  const handleDisableNotifications = () => {
    const updated = saveNotificationSettings({ enabled: false })
    setNotifSettings(updated)
    cancelDailyReminder()
    toast.showToast('Notifications disabled', 'success')
  }

  useEffect(() => {
    if (!user) { setLoading(false); return }
    supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data) setProfile(data as Profile)
        setLoading(false)
      })
  }, [user])

  const updateSetting = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    const next = { ...settings, [key]: value }
    setSettings(next)
    saveSettings(next)
    toast.showToast('Setting updated', 'success')
  }

  const handleDeleteAllData = async () => {
    if (!user) return
    setDeletingData(true)
    try {
      await Promise.all([
        supabase.from('wear_logs').delete().eq('user_id', user.id),
        supabase.from('reviews').delete().eq('user_id', user.id),
        supabase.from('decants').delete().eq('user_id', user.id),
        supabase.from('user_collections').delete().eq('user_id', user.id),
      ])
      toast.showToast('All data deleted', 'success')
      setDeleteConfirmOpen(false)
    } catch {
      toast.showToast('Delete failed', 'error')
    }
    setDeletingData(false)
  }

  if (!user) {
    return (
      <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen flex flex-col items-center justify-center">
        <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center mb-5">
          <Icon name="settings" className="text-3xl text-primary/40" />
        </div>
        <h3 className="font-headline text-xl text-on-surface mb-2">Sign in to access settings</h3>
        <button onClick={() => navigate('/profile')} className="gold-gradient text-on-primary-container px-8 py-3 rounded-xl font-label text-[10px] font-bold uppercase tracking-widest active:scale-95 transition-all shadow-lg mt-6">SIGN IN</button>
      </main>
    )
  }

  if (loading) {
    return (
      <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </main>
    )
  }

  return (
    <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen space-y-6">
      {/* Profile Summary */}
      <section className="bg-surface-container rounded-xl p-5 flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-surface-container-highest flex items-center justify-center ring-2 ring-primary/20 flex-shrink-0">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
          ) : (
            <Icon name="person" className="text-2xl text-primary/40" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-headline text-lg text-on-surface truncate">{profile?.display_name ?? 'Fragrance Lover'}</h2>
          <p className="text-[10px] text-secondary/50 truncate">{user.email}</p>
          <p className="text-[10px] text-primary font-bold mt-0.5">Level {profile?.level ?? 1} · {profile?.xp ?? 0} XP</p>
        </div>
        <button
          onClick={() => setEditNameOpen(true)}
          className="w-9 h-9 rounded-full bg-surface-container-highest flex items-center justify-center active:scale-90 transition-transform"
        >
          <Icon name="edit" className="text-primary" size={16} />
        </button>
      </section>

      {/* Preferences */}
      <section className="space-y-2">
        <h3 className="text-[10px] uppercase tracking-[0.15em] font-label text-secondary px-1 mb-3">PREFERENCES</h3>

        {/* Currency */}
        <div className="bg-surface-container rounded-xl px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Icon name="payments" className="text-primary" size={20} />
            <div>
              <p className="text-sm text-on-surface font-medium">Currency</p>
              <p className="text-[10px] text-secondary/50">For decant & budget tracking</p>
            </div>
          </div>
          <select
            value={settings.preferred_currency}
            onChange={(e) => updateSetting('preferred_currency', e.target.value as Currency)}
            className="bg-surface-container-highest text-on-surface text-xs font-bold px-3 py-1.5 rounded-lg border-none focus:outline-none focus:ring-1 focus:ring-primary/30"
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>{CURRENCY_SYMBOLS[c]} {c}</option>
            ))}
          </select>
        </div>

        {/* Theme Toggle */}
        <div className="bg-surface-container rounded-xl px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Icon name={theme === 'dark' ? 'dark_mode' : 'light_mode'} className="text-primary" size={20} />
            <div>
              <p className="text-sm text-on-surface font-medium">Theme</p>
              <p className="text-[10px] text-secondary/50">{theme === 'dark' ? 'Dark mode' : 'Light mode'}</p>
            </div>
          </div>
          <button
            onClick={toggleTheme}
            className={`w-11 h-6 rounded-full transition-colors relative ${theme === 'light' ? 'bg-primary' : 'bg-surface-container-highest'}`}
            role="switch"
            aria-checked={theme === 'light'}
            aria-label="Toggle light mode"
          >
            <div className="w-5 h-5 rounded-full bg-white shadow-sm absolute top-0.5 transition-transform"
              style={{ transform: theme === 'light' ? 'translateX(21px)' : 'translateX(1px)' }}
            />
          </button>
        </div>

        {/* Season auto-detect */}
        <div className="bg-surface-container rounded-xl px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Icon name="thermostat" className="text-primary" size={20} />
            <div>
              <p className="text-sm text-on-surface font-medium">Auto-detect season</p>
              <p className="text-[10px] text-secondary/50">For recommendations</p>
            </div>
          </div>
          <button
            onClick={() => updateSetting('season_auto_detect', !settings.season_auto_detect)}
            className={`w-11 h-6 rounded-full transition-colors relative ${settings.season_auto_detect ? 'bg-primary' : 'bg-surface-container-highest'}`}
            role="switch"
            aria-checked={settings.season_auto_detect}
          >
            <div className={`w-5 h-5 rounded-full bg-white shadow-sm absolute top-0.5 transition-transform ${settings.season_auto_detect ? 'translate-x-5.5 left-[1px]' : 'translate-x-0 left-[1px]'}`}
              style={{ transform: settings.season_auto_detect ? 'translateX(21px)' : 'translateX(1px)' }}
            />
          </button>
        </div>

        {/* Default size type */}
        <div className="bg-surface-container rounded-xl px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Icon name="straighten" className="text-primary" size={20} />
            <div>
              <p className="text-sm text-on-surface font-medium">Default size type</p>
              <p className="text-[10px] text-secondary/50">When adding decants</p>
            </div>
          </div>
          <select
            value={settings.default_size_type}
            onChange={(e) => updateSetting('default_size_type', e.target.value)}
            className="bg-surface-container-highest text-on-surface text-xs font-bold px-3 py-1.5 rounded-lg border-none focus:outline-none focus:ring-1 focus:ring-primary/30"
          >
            {['full', 'travel', 'decant', 'sample', 'discovery'].map((t) => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
        </div>
      </section>

      {/* Notifications */}
      {isNotificationSupported() && (
        <section className="space-y-2">
          <h3 className="text-[10px] uppercase tracking-[0.15em] font-label text-secondary px-1 mb-3">NOTIFICATIONS</h3>

          {notifPermission !== 'granted' || !notifSettings.enabled ? (
            <button
              onClick={handleEnableNotifications}
              className="w-full bg-surface-container rounded-xl px-4 py-3.5 flex items-center gap-3 active:scale-[0.98] transition-transform text-left"
            >
              <Icon name="notifications" className="text-primary" size={20} />
              <div className="flex-1">
                <p className="text-sm text-on-surface font-medium">Enable notifications</p>
                <p className="text-[10px] text-secondary/50">Get reminders to log your daily wear</p>
              </div>
              <Icon name="chevron_right" className="text-secondary/60" size={18} />
            </button>
          ) : (
            <>
              {/* Daily reminder toggle */}
              <div className="bg-surface-container rounded-xl px-4 py-3.5 flex items-center gap-3">
                <Icon name="schedule" className="text-primary" size={20} />
                <div className="flex-1">
                  <p className="text-sm text-on-surface font-medium">Daily reminder</p>
                  <p className="text-[10px] text-secondary/50">Remind me to log my wear</p>
                </div>
                <button
                  onClick={() => handleToggleNotifSetting('dailyReminder')}
                  className={`w-11 h-6 rounded-full transition-colors relative ${
                    notifSettings.dailyReminder ? 'bg-primary' : 'bg-surface-container-highest'
                  }`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    notifSettings.dailyReminder ? 'translate-x-5' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>

              {/* Reminder time */}
              {notifSettings.dailyReminder && (
                <div className="bg-surface-container rounded-xl px-4 py-3.5 flex items-center gap-3">
                  <Icon name="alarm" className="text-primary/60" size={20} />
                  <div className="flex-1">
                    <p className="text-sm text-on-surface font-medium">Reminder time</p>
                  </div>
                  <input
                    type="time"
                    value={notifSettings.dailyReminderTime}
                    onChange={(e) => handleChangeReminderTime(e.target.value)}
                    className="bg-surface-container-highest text-on-surface text-xs font-bold px-3 py-1.5 rounded-lg border-none focus:outline-none focus:ring-1 focus:ring-primary/30"
                  />
                </div>
              )}

              {/* Streak reminder toggle */}
              <div className="bg-surface-container rounded-xl px-4 py-3.5 flex items-center gap-3">
                <Icon name="local_fire_department" className="text-primary" size={20} />
                <div className="flex-1">
                  <p className="text-sm text-on-surface font-medium">Streak alerts</p>
                  <p className="text-[10px] text-secondary/50">Warn when streak is about to break</p>
                </div>
                <button
                  onClick={() => handleToggleNotifSetting('streakReminder')}
                  className={`w-11 h-6 rounded-full transition-colors relative ${
                    notifSettings.streakReminder ? 'bg-primary' : 'bg-surface-container-highest'
                  }`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    notifSettings.streakReminder ? 'translate-x-5' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>

              {/* Disable all */}
              <button
                onClick={handleDisableNotifications}
                className="w-full bg-surface-container rounded-xl px-4 py-3.5 flex items-center gap-3 active:scale-[0.98] transition-transform text-left"
              >
                <Icon name="notifications_off" className="text-secondary/40" size={20} />
                <div className="flex-1">
                  <p className="text-sm text-secondary/60 font-medium">Disable all notifications</p>
                </div>
              </button>
            </>
          )}
        </section>
      )}

      {/* Data Management */}
      <section className="space-y-2">
        <h3 className="text-[10px] uppercase tracking-[0.15em] font-label text-secondary px-1 mb-3">DATA</h3>

        <button
          onClick={() => navigate('/data')}
          className="w-full bg-surface-container rounded-xl px-4 py-3.5 flex items-center gap-3 active:scale-[0.98] transition-transform text-left"
        >
          <Icon name="cloud_download" className="text-primary" size={20} />
          <div className="flex-1">
            <p className="text-sm text-on-surface font-medium">Export & Backup</p>
            <p className="text-[10px] text-secondary/50">JSON, CSV, HTML report, restore from backup</p>
          </div>
          <Icon name="chevron_right" className="text-secondary/60" size={18} />
        </button>

        <button
          onClick={() => setDeleteConfirmOpen(true)}
          className="w-full bg-surface-container rounded-xl px-4 py-3.5 flex items-center gap-3 active:scale-[0.98] transition-transform text-left"
        >
          <Icon name="delete_forever" className="text-error/70" size={20} />
          <div className="flex-1">
            <p className="text-sm text-error/70 font-medium">Delete all data</p>
            <p className="text-[10px] text-secondary/50">Remove collection, wears, reviews & decants</p>
          </div>
          <Icon name="chevron_right" className="text-secondary/60" size={18} />
        </button>
      </section>

      {/* Sign Out */}
      <section>
        <button
          onClick={signOut}
          className="w-full bg-surface-container rounded-xl px-4 py-3.5 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
        >
          <Icon name="logout" className="text-error/70" />
          <span className="text-sm text-error/70 font-medium">Sign out</span>
        </button>
      </section>

      {/* App Info */}
      <section className="text-center pt-4 pb-8">
        <p className="text-[10px] text-secondary/30 tracking-widest uppercase font-label">ScentFolio v2.0</p>
        <p className="text-[9px] text-secondary/20 mt-1">Letterboxd for fragrance lovers</p>
      </section>

      {/* Edit Name Sheet */}
      {editNameOpen && (
        <EditNameInline
          isOpen={editNameOpen}
          onClose={() => setEditNameOpen(false)}
          userId={user.id}
          currentName={profile?.display_name ?? ''}
          onSaved={(newName) => setProfile((p) => p ? { ...p, display_name: newName } : p)}
        />
      )}

      {/* Delete Confirm Dialog */}
      {deleteConfirmOpen && (
        <DeleteConfirmDialog
          isOpen={deleteConfirmOpen}
          onClose={() => setDeleteConfirmOpen(false)}
          onConfirm={handleDeleteAllData}
          deleting={deletingData}
        />
      )}
    </main>
  )
}

function EditNameInline({ isOpen, onClose, userId, currentName, onSaved }: {
  isOpen: boolean; onClose: () => void; userId: string; currentName: string; onSaved: (name: string) => void
}) {
  const [name, setName] = useState(currentName)
  const [saving, setSaving] = useState(false)
  const toast = useToast()
  const trapRef = useFocusTrap(isOpen, onClose)

  const handleSave = async () => {
    if (name.trim().length < 2) return
    setSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: name.trim(), updated_at: new Date().toISOString() })
      .eq('id', userId)
    setSaving(false)
    if (error) { toast.showToast('Failed to update name', 'error'); return }
    onSaved(name.trim())
    toast.showToast('Name updated', 'success')
    onClose()
  }

  return (
    <div ref={trapRef} className="fixed inset-0 z-[var(--z-sheet)] flex flex-col justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <section className="relative w-full bg-surface-container-low rounded-t-[2.5rem] sheet-shadow animate-slide-up">
        <div className="flex justify-center py-4"><div className="w-12 h-1 bg-surface-container-highest rounded-full" /></div>
        <div className="px-8 pb-10 space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-headline font-bold text-on-surface">Edit Name</h2>
            <button onClick={onClose} className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center active:scale-90 transition-transform">
              <Icon name="close" size={20} />
            </button>
          </div>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={50}
            autoFocus
            className="w-full bg-surface-container border-none text-on-surface placeholder:text-on-surface-variant/40 rounded-2xl px-4 py-3.5 text-sm focus:ring-1 focus:ring-primary/30 focus:outline-none"
          />
          <button
            onClick={handleSave}
            disabled={name.trim().length < 2 || saving}
            className="w-full py-4 gold-gradient text-on-primary font-bold uppercase tracking-[0.15em] rounded-2xl ambient-glow active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {saving ? 'SAVING...' : 'SAVE'}
          </button>
        </div>
      </section>
    </div>
  )
}

function DeleteConfirmDialog({ isOpen, onClose, onConfirm, deleting }: {
  isOpen: boolean; onClose: () => void; onConfirm: () => void; deleting: boolean
}) {
  const trapRef = useFocusTrap(isOpen, onClose)

  return (
    <div ref={trapRef} className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-6" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-surface-container-low rounded-2xl p-6 max-w-[340px] w-full space-y-4">
        <div className="flex items-center gap-3">
          <Icon name="warning" className="text-error text-2xl" />
          <h3 className="font-headline text-lg text-on-surface font-bold">Delete all data?</h3>
        </div>
        <p className="text-sm text-secondary/70">This will permanently remove your collection, wear logs, reviews, and decants. This cannot be undone.</p>
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-surface-container text-on-surface font-bold text-xs uppercase tracking-widest active:scale-95 transition-all">CANCEL</button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 py-3 rounded-xl bg-error/20 text-error font-bold text-xs uppercase tracking-widest active:scale-95 transition-all disabled:opacity-50"
          >
            {deleting ? 'DELETING...' : 'DELETE'}
          </button>
        </div>
      </div>
    </div>
  )
}

/** Get user settings from localStorage */
export function getUserSettings(): UserSettings {
  return loadSettings()
}
