import { useState } from 'react'
import { Icon } from '../ui/Icon'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import type { Fragrance } from '@/types/database'

const OCCASIONS = ['Casual', 'Office', 'Date Night', 'Night Out', 'Special Event']

interface LogWearSheetProps {
  isOpen: boolean
  onClose: () => void
  fragrance?: Fragrance | null
}

export function LogWearSheet({ isOpen, onClose, fragrance }: LogWearSheetProps) {
  const { user } = useAuth()
  const [selectedDay, setSelectedDay] = useState<'today' | 'yesterday' | 'custom'>('today')
  const [selectedOccasion, setSelectedOccasion] = useState('Casual')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  if (!isOpen) return null

  const getWearDate = () => {
    const d = new Date()
    if (selectedDay === 'yesterday') d.setDate(d.getDate() - 1)
    return d.toISOString().split('T')[0]
  }

  const handleLog = async () => {
    if (!user || !fragrance) return
    setSaving(true)

    const { error } = await supabase.from('wear_logs').insert({
      user_id: user.id,
      fragrance_id: fragrance.id,
      wear_date: getWearDate(),
      occasion: selectedOccasion.toLowerCase().replace(/ /g, '_'),
      notes: notes.trim() || null,
    })

    setSaving(false)
    if (!error) {
      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
        setNotes('')
        setSelectedDay('today')
        setSelectedOccasion('Casual')
        onClose()
      }, 1200)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Sheet */}
      <section className="relative w-full max-h-[75vh] bg-surface-container-low rounded-t-[2.5rem] sheet-shadow flex flex-col overflow-hidden animate-slide-up">
        {/* Drag Handle */}
        <div className="flex justify-center py-4">
          <div className="w-12 h-1 bg-surface-container-highest rounded-full" />
        </div>

        {/* Header */}
        <header className="px-8 pb-4 flex justify-between items-start">
          <h1 className="text-4xl font-headline font-bold text-on-surface leading-tight">Log Wear</h1>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center text-on-surface-variant active:scale-90 transition-transform"
          >
            <Icon name="close" size={20} />
          </button>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-8 space-y-8 pb-10">
          {/* Selected Fragrance Card */}
          {fragrance && (
            <div className="flex items-center gap-4 bg-surface-container p-4 rounded-2xl">
              <div className="w-12 h-12 bg-surface-container-highest rounded-lg overflow-hidden flex-shrink-0">
                {fragrance.image_url ? (
                  <img src={fragrance.image_url} alt={fragrance.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Icon name="water_drop" className="text-secondary/30" size={20} />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-[0.15em] text-primary font-bold">{fragrance.brand}</p>
                <h3 className="text-lg font-headline text-on-surface truncate">{fragrance.name}</h3>
              </div>
            </div>
          )}

          {/* Date Selector */}
          <div className="space-y-4">
            <label className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">WHEN</label>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedDay('today')}
                className={`flex-1 py-3 px-4 rounded-full text-xs font-bold tracking-wider active:scale-95 transition-all ${
                  selectedDay === 'today'
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container-highest text-on-surface-variant'
                }`}
              >
                TODAY
              </button>
              <button
                onClick={() => setSelectedDay('yesterday')}
                className={`flex-1 py-3 px-4 rounded-full text-xs font-bold tracking-wider active:scale-95 transition-all ${
                  selectedDay === 'yesterday'
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container-highest text-on-surface-variant'
                }`}
              >
                YESTERDAY
              </button>
              <button
                onClick={() => setSelectedDay('custom')}
                className="w-12 py-3 bg-surface-container-highest text-on-surface-variant rounded-full flex items-center justify-center active:scale-95 transition-all"
              >
                <Icon name="calendar_today" size={18} />
              </button>
            </div>
          </div>

          {/* Occasion */}
          <div className="space-y-4">
            <label className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">OCCASION</label>
            <div className="flex flex-wrap gap-2">
              {OCCASIONS.map((occ) => (
                <button
                  key={occ}
                  onClick={() => setSelectedOccasion(occ)}
                  className={`px-5 py-2.5 rounded-full text-sm transition-colors ${
                    selectedOccasion === occ
                      ? 'bg-primary text-on-primary font-semibold ambient-glow'
                      : 'bg-surface-container-highest text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {occ}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-3">
            <textarea
              className="w-full bg-surface-container border-none text-on-surface placeholder:text-on-surface-variant/40 rounded-2xl p-4 text-sm focus:ring-1 focus:ring-primary/30 focus:outline-none resize-none"
              placeholder="Add a note..."
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Footer */}
          <div className="pt-2 flex flex-col items-center gap-4">
            {success ? (
              <div className="w-full py-4 bg-primary/20 text-primary font-bold uppercase tracking-[0.15em] rounded-2xl text-center flex items-center justify-center gap-2">
                <Icon name="check_circle" filled className="text-xl" />
                LOGGED!
              </div>
            ) : (
              <button
                onClick={handleLog}
                disabled={saving || !fragrance || !user}
                className="w-full py-4 gold-gradient text-on-primary font-bold uppercase tracking-[0.15em] rounded-2xl ambient-glow active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {saving ? 'SAVING...' : !user ? 'SIGN IN TO LOG' : 'LOG WEAR'}
              </button>
            )}
            <div className="flex items-center gap-2">
              <Icon name="auto_awesome" filled className="text-primary text-sm" />
              <span className="text-[10px] font-bold tracking-[0.1em] text-primary">+10 XP EARNED</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
