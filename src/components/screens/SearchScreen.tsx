import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { FragranceImage } from '../ui/FragranceImage'
import { supabase } from '@/lib/supabase'
import type { Fragrance } from '@/types/database'
import { getRecentlyViewed, clearRecentlyViewed } from '@/lib/recentlyViewed'
import { trackEvent, AnalyticsEvents } from '@/lib/analytics'

/* ── constants ───────────────────────────────────────────────── */

const DISTINGUISHED_HOUSES = [
  'Dior', 'Chanel', 'Tom Ford', 'Creed', 'Le Labo',
  'Maison Margiela', 'Jo Malone', 'Byredo', 'Versace', 'YSL',
]

const NOTE_FAMILIES = [
  'Woody', 'Floral', 'Oriental', 'Fresh', 'Citrus', 'Aromatic',
  'Gourmand', 'Aquatic', 'Spicy', 'Leather', 'Musk', 'Green',
]

const CONCENTRATIONS = [
  'Eau de Parfum', 'Eau de Toilette', 'Parfum', 'Eau de Cologne', 'Extrait',
]

const CHARACTERS = ['Unisex', 'Male', 'Female']

type SortOption = 'rating' | 'name' | 'brand'

/* ── recent-enquiry helpers (localStorage) ───────────────────── */

const MAX_RECENT = 8
const STORAGE_KEY = 'scentfolio-recent-searches'

function getRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as string[]
  } catch { return [] }
}

function saveRecentSearch(query: string) {
  const existing = getRecentSearches()
  const filtered = existing.filter((s) => s.toLowerCase() !== query.toLowerCase())
  const updated = [query, ...filtered].slice(0, MAX_RECENT)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
}

function clearRecentSearchesStorage() {
  localStorage.removeItem(STORAGE_KEY)
}

/* ── voice helpers ───────────────────────────────────────────── */

const WORDS = [
  'zero','one','two','three','four','five','six','seven','eight','nine',
  'ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen',
  'seventeen','eighteen','nineteen','twenty',
]

function numberToWord(n: number): string {
  if (n >= 0 && n <= 20) return WORDS[n]
  return String(n)
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/* ── noir style constants ────────────────────────────────────── */

const hairline = 'linear-gradient(to right, rgba(229,194,118,0.4) 0%, rgba(229,194,118,0.1) 40%, transparent 100%)'

function ambientGlow(top: string, left: string) {
  return {
    position: 'absolute' as const,
    top,
    left,
    width: '300px',
    height: '300px',
    background: 'radial-gradient(circle, rgba(229,194,118,0.07) 0%, transparent 70%)',
    filter: 'blur(80px)',
    pointerEvents: 'none' as const,
  }
}

/* ── component ───────────────────────────────────────────────── */

export function SearchScreen() {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)

  /* state */
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Fragrance[]>([])
  const [loading, setLoading] = useState(false)
  const [recentSearches, setRecentSearches] = useState<string[]>(getRecentSearches)
  const [recentlyViewed, setRecentlyViewed] = useState(getRecentlyViewed)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  /* refinements */
  const [filterFamily, setFilterFamily] = useState<string | null>(null)
  const [filterConcentration, setFilterConcentration] = useState<string | null>(null)
  const [filterCharacter, setFilterCharacter] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<SortOption>('rating')

  /* dropdown visibility */
  const [showFamilyList, setShowFamilyList] = useState(false)
  const [showConcList, setShowConcList] = useState(false)
  const [showCharList, setShowCharList] = useState(false)
  const [showSortList, setShowSortList] = useState(false)

  const hasActiveFilters = filterFamily !== null || filterConcentration !== null || filterCharacter !== null

  /* auto-focus */
  useEffect(() => { inputRef.current?.focus() }, [])

  /* debounced search */
  const search = useCallback((
    q: string,
    family?: string | null,
    conc?: string | null,
    character?: string | null,
    sort?: SortOption,
  ) => {
    if (q.length < 2 && !family && !conc && !character) {
      setResults([]); setLoading(false); return
    }
    setLoading(true)

    let qb = supabase
      .from('fragrances')
      .select('*')
      .not('image_url', 'is', null)

    if (q.length >= 2) {
      qb = qb.or(`name.ilike.%${q}%,brand.ilike.%${q}%`)
    }
    if (family) qb = qb.eq('note_family', family)
    if (conc) qb = qb.eq('concentration', conc)
    if (character) qb = qb.eq('gender', character)

    const s = sort ?? 'rating'
    if (s === 'rating') {
      qb = qb.order('rating', { ascending: false, nullsFirst: false })
    } else if (s === 'name') {
      qb = qb.order('name', { ascending: true })
    } else {
      qb = qb.order('brand', { ascending: true }).order('name', { ascending: true })
    }

    qb.limit(30).then(({ data }) => {
      if (data) setResults(data as Fragrance[])
      setLoading(false)
      if (q.length >= 2) trackEvent(AnalyticsEvents.SEARCH, { query: q, results_count: data?.length ?? 0 })
    })
  }, [])

  useEffect(() => {
    clearTimeout(debounceRef.current)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (query.length < 2 && !hasActiveFilters) { setResults([]); return }
    debounceRef.current = setTimeout(
      () => search(query, filterFamily, filterConcentration, filterCharacter, sortBy),
      250,
    )
    return () => clearTimeout(debounceRef.current)
  }, [query, search, filterFamily, filterConcentration, filterCharacter, sortBy, hasActiveFilters])

  /* handlers */
  const handleSelect = (frag: Fragrance) => {
    saveRecentSearch(`${frag.brand} ${frag.name}`)
    navigate(`/fragrance/${frag.id}`)
  }

  const handleRecentTap = (term: string) => { setQuery(term); search(term) }
  const handleHouseTap = (brand: string) => { setQuery(brand); search(brand) }

  const handleClearRecent = () => {
    clearRecentSearchesStorage()
    setRecentSearches([])
  }

  const clearAllFilters = () => {
    setFilterFamily(null)
    setFilterConcentration(null)
    setFilterCharacter(null)
    setSortBy('rating')
  }

  const closeAllDropdowns = () => {
    setShowFamilyList(false)
    setShowConcList(false)
    setShowCharList(false)
    setShowSortList(false)
  }

  const isSearching = query.length >= 2 || hasActiveFilters
  const showLanding = !isSearching && results.length === 0

  /* sort label */
  const sortLabel = sortBy === 'rating' ? 'most appreciated'
    : sortBy === 'name' ? 'by name, a to z' : 'by house, a to z'

  /* ── render ────────────────────────────────────────────────── */

  return (
    <main
      className="relative pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen overflow-hidden"
      onClick={() => closeAllDropdowns()}
    >
      {/* ── ambient gold lifts ─────────────────────────────── */}
      <div aria-hidden style={ambientGlow('-5%', '-10%')} />
      <div aria-hidden style={ambientGlow('40%', '70%')} />
      <div aria-hidden style={ambientGlow('80%', '-15%')} />

      {/* ── I. THE FRONTISPIECE ────────────────────────────── */}
      <header className="mb-10">
        <p
          className="font-label text-[0.65rem] tracking-[0.3em] uppercase mb-3"
          style={{ color: 'rgba(229,194,118,0.6)' }}
        >
          THE READING ROOM · CATALOGUE DESK
        </p>
        <h1 className="font-headline italic text-5xl md:text-6xl leading-tight text-on-background mb-3">
          Request a title.
        </h1>
        <p className="font-headline italic text-base md:text-lg" style={{ color: 'rgba(168,154,145,0.7)' }}>
          Consult our catalogue of over two thousand titles by name, house, or note.
        </p>
        <div className="mt-6" style={{ height: '1px', background: hairline }} />
      </header>

      {/* ── II. THE REQUEST SLIP ───────────────────────────── */}
      <div className="relative flex items-center mb-2 group">
        <span className="mr-3 flex-shrink-0">⌕</span>
        <input
          ref={inputRef}
          className="bg-transparent border-none p-0 focus:ring-0 focus:outline-none w-full font-headline italic text-xl text-on-background placeholder:font-headline placeholder:italic"
          style={{ caretColor: '#e5c276' }}
          placeholder="A name, a house, a note…"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Request a title"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setResults([]) }}
            className="font-headline italic text-sm transition-colors ml-3 flex-shrink-0"
            style={{ color: 'rgba(168,154,145,0.5)' }}
          >
            clear
          </button>
        )}
      </div>
      <div
        className="transition-opacity duration-300"
        style={{
          height: '1px',
          background: hairline,
          opacity: query ? 1 : 0.4,
        }}
      />

      {/* ── III. THE REFINEMENTS ───────────────────────────── */}
      <div className="mt-5 mb-2">
        <p className="font-headline italic text-sm" style={{ color: 'rgba(168,154,145,0.6)' }}>
          Refine by{' '}
          {/* note family trigger */}
          <span className="relative inline-block">
            <button
              onClick={(e) => { e.stopPropagation(); closeAllDropdowns(); setShowFamilyList(!showFamilyList) }}
              className="font-headline italic underline underline-offset-2 transition-colors"
              style={{ color: filterFamily ? '#e5c276' : 'rgba(168,154,145,0.6)' }}
            >
              {filterFamily ? filterFamily.toLowerCase() : 'note family'}
            </button>
            {showFamilyList && (
              <ul
                className="absolute left-0 top-full mt-1 z-50 py-2 px-1 min-w-[160px]"
                style={{ background: '#261e1b' }}
                onClick={(e) => e.stopPropagation()}
              >
                {NOTE_FAMILIES.map(f => (
                  <li key={f}>
                    <button
                      onClick={() => { setFilterFamily(filterFamily === f ? null : f); setShowFamilyList(false) }}
                      className="w-full text-left font-headline italic text-sm px-3 py-1.5 transition-colors"
                      style={{ color: filterFamily === f ? '#e5c276' : 'rgba(168,154,145,0.5)' }}
                    >
                      {f.toLowerCase()}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </span>
          ,{' '}
          {/* concentration trigger */}
          <span className="relative inline-block">
            <button
              onClick={(e) => { e.stopPropagation(); closeAllDropdowns(); setShowConcList(!showConcList) }}
              className="font-headline italic underline underline-offset-2 transition-colors"
              style={{ color: filterConcentration ? '#e5c276' : 'rgba(168,154,145,0.6)' }}
            >
              {filterConcentration ? filterConcentration.toLowerCase() : 'concentration'}
            </button>
            {showConcList && (
              <ul
                className="absolute left-0 top-full mt-1 z-50 py-2 px-1 min-w-[180px]"
                style={{ background: '#261e1b' }}
                onClick={(e) => e.stopPropagation()}
              >
                {CONCENTRATIONS.map(c => (
                  <li key={c}>
                    <button
                      onClick={() => { setFilterConcentration(filterConcentration === c ? null : c); setShowConcList(false) }}
                      className="w-full text-left font-headline italic text-sm px-3 py-1.5 transition-colors"
                      style={{ color: filterConcentration === c ? '#e5c276' : 'rgba(168,154,145,0.5)' }}
                    >
                      {c.toLowerCase()}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </span>
          , or{' '}
          {/* character trigger */}
          <span className="relative inline-block">
            <button
              onClick={(e) => { e.stopPropagation(); closeAllDropdowns(); setShowCharList(!showCharList) }}
              className="font-headline italic underline underline-offset-2 transition-colors"
              style={{ color: filterCharacter ? '#e5c276' : 'rgba(168,154,145,0.6)' }}
            >
              {filterCharacter ? filterCharacter.toLowerCase() : 'character'}
            </button>
            {showCharList && (
              <ul
                className="absolute left-0 top-full mt-1 z-50 py-2 px-1 min-w-[120px]"
                style={{ background: '#261e1b' }}
                onClick={(e) => e.stopPropagation()}
              >
                {CHARACTERS.map(g => (
                  <li key={g}>
                    <button
                      onClick={() => { setFilterCharacter(filterCharacter === g ? null : g); setShowCharList(false) }}
                      className="w-full text-left font-headline italic text-sm px-3 py-1.5 transition-colors"
                      style={{ color: filterCharacter === g ? '#e5c276' : 'rgba(168,154,145,0.5)' }}
                    >
                      {g.toLowerCase()}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </span>
          .
          {hasActiveFilters && (
            <>
              {' '}
              <button
                onClick={clearAllFilters}
                className="font-headline italic text-sm transition-colors"
                style={{ color: 'rgba(168,154,145,0.5)' }}
              >
                clear refinements
              </button>
            </>
          )}
        </p>

        {/* sort sentence */}
        <p className="font-headline italic text-sm mt-2" style={{ color: 'rgba(168,154,145,0.6)' }}>
          Arranged by{' '}
          <span className="relative inline-block">
            <button
              onClick={(e) => { e.stopPropagation(); closeAllDropdowns(); setShowSortList(!showSortList) }}
              className="font-headline italic underline underline-offset-2 transition-colors"
              style={{ color: 'rgba(168,154,145,0.6)' }}
            >
              {sortLabel}
            </button>
            {showSortList && (
              <ul
                className="absolute left-0 top-full mt-1 z-50 py-2 px-1 min-w-[180px]"
                style={{ background: '#261e1b' }}
                onClick={(e) => e.stopPropagation()}
              >
                {([
                  ['rating', 'most appreciated'],
                  ['name', 'by name, a to z'],
                  ['brand', 'by house, a to z'],
                ] as [SortOption, string][]).map(([val, label]) => (
                  <li key={val}>
                    <button
                      onClick={() => { setSortBy(val); setShowSortList(false) }}
                      className="w-full text-left font-headline italic text-sm px-3 py-1.5 transition-colors"
                      style={{ color: sortBy === val ? '#e5c276' : 'rgba(168,154,145,0.5)' }}
                    >
                      {label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </span>
          .
        </p>
      </div>

      {/* ── IV. THE RESULTS ────────────────────────────────── */}
      {!loading && isSearching && results.length > 0 && (
        <section className="mt-8">
          <p className="font-headline italic text-base mb-6" style={{ color: 'rgba(168,154,145,0.7)' }}>
            <em>{capitalise(numberToWord(results.length))}</em>{' '}
            {results.length === 1 ? 'title matched' : 'titles matched'} your request.
          </p>
          <div className="grid grid-cols-[64px_1fr] md:grid-cols-[96px_1fr] gap-y-6 md:gap-y-8">
            {results.map((frag) => (
              <div key={frag.id} className="group contents">
                {/* portrait */}
                <button
                  onClick={() => handleSelect(frag)}
                  className="aspect-[3/4] rounded-sm overflow-hidden grayscale group-hover:grayscale-0 transition-all duration-700"
                  style={{ background: '#3c3330' }}
                >
                  <FragranceImage
                    src={frag.image_url}
                    alt={frag.name}
                    noteFamily={frag.note_family}
                    size="sm"
                    className="w-full h-full object-cover"
                  />
                </button>
                {/* meta */}
                <div className="flex flex-col justify-center pl-4">
                  <p
                    className="font-label text-[0.6rem] tracking-[0.15em] uppercase"
                    style={{ color: 'rgba(229,194,118,0.7)' }}
                  >
                    {frag.brand}
                  </p>
                  <button
                    onClick={() => handleSelect(frag)}
                    className="font-headline italic text-lg text-on-background text-left leading-snug mt-0.5"
                  >
                    {frag.name}
                  </button>
                  {frag.concentration && (
                    <p
                      className="font-headline italic text-sm mt-0.5"
                      style={{ color: 'rgba(168,154,145,0.5)' }}
                    >
                      {frag.concentration.toLowerCase()}
                    </p>
                  )}
                </div>
                {/* hairline spans full grid */}
                <div className="col-span-2 mt-1" style={{ height: '1px', background: hairline }} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── V. THE EMPTY CATALOGUE ─────────────────────────── */}
      {!loading && isSearching && results.length === 0 && (
        <div className="flex items-center justify-center py-20">
          <p
            className="font-headline italic text-base text-center max-w-md"
            style={{ color: 'rgba(168,154,145,0.6)' }}
          >
            No titles in the catalogue match your request.
          </p>
        </div>
      )}

      {/* ── VI. THE LANDING ────────────────────────────────── */}
      {showLanding && (
        <div className="mt-10 space-y-10">
          {/* a) Recent Enquiries */}
          {recentSearches.length > 0 && (
            <section>
              <div className="flex justify-between items-center mb-3">
                <p
                  className="font-label text-[0.65rem] tracking-[0.3em] uppercase"
                  style={{ color: 'rgba(229,194,118,0.6)' }}
                >
                  RECENT ENQUIRIES
                </p>
                <button
                  onClick={handleClearRecent}
                  className="font-headline italic text-sm transition-colors"
                  style={{ color: 'rgba(168,154,145,0.5)' }}
                >
                  clear
                </button>
              </div>
              <p className="font-headline italic text-base leading-relaxed">
                {recentSearches.map((term, i) => (
                  <span key={term}>
                    <button
                      onClick={() => handleRecentTap(term)}
                      className="font-headline italic transition-colors"
                      style={{ color: 'rgba(168,154,145,0.5)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = '#f0dfdb' }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(168,154,145,0.5)' }}
                    >
                      {term}
                    </button>
                    {i < recentSearches.length - 1 && (
                      <span className="mx-2" style={{ color: 'rgba(229,194,118,0.3)' }}>·</span>
                    )}
                  </span>
                ))}
              </p>
            </section>
          )}

          {/* b) Recently Consulted */}
          {recentlyViewed.length > 0 && (
            <section>
              <div className="flex justify-between items-center mb-3">
                <p
                  className="font-label text-[0.65rem] tracking-[0.3em] uppercase"
                  style={{ color: 'rgba(229,194,118,0.6)' }}
                >
                  RECENTLY CONSULTED
                </p>
                <button
                  onClick={() => { clearRecentlyViewed(); setRecentlyViewed([]) }}
                  className="font-headline italic text-sm transition-colors"
                  style={{ color: 'rgba(168,154,145,0.5)' }}
                >
                  clear
                </button>
              </div>
              <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-6 px-6 pb-2">
                {recentlyViewed.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => navigate(`/fragrance/${item.id}`)}
                    className="flex-shrink-0 flex flex-col items-center gap-1.5 group"
                    style={{ minWidth: '80px' }}
                  >
                    <div
                      className="w-full aspect-[3/4] rounded-sm overflow-hidden grayscale group-hover:grayscale-0 transition-all duration-700"
                      style={{ background: '#3c3330' }}
                    >
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full" style={{ background: '#3c3330' }} />
                      )}
                    </div>
                    <span
                      className="font-headline italic text-center line-clamp-2 leading-tight"
                      style={{ fontSize: '0.65rem', color: 'rgba(168,154,145,0.6)' }}
                    >
                      {item.name}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* c) Distinguished Houses */}
          <section>
            <p
              className="font-label text-[0.65rem] tracking-[0.3em] uppercase mb-3"
              style={{ color: 'rgba(229,194,118,0.6)' }}
            >
              DISTINGUISHED HOUSES
            </p>
            <p className="font-headline italic text-base leading-relaxed">
              {DISTINGUISHED_HOUSES.map((house, i) => (
                <span key={house}>
                  <button
                    onClick={() => handleHouseTap(house)}
                    className="font-headline italic transition-colors"
                    style={{ color: 'rgba(168,154,145,0.5)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#f0dfdb' }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(168,154,145,0.5)' }}
                  >
                    {house}
                  </button>
                  {i < DISTINGUISHED_HOUSES.length - 1 && (
                    <span className="mx-2" style={{ color: 'rgba(229,194,118,0.3)' }}>·</span>
                  )}
                </span>
              ))}
            </p>
          </section>
        </div>
      )}

      {/* ── VII. THE LOADING STATE ─────────────────────────── */}
      {loading && (
        <section className="mt-8">
          <div className="grid grid-cols-[64px_1fr] md:grid-cols-[96px_1fr] gap-y-6 md:gap-y-8">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="contents">
                <div
                  className="aspect-[3/4] rounded-sm animate-pulse"
                  style={{ background: '#3c3330' }}
                />
                <div className="flex flex-col justify-center pl-4 gap-2">
                  <div className="h-2 w-16 rounded-sm animate-pulse" style={{ background: '#3c3330' }} />
                  <div className="h-4 w-32 rounded-sm animate-pulse" style={{ background: '#3c3330' }} />
                  <div className="h-2.5 w-24 rounded-sm animate-pulse" style={{ background: '#3c3330' }} />
                </div>
                <div className="col-span-2 mt-1" style={{ height: '1px', background: hairline }} />
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  )
}
