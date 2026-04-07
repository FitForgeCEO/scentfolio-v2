import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../ui/Icon'
import { InlineError } from '../ui/InlineError'
import { useFragranceSearch } from '@/hooks/useFragrances'
import { supabase } from '@/lib/supabase'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import type { Fragrance } from '@/types/database'

const PAGE_SIZE = 20
const CONCENTRATION_OPTIONS = ['Eau de Parfum', 'Eau de Toilette', 'Eau de Cologne', 'Extrait de Parfum', 'Parfum']
const GENDER_OPTIONS = ['Male', 'Female', 'Unisex']
const SEASON_OPTIONS = ['SPRING', 'SUMMER', 'FALL', 'WINTER']
const NOTE_FAMILY_OPTIONS = ['Floral', 'Woody', 'Oriental', 'Fresh', 'Citrus', 'Aromatic', 'Gourmand', 'Aquatic', 'Spicy', 'Fruity', 'Green', 'Powdery', 'Musky', 'Chypre', 'Fougere', 'Leather']

interface Filters {
  concentration: string | null
  gender: string | null
  noteFamily: string | null
  season: string | null
  minRating: number | null
}

const EMPTY_FILTERS: Filters = { concentration: null, gender: null, noteFamily: null, season: null, minRating: null }

function hasActiveFilters(f: Filters): boolean {
  return !!(f.concentration || f.gender || f.noteFamily || f.season || f.minRating)
}

function countActiveFilters(f: Filters): number {
  return [f.concentration, f.gender, f.noteFamily, f.season, f.minRating].filter(Boolean).length
}

export function ExploreScreen() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)

  // Search mode
  const { data: searchResults, loading: searchLoading, error: searchError } = useFragranceSearch(query)

  // Browse mode with filters + infinite scroll
  const [browseResults, setBrowseResults] = useState<Fragrance[]>([])
  const [browseLoading, setBrowseLoading] = useState(true)
  const [browseLoadingMore, setBrowseLoadingMore] = useState(false)
  const [browseCount, setBrowseCount] = useState(0)
  const [browseError, setBrowseError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const pageRef = useRef(0)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const fetchPage = useCallback((page: number, append: boolean) => {
    if (page === 0) { setBrowseLoading(true); setBrowseError(null) }
    else setBrowseLoadingMore(true)

    let q = supabase
      .from('fragrances')
      .select('*', { count: 'exact' })
      .not('image_url', 'is', null)

    if (filters.concentration) q = q.eq('concentration', filters.concentration)
    if (filters.gender) q = q.ilike('gender', `%${filters.gender}%`)
    if (filters.noteFamily) q = q.eq('note_family', filters.noteFamily)
    if (filters.minRating) q = q.gte('rating', filters.minRating)

    q = q.order('rating', { ascending: false, nullsFirst: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    q.then(({ data, error, count: total }) => {
      if (error) { setBrowseError(error.message); setBrowseLoading(false); setBrowseLoadingMore(false); return }

      let results = (data ?? []) as Fragrance[]
      if (filters.season) {
        results = results.filter((f) =>
          f.season_ranking?.some((s) => s.name.toUpperCase() === filters.season && s.score > 0.5)
        )
      }

      if (append) setBrowseResults((prev) => [...prev, ...results])
      else setBrowseResults(results)

      if (total !== null) setBrowseCount(total)
      setHasMore(results.length === PAGE_SIZE)
      setBrowseLoading(false)
      setBrowseLoadingMore(false)
    })
  }, [filters])

  // Reset and fetch first page when filters change
  useEffect(() => {
    pageRef.current = 0
    fetchPage(0, false)
  }, [fetchPage])

  // Infinite scroll observer
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !browseLoading && !browseLoadingMore) {
          pageRef.current++
          fetchPage(pageRef.current, true)
        }
      },
      { rootMargin: '200px' }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, browseLoading, browseLoadingMore, fetchPage])

  const isSearching = query.length >= 2
  const fragrances = isSearching ? searchResults : browseResults
  const loading = isSearching ? searchLoading : browseLoading
  const error = isSearching ? searchError : browseError
  const activeFilterCount = countActiveFilters(filters)

  return (
    <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen">
      <header className="mb-6">
        <h2 className="font-headline text-3xl text-on-surface leading-tight mb-1">Explore</h2>
        <p className="font-body text-sm text-secondary opacity-70">
          {browseCount.toLocaleString()} fragrances in the library
        </p>
      </header>

      {/* Search + Filter Row */}
      <section className="mb-6 space-y-3">
        <div className="relative flex items-center bg-surface-container rounded-xl px-4 py-3.5 focus-within:ring-1 ring-primary/30 transition-all">
          <Icon name="search" className="text-secondary opacity-50 mr-3" />
          <input
            className="bg-transparent border-none p-0 focus:ring-0 focus:outline-none text-on-surface placeholder:text-secondary/40 w-full text-sm"
            placeholder="Search by name or brand..."
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button onClick={() => setQuery('')} aria-label="Clear search" className="text-secondary/60 active:scale-90 transition-transform">
              <Icon name="close" size={18} />
            </button>
          )}
        </div>

        <button
          onClick={() => setFilterSheetOpen(true)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-full active:scale-95 transition-transform ${
            hasActiveFilters(filters) ? 'bg-primary/15 ring-1 ring-primary/30' : 'bg-surface-container'
          }`}
        >
          <Icon name="tune" className={`text-sm ${hasActiveFilters(filters) ? 'text-primary' : 'text-secondary/60'}`} />
          <span className={`text-[10px] font-bold tracking-widest uppercase ${hasActiveFilters(filters) ? 'text-primary' : 'text-secondary/60'}`}>
            FILTERS{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </span>
        </button>

        {hasActiveFilters(filters) && (
          <div className="flex flex-wrap gap-2">
            {filters.concentration && <FilterChip label={filters.concentration} onRemove={() => setFilters((f) => ({ ...f, concentration: null }))} />}
            {filters.gender && <FilterChip label={filters.gender} onRemove={() => setFilters((f) => ({ ...f, gender: null }))} />}
            {filters.noteFamily && <FilterChip label={filters.noteFamily} onRemove={() => setFilters((f) => ({ ...f, noteFamily: null }))} />}
            {filters.season && <FilterChip label={filters.season} onRemove={() => setFilters((f) => ({ ...f, season: null }))} />}
            {filters.minRating && <FilterChip label={`${filters.minRating}+ rating`} onRemove={() => setFilters((f) => ({ ...f, minRating: null }))} />}
            <button onClick={() => setFilters(EMPTY_FILTERS)} className="text-[10px] font-bold tracking-widest text-error/60 uppercase px-2 py-1">CLEAR ALL</button>
          </div>
        )}
      </section>

      {/* Results Grid */}
      {error ? (
        <InlineError message="Couldn't load fragrances" onRetry={() => fetchPage(0, false)} />
      ) : loading ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-8">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex flex-col">
              <div className="aspect-[3/4] rounded-xl bg-surface-container animate-pulse mb-3" />
              <div className="h-3 w-16 bg-surface-container rounded animate-pulse mb-1" />
              <div className="h-4 w-24 bg-surface-container rounded animate-pulse" />
            </div>
          ))}
        </div>
      ) : fragrances.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-4">
          <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center mb-5">
            <Icon name="search_off" className="text-3xl text-primary/40" />
          </div>
          <h4 className="font-headline text-xl text-on-surface mb-2">No results found</h4>
          <p className="text-sm text-secondary/60 text-center max-w-[260px]">
            {isSearching
              ? `We couldn't find anything matching "${query}". Try a different name or brand.`
              : hasActiveFilters(filters)
              ? 'No fragrances match your filters. Try adjusting or clearing them.'
              : 'No fragrances found. Check back soon — we\'re always adding more.'}
          </p>
        </div>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-x-4 gap-y-8 mb-8">
            {fragrances.map((frag) => (
              <div
                key={frag.id}
                className="flex flex-col group cursor-pointer"
                role="link"
                tabIndex={0}
                onClick={() => navigate(`/fragrance/${frag.id}`)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/fragrance/${frag.id}`) } }}
              >
                <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-surface-container-low mb-3">
                  {frag.image_url ? (
                    <img src={frag.image_url} alt={frag.name} className="w-full h-full object-cover grayscale-[20%] group-hover:scale-105 transition-transform duration-700" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-secondary/20">
                      <Icon name="water_drop" size={40} />
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-background/80 to-transparent" />
                </div>
                <span className="font-label text-[9px] tracking-[0.2em] text-secondary opacity-60 uppercase mb-0.5">{frag.brand}</span>
                <h3 className="font-body text-sm font-medium text-on-surface line-clamp-1 mb-1">{frag.name}</h3>
                {frag.rating && (
                  <div className="flex items-center gap-1">
                    <Icon name="star" filled className="text-[12px] text-primary" />
                    <span className="font-body text-[10px] text-primary font-semibold">{Number(frag.rating).toFixed(1)}</span>
                  </div>
                )}
              </div>
            ))}
          </section>

          {/* Infinite scroll sentinel */}
          {!isSearching && (
            <div ref={sentinelRef} className="flex justify-center py-6">
              {browseLoadingMore && (
                <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              )}
              {!hasMore && browseResults.length > 0 && (
                <p className="text-[10px] text-secondary/40 uppercase tracking-widest">You've seen them all</p>
              )}
            </div>
          )}
        </>
      )}

      {filterSheetOpen && (
        <FilterSheet
          filters={filters}
          onApply={(f) => { setFilters(f); setFilterSheetOpen(false) }}
          onClose={() => setFilterSheetOpen(false)}
        />
      )}
    </main>
  )
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="flex items-center gap-1.5 bg-primary/10 px-3 py-1.5 rounded-full">
      <span className="text-[10px] font-bold tracking-wider text-primary uppercase">{label}</span>
      <button onClick={onRemove} aria-label={`Remove ${label} filter`} className="text-primary/60 active:scale-90 transition-transform">
        <Icon name="close" size={12} />
      </button>
    </span>
  )
}

function FilterSheet({ filters, onApply, onClose }: { filters: Filters; onApply: (f: Filters) => void; onClose: () => void }) {
  const [local, setLocal] = useState<Filters>({ ...filters })
  const trapRef = useFocusTrap(true, onClose)

  const toggleOption = (key: keyof Filters, value: string | number) => {
    setLocal((prev) => ({ ...prev, [key]: prev[key] === value ? null : value }))
  }

  return (
    <div ref={trapRef} className="fixed inset-0 z-[var(--z-sheet)] flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="Filter fragrances">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <section className="relative w-full max-h-[80vh] bg-surface-container-low rounded-t-[2.5rem] sheet-shadow flex flex-col overflow-hidden animate-slide-up">
        <div className="flex justify-center py-4"><div className="w-12 h-1 bg-surface-container-highest rounded-full" /></div>
        <header className="px-8 pb-4 flex justify-between items-start">
          <h1 className="text-2xl font-headline font-bold text-on-surface">Filters</h1>
          <button onClick={onClose} aria-label="Close" className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center text-on-surface-variant active:scale-90 transition-transform">
            <Icon name="close" size={20} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-8 space-y-8 pb-6">
          <div className="space-y-3">
            <label className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">CONCENTRATION</label>
            <div className="flex flex-wrap gap-2">
              {CONCENTRATION_OPTIONS.map((opt) => (
                <button key={opt} onClick={() => toggleOption('concentration', opt)} className={`px-4 py-2.5 rounded-full text-xs transition-colors ${local.concentration === opt ? 'bg-primary text-on-primary font-semibold' : 'bg-surface-container-highest text-on-surface-variant'}`}>{opt}</button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">GENDER</label>
            <div className="flex flex-wrap gap-2">
              {GENDER_OPTIONS.map((opt) => (
                <button key={opt} onClick={() => toggleOption('gender', opt)} className={`px-4 py-2.5 rounded-full text-xs transition-colors ${local.gender === opt ? 'bg-primary text-on-primary font-semibold' : 'bg-surface-container-highest text-on-surface-variant'}`}>{opt}</button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">NOTE FAMILY</label>
            <div className="flex flex-wrap gap-2">
              {NOTE_FAMILY_OPTIONS.map((opt) => (
                <button key={opt} onClick={() => toggleOption('noteFamily', opt)} className={`px-4 py-2.5 rounded-full text-xs transition-colors ${local.noteFamily === opt ? 'bg-primary text-on-primary font-semibold' : 'bg-surface-container-highest text-on-surface-variant'}`}>{opt}</button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">BEST SEASON</label>
            <div className="flex flex-wrap gap-2">
              {SEASON_OPTIONS.map((opt) => (
                <button key={opt} onClick={() => toggleOption('season', opt)} className={`px-4 py-2.5 rounded-full text-xs transition-colors ${local.season === opt ? 'bg-primary text-on-primary font-semibold' : 'bg-surface-container-highest text-on-surface-variant'}`}>{opt.charAt(0) + opt.slice(1).toLowerCase()}</button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">MINIMUM RATING</label>
            <div className="flex gap-2">
              {[3, 3.5, 4, 4.5].map((r) => (
                <button key={r} onClick={() => toggleOption('minRating', r)} className={`flex items-center gap-1 px-4 py-2.5 rounded-full text-xs transition-colors ${local.minRating === r ? 'bg-primary text-on-primary font-semibold' : 'bg-surface-container-highest text-on-surface-variant'}`}>
                  <Icon name="star" filled className="text-[11px]" />{r}+
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="px-8 py-4 flex gap-3 border-t border-outline-variant/10">
          <button onClick={() => setLocal(EMPTY_FILTERS)} className="flex-1 py-3.5 rounded-xl bg-surface-container text-sm font-medium text-on-surface active:scale-95 transition-transform">Clear All</button>
          <button onClick={() => onApply(local)} className="flex-1 py-3.5 gold-gradient text-on-primary font-bold uppercase tracking-[0.1em] rounded-xl ambient-glow active:scale-[0.98] transition-all text-sm">APPLY</button>
        </div>
      </section>
    </div>
  )
}
