import { useState, useEffect, useRef } from 'react'
import { Icon } from '../ui/Icon'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { awardXP, XP_AWARDS } from '@/lib/xp'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import type { Fragrance } from '@/types/database'

const OCCASIONS = ['Casual', 'Office', 'Date Night', 'Night Out', 'Special Event']

interface LogWearSheetProps {
  isOpen: boolean
  onClose: () => void
  fragrance?: Fragrance | null
}

export function LogWearSheet({ isOpen, onClose, fragrance: passedFragrance }: LogWearSheetProps) {
  const { user } = useAuth()
  const [selectedDay, setSelectedDay] = useState<'today' | 'yesterday' | 'custom'>('today')
  const [customDate, setCustomDate] = useState('')
  const [selectedOccasion, setSelectedOccasion] = useState('Casual')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [xpGained, setXpGained] = useState(0)

  // Fragrance selection state (for when no fragrance is pre-passed)
  const [chosenFragrance, setChosenFragrance] = useState<Fragrance | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Fragrance[]>([])
  const [searching, setSearching] = useState(false)
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>()

  const trapRef = useFocusTrap(isOpen, onClose)
  const fragrance = passedFragrance ?? chosenFragrance

  // Reset state when sheet closes
  useEffect(() => {
    if (!isOpen) {
      setChosenFragrance(null)
      setSearchQuery('')
      setSearchResults([])
    }
  }, [isOpen])

  // Debounced search
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => {
      supabase
        .from('fragrances')
        .select('*')
        .or(`name.ilike.%${searchQuery}%,brand.ilike.%${searchQuery}%`)
        .not('image_url', 'is', null)
        .order('rating', { ascending: false, nullsFirst: false })
        .limit(8)
        .then(({ data }) => {
          if (data) setSearchResults(data as Fragrance[])
          setSearching(false)
        })
    }, 300)
    return () => clearTimeout(searchTimeout.current)
  }, [searchQuery])

  if (!isOpen) return null

  const getWearDate = () => {
    if (selectedDay === 'custom' && customDate) return customDate
    const d = new Date()
    if (selectedDay === 'yesterday') d.setDate(d.getDate() - 1)
    return d.toISOString().split('T')[0]
  }

  const handleLog = async () => {
    if (!user || !fragrance) return
    if (selectedDay === 'custom' && !customDate) return
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
      // Award XP
      const result = await awardXP(user.id, 'LOG_WEAR')
      setXpGained(result ? XP_AWARDS.LOG_WEAR : 0)
      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
        setXpGained(0)
        setNotes('')
        setCustomDate('')
        setSelectedDay('today')
        setSelectedOccasion('Casual')
        setChosenFragrance(null)
        setSearchQuery('')
        onClose()
      }, 1200)
    }
  }

  const handleSelectFragrance = (f: Fragrance) => {
    setChosenFragrance(f)
    setSearchQuery('')
    setSearchResults([])
  }

  return (
    <div ref={trapRef} className="fixed inset-0 z-[var(--z-sheet)] flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="Log wear">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Sheet */}
      <section className="relative w-full max-h-[85vh] bg-surface-container-low rounded-t-[2.5rem] sheet-shadow flex flex-col overflow-hidden animate-slide-up">
        {/* Drag Handle */}
        <div className="flex justify-center py-4">
          <div className="w-12 h-1 bg-surface-container-highest rounded-full" />
        </div>

        {/* Header */}
        <header className="px-8 pb-4 flex justify-between items-start">
          <h1 className="text-4xl font-headline font-bold text-on-surface leading-tight">Log Wear</h1>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center text-on-surface-variant active:scale-90 transition-transform"
          >
            <Icon name="close" size={20} />
          </button>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-8 space-y-8 pb-10">

          {/* Fragrance Selector — shown when no fragrance pre-passed */}
          {!passedFragrance && !chosenFragrance && (
            <div className="space-y-3">
              <label className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">FRAGRANCE</label>
              <div className="relative">
                <div className="flex items-center bg-surface-container rounded-2xl px-4 py-3 focus-within:ring-1 ring-primary/30 transition-all">
                  <Icon name="search" className="text-secondary/50 mr-3" size={18} />
                  <input
                    className="bg-transparent border-none p-0 focus:ring-0 focus:outline-none text-on-surface placeholder:text-secondary/40 w-full text-sm"
                    placeholder="Search by name or brand..."
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} aria-label="Clear search" className="text-secondary/60 active:scale-90 transition-transform">
                      <Icon name="close" size={16} />
                    </button>
                  )}
                </div>

                {/* Search Results */}
                {searchQuery.length >= 2 && (
                  <div className="mt-2 max-h-[35vh] overflow-y-auto rounded-2xl bg-surface-container divide-y divide-outline-variant/10">
                    {searching ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : searchResults.length === 0 ? (
                      <div className="py-8 text-center">
                        <p className="text-sm text-secondary/50">No fragrances found</p>
                      </div>
                    ) : (
                      searchResults.map((f) => (
                        <button
                          key={f.id}
                          onClick={() => handleSelectFragrance(f)}
                          className="w-full flex items-center gap-3 p-3 hover:bg-surface-container-highest active:bg-surface-container-highest transition-colors text-left"
                        >
                          <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-surface-container-highest">
                            {f.image_url ? (
                              <img src={f.image_url} alt={f.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Icon name="water_drop" className="text-secondary/30" size={16} />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[9px] uppercase tracking-[0.15em] text-primary/70 font-bold">{f.brand}</p>
                            <p className="text-sm text-on-surface truncate">{f.name}</p>
                          </div>
                          {f.rating && (
                            <div className="flex items-center gap-0.5 text-primary/60">
                              <Icon name="star" filled className="text-[11px]" />
                              <span className="text-[10px] font-bold">{Number(f.rating).toFixed(1)}</span>
                            </div>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

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
              {/* Allow changing fragrance when no pre-passed fragrance */}
              {!passedFragrance && (
                <button
                  onClick={() => { setChosenFragrance(null); setSearchQuery('') }}
                  aria-label="Change fragrance"
                  className="w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center text-secondary/60 active:scale-90 transition-transform flex-shrink-0"
                >
                  <Icon name="swap_horiz" size={16} />
                </button>
              )}
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
                className={`w-12 py-3 rounded-full flex items-center justify-center active:scale-95 transition-all ${
                  selectedDay === 'custom'
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container-highest text-on-surface-variant'
                }`}
              >
                <Icon name="calendar_today" size={18} />
              </button>
            </div>

            {/* Custom date input */}
            {selectedDay === 'custom' && (
              <input
                type="date"
                value={customDate}
                max={new Date().toISOString().split('T')[0]}
                onChange={(e) => setCustomDate(e.target.value)}
                className="w-full py-3 px-4 bg-surface-container text-on-surface rounded-2xl text-sm focus:ring-1 focus:ring-primary/30 focus:outline-none [color-scheme:dark]"
              />
            )}
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
              <div role="status" aria-live="polite" className="w-full py-4 bg-primary/20 text-primary font-bold uppercase tracking-[0.15em] rounded-2xl text-center flex items-center justify-center gap-2">
                <Icon name="check_circle" filled className="text-xl" />
                LOGGED!
              </div>
            ) : (
              <button
                onClick={handleLog}
                disabled={saving || !fragrance || !user || (selectedDay === 'custom' && !customDate)}
                className="w-full py-4 gold-gradient text-on-primary font-bold uppercase tracking-[0.15em] rounded-2xl ambient-glow active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {saving ? 'SAVING...' : !user ? 'SIGN IN TO LOG' : !fragrance ? 'SELECT A FRAGRANCE' : 'LOG WEAR'}
              </button>
            )}
            <div className="flex items-center gap-2">
              <Icon name="auto_awesome" filled className="text-primary text-sm" />
              <span className="text-[10px] font-bold tracking-[0.1em] text-primary">
                {success && xpGained > 0 ? `+${xpGained} XP EARNED` : `+${XP_AWARDS.LOG_WEAR} XP`}
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
