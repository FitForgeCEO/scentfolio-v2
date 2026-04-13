import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { InlineError } from '../ui/InlineError'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { supabase } from '@/lib/supabase'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import type { Fragrance } from '@/types/database'

interface LayeringCombo {
  id: string
  user_id: string
  fragrance_a_id: string
  fragrance_b_id: string
  rating: number | null
  notes: string | null
  occasion: string | null
  created_at: string
  fragrance_a: Fragrance
  fragrance_b: Fragrance
}

export function LayeringCombosScreen() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const toast = useToast()
  const [combos, setCombos] = useState<LayeringCombo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)

  const fetchCombos = useCallback(() => {
    if (!user) { setLoading(false); return }
    setLoading(true)
    setError(null)
    supabase
      .from('layering_combos')
      .select('*, fragrance_a:fragrances!layering_combos_fragrance_a_id_fkey(*), fragrance_b:fragrances!layering_combos_fragrance_b_id_fkey(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (err) setError(err.message)
        else setCombos((data ?? []) as LayeringCombo[])
        setLoading(false)
      })
  }, [user])

  useEffect(() => { fetchCombos() }, [fetchCombos])

  const handleDelete = async (id: string) => {
    setCombos((prev) => prev.filter((c) => c.id !== id))
    const { error: err } = await supabase.from('layering_combos').delete().eq('id', id)
    if (err) { toast.showToast('Failed to delete', 'error'); fetchCombos() }
    else toast.showToast('Combo removed', 'success')
  }

  const handleRateCombo = async (id: string, rating: number) => {
    setCombos((prev) => prev.map((c) => c.id === id ? { ...c, rating } : c))
    await supabase.from('layering_combos').update({ rating, updated_at: new Date().toISOString() }).eq('id', id)
  }

  if (!user) {
    return (
      <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen flex flex-col items-center justify-center">
        <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center mb-5">
          <span className="text-3xl text-primary/40">?</span>
        </div>
        <h3 className="font-headline text-xl text-on-surface mb-2">Sign in to save combos</h3>
        <button onClick={() => navigate('/profile')} className="gold-gradient text-on-primary-container px-8 py-3 rounded-sm font-label text-[10px] font-bold uppercase tracking-widest hover:opacity-80 transition-all shadow-lg mt-6">SIGN IN</button>
      </main>
    )
  }

  if (error) return <main className="pt-24 pb-32 px-6"><InlineError message="Couldn't load combos" onRetry={fetchCombos} /></main>

  return (
    <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen space-y-6">
      <header>
        <h2 className="font-headline text-3xl text-on-surface leading-tight mb-1">Layering Combos</h2>
        <p className="font-body text-sm text-secondary opacity-70">Save & rate your favourite pairings</p>
      </header>

      {loading ? (
        <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 rounded-sm bg-surface-container animate-pulse" />)}</div>
      ) : combos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-20 h-20 rounded-full bg-surface-container flex items-center justify-center mb-6">
            <span className="text-primary/40 text-4xl">?</span>
          </div>
          <h3 className="font-headline text-xl text-on-surface mb-2">No combos yet</h3>
          <p className="text-sm text-secondary/60 text-center mb-8 max-w-[280px]">Save fragrance pairings that work well together and rate them.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {combos.map((combo) => (
            <div key={combo.id} className="bg-surface-container rounded-sm p-4 space-y-3">
              <div className="flex items-center gap-3">
                {/* Fragrance A */}
                <button onClick={() => navigate(`/fragrance/${combo.fragrance_a.id}`)} className="flex items-center gap-2 flex-1 min-w-0 hover:opacity-80">
                  <div className="w-10 h-10 rounded-sm overflow-hidden flex-shrink-0 bg-surface-container-highest">
                    {combo.fragrance_a.image_url && <img src={combo.fragrance_a.image_url} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[8px] uppercase tracking-wider text-primary/60 font-bold">{combo.fragrance_a.brand}</p>
                    <p className="text-xs text-on-surface truncate">{combo.fragrance_a.name}</p>
                  </div>
                </button>

                <span className="text-primary/40 flex-shrink-0">+</span>

                {/* Fragrance B */}
                <button onClick={() => navigate(`/fragrance/${combo.fragrance_b.id}`)} className="flex items-center gap-2 flex-1 min-w-0 hover:opacity-80">
                  <div className="w-10 h-10 rounded-sm overflow-hidden flex-shrink-0 bg-surface-container-highest">
                    {combo.fragrance_b.image_url && <img src={combo.fragrance_b.image_url} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[8px] uppercase tracking-wider text-primary/60 font-bold">{combo.fragrance_b.brand}</p>
                    <p className="text-xs text-on-surface truncate">{combo.fragrance_b.name}</p>
                  </div>
                </button>
              </div>

              {/* Rating */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => handleRateCombo(combo.id, star)}
                      className="hover:opacity-80 transition-transform"
                    >
                      <span>★</span>
                    </button>
                  ))}
                </div>
                <button onClick={() => handleDelete(combo.id)} className="text-secondary/40 active:text-error/70 transition-colors">
                  <span>?</span>
                </button>
              </div>

              {combo.notes && <p className="text-xs text-secondary/70 italic">{combo.notes}</p>}
              {combo.occasion && (
                <span className="inline-block bg-primary/10 text-primary text-[9px] font-bold tracking-wider uppercase px-2 py-1 rounded-full">{combo.occasion}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setAddOpen(true)}
        className="fixed bottom-24 right-6 z-[var(--z-fab)] w-14 h-14 rounded-full gold-gradient shadow-xl flex items-center justify-center hover:opacity-80 transition-all ambient-glow"
        aria-label="Add combo"
      >
        <span className="text-on-primary text-2xl">+</span>
      </button>

      {/* Add Combo Sheet */}
      {addOpen && (
        <AddComboSheet
          isOpen={addOpen}
          onClose={() => setAddOpen(false)}
          userId={user.id}
          onAdded={fetchCombos}
        />
      )}
    </main>
  )
}

function AddComboSheet({ isOpen, onClose, userId, onAdded }: {
  isOpen: boolean; onClose: () => void; userId: string; onAdded: () => void
}) {
  const toast = useToast()
  const trapRef = useFocusTrap(isOpen, onClose)
  const [step, setStep] = useState<1 | 2 | 3>(1) // 1: pick A, 2: pick B, 3: details
  const [fragA, setFragA] = useState<Fragrance | null>(null)
  const [fragB, setFragB] = useState<Fragrance | null>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Fragrance[]>([])
  const [searching, setSearching] = useState(false)
  const [rating, setRating] = useState(0)
  const [notes, setNotes] = useState('')
  const [occasion, setOccasion] = useState('')
  const [saving, setSaving] = useState(false)
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (query.length < 2) { setResults([]); return }
    setSearching(true)
    clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => {
      supabase
        .from('fragrances')
        .select('*')
        .or(`name.ilike.%${query}%,brand.ilike.%${query}%`)
        .order('rating', { ascending: false, nullsFirst: false })
        .limit(10)
        .then(({ data }) => {
          setResults((data ?? []) as Fragrance[])
          setSearching(false)
        })
    }, 250)
    return () => clearTimeout(searchTimeout.current)
  }, [query])

  const selectFragrance = (frag: Fragrance) => {
    if (step === 1) { setFragA(frag); setStep(2); setQuery(''); setResults([]) }
    else if (step === 2) { setFragB(frag); setStep(3); setQuery(''); setResults([]) }
  }

  const handleSave = async () => {
    if (!fragA || !fragB) return
    setSaving(true)
    const { error } = await supabase.from('layering_combos').insert({
      user_id: userId,
      fragrance_a_id: fragA.id,
      fragrance_b_id: fragB.id,
      rating: rating || null,
      notes: notes.trim() || null,
      occasion: occasion.trim() || null,
    })
    setSaving(false)
    if (error) { toast.showToast('Failed to save combo', 'error'); return }
    toast.showToast('Combo saved!', 'success')
    onAdded()
    onClose()
  }

  const stepLabel = step === 1 ? 'Pick first fragrance' : step === 2 ? 'Pick second fragrance' : 'Rate this combo'

  return (
    <div ref={trapRef} className="fixed inset-0 z-[var(--z-sheet)] flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="Add layering combo">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <section className="relative w-full max-h-[75vh] bg-surface-container-low rounded-t-[2.5rem] sheet-shadow flex flex-col overflow-hidden animate-slide-up">
        <div className="flex justify-center py-4"><div className="w-12 h-1 bg-surface-container-highest rounded-full" /></div>
        <header className="px-8 pb-4 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-headline font-bold text-on-surface">New Combo</h2>
            <p className="text-[10px] uppercase tracking-widest text-primary font-bold mt-1">{stepLabel}</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center hover:opacity-80 transition-transform">
            <span>✕</span>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-8 pb-8">
          {/* Selected fragrances preview */}
          {(fragA || fragB) && (
            <div className="flex items-center gap-3 mb-4 py-3 border-b border-outline-variant/10">
              {fragA && (
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="w-8 h-8 rounded-sm overflow-hidden bg-surface-container-highest flex-shrink-0">
                    {fragA.image_url && <img src={fragA.image_url} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <p className="text-xs text-on-surface truncate">{fragA.name}</p>
                </div>
              )}
              {fragA && fragB && <span className="text-primary/40">+</span>}
              {fragB && (
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="w-8 h-8 rounded-sm overflow-hidden bg-surface-container-highest flex-shrink-0">
                    {fragB.image_url && <img src={fragB.image_url} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <p className="text-xs text-on-surface truncate">{fragB.name}</p>
                </div>
              )}
            </div>
          )}

          {/* Search (steps 1-2) */}
          {step < 3 && (
            <>
              <div className="flex items-center bg-surface-container rounded-sm px-4 py-3 focus-within:ring-1 ring-primary/30 transition-all mb-4">
                <span className="text-secondary/50 mr-3">⌕</span>
                <input
                  className="bg-transparent border-none p-0 focus:ring-0 focus:outline-none text-on-surface placeholder:text-secondary/40 w-full text-sm"
                  placeholder="Search fragrances..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  autoFocus
                />
              </div>
              {searching ? (
                <div className="flex justify-center py-8"><span className="text-[9px] uppercase tracking-wider text-primary animate-pulse">Loading…</span></div>
              ) : (
                <div className="divide-y divide-outline-variant/10">
                  {results.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => selectFragrance(f)}
                      disabled={fragA?.id === f.id}
                      className="w-full flex items-center gap-3 py-3 text-left disabled:opacity-30 active:bg-surface-container-highest transition-colors"
                    >
                      <div className="w-10 h-10 rounded-sm overflow-hidden flex-shrink-0 bg-surface-container-highest">
                        {f.image_url && <img src={f.image_url} alt="" className="w-full h-full object-cover" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] uppercase tracking-wider text-primary/70 font-bold">{f.brand}</p>
                        <p className="text-sm text-on-surface truncate">{f.name}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Details (step 3) */}
          {step === 3 && (
            <div className="space-y-5">
              {/* Rating */}
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold mb-3">RATING</p>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button key={star} onClick={() => setRating(star)} className="hover:opacity-80 transition-transform">
                      <span>★</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Occasion */}
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold mb-3">OCCASION</p>
                <div className="flex flex-wrap gap-2">
                  {['Date Night', 'Work', 'Casual', 'Formal', 'Night Out', 'Cosy'].map((occ) => (
                    <button
                      key={occ}
                      onClick={() => setOccasion(occasion === occ ? '' : occ)}
                      className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-all ${occasion === occ ? 'bg-primary text-on-primary-container' : 'bg-surface-container text-on-surface'}`}
                    >
                      {occ}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold mb-3">NOTES</p>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="How do they work together?"
                  rows={3}
                  className="w-full bg-surface-container border-none text-on-surface placeholder:text-on-surface-variant/40 rounded-sm px-4 py-3 text-sm focus:ring-1 focus:ring-primary/30 focus:outline-none resize-none"
                />
              </div>

              {/* Save */}
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full py-4 gold-gradient text-on-primary font-bold uppercase tracking-[0.15em] rounded-sm ambient-glow hover:opacity-80 transition-all disabled:opacity-50"
              >
                {saving ? 'SAVING...' : 'SAVE COMBO'}
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
