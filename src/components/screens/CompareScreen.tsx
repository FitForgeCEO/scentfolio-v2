import { useState, useEffect, useRef } from 'react'
import { Icon } from '../ui/Icon'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { supabase } from '@/lib/supabase'
import type { Fragrance } from '@/types/database'

const MAX_COMPARE = 3

export function CompareScreen() {
  const [selected, setSelected] = useState<Fragrance[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerSlot, setPickerSlot] = useState(0)

  const handleOpenPicker = (slot: number) => {
    setPickerSlot(slot)
    setPickerOpen(true)
  }

  const handleSelect = (frag: Fragrance) => {
    setSelected((prev) => {
      const copy = [...prev]
      copy[pickerSlot] = frag
      return copy
    })
    setPickerOpen(false)
  }

  const handleRemove = (idx: number) => {
    setSelected((prev) => prev.filter((_, i) => i !== idx))
  }

  const hasComparison = selected.length >= 2

  return (
    <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen">
      <header className="mb-6">
        <h2 className="font-headline text-3xl text-on-surface leading-tight mb-1">Compare</h2>
        <p className="font-body text-sm text-secondary opacity-70">Side-by-side fragrance comparison</p>
      </header>

      {/* Selection Slots */}
      <section className="grid grid-cols-3 gap-3 mb-8">
        {Array.from({ length: MAX_COMPARE }).map((_, i) => {
          const frag = selected[i]
          return frag ? (
            <div key={i} className="relative flex flex-col items-center">
              <div className="w-full aspect-[3/4] rounded-xl overflow-hidden bg-surface-container-low mb-2">
                {frag.image_url ? (
                  <img src={frag.image_url} alt={frag.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-surface-container">
                    <Icon name="water_drop" className="text-secondary/30" size={32} />
                  </div>
                )}
              </div>
              <p className="text-[9px] uppercase tracking-[0.15em] text-primary/70 font-bold text-center">{frag.brand}</p>
              <p className="text-[11px] text-on-surface font-medium text-center line-clamp-2">{frag.name}</p>
              <button
                onClick={() => handleRemove(i)}
                className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-error/80 flex items-center justify-center"
                aria-label={`Remove ${frag.name}`}
              >
                <Icon name="close" size={14} className="text-on-error" />
              </button>
            </div>
          ) : (
            <button
              key={i}
              onClick={() => handleOpenPicker(i)}
              className="w-full aspect-[3/4] rounded-xl border-2 border-dashed border-outline-variant/30 flex flex-col items-center justify-center gap-2 active:scale-95 transition-transform"
            >
              <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center">
                <Icon name="add" className="text-primary" />
              </div>
              <span className="text-[10px] text-secondary/50 font-bold uppercase tracking-wider">
                {i === 0 ? 'ADD FIRST' : i === 1 ? 'ADD SECOND' : 'ADD THIRD'}
              </span>
            </button>
          )
        })}
      </section>

      {/* Comparison Table */}
      {hasComparison && (
        <div className="space-y-6">
          {/* Rating */}
          <CompareRow label="RATING" icon="star">
            {selected.map((f) => (
              <div key={f.id} className="flex-1 text-center">
                <span className="text-lg font-headline text-on-surface font-bold">{f.rating ? Number(f.rating).toFixed(1) : '—'}</span>
              </div>
            ))}
          </CompareRow>

          {/* Concentration */}
          <CompareRow label="CONCENTRATION" icon="science">
            {selected.map((f) => (
              <div key={f.id} className="flex-1 text-center">
                <span className="text-xs text-on-surface">{f.concentration ?? '—'}</span>
              </div>
            ))}
          </CompareRow>

          {/* Longevity */}
          <CompareRow label="LONGEVITY" icon="schedule">
            {selected.map((f) => (
              <div key={f.id} className="flex-1 text-center">
                <span className="text-lg font-headline text-on-surface font-bold">{f.longevity ?? '—'}</span>
                {f.longevity && <p className="text-[9px] text-secondary/50">/ 10</p>}
              </div>
            ))}
          </CompareRow>

          {/* Sillage */}
          <CompareRow label="SILLAGE" icon="air">
            {selected.map((f) => (
              <div key={f.id} className="flex-1 text-center">
                <span className="text-lg font-headline text-on-surface font-bold">{f.sillage ?? '—'}</span>
                {f.sillage && <p className="text-[9px] text-secondary/50">/ 10</p>}
              </div>
            ))}
          </CompareRow>

          {/* Gender */}
          <CompareRow label="GENDER" icon="person">
            {selected.map((f) => (
              <div key={f.id} className="flex-1 text-center">
                <span className="text-xs text-on-surface">{f.gender ?? '—'}</span>
              </div>
            ))}
          </CompareRow>

          {/* Note Family */}
          <CompareRow label="NOTE FAMILY" icon="spa">
            {selected.map((f) => (
              <div key={f.id} className="flex-1 text-center">
                <span className="text-xs text-on-surface">{f.note_family ?? '—'}</span>
              </div>
            ))}
          </CompareRow>

          {/* Year */}
          <CompareRow label="YEAR" icon="calendar_month">
            {selected.map((f) => (
              <div key={f.id} className="flex-1 text-center">
                <span className="text-xs text-on-surface">{f.year_released ?? '—'}</span>
              </div>
            ))}
          </CompareRow>

          {/* Price */}
          <CompareRow label="PRICE" icon="payments">
            {selected.map((f) => (
              <div key={f.id} className="flex-1 text-center">
                <span className="text-xs text-on-surface">{f.price ?? '—'}</span>
              </div>
            ))}
          </CompareRow>

          {/* Top Accords */}
          <section className="bg-surface-container rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon name="palette" className="text-primary" size={18} />
              <h3 className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">TOP ACCORDS</h3>
            </div>
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${selected.length}, 1fr)` }}>
              {selected.map((f) => (
                <div key={f.id} className="space-y-1.5">
                  <p className="text-[9px] uppercase tracking-wider text-primary/50 font-bold text-center mb-2">{f.name.split(' ')[0]}</p>
                  {f.main_accords_percentage ? (
                    Object.entries(f.main_accords_percentage)
                      .sort(([, a], [, b]) => parseFloat(b as string) - parseFloat(a as string))
                      .slice(0, 5)
                      .map(([accord, pct]) => (
                        <div key={accord}>
                          <p className="text-[9px] text-secondary/60 truncate">{accord}</p>
                          <div className="h-1 bg-surface-container-highest rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${parseFloat(pct as string)}%` }} />
                          </div>
                        </div>
                      ))
                  ) : (
                    <p className="text-[10px] text-secondary/40 text-center">No data</p>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Season Comparison */}
          <section className="bg-surface-container rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon name="thermostat" className="text-primary" size={18} />
              <h3 className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">SEASON FIT</h3>
            </div>
            {['SPRING', 'SUMMER', 'FALL', 'WINTER'].map((season) => (
              <div key={season} className="flex items-center gap-3">
                <span className="text-[10px] w-14 text-secondary/50 uppercase tracking-wider font-bold">
                  {season.slice(0, 3)}
                </span>
                {selected.map((f) => {
                  const score = f.season_ranking?.find((s) => s.name.toUpperCase() === season)?.score ?? 0
                  return (
                    <div key={f.id} className="flex-1">
                      <div className="h-2 bg-surface-container-highest rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-500"
                          style={{ width: `${score * 100}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </section>

          {/* Notes Comparison */}
          <section className="bg-surface-container rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon name="music_note" className="text-primary" size={18} />
              <h3 className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">NOTES</h3>
            </div>
            {(['notes_top', 'notes_heart', 'notes_base'] as const).map((layer) => {
              const label = layer === 'notes_top' ? 'TOP' : layer === 'notes_heart' ? 'HEART' : 'BASE'
              return (
                <div key={layer}>
                  <p className="text-[9px] uppercase tracking-wider text-secondary/40 font-bold mb-2">{label} NOTES</p>
                  <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${selected.length}, 1fr)` }}>
                    {selected.map((f) => (
                      <div key={f.id} className="flex flex-wrap gap-1">
                        {(f[layer] ?? []).slice(0, 5).map((note) => (
                          <span key={note} className="text-[9px] bg-surface-container-highest px-2 py-0.5 rounded-full text-on-surface-variant">{note}</span>
                        ))}
                        {(!f[layer] || f[layer]!.length === 0) && <span className="text-[9px] text-secondary/30">—</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </section>
        </div>
      )}

      {!hasComparison && (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center mb-5">
            <Icon name="compare_arrows" className="text-3xl text-primary/40" />
          </div>
          <p className="text-sm text-secondary/60 text-center max-w-[260px]">
            Select at least 2 fragrances above to see a detailed side-by-side comparison.
          </p>
        </div>
      )}

      {pickerOpen && (
        <FragrancePickerSheet
          onSelect={handleSelect}
          onClose={() => setPickerOpen(false)}
          excludeIds={selected.map((s) => s.id)}
        />
      )}
    </main>
  )
}

function CompareRow({ label, icon, children }: { label: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface-container rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon name={icon} className="text-primary" size={16} />
        <span className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">{label}</span>
      </div>
      <div className="flex gap-2">
        {children}
      </div>
    </div>
  )
}

function FragrancePickerSheet({
  onSelect,
  onClose,
  excludeIds,
}: {
  onSelect: (f: Fragrance) => void
  onClose: () => void
  excludeIds: string[]
}) {
  const trapRef = useFocusTrap(true, onClose)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Fragrance[]>([])
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    clearTimeout(debounceRef.current)
    if (query.length < 2) { setResults([]); return }
    setSearching(true)
    debounceRef.current = setTimeout(() => {
      supabase
        .from('fragrances')
        .select('*')
        .or(`name.ilike.%${query}%,brand.ilike.%${query}%`)
        .not('image_url', 'is', null)
        .order('rating', { ascending: false, nullsFirst: false })
        .limit(15)
        .then(({ data }) => {
          if (data) setResults((data as Fragrance[]).filter((f) => !excludeIds.includes(f.id)))
          setSearching(false)
        })
    }, 250)
    return () => clearTimeout(debounceRef.current)
  }, [query, excludeIds])

  return (
    <div ref={trapRef} className="fixed inset-0 z-[var(--z-sheet)] flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="Pick a fragrance">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <section className="relative w-full max-h-[75vh] bg-surface-container-low rounded-t-[2.5rem] sheet-shadow flex flex-col overflow-hidden animate-slide-up">
        <div className="flex justify-center py-4"><div className="w-12 h-1 bg-surface-container-highest rounded-full" /></div>
        <header className="px-8 pb-4 flex justify-between items-center">
          <h2 className="text-2xl font-headline font-bold text-on-surface">Pick a Fragrance</h2>
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center text-on-surface-variant active:scale-90 transition-transform">
            <Icon name="close" size={20} />
          </button>
        </header>
        <div className="px-8 pb-4">
          <div className="flex items-center bg-surface-container rounded-2xl px-4 py-3 focus-within:ring-1 ring-primary/30 transition-all">
            <Icon name="search" className="text-secondary/50 mr-3" size={18} />
            <input
              className="bg-transparent border-none p-0 focus:ring-0 focus:outline-none text-on-surface placeholder:text-secondary/40 w-full text-sm"
              placeholder="Search fragrances..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-8 pb-8">
          {searching ? (
            <div className="flex justify-center py-12">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : query.length >= 2 && results.length === 0 ? (
            <p className="text-center text-sm text-secondary/50 py-12">No fragrances found</p>
          ) : (
            <div className="divide-y divide-outline-variant/10">
              {results.map((f) => (
                <button
                  key={f.id}
                  onClick={() => onSelect(f)}
                  className="w-full flex items-center gap-3 py-3 text-left active:bg-surface-container-highest transition-colors"
                >
                  <div className="w-11 h-11 rounded-lg overflow-hidden flex-shrink-0 bg-surface-container-highest">
                    {f.image_url ? <img src={f.image_url} alt={f.name} className="w-full h-full object-cover" /> : (
                      <div className="w-full h-full flex items-center justify-center"><Icon name="water_drop" className="text-secondary/30" size={16} /></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] uppercase tracking-[0.15em] text-primary/70 font-bold">{f.brand}</p>
                    <p className="text-sm text-on-surface truncate">{f.name}</p>
                  </div>
                  {f.rating && (
                    <div className="flex items-center gap-1">
                      <Icon name="star" filled className="text-[11px] text-primary" />
                      <span className="text-[10px] text-primary font-semibold">{Number(f.rating).toFixed(1)}</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
