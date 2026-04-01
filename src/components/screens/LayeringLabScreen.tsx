import { useState, useEffect, useCallback, useRef } from 'react'
import { Icon } from '../ui/Icon'
import { ShareStackCard } from '../fragrance/ShareStackCard'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { Fragrance } from '@/types/database'

// ── Types ────────────────────────────────────────────────────

/** Raw response shape from the layering-lab Edge Function */
interface LayeringResponse {
  bodyPrep: {
    product: string
    brand: string
    application: string
    notes: string
  }
  layeringFragrance: {
    name: string
    brand: string
    sprayCount: string
    application: string
    fromCollection: boolean
  }
  technique: string
  whyItWorks: string
  resultingVibe: string
  proBonusTip: string
}

type ScreenState = 'select' | 'loading' | 'results' | 'error'

// ── Preset vibes ─────────────────────────────────────────────

const PRESET_VIBES = [
  { label: 'Date Night', icon: 'favorite' },
  { label: 'Cozy Evening', icon: 'local_fire_department' },
  { label: 'Fresh & Clean', icon: 'water_drop' },
  { label: 'Office Power', icon: 'work' },
  { label: 'Weekend Brunch', icon: 'wb_sunny' },
  { label: 'Night Out', icon: 'nightlife' },
  { label: 'Mysterious', icon: 'visibility_off' },
  { label: 'Sophisticated', icon: 'diamond' },
]

const LOADING_MESSAGES = [
  'Analysing accords...',
  'Finding complementary notes...',
  'Crafting your layering stack...',
  'Balancing projection and longevity...',
  'Adding the finishing touches...',
]

// ── Fragrance Search ─────────────────────────────────────────

function FragranceSearch({
  onSelect,
  userId,
}: {
  onSelect: (f: Fragrance) => void
  userId?: string
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Fragrance[]>([])
  const [collection, setCollection] = useState<Fragrance[]>([])
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)

  // Load user's collection on mount
  useEffect(() => {
    if (!userId) return
    supabase
      .from('user_collections')
      .select('fragrance:fragrances(*)')
      .eq('user_id', userId)
      .eq('status', 'own')
      .order('date_added', { ascending: false })
      .limit(12)
      .then(({ data }) => {
        if (data) {
          setCollection(data.map((d: any) => d.fragrance).filter(Boolean))
        }
      })
  }, [userId])

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.length < 2) {
      setResults([])
      return
    }
    setSearching(true)
    debounceRef.current = setTimeout(() => {
      supabase
        .from('fragrances')
        .select('*')
        .or(`name.ilike.%${query}%,brand.ilike.%${query}%`)
        .not('image_url', 'is', null)
        .order('rating', { ascending: false, nullsFirst: false })
        .limit(10)
        .then(({ data }) => {
          if (data) setResults(data as Fragrance[])
          setSearching(false)
        })
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  const showCollection = query.length < 2 && collection.length > 0

  return (
    <div className="space-y-4">
      {/* Search input */}
      <div className="relative">
        <Icon name="search" className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary/40" size={18} />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search fragrances..."
          className="w-full h-12 pl-11 pr-4 bg-surface-container-highest rounded-xl text-sm text-on-surface placeholder:text-secondary/30 outline-none focus:ring-1 focus:ring-primary/30 transition-all"
        />
        {searching && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Collection shortcut */}
      {showCollection && (
        <div>
          <p className="text-[9px] tracking-[0.2em] font-bold text-secondary/40 uppercase mb-3">FROM YOUR COLLECTION</p>
          <div className="grid grid-cols-2 gap-3">
            {collection.slice(0, 6).map((f) => (
              <button
                key={f.id}
                onClick={() => onSelect(f)}
                className="flex items-center gap-3 p-3 bg-surface-container rounded-xl text-left active:scale-[0.97] transition-transform"
              >
                {f.image_url ? (
                  <img src={f.image_url} alt={f.name} className="w-10 h-12 object-cover rounded-lg shrink-0" />
                ) : (
                  <div className="w-10 h-12 bg-surface-container-highest rounded-lg flex items-center justify-center shrink-0">
                    <Icon name="water_drop" className="text-secondary/20" size={16} />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-on-surface truncate">{f.name}</p>
                  <p className="text-[10px] text-secondary/50 truncate">{f.brand}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search results */}
      {results.length > 0 && (
        <div className="space-y-1">
          {results.map((f) => (
            <button
              key={f.id}
              onClick={() => onSelect(f)}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-surface-container active:scale-[0.98] transition-all text-left"
            >
              {f.image_url ? (
                <img src={f.image_url} alt={f.name} className="w-10 h-12 object-cover rounded-lg shrink-0" />
              ) : (
                <div className="w-10 h-12 bg-surface-container-highest rounded-lg shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-on-surface truncate">{f.name}</p>
                <p className="text-[10px] tracking-wider text-secondary/50 uppercase truncate">{f.brand}</p>
              </div>
              {f.rating && (
                <div className="ml-auto flex items-center gap-1 shrink-0">
                  <Icon name="star" filled className="text-primary text-xs" />
                  <span className="text-xs text-primary font-bold">{Number(f.rating).toFixed(1)}</span>
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Empty state */}
      {query.length >= 2 && results.length === 0 && !searching && (
        <p className="text-center text-sm text-secondary/40 py-8">No fragrances found</p>
      )}
    </div>
  )
}

// ── Main Screen ──────────────────────────────────────────────

export function LayeringLabScreen() {
  const { user } = useAuth()
  const [screen, setScreen] = useState<ScreenState>('select')
  const [selectedFragrance, setSelectedFragrance] = useState<Fragrance | null>(null)
  const [selectedVibe, setSelectedVibe] = useState<string | null>(null)
  const [customVibe, setCustomVibe] = useState('')
  const [result, setResult] = useState<LayeringResponse | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MESSAGES[0])
  const [saved, setSaved] = useState(false)
  const [shareCardOpen, setShareCardOpen] = useState(false)

  // Rotate loading messages
  useEffect(() => {
    if (screen !== 'loading') return
    let idx = 0
    const interval = setInterval(() => {
      idx = (idx + 1) % LOADING_MESSAGES.length
      setLoadingMsg(LOADING_MESSAGES[idx])
    }, 2200)
    return () => clearInterval(interval)
  }, [screen])

  const activeVibe = selectedVibe || customVibe

  const handleGenerate = useCallback(async () => {
    if (!selectedFragrance || !activeVibe) return
    if (!user) { setErrorMsg('Please sign in to use the Layering Lab.'); setScreen('error'); return }

    setScreen('loading')
    setErrorMsg('')

    try {
      const { data, error } = await supabase.functions.invoke('layering-lab', {
        body: {
          fragrance: {
            name: selectedFragrance.name,
            brand: selectedFragrance.brand,
            accords: selectedFragrance.accords,
            notes_top: selectedFragrance.notes_top,
            notes_heart: selectedFragrance.notes_heart,
            notes_base: selectedFragrance.notes_base,
            longevity: selectedFragrance.longevity,
            sillage: selectedFragrance.sillage,
          },
          vibe: activeVibe,
        },
      })

      if (error) throw error
      if (!data) throw new Error('No data returned')

      setResult(data as LayeringResponse)
      setScreen('results')
    } catch (err: any) {
      console.error('Layering Lab error:', err)
      setErrorMsg(err.message || 'Something went wrong. Please try again.')
      setScreen('error')
    }
  }, [selectedFragrance, activeVibe, user])

  const handleReset = useCallback(() => {
    setScreen('select')
    setSelectedFragrance(null)
    setSelectedVibe(null)
    setCustomVibe('')
    setResult(null)
    setSaved(false)
  }, [])

  const handleTryAnotherVibe = useCallback(() => {
    setScreen('select')
    setSelectedVibe(null)
    setCustomVibe('')
    setResult(null)
    setSaved(false)
    // Keep the selected fragrance
  }, [])

  const handleSaveStack = useCallback(async () => {
    if (!user || !result || !selectedFragrance) return
    try {
      await supabase.from('layering_stacks').insert({
        user_id: user.id,
        fragrance_id: selectedFragrance.id,
        vibe: activeVibe,
        result_json: result,
      })
      setSaved(true)
    } catch (err) {
      console.error('Save stack error:', err)
    }
  }, [user, result, selectedFragrance, activeVibe])

  const handleShare = useCallback(() => {
    if (!result || !selectedFragrance) return
    setShareCardOpen(true)
  }, [result, selectedFragrance])

  // ── SELECT STATE ─────────────────────────────────────────

  if (screen === 'select') {
    return (
      <main className="pt-24 pb-32 px-6 max-w-[375px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-center gap-2 mb-2">
          <Icon name="auto_awesome" filled className="text-primary" />
          <h1 className="font-headline text-xl text-primary tracking-wide">AI Layering Lab</h1>
        </div>
        <p className="text-center text-xs text-secondary/50 mb-10">
          Select a fragrance and a vibe — our AI will craft a custom layering stack
        </p>

        {/* Step 1: Choose fragrance */}
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center text-[10px] font-bold text-primary">1</span>
            <h2 className="text-[11px] font-bold tracking-[0.15em] text-primary uppercase">CHOOSE FRAGRANCE</h2>
          </div>

          {selectedFragrance ? (
            <div className="flex items-center gap-4 p-4 bg-surface-container rounded-xl">
              {selectedFragrance.image_url ? (
                <img src={selectedFragrance.image_url} alt={selectedFragrance.name} className="w-12 h-16 object-cover rounded-lg" />
              ) : (
                <div className="w-12 h-16 bg-surface-container-highest rounded-lg" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-headline text-lg text-on-surface truncate">{selectedFragrance.name}</p>
                <p className="text-[10px] tracking-wider text-secondary/50 uppercase">{selectedFragrance.brand}</p>
              </div>
              <button onClick={() => setSelectedFragrance(null)} className="p-2 active:scale-90 transition-transform">
                <Icon name="close" className="text-secondary/40" size={18} />
              </button>
            </div>
          ) : (
            <FragranceSearch onSelect={setSelectedFragrance} userId={user?.id} />
          )}
        </section>

        {/* Step 2: Choose vibe */}
        <section className="mb-12">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center text-[10px] font-bold text-primary">2</span>
            <h2 className="text-[11px] font-bold tracking-[0.15em] text-primary uppercase">CHOOSE VIBE</h2>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            {PRESET_VIBES.map(({ label, icon }) => (
              <button
                key={label}
                onClick={() => { setSelectedVibe(label); setCustomVibe('') }}
                className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[11px] font-semibold tracking-wide transition-all active:scale-95 ${
                  selectedVibe === label
                    ? 'bg-primary/20 text-primary'
                    : 'bg-surface-container text-secondary/70 hover:text-on-surface'
                }`}
              >
                <Icon name={icon} size={14} />
                {label}
              </button>
            ))}
          </div>

          <div className="relative">
            <input
              type="text"
              value={customVibe}
              onChange={(e) => { setCustomVibe(e.target.value); setSelectedVibe(null) }}
              placeholder="Or describe your own vibe..."
              className="w-full h-12 px-4 bg-surface-container-highest rounded-xl text-sm text-on-surface placeholder:text-secondary/30 outline-none focus:ring-1 focus:ring-primary/30 transition-all"
            />
          </div>
        </section>

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={!selectedFragrance || !activeVibe}
          className="w-full h-16 gold-gradient rounded-xl font-label text-xs font-bold tracking-[0.2em] uppercase text-on-primary active:opacity-70 transition-all flex items-center justify-center gap-3 shadow-lg shadow-black/40 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Icon name="auto_awesome" filled />
          Generate Layering Stack
        </button>
      </main>
    )
  }

  // ── LOADING STATE ────────────────────────────────────────

  if (screen === 'loading') {
    return (
      <main className="pt-24 pb-32 px-6 flex flex-col items-center justify-center min-h-screen">
        <Icon name="auto_awesome" filled className="text-primary text-4xl mb-6 animate-pulse" />
        <p className="font-headline italic text-lg text-primary mb-3">Crafting your stack...</p>
        <p className="text-sm text-secondary/50 animate-pulse">{loadingMsg}</p>
      </main>
    )
  }

  // ── ERROR STATE ──────────────────────────────────────────

  if (screen === 'error') {
    return (
      <main className="pt-24 pb-32 px-6 flex flex-col items-center justify-center min-h-screen text-center">
        <Icon name="error_outline" className="text-error text-4xl mb-4" />
        <p className="text-sm text-on-surface mb-2">Something went wrong</p>
        <p className="text-xs text-secondary/50 mb-8 max-w-[280px]">{errorMsg}</p>
        <button
          onClick={handleReset}
          className="px-8 py-3 bg-surface-container rounded-xl text-sm font-bold text-on-surface active:scale-95 transition-transform"
        >
          Try Again
        </button>
      </main>
    )
  }

  // ── RESULTS STATE ────────────────────────────────────────

  if (!result || !selectedFragrance) return null

  return (
    <main className="pt-24 pb-32 px-6 max-w-[375px] mx-auto overflow-x-hidden">
      {/* Vibe Statement */}
      <section className="py-12 flex flex-col items-center text-center">
        <div className="w-12 h-[1px] bg-primary/40 mb-8" />
        <p className="font-headline italic text-2xl text-primary leading-relaxed px-4">
          "{result.resultingVibe}"
        </p>
        <div className="w-12 h-[1px] bg-primary/40 mt-8" />
      </section>

      {/* Step Cards */}
      <section className="space-y-6">
        {/* STEP 1 — Body Prep */}
        <div className="bg-surface-container rounded-xl overflow-hidden p-6">
          <span className="font-label text-[10px] tracking-[0.15em] text-secondary-fixed-dim block mb-3">
            STEP 1 · BODY PREP
          </span>
          <h3 className="font-headline text-xl mb-1">{result.bodyPrep.product}</h3>
          <p className="font-label text-xs uppercase tracking-wider text-outline-variant mb-4">{result.bodyPrep.brand}</p>
          {result.bodyPrep.notes && (
            <div className="flex flex-wrap gap-2 mb-4">
              {result.bodyPrep.notes.split(',').map((note) => (
                <span
                  key={note.trim()}
                  className="text-[10px] font-semibold text-primary uppercase tracking-widest bg-primary/5 px-2 py-1 rounded"
                >
                  {note.trim()}
                </span>
              ))}
            </div>
          )}
          <p className="text-sm text-on-surface-variant leading-relaxed">{result.bodyPrep.application}</p>
        </div>

        {/* STEP 2 — Base Layer (user's selected fragrance) */}
        <div className="bg-surface-container rounded-xl overflow-hidden p-6 border-l-2 border-primary/30 flex gap-4">
          {selectedFragrance.image_url && (
            <div className="w-16 h-20 bg-surface-container-highest rounded-lg overflow-hidden flex-shrink-0">
              <img
                src={selectedFragrance.image_url}
                alt={selectedFragrance.name}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div>
            <span className="font-label text-[10px] tracking-[0.15em] text-secondary-fixed-dim block mb-1">
              STEP 2 · BASE LAYER
            </span>
            <h3 className="font-headline text-lg mb-0.5">{selectedFragrance.name}</h3>
            <p className="font-label text-[10px] uppercase tracking-wider text-outline-variant mb-3">{selectedFragrance.brand}</p>
            <p className="text-sm text-on-surface-variant leading-tight">3–4 sprays to chest, wrists, and neck.</p>
          </div>
        </div>

        {/* STEP 3 — Top Layer (AI recommendation) */}
        <div className="bg-surface-container rounded-xl overflow-hidden p-6">
          <div className="flex justify-between items-start mb-3">
            <span className="font-label text-[10px] tracking-[0.15em] text-secondary-fixed-dim">
              STEP 3 · TOP LAYER
            </span>
            {result.layeringFragrance.fromCollection && (
              <span className="bg-primary/15 text-primary text-[9px] font-bold px-2 py-0.5 rounded tracking-tighter uppercase">
                IN YOUR COLLECTION
              </span>
            )}
          </div>
          <h3 className="font-headline text-xl mb-1">{result.layeringFragrance.name}</h3>
          <p className="font-label text-xs uppercase tracking-wider text-outline-variant mb-4">{result.layeringFragrance.brand}</p>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            {result.layeringFragrance.sprayCount} — {result.layeringFragrance.application}
          </p>
        </div>

        {/* Technique */}
        {result.technique && (
          <p className="text-center text-[13px] text-secondary/60 italic leading-relaxed px-4">
            {result.technique}
          </p>
        )}

        {/* Why It Works */}
        {result.whyItWorks && (
          <div className="bg-surface-container rounded-xl p-6 border border-primary/10">
            <div className="flex items-center gap-2 mb-3">
              <Icon name="lightbulb" className="text-primary text-lg" />
              <span className="font-label text-[10px] font-bold tracking-[0.2em] text-primary">WHY THIS WORKS</span>
            </div>
            <p className="text-sm text-on-surface-variant leading-relaxed italic">{result.whyItWorks}</p>
          </div>
        )}

        {/* Pro Tip */}
        {result.proBonusTip && (
          <div className="bg-primary/5 rounded-xl p-5 flex gap-4 items-start">
            <Icon name="auto_awesome" filled className="text-primary shrink-0" />
            <div>
              <span className="font-label text-[10px] font-bold tracking-[0.2em] text-primary block mb-1">PRO TIP</span>
              <p className="text-xs text-on-surface leading-normal">{result.proBonusTip}</p>
            </div>
          </div>
        )}
      </section>

      {/* Action Buttons */}
      <section className="mt-12 space-y-4">
        <div className="flex gap-3">
          <button
            onClick={handleTryAnotherVibe}
            className="flex-1 h-14 bg-surface-container rounded-xl font-label text-[11px] font-bold tracking-widest uppercase text-on-surface active:opacity-70 transition-all"
          >
            Try Another Vibe
          </button>
          <button
            onClick={handleShare}
            className="flex-1 h-14 gold-gradient rounded-xl font-label text-[11px] font-bold tracking-widest uppercase text-on-primary active:opacity-70 transition-all flex items-center justify-center gap-2"
          >
            <Icon name="share" size={16} />
            Share Stack
          </button>
        </div>
        <button
          onClick={saved ? undefined : handleSaveStack}
          disabled={saved || !user}
          className={`w-full h-16 rounded-xl font-label text-xs font-bold tracking-[0.2em] uppercase transition-all flex items-center justify-center gap-3 ${
            saved
              ? 'bg-surface-container text-primary'
              : 'gold-gradient text-on-primary active:opacity-70 shadow-lg shadow-black/40'
          } disabled:opacity-60`}
        >
          <Icon name={saved ? 'bookmark_added' : 'auto_awesome'} filled />
          {saved ? 'Saved' : 'Save This Stack'}
        </button>
        {!user && (
          <p className="text-center text-[10px] text-secondary/40">Sign in to save stacks</p>
        )}
      </section>

      {/* Share Stack Card Modal */}
      <ShareStackCard
        isOpen={shareCardOpen}
        onClose={() => setShareCardOpen(false)}
        vibeStatement={result.resultingVibe}
        bodyPrep={result.bodyPrep}
        baseFragrance={{
          name: selectedFragrance.name,
          brand: selectedFragrance.brand,
          image_url: selectedFragrance.image_url,
        }}
        topLayer={result.layeringFragrance}
        whyItWorks={result.whyItWorks}
      />
    </main>
  )
}
