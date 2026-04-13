import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { InlineError } from '../ui/InlineError'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { useDecants, createDecant, updateDecantRemaining, deleteDecant } from '@/hooks/useDecants'
import { supabase } from '@/lib/supabase'
import type { Decant } from '@/hooks/useDecants'
import type { Fragrance } from '@/types/database'

const SIZE_TYPES = [
  { value: 'full', label: 'Full Bottle', defaultMl: 100 },
  { value: 'travel', label: 'Travel Size', defaultMl: 10 },
  { value: 'decant', label: 'Decant', defaultMl: 5 },
  { value: 'sample', label: 'Sample', defaultMl: 2 },
  { value: 'discovery', label: 'Discovery Set', defaultMl: 1.5 },
] as const

const SIZE_COLORS: Record<string, string> = {
  full: 'bg-primary/15 text-primary',
  travel: 'bg-tertiary/15 text-tertiary',
  decant: 'bg-secondary/20 text-secondary',
  sample: 'bg-error/15 text-error/80',
  discovery: 'bg-primary-fixed/15 text-primary-fixed',
}

export function DecantsScreen() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { showToast } = useToast()
  const { data: decants, loading, error, retry } = useDecants(user?.id)
  const [addSheetOpen, setAddSheetOpen] = useState(false)

  const handleDelete = async (decant: Decant) => {
    const { error: err } = await deleteDecant(decant.id)
    if (err) showToast('Failed to delete', 'error')
    else { showToast('Removed', 'info'); retry() }
  }

  const handleUpdateRemaining = async (decant: Decant, newMl: number) => {
    const { error: err } = await updateDecantRemaining(decant.id, newMl)
    if (err) showToast('Failed to update', 'error')
    else retry()
  }

  if (!user) {
    return (
      <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen flex flex-col items-center justify-center">
        <div className="w-16 h-16 rounded-sm bg-surface-container flex items-center justify-center mb-5">
          <span className="text-3xl text-primary/40 font-serif italic">D</span>
        </div>
        <h3 className="font-headline text-xl text-on-surface mb-2">Sign in to track decants</h3>
        <p className="text-sm text-secondary/60 text-center mb-6">Track your full bottles, decants, samples, and discovery sets.</p>
        <button onClick={() => navigate('/profile')} className="gold-gradient text-on-primary px-8 py-3 rounded-sm font-label text-[10px] font-bold uppercase tracking-widest transition-opacity hover:opacity-90 ambient-glow">SIGN IN</button>
      </main>
    )
  }

  // Summary stats
  const totalItems = decants.length
  const totalMl = decants.reduce((sum, d) => sum + (d.remaining_ml ?? d.size_ml ?? 0), 0)
  const totalValue = decants.reduce((sum, d) => sum + (d.purchase_price ?? 0), 0)
  const typeBreakdown = SIZE_TYPES.map((st) => ({
    ...st,
    count: decants.filter((d) => d.size_type === st.value).length,
  })).filter((t) => t.count > 0)

  return (
    <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen">
      <header className="mb-6">
        <h2 className="font-headline text-3xl text-on-surface leading-tight mb-1">Decants & Samples</h2>
        <p className="font-body text-sm text-secondary opacity-70">
          Track every ml across {totalItems} item{totalItems !== 1 ? 's' : ''}
        </p>
      </header>

      {error ? (
        <InlineError message="Couldn't load decants" onRetry={retry} />
      ) : loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-sm bg-surface-container animate-pulse" />
          ))}
        </div>
      ) : decants.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-20 h-20 rounded-sm bg-surface-container flex items-center justify-center mb-6">
            <span className="text-primary/40 text-4xl font-serif italic">D</span>
          </div>
          <h3 className="font-headline text-xl text-on-surface mb-2 text-center">No decants yet</h3>
          <p className="text-sm text-secondary/60 text-center mb-8 max-w-[280px]">
            Track your full bottles, travel sizes, decants, and samples all in one place.
          </p>
          <button onClick={() => setAddSheetOpen(true)} className="gold-gradient text-on-primary px-8 py-3 rounded-sm font-label text-[10px] font-bold uppercase tracking-widest transition-opacity hover:opacity-90 ambient-glow">
            ADD FIRST ITEM
          </button>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <section className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-surface-container rounded-sm p-3 text-center">
              <p className="text-xl font-headline text-on-surface font-bold">{totalItems}</p>
              <p className="text-[8px] uppercase tracking-[0.2em] text-secondary/50 font-bold">ITEMS</p>
            </div>
            <div className="bg-surface-container rounded-sm p-3 text-center">
              <p className="text-xl font-headline text-on-surface font-bold">{totalMl.toFixed(0)}<span className="text-xs text-secondary/50">ml</span></p>
              <p className="text-[8px] uppercase tracking-[0.2em] text-secondary/50 font-bold">TOTAL ML</p>
            </div>
            <div className="bg-surface-container rounded-sm p-3 text-center">
              <p className="text-xl font-headline text-on-surface font-bold">{totalValue > 0 ? `£${totalValue.toFixed(0)}` : '—'}</p>
              <p className="text-[8px] uppercase tracking-[0.2em] text-secondary/50 font-bold">VALUE</p>
            </div>
          </section>

          {/* Type pills */}
          {typeBreakdown.length > 1 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {typeBreakdown.map((t) => (
                <span key={t.value} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-[10px] font-bold tracking-wider uppercase ${SIZE_COLORS[t.value] || 'bg-surface-container-highest text-secondary'}`}>
                  {t.label} ({t.count})
                </span>
              ))}
            </div>
          )}

          {/* Decant List */}
          <div className="space-y-3">
            {decants.map((decant) => (
              <DecantCard
                key={decant.id}
                decant={decant}
                onTap={() => navigate(`/fragrance/${decant.fragrance.id}`)}
                onUpdateRemaining={(ml) => handleUpdateRemaining(decant, ml)}
                onDelete={() => handleDelete(decant)}
              />
            ))}
          </div>
        </>
      )}

      {/* FAB */}
      {user && (
        <button
          onClick={() => setAddSheetOpen(true)}
          className="fixed bottom-24 right-6 z-[var(--z-fab)] w-14 h-14 rounded-sm gold-gradient shadow-xl flex items-center justify-center transition-opacity hover:opacity-90 ambient-glow"
          aria-label="Add decant"
        >
          <span className="text-on-primary text-2xl">+</span>
        </button>
      )}

      {addSheetOpen && (
        <AddDecantSheet
          userId={user.id}
          onClose={() => setAddSheetOpen(false)}
          onAdded={() => { setAddSheetOpen(false); retry() }}
        />
      )}
    </main>
  )
}

function DecantCard({
  decant,
  onTap,
  onUpdateRemaining,
  onDelete,
}: {
  decant: Decant
  onTap: () => void
  onUpdateRemaining: (ml: number) => void
  onDelete: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const frag = decant.fragrance
  const sizeMl = decant.size_ml ?? 0
  const remainingMl = decant.remaining_ml ?? sizeMl
  const percentage = sizeMl > 0 ? Math.round((remainingMl / sizeMl) * 100) : 100
  const sizeInfo = SIZE_TYPES.find((s) => s.value === decant.size_type)

  return (
    <div className="bg-surface-container rounded-sm overflow-hidden">
      <button onClick={onTap} className="w-full flex items-center gap-3.5 p-4 text-left hover:bg-surface-container-highest transition-opacity">
        <div className="w-14 h-14 rounded-sm overflow-hidden flex-shrink-0 bg-surface-container-highest">
          {frag.image_url ? (
            <img src={frag.image_url} alt={frag.name} className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-secondary/30 text-xs italic">—</span>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className={`text-[8px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-sm ${SIZE_COLORS[decant.size_type] || 'bg-surface-container-highest text-secondary'}`}>
              {sizeInfo?.label || decant.size_type}
            </span>
          </div>
          <p className="text-[9px] uppercase tracking-[0.15em] text-primary/70 font-bold">{frag.brand}</p>
          <p className="text-sm text-on-surface font-medium truncate">{frag.name}</p>

          {/* Remaining bar */}
          {sizeMl > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-surface-container-highest overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    percentage > 50 ? 'bg-tertiary' : percentage > 20 ? 'bg-primary' : 'bg-error'
                  }`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <span className="text-[10px] text-secondary/60 font-medium flex-shrink-0">{remainingMl}ml / {sizeMl}ml</span>
            </div>
          )}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }}
          className="w-8 h-8 rounded-sm bg-surface-container-highest flex items-center justify-center flex-shrink-0 transition-opacity hover:opacity-80"
          aria-label="More actions"
        >
          <span className="text-secondary/60 text-xs">{expanded ? '‹' : '›'}</span>
        </button>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 animate-slide-down">
          {/* Quick adjust remaining */}
          {sizeMl > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-secondary/50 w-16">Remaining:</span>
              <div className="flex items-center gap-1.5">
                {[0.5, 1, 2].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => onUpdateRemaining(Math.max(0, remainingMl - amt))}
                    className="px-3 py-1.5 rounded-sm bg-surface-container-highest text-[10px] font-bold text-secondary transition-opacity hover:opacity-80"
                  >
                    -{amt}ml
                  </button>
                ))}
                <button
                  onClick={() => onUpdateRemaining(sizeMl)}
                  className="px-3 py-1.5 rounded-sm bg-primary/10 text-[10px] font-bold text-primary transition-opacity hover:opacity-80"
                >
                  REFILL
                </button>
              </div>
            </div>
          )}

          {decant.source && (
            <p className="text-[10px] text-secondary/50">
              <span className="font-bold">Source:</span> {decant.source}
            </p>
          )}
          {decant.notes && (
            <p className="text-[10px] text-secondary/50">
              <span className="font-bold">Notes:</span> {decant.notes}
            </p>
          )}

          <button
            onClick={onDelete}
            className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-error/60 uppercase transition-opacity hover:opacity-80"
          >
            <span>✕</span>
            DELETE
          </button>
        </div>
      )}
    </div>
  )
}

function AddDecantSheet({
  userId,
  onClose,
  onAdded,
}: {
  userId: string
  onClose: () => void
  onAdded: () => void
}) {
  const trapRef = useFocusTrap(true, onClose)
  const { showToast } = useToast()
  const [step, setStep] = useState<'search' | 'details'>('search')
  const [selectedFrag, setSelectedFrag] = useState<Fragrance | null>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Fragrance[]>([])
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Form fields
  const [sizeType, setSizeType] = useState('full')
  const [sizeMl, setSizeMl] = useState('')
  const [price, setPrice] = useState('')
  const [source, setSource] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    clearTimeout(debounceRef.current)
    if (query.length < 2) { setResults([]); return }
    setSearching(true)
    debounceRef.current = setTimeout(() => {
      supabase
        .from('fragrances')
        .select('*')
        .or(`name.ilike.%${query}%,brand.ilike.%${query}%`)
        .order('rating', { ascending: false, nullsFirst: false })
        .limit(15)
        .then(({ data }) => {
          if (data) setResults(data as Fragrance[])
          setSearching(false)
        })
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [query])

  const handleSelectFragrance = (f: Fragrance) => {
    setSelectedFrag(f)
    const defaultMl = SIZE_TYPES.find((s) => s.value === sizeType)?.defaultMl ?? 100
    setSizeMl(defaultMl.toString())
    setStep('details')
  }

  const handleSave = async () => {
    if (!selectedFrag) return
    setSaving(true)
    const ml = parseFloat(sizeMl) || undefined
    const { error } = await createDecant({
      user_id: userId,
      fragrance_id: selectedFrag.id,
      size_type: sizeType,
      size_ml: ml,
      remaining_ml: ml,
      purchase_price: parseFloat(price) || undefined,
      source: source || undefined,
      notes: notes || undefined,
    })
    if (error) {
      showToast('Failed to add', 'error')
      setSaving(false)
    } else {
      showToast(`${selectedFrag.name} added!`, 'success', 'science')
      onAdded()
    }
  }

  const handleSizeTypeChange = (type: string) => {
    setSizeType(type)
    const defaultMl = SIZE_TYPES.find((s) => s.value === type)?.defaultMl ?? 100
    setSizeMl(defaultMl.toString())
  }

  return (
    <div ref={trapRef} className="fixed inset-0 z-[var(--z-sheet)] flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="Add decant">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <section className="relative w-full max-h-[85vh] bg-surface-container-low rounded-t-[2.5rem] sheet-shadow flex flex-col overflow-hidden animate-slide-up">
        <div className="flex justify-center py-4"><div className="w-12 h-1 bg-surface-container-highest rounded-full" /></div>
        <header className="px-8 pb-4 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-headline font-bold text-on-surface">
              {step === 'search' ? 'Add Item' : 'Details'}
            </h2>
            {step === 'details' && selectedFrag && (
              <p className="text-xs text-secondary/60 mt-0.5">{selectedFrag.brand} — {selectedFrag.name}</p>
            )}
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-sm bg-surface-container-highest flex items-center justify-center text-on-surface-variant transition-opacity hover:opacity-80">
            <span className="text-sm">×</span>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-8 pb-8">
          {step === 'search' ? (
            <>
              <div className="flex items-center bg-surface-container rounded-sm px-4 py-3 focus-within:ring-1 ring-primary/30 transition-all mb-4">
                <span className="text-secondary/40 mr-2 text-xs italic">search</span>
                <input
                  className="bg-transparent border-none p-0 focus:ring-0 focus:outline-none text-on-surface placeholder:text-secondary/40 w-full text-sm"
                  placeholder="Search fragrances..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  autoFocus
                />
              </div>
              {searching ? (
                <div className="flex flex-col gap-2 py-8 px-2">
                  {[1,2,3].map(i => (
                    <div key={i} className="h-3 rounded-sm bg-surface-container-highest/40 animate-pulse" style={{ width: `${90 - i * 15}%` }} />
                  ))}
                </div>
              ) : (
                <div className="space-y-1">
                  {results.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => handleSelectFragrance(f)}
                      className="w-full flex items-center gap-3 py-3 text-left hover:bg-surface-container-highest transition-opacity"
                    >
                      <div className="w-11 h-11 rounded-sm overflow-hidden flex-shrink-0 bg-surface-container-highest">
                        {f.image_url ? <img src={f.image_url} alt={f.name} className="w-full h-full object-cover" /> : (
                          <div className="w-full h-full flex items-center justify-center"><span className="text-secondary/30 text-[9px] italic">—</span></div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] uppercase tracking-[0.15em] text-primary/70 font-bold">{f.brand}</p>
                        <p className="text-sm text-on-surface truncate">{f.name}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-6">
              {/* Size Type */}
              <div>
                <label className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold block mb-3">TYPE</label>
                <div className="flex flex-wrap gap-2">
                  {SIZE_TYPES.map((st) => (
                    <button
                      key={st.value}
                      onClick={() => handleSizeTypeChange(st.value)}
                      className={`flex items-center gap-1.5 px-4 py-2.5 rounded-sm text-xs transition-colors ${
                        sizeType === st.value ? 'bg-primary text-on-primary font-semibold' : 'bg-surface-container-highest text-on-surface-variant'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Size ML */}
              <div>
                <label className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold block mb-2">SIZE (ML)</label>
                <input
                  type="number"
                  value={sizeMl}
                  onChange={(e) => setSizeMl(e.target.value)}
                  className="w-full bg-surface-container rounded-sm px-4 py-3 text-on-surface text-sm focus:ring-1 ring-primary/30 focus:outline-none border-none"
                  placeholder="e.g. 100"
                />
              </div>

              {/* Price */}
              <div>
                <label className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold block mb-2">PRICE PAID (£)</label>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full bg-surface-container rounded-sm px-4 py-3 text-on-surface text-sm focus:ring-1 ring-primary/30 focus:outline-none border-none"
                  placeholder="Optional"
                />
              </div>

              {/* Source */}
              <div>
                <label className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold block mb-2">SOURCE</label>
                <input
                  type="text"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className="w-full bg-surface-container rounded-sm px-4 py-3 text-on-surface text-sm focus:ring-1 ring-primary/30 focus:outline-none border-none"
                  placeholder="e.g. FragranceX, r/fragranceswap"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold block mb-2">NOTES</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full bg-surface-container rounded-sm px-4 py-3 text-on-surface text-sm focus:ring-1 ring-primary/30 focus:outline-none border-none resize-none"
                  placeholder="Any notes about this item..."
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setStep('search')} className="flex-1 py-3.5 rounded-sm bg-surface-container text-sm font-medium text-on-surface transition-opacity hover:opacity-80">
                  BACK
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-3.5 gold-gradient text-on-primary font-bold uppercase tracking-[0.1em] rounded-sm ambient-glow transition-opacity hover:opacity-90 text-sm flex items-center justify-center gap-2"
                >
                  {saving ? 'SAVING...' : 'SAVE'}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
