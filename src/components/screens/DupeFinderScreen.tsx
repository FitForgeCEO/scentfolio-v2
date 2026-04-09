import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../ui/Icon'
import { useDupeSearch, useDupesForFragrance } from '@/hooks/useDupeFinder'
import type { Fragrance } from '@/types/database'

export function DupeFinderScreen() {
  const navigate = useNavigate()
  const { query, setQuery, results, searching } = useDupeSearch()
  const [selectedFragrance, setSelectedFragrance] = useState<Fragrance | null>(null)
  const { dupes, loading: dupesLoading } = useDupesForFragrance(selectedFragrance?.id ?? null)

  return (
    <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen">
      {/* Header */}
      <section className="mb-6">
        <h1 className="font-headline text-2xl text-on-surface mb-1">Dupe Finder</h1>
        <p className="text-xs text-secondary/50">Find affordable alternatives &amp; similar scents</p>
      </section>

      {/* Search */}
      <div className="relative mb-4">
        <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary/40" size={18} />
        <input
          type="text"
          placeholder="Search for a fragrance…"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setSelectedFragrance(null) }}
          className="w-full bg-surface-container rounded-xl pl-10 pr-4 py-3 text-sm text-on-surface placeholder:text-secondary/30 outline-none focus:ring-1 focus:ring-primary/30"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setSelectedFragrance(null) }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary/40"
          >
            <Icon name="close" size={16} />
          </button>
        )}
      </div>

      {/* Search results dropdown */}
      {!selectedFragrance && results.length > 0 && (
        <div className="space-y-1 mb-6">
          {results.map(f => (
            <button
              key={f.id}
              onClick={() => { setSelectedFragrance(f); setQuery('') }}
              className="w-full flex items-center gap-3 bg-surface-container rounded-xl p-3 text-left active:bg-surface-container-highest transition-colors"
            >
              <div className="w-10 h-10 rounded-lg overflow-hidden bg-surface-container-highest flex-shrink-0">
                {f.image_url ? (
                  <img src={f.image_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Icon name="water_drop" className="text-secondary/20" size={16} />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-on-surface truncate">{f.name}</p>
                <p className="text-[10px] text-secondary/50">{f.brand}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {searching && (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      )}

      {/* Selected fragrance card */}
      {selectedFragrance && (
        <section className="mb-6">
          <div className="bg-surface-container rounded-2xl p-4 flex items-center gap-3">
            <div className="w-14 h-14 rounded-xl overflow-hidden bg-surface-container-highest flex-shrink-0">
              {selectedFragrance.image_url ? (
                <img src={selectedFragrance.image_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Icon name="water_drop" className="text-secondary/20" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-on-surface font-medium truncate">{selectedFragrance.name}</p>
              <p className="text-[10px] text-secondary/50">{selectedFragrance.brand}</p>
              {selectedFragrance.note_family && (
                <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[9px]">
                  {selectedFragrance.note_family}
                </span>
              )}
            </div>
            <button
              onClick={() => setSelectedFragrance(null)}
              className="w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center"
            >
              <Icon name="close" size={14} className="text-secondary/60" />
            </button>
          </div>
        </section>
      )}

      {/* Dupes loading */}
      {dupesLoading && (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-xs text-secondary/40">Finding similar scents…</p>
        </div>
      )}

      {/* Dupes results */}
      {selectedFragrance && !dupesLoading && dupes.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <Icon name="search_off" className="text-4xl text-primary/20" />
          <p className="text-sm text-secondary/50">No dupes found for this fragrance yet</p>
        </div>
      )}

      {dupes.length > 0 && (
        <section>
          <h3 className="text-[10px] uppercase tracking-[0.15em] font-label text-secondary mb-3">
            {dupes.length} SIMILAR SCENT{dupes.length !== 1 ? 'S' : ''}
          </h3>
          <div className="space-y-2">
            {dupes.map((dupe) => (
              <button
                key={dupe.connection.id}
                onClick={() => navigate(`/fragrance/${dupe.otherFragrance.id}`)}
                className="w-full flex items-center gap-3 bg-surface-container rounded-2xl p-3 text-left active:scale-[0.98] transition-transform"
              >
                {/* Similarity badge */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  dupe.connection.similarity_score >= 70 ? 'bg-green-500/20' :
                  dupe.connection.similarity_score >= 40 ? 'bg-yellow-500/20' : 'bg-primary/10'
                }`}>
                  <span className={`text-xs font-bold ${
                    dupe.connection.similarity_score >= 70 ? 'text-green-400' :
                    dupe.connection.similarity_score >= 40 ? 'text-yellow-400' : 'text-primary/60'
                  }`}>
                    {dupe.connection.similarity_score}%
                  </span>
                </div>

                {/* Image */}
                <div className="w-11 h-11 rounded-xl overflow-hidden bg-surface-container-highest flex-shrink-0">
                  {dupe.otherFragrance.image_url ? (
                    <img src={dupe.otherFragrance.image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Icon name="water_drop" className="text-secondary/20" size={16} />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-on-surface font-medium truncate">{dupe.otherFragrance.name}</p>
                  <p className="text-[10px] text-secondary/50">{dupe.otherFragrance.brand}</p>
                  {dupe.otherFragrance.note_family && (
                    <span className="text-[9px] text-secondary/40">{dupe.otherFragrance.note_family}</span>
                  )}
                </div>

                {/* Votes */}
                {dupe.connection.votes > 0 && (
                  <div className="flex items-center gap-1 text-secondary/40">
                    <Icon name="thumb_up" size={12} />
                    <span className="text-[9px]">{dupe.connection.votes}</span>
                  </div>
                )}

                <Icon name="chevron_right" className="text-secondary/30" size={16} />
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Empty state when nothing selected */}
      {!selectedFragrance && !query && (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
            <Icon name="compare_arrows" className="text-primary/40 text-4xl" />
          </div>
          <p className="text-sm text-secondary/50 text-center max-w-[260px]">
            Search for any fragrance to find similar scents and affordable alternatives.
          </p>
        </div>
      )}
    </main>
  )
}
