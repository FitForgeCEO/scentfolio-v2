import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { InlineError } from '../ui/InlineError'
import { supabase } from '@/lib/supabase'
import type { Fragrance } from '@/types/database'
import { getIconChar } from '@/lib/iconUtils'

const NOTE_FAMILIES: Record<string, { icon: string; color: string }> = {
  'woody': { icon: 'park', color: '#8B6914' },
  'floral': { icon: 'local_florist', color: '#C77DB5' },
  'white floral': { icon: 'local_florist', color: '#E8D0E8' },
  'citrus': { icon: 'sunny', color: '#E5C276' },
  'aromatic': { icon: 'spa', color: '#6B8F71' },
  'amber': { icon: 'diamond', color: '#FFBF00' },
  'warm spicy': { icon: 'whatshot', color: '#C75B39' },
  'fruity': { icon: 'nutrition', color: '#E07A5F' },
  'rose': { icon: 'local_florist', color: '#D4788E' },
  'vanilla': { icon: 'cake', color: '#D4845A' },
  'sweet': { icon: 'cake', color: '#E8A87C' },
  'powdery': { icon: 'cloud', color: '#C8B8D8' },
  'musky': { icon: 'blur_on', color: '#9E8C7C' },
  'fresh spicy': { icon: 'whatshot', color: '#5BA3C9' },
  'green': { icon: 'eco', color: '#5A8C4F' },
  'leather': { icon: 'work', color: '#8B4513' },
  'oud': { icon: 'forest', color: '#5C4033' },
  'aquatic': { icon: 'waves', color: '#4A90B8' },
  'iris': { icon: 'filter_vintage', color: '#9B8EC8' },
  'patchouli': { icon: 'eco', color: '#6B5B3E' },
}

type ViewMode = 'families' | 'accords' | 'notes'

interface FamilyResult {
  family: string
  count: number
  fragrances: Fragrance[]
}

interface AccordResult {
  accord: string
  count: number
}

interface AccordDetail {
  accord: string
  fragrances: Fragrance[]
}

export function NotesExplorerScreen() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<ViewMode>('families')
  const [selectedFamily, setSelectedFamily] = useState<string | null>(null)
  const [familyResults, setFamilyResults] = useState<FamilyResult[]>([])
  const [accordResults, setAccordResults] = useState<AccordResult[]>([])
  const [selectedFamilyFragrances, setSelectedFamilyFragrances] = useState<Fragrance[]>([])
  const [selectedAccord, setSelectedAccord] = useState<AccordDetail | null>(null)
  const [noteSearch, setNoteSearch] = useState('')
  const [noteResults, setNoteResults] = useState<Fragrance[]>([])
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchOverview = useCallback(() => {
    setLoading(true)
    setError(null)

    supabase
      .from('fragrances')
      .select('note_family')
      .not('note_family', 'is', null)
      .then(({ data, error: err }) => {
        if (err) { setError(err.message); setLoading(false); return }
        const map = new Map<string, number>()
        data?.forEach((f: any) => { map.set(f.note_family, (map.get(f.note_family) || 0) + 1) })
        setFamilyResults(
          [...map.entries()]
            .map(([family, count]) => ({ family, count, fragrances: [] }))
            .sort((a, b) => b.count - a.count)
        )
        setLoading(false)
      })

    // Also fetch top accords
    supabase
      .from('fragrances')
      .select('main_accords_percentage')
      .not('main_accords_percentage', 'is', null)
      .limit(500)
      .then(({ data }) => {
        const map = new Map<string, number>()
        data?.forEach((f: any) => {
          if (f.main_accords_percentage && typeof f.main_accords_percentage === 'object') {
            Object.keys(f.main_accords_percentage).forEach((accord) => {
              map.set(accord, (map.get(accord) || 0) + 1)
            })
          }
        })
        setAccordResults(
          [...map.entries()]
            .map(([accord, count]) => ({ accord, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 30)
        )
      })
  }, [])

  useEffect(() => { fetchOverview() }, [fetchOverview])

  const handleFamilyTap = async (family: string) => {
    setSelectedFamily(family)
    setLoading(true)
    const { data } = await supabase
      .from('fragrances')
      .select('*')
      .eq('note_family', family)
      .not('image_url', 'is', null)
      .order('rating', { ascending: false, nullsFirst: false })
      .limit(20)
    setSelectedFamilyFragrances((data ?? []) as Fragrance[])
    setLoading(false)
  }

  const handleAccordTap = async (accord: string) => {
    setLoading(true)
    const { data } = await supabase
      .from('fragrances')
      .select('*')
      .contains('accords', [accord])
      .not('image_url', 'is', null)
      .order('rating', { ascending: false, nullsFirst: false })
      .limit(20)
    setSelectedAccord({ accord, fragrances: (data ?? []) as Fragrance[] })
    setLoading(false)
  }

  const handleNoteSearch = useCallback((q: string) => {
    setNoteSearch(q)
    if (q.length < 2) { setNoteResults([]); return }
    setSearching(true)
    supabase
      .from('fragrances')
      .select('*')
      .or(`notes_top.cs.{${q}},notes_heart.cs.{${q}},notes_base.cs.{${q}},general_notes.cs.{${q}}`)
      .not('image_url', 'is', null)
      .order('rating', { ascending: false, nullsFirst: false })
      .limit(20)
      .then(({ data }) => {
        setNoteResults((data ?? []) as Fragrance[])
        setSearching(false)
      })
  }, [])

  if (error) return <main className="pt-24 pb-32 px-6"><InlineError message="Couldn't load notes" onRetry={fetchOverview} /></main>

  return (
    <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen space-y-6">
      <header>
        <h2 className="font-headline text-3xl text-on-surface leading-tight mb-1">Notes Explorer</h2>
        <p className="font-body text-sm text-secondary opacity-70">Browse by scent family, accord, or note</p>
      </header>

      {/* Mode Tabs */}
      <nav className="flex gap-2">
        {([
          { value: 'families', label: 'Families' },
          { value: 'accords', label: 'Accords' },
          { value: 'notes', label: 'Search Notes' },
        ] as const).map((tab) => (
          <button
            key={tab.value}
            onClick={() => { setMode(tab.value); setSelectedFamily(null); setSelectedAccord(null) }}
            className={`px-4 py-2 rounded-full text-[10px] font-bold tracking-widest uppercase transition-all ${mode === tab.value ? 'bg-primary text-on-primary-container' : 'bg-surface-container text-secondary'}`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Families View */}
      {mode === 'families' && !selectedFamily && (
        <section className="space-y-3">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 rounded-sm bg-surface-container animate-pulse" />
            ))
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {familyResults.map((fr) => {
                const key = fr.family.toLowerCase()
                const meta = NOTE_FAMILIES[key]
                const icon = meta?.icon ?? 'spa'
                const color = meta?.color ?? '#e5c276'
                const label = fr.family.charAt(0).toUpperCase() + fr.family.slice(1)
                return (
                  <button
                    key={fr.family}
                    onClick={() => handleFamilyTap(fr.family)}
                    className="bg-surface-container rounded-sm p-4 text-left hover:opacity-80 transition-transform space-y-2"
                  >
                    <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
                      <span>{getIconChar(icon)}</span>
                    </div>
                    <p className="text-sm text-on-surface font-medium">{label}</p>
                    <p className="text-[10px] text-secondary/50">{fr.count} fragrances</p>
                  </button>
                )
              })}
            </div>
          )}
        </section>
      )}

      {/* Selected Family Detail */}
      {mode === 'families' && selectedFamily && (
        <section className="space-y-4">
          <button onClick={() => setSelectedFamily(null)} className="flex items-center gap-2 text-primary text-sm font-medium hover:opacity-80">
            <span>←</span> All Families
          </button>
          <h3 className="font-headline text-2xl text-on-surface">{selectedFamily}</h3>
          {loading ? (
            <div className="grid grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="aspect-[3/4] rounded-sm bg-surface-container animate-pulse" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {selectedFamilyFragrances.map((frag) => (
                <div
                  key={frag.id}
                  className="space-y-2 group cursor-pointer"
                  role="link"
                  tabIndex={0}
                  onClick={() => navigate(`/fragrance/${frag.id}`)}
                  onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/fragrance/${frag.id}`) }}
                >
                  <div className="aspect-[3/4] rounded-sm overflow-hidden bg-surface-container-low">
                    {frag.image_url && <img src={frag.image_url} alt={frag.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />}
                  </div>
                  <div>
                    <span className="text-[9px] uppercase tracking-[0.15em] text-secondary/60">{frag.brand}</span>
                    <h4 className="text-sm font-medium text-on-surface truncate">{frag.name}</h4>
                    {frag.rating && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-[10px] text-primary">★</span>
                        <span className="text-[10px] text-on-surface-variant">{Number(frag.rating).toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Accords View */}
      {mode === 'accords' && !selectedAccord && (
        <section className="space-y-3">
          {accordResults.length === 0 && !loading ? (
            <p className="text-sm text-secondary/50 text-center py-8">No accord data available</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {accordResults.map((a) => (
                <button
                  key={a.accord}
                  onClick={() => handleAccordTap(a.accord)}
                  className="bg-surface-container px-3 py-2 rounded-full flex items-center gap-2 hover:opacity-80 transition-all hover:bg-surface-container-highest"
                >
                  <span className="text-xs text-on-surface font-medium">{a.accord}</span>
                  <span className="text-[9px] text-primary font-bold bg-primary/10 px-1.5 py-0.5 rounded-full">{a.count}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Selected Accord Detail */}
      {mode === 'accords' && selectedAccord && (
        <section className="space-y-4">
          <button onClick={() => setSelectedAccord(null)} className="flex items-center gap-2 text-primary text-sm font-medium hover:opacity-80">
            <span>←</span> All Accords
          </button>
          <h3 className="font-headline text-2xl text-on-surface capitalize">{selectedAccord.accord}</h3>
          {loading ? (
            <div className="grid grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="aspect-[3/4] rounded-sm bg-surface-container animate-pulse" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {selectedAccord.fragrances.map((frag) => (
                <div
                  key={frag.id}
                  className="space-y-2 group cursor-pointer"
                  role="link"
                  tabIndex={0}
                  onClick={() => navigate(`/fragrance/${frag.id}`)}
                  onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/fragrance/${frag.id}`) }}
                >
                  <div className="aspect-[3/4] rounded-sm overflow-hidden bg-surface-container-low">
                    {frag.image_url && <img src={frag.image_url} alt={frag.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />}
                  </div>
                  <div>
                    <span className="text-[9px] uppercase tracking-[0.15em] text-secondary/60">{frag.brand}</span>
                    <h4 className="text-sm font-medium text-on-surface truncate">{frag.name}</h4>
                    {frag.rating && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-[10px] text-primary">★</span>
                        <span className="text-[10px] text-on-surface-variant">{Number(frag.rating).toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Notes Search */}
      {mode === 'notes' && (
        <section className="space-y-4">
          <div className="relative flex items-center bg-surface-container rounded-sm px-4 py-3.5 focus-within:ring-1 ring-primary/30 transition-all">
            <span className="text-secondary/50 mr-3">⌕</span>
            <input
              className="bg-transparent border-none p-0 focus:ring-0 focus:outline-none text-on-surface placeholder:text-secondary/40 w-full text-sm"
              placeholder='Search by note (e.g. "bergamot", "vanilla")'
              type="text"
              value={noteSearch}
              onChange={(e) => handleNoteSearch(e.target.value)}
              autoFocus
            />
            {noteSearch && (
              <button onClick={() => { setNoteSearch(''); setNoteResults([]) }} className="text-secondary/60">
                <span>✕</span>
              </button>
            )}
          </div>

          {searching ? (
            <div className="flex justify-center py-8"><span className="text-[9px] uppercase tracking-wider text-primary animate-pulse">Loading…</span></div>
          ) : noteSearch.length >= 2 && noteResults.length === 0 ? (
            <p className="text-sm text-secondary/50 text-center py-8">No fragrances found with that note</p>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {noteResults.map((frag) => (
                <div
                  key={frag.id}
                  className="space-y-2 group cursor-pointer"
                  role="link"
                  tabIndex={0}
                  onClick={() => navigate(`/fragrance/${frag.id}`)}
                  onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/fragrance/${frag.id}`) }}
                >
                  <div className="aspect-[3/4] rounded-sm overflow-hidden bg-surface-container-low">
                    {frag.image_url && <img src={frag.image_url} alt={frag.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />}
                  </div>
                  <div>
                    <span className="text-[9px] uppercase tracking-[0.15em] text-secondary/60">{frag.brand}</span>
                    <h4 className="text-sm font-medium text-on-surface truncate">{frag.name}</h4>
                  </div>
                </div>
              ))}
            </div>
          )}

          {noteSearch.length < 2 && (
            <div className="space-y-3 pt-4">
              <p className="text-[10px] uppercase tracking-[0.15em] text-secondary/60 font-bold">POPULAR NOTES</p>
              <div className="flex flex-wrap gap-2">
                {['Bergamot', 'Vanilla', 'Sandalwood', 'Rose', 'Oud', 'Musk', 'Amber', 'Jasmine', 'Patchouli', 'Tonka Bean', 'Cedar', 'Lavender'].map((note) => (
                  <button
                    key={note}
                    onClick={() => handleNoteSearch(note)}
                    className="bg-surface-container px-3 py-2 rounded-full text-xs text-on-surface hover:opacity-80 transition-all"
                  >
                    {note}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </main>
  )
}
