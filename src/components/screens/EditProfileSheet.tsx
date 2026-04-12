import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { useProfileExtras, useSignatureFragrance } from '@/hooks/useProfileExtras'
import type { Fragrance } from '@/types/database'

const POPULAR_NOTES = [
  'Bergamot', 'Vanilla', 'Sandalwood', 'Rose', 'Oud', 'Musk',
  'Amber', 'Jasmine', 'Patchouli', 'Tonka Bean', 'Cedar', 'Lavender',
  'Vetiver', 'Iris', 'Neroli', 'Cardamom', 'Saffron', 'Fig',
]

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
  const trapRef = useFocusTrap(isOpen, onClose)

  // Profile extras
  const { data: extras, save: saveExtras } = useProfileExtras(userId)
  const [bio, setBio] = useState('')
  const [favoriteNotes, setFavoriteNotes] = useState<string[]>([])
  const [signatureId, setSignatureId] = useState<string | null>(null)

  // Signature scent picker
  const [scentPickerOpen, setScentPickerOpen] = useState(false)
  const [scentSearch, setScentSearch] = useState('')
  const [scentResults, setScentResults] = useState<Fragrance[]>([])
  const [scentSearching, setScentSearching] = useState(false)
  const signatureFragrance = useSignatureFragrance(signatureId)

  // Sync extras to local state when data loads
  useEffect(() => {
    if (extras) {
      setBio(extras.bio)
      setFavoriteNotes(extras.favorite_notes)
      setSignatureId(extras.signature_fragrance_id)
    }
  }, [extras])

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setDisplayName(currentName)
      setSuccess(false)
      setError(null)
    }
  }, [isOpen, currentName])

  if (!isOpen) return null

  const nameChanged = displayName.trim().length >= 2 && displayName.trim() !== currentName
  const extrasChanged =
    bio !== extras.bio ||
    signatureId !== extras.signature_fragrance_id ||
    JSON.stringify(favoriteNotes) !== JSON.stringify(extras.favorite_notes)
  const canSubmit = (nameChanged || extrasChanged) && !saving

  const toggleNote = (note: string) => {
    setFavoriteNotes((prev) =>
      prev.includes(note) ? prev.filter((n) => n !== note) : [...prev, note].slice(0, 8)
    )
  }

  // Signature scent search
  const handleScentSearch = (q: string) => {
    setScentSearch(q)
    if (q.length < 2) { setScentResults([]); return }
    setScentSearching(true)
    supabase
      .from('user_collections')
      .select('fragrance:fragrances(id, name, brand, image_url)')
      .eq('user_id', userId)
      .then(({ data }) => {
        type Row = { fragrance: { id: string; name: string; brand: string; image_url: string | null } | null }
        const rows = (data ?? []) as unknown as Row[]
        const frags = rows
          .map((r) => r.fragrance)
          .filter((f): f is NonNullable<typeof f> => !!f)
          .filter((f) =>
            f.name.toLowerCase().includes(q.toLowerCase()) ||
            f.brand.toLowerCase().includes(q.toLowerCase())
          )
        setScentResults(frags as Fragrance[])
        setScentSearching(false)
      })
  }

  const handleSave = async () => {
    if (!canSubmit) return
    setSaving(true)
    setError(null)

    // Save display name if changed
    if (nameChanged) {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ display_name: displayName.trim(), updated_at: new Date().toISOString() })
        .eq('id', userId)

      if (updateError) {
        setError('Something went wrong. Please try again.')
        setSaving(false)
        return
      }
      onSaved?.(displayName.trim())
    }

    // Save extras if changed
    if (extrasChanged) {
      await saveExtras({ bio, signature_fragrance_id: signatureId, favorite_notes: favoriteNotes })
    }

    setSaving(false)
    setSuccess(true)
    setTimeout(() => {
      setSuccess(false)
      onClose()
    }, 800)
  }

  return (
    <div ref={trapRef} className="fixed inset-0 z-[var(--z-sheet)] flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="Edit profile">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <section className="relative w-full max-h-[90vh] bg-surface-container-low rounded-t-[2.5rem] sheet-shadow flex flex-col overflow-hidden animate-slide-up">
        <div className="flex justify-center py-4">
          <div className="w-12 h-1 bg-surface-container-highest rounded-full" />
        </div>

        <header className="px-8 pb-4 flex justify-between items-start">
          <h1 className="text-3xl font-headline font-bold text-on-surface leading-tight">Edit Profile</h1>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-10 h-10 rounded-sm bg-surface-container-highest flex items-center justify-center text-on-surface-variant transition-opacity hover:opacity-80"
          >
            <span className="text-sm">×</span>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-8 space-y-7 pb-10">
          {/* Display Name */}
          <div className="space-y-3">
            <label className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your display name"
              maxLength={50}
              className="w-full bg-surface-container border-none text-on-surface placeholder:text-on-surface-variant/40 rounded-sm px-4 py-3.5 text-sm focus:ring-1 focus:ring-primary/30 focus:outline-none"
            />
            <p className="text-[9px] text-secondary/60">{displayName.trim().length}/50 characters</p>
          </div>

          {/* Bio */}
          <div className="space-y-3">
            <label className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">Bio</label>
            <textarea
              className="w-full bg-surface-container border-none text-on-surface placeholder:text-on-surface-variant/40 rounded-sm p-4 text-sm focus:ring-1 focus:ring-primary/30 focus:outline-none resize-none"
              placeholder="Tell the community about your fragrance journey..."
              rows={3}
              maxLength={200}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
            <p className="text-[9px] text-secondary/60">{bio.length}/200 characters</p>
          </div>

          {/* Signature Scent */}
          <div className="space-y-3">
            <label className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">Signature Scent</label>
            <p className="text-[10px] text-secondary/60 -mt-1 italic">Your all-time favourite — shown on your profile</p>

            {signatureFragrance && !scentPickerOpen ? (
              <div className="flex items-center gap-3 bg-surface-container p-3 rounded-sm">
                <div className="w-10 h-10 rounded-sm overflow-hidden bg-surface-container-highest flex-shrink-0">
                  {signatureFragrance.image_url ? (
                    <img src={signatureFragrance.image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-secondary/30 text-[10px] italic">—</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] uppercase tracking-[0.1em] text-primary/70 font-bold">{signatureFragrance.brand}</p>
                  <p className="text-sm text-on-surface truncate">{signatureFragrance.name}</p>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => setScentPickerOpen(true)}
                    className="w-8 h-8 rounded-sm bg-surface-container-highest flex items-center justify-center transition-opacity hover:opacity-80"
                    aria-label="Change"
                  >
                    <span className="text-secondary text-[9px] italic">edit</span>
                  </button>
                  <button
                    onClick={() => setSignatureId(null)}
                    className="w-8 h-8 rounded-sm bg-surface-container-highest flex items-center justify-center transition-opacity hover:opacity-80"
                    aria-label="Remove"
                  >
                    <span className="text-secondary text-sm">×</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative flex items-center bg-surface-container rounded-sm px-4 py-3 focus-within:ring-1 ring-primary/30 transition-all">
                  <span className="text-secondary/40 mr-2 text-xs italic">search</span>
                  <input
                    className="bg-transparent border-none p-0 focus:ring-0 focus:outline-none text-on-surface placeholder:text-secondary/40 w-full text-sm"
                    placeholder="Search your collection..."
                    value={scentSearch}
                    onChange={(e) => handleScentSearch(e.target.value)}
                    autoFocus={scentPickerOpen}
                  />
                  {scentSearch && (
                    <button onClick={() => { setScentSearch(''); setScentResults([]) }} className="text-secondary/60 transition-opacity hover:opacity-80">
                      <span className="text-sm">×</span>
                    </button>
                  )}
                </div>
                {scentSearching && (
                  <div className="flex flex-col gap-2 py-4 px-2">
                    {[1,2].map(i => (
                      <div key={i} className="h-3 rounded-sm bg-surface-container-highest/40 animate-pulse" style={{ width: `${80 - i * 20}%` }} />
                    ))}
                  </div>
                )}
                {scentResults.length > 0 && (
                  <div className="bg-surface-container rounded-sm overflow-hidden max-h-[180px] overflow-y-auto">
                    {scentResults.map((frag) => (
                      <button
                        key={frag.id}
                        onClick={() => {
                          setSignatureId(frag.id)
                          setScentPickerOpen(false)
                          setScentSearch('')
                          setScentResults([])
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-surface-container-highest transition-opacity"
                      >
                        <div className="w-8 h-8 rounded-sm overflow-hidden bg-surface-container-highest flex-shrink-0">
                          {frag.image_url ? (
                            <img src={frag.image_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <span className="text-secondary/30 text-[9px] italic">—</span>
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[9px] text-primary/60 uppercase tracking-wider">{frag.brand}</p>
                          <p className="text-xs text-on-surface truncate">{frag.name}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {scentPickerOpen && signatureFragrance && (
                  <button
                    onClick={() => { setScentPickerOpen(false); setScentSearch(''); setScentResults([]) }}
                    className="text-[10px] text-secondary/60 transition-opacity hover:opacity-80 italic"
                  >
                    Cancel
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Favourite Notes */}
          <div className="space-y-3">
            <label className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">
              Favourite Notes <span className="text-secondary/40 normal-case tracking-normal">(up to 8)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {POPULAR_NOTES.map((note) => (
                <button
                  key={note}
                  type="button"
                  onClick={() => toggleNote(note)}
                  className={`px-3 py-2 rounded-sm text-[10px] font-medium transition-colors ${
                    favoriteNotes.includes(note)
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-container-highest text-secondary/70'
                  }`}
                >
                  {note}
                </button>
              ))}
            </div>
            {favoriteNotes.length > 0 && (
              <p className="text-[9px] text-secondary/50">{favoriteNotes.length}/8 selected</p>
            )}
          </div>

          {/* Error */}
          {error && (
            <div role="alert" className="bg-red-500/10 text-red-400 text-xs font-medium px-4 py-3 rounded-sm text-center">
              {error}
            </div>
          )}

          {/* Save */}
          {success ? (
            <div role="status" aria-live="polite" className="w-full py-4 bg-primary/20 text-primary font-bold uppercase tracking-[0.15em] rounded-sm text-center flex items-center justify-center gap-2">
              <span className="text-lg">✓</span>
              SAVED!
            </div>
          ) : (
            <button
              onClick={handleSave}
              disabled={!canSubmit}
              className="w-full py-4 gold-gradient text-on-primary font-bold uppercase tracking-[0.15em] rounded-sm ambient-glow transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {saving ? 'SAVING...' : 'SAVE CHANGES'}
            </button>
          )}
        </div>
      </section>
    </div>
  )
}
