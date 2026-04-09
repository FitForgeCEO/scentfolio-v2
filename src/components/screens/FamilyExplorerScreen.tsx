import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../ui/Icon'
import { useFamilyExplorer, useFamilyFragrances, getFamilyIcon } from '@/hooks/useFamilyExplorer'
import type { FamilySortOption, FamilyStats } from '@/hooks/useFamilyExplorer'
import type { Fragrance } from '@/types/database'

const SORT_OPTIONS: { value: FamilySortOption; label: string; icon: string }[] = [
  { value: 'most', label: 'Most owned', icon: 'sort' },
  { value: 'alpha', label: 'A–Z', icon: 'sort_by_alpha' },
  { value: 'rating', label: 'Top rated', icon: 'star' },
]

export function FamilyExplorerScreen() {
  const navigate = useNavigate()
  const { families, loading, sort, setSort, search, setSearch, totalFamilies, totalFragrances } = useFamilyExplorer()
  const [expandedFamily, setExpandedFamily] = useState<string | null>(null)

  if (loading) {
    return (
      <main className="pt-24 pb-32 px-6 min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </main>
    )
  }

  // Distribution bar data
  const maxCount = families.length > 0 ? Math.max(...families.map(f => f.count)) : 1

  return (
    <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen">
      {/* Header */}
      <section className="mb-6">
        <h1 className="font-headline text-2xl text-on-surface mb-1">Note Families</h1>
        <p className="text-xs text-secondary/50">
          {totalFamilies} famil{totalFamilies !== 1 ? 'ies' : 'y'} · {totalFragrances} fragrance{totalFragrances !== 1 ? 's' : ''}
        </p>
      </section>

      {/* Distribution overview */}
      {families.length > 0 && !search && (
        <section className="mb-6 bg-surface-container rounded-2xl p-4">
          <p className="text-[9px] uppercase tracking-[0.15em] text-secondary/40 font-bold mb-3">DISTRIBUTION</p>
          <div className="space-y-2">
            {families.slice(0, 6).map((fam) => (
              <div key={fam.family} className="flex items-center gap-2">
                <Icon name={getFamilyIcon(fam.family)} size={14} className="text-primary/60 flex-shrink-0" />
                <span className="text-[10px] text-on-surface-variant w-16 truncate flex-shrink-0">{fam.family}</span>
                <div className="flex-1 h-2 bg-surface-container-highest rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary/60 rounded-full transition-all duration-500"
                    style={{ width: `${(fam.count / maxCount) * 100}%` }}
                  />
                </div>
                <span className="text-[9px] text-secondary/40 w-5 text-right flex-shrink-0">{fam.count}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Search */}
      <div className="relative mb-4">
        <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary/40" size={18} />
        <input
          type="text"
          placeholder="Search families…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-surface-container rounded-xl pl-10 pr-4 py-3 text-sm text-on-surface placeholder:text-secondary/30 outline-none focus:ring-1 focus:ring-primary/30"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary/40 active:text-secondary"
          >
            <Icon name="close" size={16} />
          </button>
        )}
      </div>

      {/* Sort chips */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1 scrollbar-hide">
        {SORT_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setSort(opt.value)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-medium whitespace-nowrap transition-colors ${
              sort === opt.value
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container text-secondary/60'
            }`}
          >
            <Icon name={opt.icon} size={12} />
            {opt.label}
          </button>
        ))}
      </div>

      {/* Family list */}
      {families.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Icon name="category" className="text-4xl text-primary/20" />
          <p className="text-sm text-secondary/50">
            {search ? 'No matching families' : 'No note families in your collection yet'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {families.map((fam) => (
            <FamilyCard
              key={fam.family}
              family={fam}
              isExpanded={expandedFamily === fam.family}
              onToggle={() => setExpandedFamily(expandedFamily === fam.family ? null : fam.family)}
              onNavigate={(id) => navigate(`/fragrance/${id}`)}
            />
          ))}
        </div>
      )}
    </main>
  )
}

function FamilyCard({
  family,
  isExpanded,
  onToggle,
  onNavigate,
}: {
  family: FamilyStats
  isExpanded: boolean
  onToggle: () => void
  onNavigate: (fragranceId: string) => void
}) {
  return (
    <div className="bg-surface-container rounded-2xl overflow-hidden transition-all">
      {/* Family header row */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-4 text-left active:bg-surface-container-highest/50 transition-colors"
      >
        {/* Family icon */}
        <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Icon name={getFamilyIcon(family.family)} className="text-primary" size={22} />
        </div>

        {/* Family info */}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-on-surface">{family.family}</h3>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-secondary/50">
              {family.count} fragrance{family.count !== 1 ? 's' : ''}
            </span>
            {family.avgRating !== null && (
              <>
                <span className="text-[10px] text-secondary/30">·</span>
                <span className="text-[10px] text-primary/70 flex items-center gap-0.5">
                  <Icon name="star" filled size={10} />
                  {family.avgRating}
                </span>
              </>
            )}
          </div>
          {family.topBrands.length > 0 && (
            <p className="text-[9px] text-secondary/40 mt-0.5 truncate">
              {family.topBrands.join(' · ')}
            </p>
          )}
        </div>

        {/* Count badge + chevron */}
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
            {family.count}
          </span>
          <Icon
            name="expand_more"
            className={`text-secondary/40 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
            size={20}
          />
        </div>
      </button>

      {/* Expanded fragrance list */}
      {isExpanded && (
        <FamilyFragranceList family={family.family} onNavigate={onNavigate} />
      )}
    </div>
  )
}

function FamilyFragranceList({ family, onNavigate }: { family: string; onNavigate: (id: string) => void }) {
  const { fragrances, loading } = useFamilyFragrances(family)

  if (loading) {
    return (
      <div className="px-4 pb-4 flex justify-center">
        <div className="w-5 h-5 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    )
  }

  if (fragrances.length === 0) return null

  return (
    <div className="px-3 pb-3 space-y-1">
      {fragrances.map((f) => (
        <FragranceRow key={f.id} fragrance={f} onNavigate={onNavigate} />
      ))}
    </div>
  )
}

function FragranceRow({
  fragrance,
  onNavigate,
}: {
  fragrance: Fragrance & { personal_rating: number | null }
  onNavigate: (id: string) => void
}) {
  return (
    <button
      onClick={() => onNavigate(fragrance.id)}
      className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-surface-container-highest/40 active:bg-surface-container-highest transition-colors text-left"
    >
      <div className="w-9 h-9 rounded-lg overflow-hidden bg-surface-container flex-shrink-0">
        {fragrance.image_url ? (
          <img src={fragrance.image_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Icon name="water_drop" className="text-secondary/20" size={14} />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-on-surface truncate">{fragrance.name}</p>
        <p className="text-[9px] text-secondary/40 truncate">{fragrance.brand}</p>
      </div>
      {fragrance.personal_rating !== null && fragrance.personal_rating > 0 && (
        <div className="flex items-center gap-0.5 text-primary/70">
          <Icon name="star" filled size={10} />
          <span className="text-[10px] font-medium">{fragrance.personal_rating}</span>
        </div>
      )}
      <Icon name="chevron_right" className="text-secondary/30" size={16} />
    </button>
  )
}
