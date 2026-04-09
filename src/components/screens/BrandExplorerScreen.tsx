import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../ui/Icon'
import { useBrandExplorer, useBrandFragrances } from '@/hooks/useBrandExplorer'
import type { BrandSortOption, BrandStats } from '@/hooks/useBrandExplorer'
import type { Fragrance } from '@/types/database'

const SORT_OPTIONS: { value: BrandSortOption; label: string; icon: string }[] = [
  { value: 'most', label: 'Most owned', icon: 'sort' },
  { value: 'alpha', label: 'A–Z', icon: 'sort_by_alpha' },
  { value: 'rating', label: 'Top rated', icon: 'star' },
]

export function BrandExplorerScreen() {
  const navigate = useNavigate()
  const { brands, loading, sort, setSort, search, setSearch, totalBrands, totalFragrances } = useBrandExplorer()
  const [expandedBrand, setExpandedBrand] = useState<string | null>(null)

  if (loading) {
    return (
      <main className="pt-24 pb-32 px-6 min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </main>
    )
  }

  return (
    <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen">
      {/* Header */}
      <section className="mb-6">
        <h1 className="font-headline text-2xl text-on-surface mb-1">Brand Explorer</h1>
        <p className="text-xs text-secondary/50">
          {totalBrands} brand{totalBrands !== 1 ? 's' : ''} · {totalFragrances} fragrance{totalFragrances !== 1 ? 's' : ''}
        </p>
      </section>

      {/* Search */}
      <div className="relative mb-4">
        <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary/40" size={18} />
        <input
          type="text"
          placeholder="Search brands…"
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

      {/* Brand list */}
      {brands.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Icon name="storefront" className="text-4xl text-primary/20" />
          <p className="text-sm text-secondary/50">
            {search ? 'No matching brands' : 'No brands in your collection yet'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {brands.map((brand) => (
            <BrandCard
              key={brand.brand}
              brand={brand}
              isExpanded={expandedBrand === brand.brand}
              onToggle={() => setExpandedBrand(expandedBrand === brand.brand ? null : brand.brand)}
              onNavigate={(id) => navigate(`/fragrance/${id}`)}
            />
          ))}
        </div>
      )}
    </main>
  )
}

function BrandCard({
  brand,
  isExpanded,
  onToggle,
  onNavigate,
}: {
  brand: BrandStats
  isExpanded: boolean
  onToggle: () => void
  onNavigate: (fragranceId: string) => void
}) {
  return (
    <div className="bg-surface-container rounded-2xl overflow-hidden transition-all">
      {/* Brand header row */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-4 text-left active:bg-surface-container-highest/50 transition-colors"
      >
        {/* Brand image thumbnail */}
        <div className="w-11 h-11 rounded-xl overflow-hidden bg-surface-container-highest flex-shrink-0">
          {brand.imageUrl ? (
            <img src={brand.imageUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Icon name="storefront" className="text-secondary/20" size={20} />
            </div>
          )}
        </div>

        {/* Brand info */}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-on-surface truncate">{brand.brand}</h3>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-secondary/50">
              {brand.count} fragrance{brand.count !== 1 ? 's' : ''}
            </span>
            {brand.avgRating !== null && (
              <>
                <span className="text-[10px] text-secondary/30">·</span>
                <span className="text-[10px] text-primary/70 flex items-center gap-0.5">
                  <Icon name="star" filled size={10} />
                  {brand.avgRating}
                </span>
              </>
            )}
            {brand.topFamily && (
              <>
                <span className="text-[10px] text-secondary/30">·</span>
                <span className="text-[10px] text-secondary/50">{brand.topFamily}</span>
              </>
            )}
          </div>
        </div>

        {/* Count badge + chevron */}
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
            {brand.count}
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
        <BrandFragranceList brand={brand.brand} onNavigate={onNavigate} />
      )}
    </div>
  )
}

function BrandFragranceList({ brand, onNavigate }: { brand: string; onNavigate: (id: string) => void }) {
  const { fragrances, loading } = useBrandFragrances(brand)

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
  fragrance: Fragrance & { personal_rating: number | null; date_added: string }
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
        <div className="flex items-center gap-2 mt-0.5">
          {fragrance.concentration && (
            <span className="text-[9px] text-secondary/40">{fragrance.concentration}</span>
          )}
          {fragrance.note_family && (
            <>
              {fragrance.concentration && <span className="text-[9px] text-secondary/20">·</span>}
              <span className="text-[9px] text-secondary/40">{fragrance.note_family}</span>
            </>
          )}
        </div>
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
