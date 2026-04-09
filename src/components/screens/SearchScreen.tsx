import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../ui/Icon'
import { FragranceImage } from '../ui/FragranceImage'
import { supabase } from '@/lib/supabase'
import type { Fragrance } from '@/types/database'
import { getRecentlyViewed, clearRecentlyViewed } from '@/lib/recentlyViewed'
import { trackEvent, AnalyticsEvents } from '@/lib/analytics'

const POPULAR_SEARCHES = [
  'Dior', 'Chanel', 'Tom Ford', 'Creed', 'Le Labo',
  'Maison Margiela', 'Jo Malone', 'Byredo', 'Versace', 'YSL',
]

const NOTE_FAMILIES = [
  'Woody', 'Floral', 'Oriental', 'Fresh', 'Citrus', 'Aromatic', 'Gourmand', 'Aquatic', 'Spicy', 'Leather', 'Musk', 'Green',
]

const CONCENTRATIONS = [
  'Eau de Parfum', 'Eau de Toilette', 'Parfum', 'Eau de Cologne', 'Extrait',
]

const GENDERS = ['Unisex', 'Male', 'Female']

type SortOption = 'rating' | 'name' | 'brand'

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

function clearRecentSearches() {
  localStorage.removeItem(STORAGE_KEY)
}

export function SearchScreen() {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Fragrance[]>([])
  const [loading, setLoading] = useState(false)
  const [recentSearches, setRecentSearches] = useState<string[]>(getRecentSearches)
  const [recentlyViewed, setRecentlyViewed] = useState(getRecentlyViewed)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Filters
  const [showFilters, setShowFilters] = useState(false)
  const [filterFamily, setFilterFamily] = useState<string | null>(null)
  const [filterConcentration, setFilterConcentration] = useState<string | null>(null)
  const [filterGender, setFilterGender] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<SortOption>('rating')

  const hasActiveFilters = filterFamily !== null || filterConcentration !== null || filterGender !== null
  const activeFilterCount = [filterFamily, filterConcentration, filterGender].filter(Boolean).length

  // Auto-focus on mount
  useEffect(() => { inputRef.current?.focus() }, [])

  // Debounced search
  const search = useCallback((q: string, family?: string | null, conc?: string | null, gender?: string | null, sort?: SortOption) => {
    if (q.length < 2 && !family && !conc && !gender) { setResults([]); setLoading(false); return }
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
    if (gender) qb = qb.eq('gender', gender)

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
    if (query.length < 2 && !hasActiveFilters) { setResults([]); return }
    debounceRef.current = setTimeout(() => search(query, filterFamily, filterConcentration, filterGender, sortBy), 250)
    return () => clearTimeout(debounceRef.current)
  }, [query, search, filterFamily, filterConcentration, filterGender, sortBy, hasActiveFilters])

  const handleSelect = (frag: Fragrance) => {
    saveRecentSearch(`${frag.brand} ${frag.name}`)
    navigate(`/fragrance/${frag.id}`)
  }

  const handleRecentTap = (term: string) => {
    setQuery(term)
    search(term)
  }

  const handlePopularTap = (brand: string) => {
    setQuery(brand)
    search(brand)
  }

  const handleClearRecent = () => {
    clearRecentSearches()
    setRecentSearches([])
  }

  const clearAllFilters = () => {
    setFilterFamily(null)
    setFilterConcentration(null)
    setFilterGender(null)
    setSortBy('rating')
  }

  const isSearching = query.length >= 2 || hasActiveFilters
  const showLanding = !isSearching && results.length === 0

  return (
    <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen">
      {/* Search Input */}
      <div className="relative flex items-center bg-surface-container rounded-2xl px-4 py-4 focus-within:ring-1 ring-primary/30 transition-all mb-6">
        <Icon name="search" className="text-primary mr-3" />
        <input
          ref={inputRef}
          className="bg-transparent border-none p-0 focus:ring-0 focus:outline-none text-on-surface placeholder:text-secondary/40 w-full text-base"
          placeholder="Search 2,700+ fragrances..."
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search fragrances"
        />
        {query && (
          <button onClick={() => { setQuery(''); setResults([]) }} aria-label="Clear search" className="text-secondary/60 active:scale-90 transition-transform">
            <Icon name="close" size={20} />
          </button>
        )}
      </div>

      {/* Filter toggle + active filter pills */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium transition-all active:scale-95 ${
            hasActiveFilters ? 'bg-primary text-on-primary' : 'bg-surface-container text-secondary'
          }`}
        >
          <Icon name="tune" size={16} />
          <span>Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}</span>
        </button>

        {/* Active filter pills */}
        {filterFamily && (
          <button onClick={() => setFilterFamily(null)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-primary/15 text-primary text-[10px] font-medium active:scale-95">
            {filterFamily} <Icon name="close" size={12} />
          </button>
        )}
        {filterConcentration && (
          <button onClick={() => setFilterConcentration(null)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-primary/15 text-primary text-[10px] font-medium active:scale-95">
            {filterConcentration} <Icon name="close" size={12} />
          </button>
        )}
        {filterGender && (
          <button onClick={() => setFilterGender(null)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-primary/15 text-primary text-[10px] font-medium active:scale-95">
            {filterGender} <Icon name="close" size={12} />
          </button>
        )}
        {hasActiveFilters && (
          <button onClick={clearAllFilters} className="text-[10px] text-error/60 font-bold ml-auto active:scale-95">
            Clear
          </button>
        )}
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="bg-surface-container rounded-2xl p-4 mb-4 space-y-4 animate-slide-up">
          {/* Note Family */}
          <div>
            <p className="text-[10px] uppercase tracking-[0.15em] text-secondary font-bold mb-2">Note Family</p>
            <div className="flex flex-wrap gap-1.5">
              {NOTE_FAMILIES.map(f => (
                <button
                  key={f}
                  onClick={() => setFilterFamily(filterFamily === f ? null : f)}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-medium transition-all active:scale-95 ${
                    filterFamily === f ? 'bg-primary text-on-primary' : 'bg-surface-container-highest text-secondary'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Concentration */}
          <div>
            <p className="text-[10px] uppercase tracking-[0.15em] text-secondary font-bold mb-2">Concentration</p>
            <div className="flex flex-wrap gap-1.5">
              {CONCENTRATIONS.map(c => (
                <button
                  key={c}
                  onClick={() => setFilterConcentration(filterConcentration === c ? null : c)}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-medium transition-all active:scale-95 ${
                    filterConcentration === c ? 'bg-primary text-on-primary' : 'bg-surface-container-highest text-secondary'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Gender */}
          <div>
            <p className="text-[10px] uppercase tracking-[0.15em] text-secondary font-bold mb-2">Gender</p>
            <div className="flex flex-wrap gap-1.5">
              {GENDERS.map(g => (
                <button
                  key={g}
                  onClick={() => setFilterGender(filterGender === g ? null : g)}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-medium transition-all active:scale-95 ${
                    filterGender === g ? 'bg-primary text-on-primary' : 'bg-surface-container-highest text-secondary'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* Sort */}
          <div>
            <p className="text-[10px] uppercase tracking-[0.15em] text-secondary font-bold mb-2">Sort By</p>
            <div className="flex gap-1.5">
              {([['rating', 'Top Rated'], ['name', 'Name A-Z'], ['brand', 'Brand A-Z']] as [SortOption, string][]).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setSortBy(val)}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-medium transition-all active:scale-95 ${
                    sortBy === val ? 'bg-primary text-on-primary' : 'bg-surface-container-highest text-secondary'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Loading indicator */}
      {loading && (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      )}

      {/* Search Results */}
      {!loading && isSearching && results.length > 0 && (
        <section>
          <p className="text-[10px] uppercase tracking-[0.2em] text-secondary/50 font-bold mb-4">
            {results.length} RESULT{results.length !== 1 ? 'S' : ''}
          </p>
          <div className="space-y-1">
            {results.map((frag) => (
              <button
                key={frag.id}
                onClick={() => handleSelect(frag)}
                className="w-full flex items-center gap-3.5 py-3 px-3 rounded-xl text-left active:bg-surface-container-highest transition-colors"
              >
                <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-surface-container-highest">
                  <FragranceImage src={frag.image_url} alt={frag.name} noteFamily={frag.note_family} size="sm" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] uppercase tracking-[0.15em] text-primary/70 font-bold">{frag.brand}</p>
                  <p className="text-sm text-on-surface truncate">{frag.name}</p>
                  {frag.concentration && (
                    <p className="text-[10px] text-secondary/50">{frag.concentration}</p>
                  )}
                </div>
                {frag.rating && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Icon name="star" filled className="text-[11px] text-primary" />
                    <span className="text-[10px] text-primary font-semibold">{Number(frag.rating).toFixed(1)}</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* No results */}
      {!loading && isSearching && results.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center mb-5">
            <Icon name="search_off" className="text-3xl text-primary/40" />
          </div>
          <h4 className="font-headline text-xl text-on-surface mb-2">No results found</h4>
          <p className="text-sm text-secondary/60 text-center max-w-[260px]">
            We couldn't find anything matching "{query}". Try a different name or brand.
          </p>
        </div>
      )}

      {/* Landing — Recent + Popular */}
      {showLanding && (
        <div className="space-y-10">
          {/* Recent Searches */}
          {recentSearches.length > 0 && (
            <section>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">RECENT SEARCHES</h3>
                <button onClick={handleClearRecent} className="text-[10px] uppercase tracking-widest text-error/60 font-bold">CLEAR</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((term) => (
                  <button
                    key={term}
                    onClick={() => handleRecentTap(term)}
                    className="flex items-center gap-2 bg-surface-container px-4 py-2.5 rounded-full active:scale-95 transition-transform"
                  >
                    <Icon name="history" className="text-secondary/40" size={14} />
                    <span className="text-xs text-on-surface">{term}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Recently Viewed */}
          {recentlyViewed.length > 0 && (
            <section>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">RECENTLY VIEWED</h3>
                <button
                  onClick={() => { clearRecentlyViewed(); setRecentlyViewed([]) }}
                  className="text-[10px] uppercase tracking-widest text-error/60 font-bold"
                >
                  CLEAR
                </button>
              </div>
              <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-6 px-6 pb-2">
                {recentlyViewed.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => navigate(`/fragrance/${item.id}`)}
                    className="flex-shrink-0 w-20 flex flex-col items-center gap-1.5 active:scale-95 transition-transform"
                  >
                    <div className="w-16 h-16 rounded-xl overflow-hidden bg-surface-container-highest">
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Icon name="water_drop" className="text-secondary/30" size={20} />
                        </div>
                      )}
                    </div>
                    <span className="text-[9px] text-on-surface text-center line-clamp-2 leading-tight">{item.name}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Popular Brands */}
          <section>
            <h3 className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold mb-4">POPULAR BRANDS</h3>
            <div className="flex flex-wrap gap-2">
              {POPULAR_SEARCHES.map((brand) => (
                <button
                  key={brand}
                  onClick={() => handlePopularTap(brand)}
                  className="flex items-center gap-2 bg-surface-container-high px-4 py-2.5 rounded-full active:scale-95 transition-transform"
                >
                  <Icon name="trending_up" className="text-primary/50" size={14} />
                  <span className="text-xs text-on-surface font-medium">{brand}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Quick Stats */}
          <section className="bg-surface-container rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <Icon name="auto_awesome" className="text-primary" />
              <h3 className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">SEARCH TIPS</h3>
            </div>
            <ul className="space-y-2 text-sm text-secondary/70">
              <li>Search by fragrance name, e.g. "Aventus"</li>
              <li>Search by brand, e.g. "Tom Ford"</li>
              <li>Try partial matches, e.g. "oud" or "rose"</li>
            </ul>
          </section>
        </div>
      )}
    </main>
  )
}
