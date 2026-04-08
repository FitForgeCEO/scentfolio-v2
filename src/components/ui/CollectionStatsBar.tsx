import { useMemo } from 'react'
import { Icon } from './Icon'

interface CollectionItem {
  status: string
  personal_rating: number | null
  fragrance: {
    brand: string
    rating: number | null
    price_value: string | null
    note_family: string | null
  }
}

interface Props {
  items: CollectionItem[]
}

export function CollectionStatsBar({ items }: Props) {
  const stats = useMemo(() => {
    if (items.length === 0) return null

    const owned = items.filter((i) => i.status === 'own')

    // Average rating
    const ratings = owned
      .map((i) => i.personal_rating ?? Number(i.fragrance.rating) ?? 0)
      .filter((r) => r > 0)
    const avgRating = ratings.length > 0
      ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
      : null

    // Total estimated value
    const values = owned
      .map((i) => Number(i.fragrance.price_value) || 0)
      .filter((v) => v > 0)
    const totalValue = values.reduce((a, b) => a + b, 0)

    // Top brand (most owned)
    const brandCounts: Record<string, number> = {}
    for (const i of owned) {
      brandCounts[i.fragrance.brand] = (brandCounts[i.fragrance.brand] || 0) + 1
    }
    const topBrand = Object.entries(brandCounts).sort((a, b) => b[1] - a[1])[0]

    // Unique families
    const families = new Set(owned.map((i) => i.fragrance.note_family).filter(Boolean))

    return { avgRating, totalValue, topBrand, familyCount: families.size, ownedCount: owned.length }
  }, [items])

  if (!stats || stats.ownedCount < 3) return null

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-6 px-6 scrollbar-hide mb-4">
      {stats.avgRating && (
        <StatChip icon="star" label="Avg" value={stats.avgRating} />
      )}
      {stats.totalValue > 0 && (
        <StatChip icon="payments" label="Value" value={`£${Math.round(stats.totalValue)}`} />
      )}
      {stats.topBrand && (
        <StatChip icon="workspace_premium" label="Top" value={stats.topBrand[0]} sub={`×${stats.topBrand[1]}`} />
      )}
      {stats.familyCount > 0 && (
        <StatChip icon="spa" label="Families" value={String(stats.familyCount)} />
      )}
    </div>
  )
}

function StatChip({ icon, label, value, sub }: { icon: string; label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-center gap-2 bg-surface-container rounded-xl px-3 py-2 flex-shrink-0">
      <Icon name={icon} className="text-primary" size={14} />
      <div className="flex items-baseline gap-1">
        <span className="text-[10px] text-secondary/50">{label}</span>
        <span className="text-xs text-on-surface font-bold truncate max-w-[80px]">{value}</span>
        {sub && <span className="text-[10px] text-primary/60 font-bold">{sub}</span>}
      </div>
    </div>
  )
}
