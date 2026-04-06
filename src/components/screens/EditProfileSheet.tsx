import { useState } from 'react'
import { Icon } from '../ui/Icon'
import { supabase } from '@/lib/supabase'

interface EditProfileSheetProps {
  isOpen: boolean
  onClose: () => void
  userId: string
  currentName: string
  onSaved?: (newName: string) => void
}

export function EditProfileSheet({ isOpen, onClose, userId, currentName, onSaved }: EditProfileSheetProps) {
  const [displayName, setDisplayName] = useState(currentName)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const canSubmit = displayName.trim().length >= 2 && displayName.trim() !== currentName && !saving

  const handleSave = async () => {
    if (!canSubmit) return
    setSaving(true)
    setError(null)

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ display_name: displayName.trim(), updated_at: new Date().toISOString() })
      .eq('id', userId)

    setSaving(false)

    if (updateError) {
      setError('Something went wrong. Please try again.')
      return
    }

    setSuccess(true)
    onSaved?.(displayName.trim())
    setTimeout(() => {
      setSuccess(false)
      onClose()
    }, 800)
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <section className="relative w-full bg-surface-container-low rounded-t-[2.5rem] sheet-shadow flex flex-col overflow-hidden animate-slide-up">
        <div className="flex justify-center py-4">
          <div className="w-12 h-1 bg-surface-container-highest rounded-full" />
        </div>

        <header className="px-8 pb-4 flex justify-between items-start">
          <h1 className="text-3xl font-headline font-bold text-on-surface leading-tight">Edit Profile</h1>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center text-on-surface-variant active:scale-90 transition-transform"
          >
            <Icon name="close" size={20} />
          </button>
        </header>

        <div className="px-8 space-y-6 pb-10">
          {/* Display Name */}
          <div className="space-y-3">
            <label className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your display name"
              maxLength={50}
              className="w-full bg-surface-container border-none text-on-surface placeholder:text-on-surface-variant/40 rounded-2xl px-4 py-3.5 text-sm focus:ring-1 focus:ring-primary/30 focus:outline-none"
            />
            <p className="text-[9px] text-secondary/40">{displayName.trim().length}/50 characters</p>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 text-red-400 text-xs font-medium px-4 py-3 rounded-xl text-center">
              {error}
            </div>
          )}

          {/* Save */}
          {success ? (
            <div className="w-full py-4 bg-primary/20 text-primary font-bold uppercase tracking-[0.15em] rounded-2xl text-center flex items-center justify-center gap-2">
              <Icon name="check_circle" filled className="text-xl" />
              SAVED!
            </div>
          ) : (
            <button
              onClick={handleSave}
              disabled={!canSubmit}
              className="w-full py-4 gold-gradient text-on-primary font-bold uppercase tracking-[0.15em] rounded-2xl ambient-glow active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {saving ? 'SAVING...' : 'SAVE CHANGES'}
            </button>
          )}
        </div>
      </section>
    </div>
  )
}
