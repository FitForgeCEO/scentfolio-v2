import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../ui/Icon'
import { useFragranceSearch, useFragrancesBrowse } from '@/hooks/useFragrances'

export function ExploreScreen() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const { data: searchResults, loading: searchLoading } = useFragranceSearch(query)
  const { data: browseResults, loading: browseLoading, count } = useFragrancesBrowse(page, 20)

  const isSearching = query.length >= 2
  const fragrances = isSearching ? searchResults : browseResults
  const loading = isSearching ? searchLoading : browseLoading

  return (
    <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen">
      <header className="mb-6">
        <h2 className="font-headline text-3xl text-on-surface leading-tight mb-1">Explore</h2>
        <p className="font-body text-sm text-secondary opacity-70">
          {count.toLocaleString()} fragrances in the library
        </p>
      </header>

      {/* Search */}
      <section className="mb-6">
        <div className="relative flex items-center bg-surface-container rounded-xl px-4 py-3.5 focus-within:ring-1 ring-primary/30 transition-all">
          <Icon name="search" className="text-secondary opacity-50 mr-3" />
          <input
            className="bg-transparent border-none p-0 focus:ring-0 focus:outline-none text-on-surface placeholder:text-secondary/40 w-full text-sm"
            placeholder="Search by name or brand..."
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setPage(0)
            }}
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-secondary/60 active:scale-90 transition-transform">
              <Icon name="close" size={18} />
            </button>
          )}
        </div>
      </section>

      {/* Results Grid */}
      {loading ? (
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
        <div className="flex flex-col items-center justify-center py-20">
          <Icon name="search_off" className="text-4xl text-primary/30 mb-4" />
          <h4 className="font-headline text-xl text-on-surface mb-2">No results</h4>
          <p className="text-sm text-secondary/60 text-center">
            {isSearching ? `No fragrances matching "${query}"` : 'No fragrances found'}
          </p>
        </div>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-x-4 gap-y-8 mb-8">
            {fragrances.map((frag) => (
              <div
                key={frag.id}
                className="flex flex-col group cursor-pointer"
                onClick={() => navigate(`/fragrance/${frag.id}`)}
              >
                <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-surface-container-low mb-3">
                  {frag.image_url ? (
                    <img
                      src={frag.image_url}
                      alt={frag.name}
                      className="w-full h-full object-cover grayscale-[20%] group-hover:scale-105 transition-transform duration-700"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-secondary/20">
                      <Icon name="water_drop" size={40} />
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-background/80 to-transparent" />
                </div>
                <span className="font-label text-[9px] tracking-[0.2em] text-secondary opacity-60 uppercase mb-0.5">
                  {frag.brand}
                </span>
                <h3 className="font-body text-sm font-medium text-on-surface line-clamp-1 mb-1">{frag.name}</h3>
                {frag.rating && (
                  <div className="flex items-center gap-1">
                    <Icon name="star" filled className="text-[12px] text-primary" />
                    <span className="font-body text-[10px] text-primary font-semibold">
                      {Number(frag.rating).toFixed(1)}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </section>

          {/* Pagination (browse mode only) */}
          {!isSearching && (
            <div className="flex justify-center gap-3 mb-8">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-4 py-2 bg-surface-container rounded-lg text-sm text-secondary disabled:opacity-30 active:scale-95 transition-all"
              >
                Previous
              </button>
              <span className="px-4 py-2 text-[10px] uppercase tracking-widest text-primary font-bold flex items-center">
                Page {page + 1}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={fragrances.length < 20}
                className="px-4 py-2 bg-surface-container rounded-lg text-sm text-secondary disabled:opacity-30 active:scale-95 transition-all"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </main>
  )
}
