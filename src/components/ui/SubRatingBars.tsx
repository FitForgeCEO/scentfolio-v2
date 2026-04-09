interface SubRating {
  label: string
  value: number | null
}

interface SubRatingBarsProps {
  scent: number | null
  longevity: number | null
  sillage: number | null
  value: number | null
  /** Compact mode for feed cards (single row, no labels) */
  compact?: boolean
}

const SUB_LABELS: { key: keyof Omit<SubRatingBarsProps, 'compact'>; label: string }[] = [
  { key: 'scent', label: 'Scent' },
  { key: 'longevity', label: 'Longevity' },
  { key: 'sillage', label: 'Sillage' },
  { key: 'value', label: 'Value' },
]

function RatingBar({ label, value }: SubRating) {
  if (value === null || value === 0) return null
  const pct = (value / 5) * 100

  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] uppercase tracking-[0.1em] text-secondary/60 w-16 text-right font-label">
        {label}
      </span>
      <div className="flex-1 h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
        <div
          className="h-full bg-primary/60 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[9px] text-secondary/50 font-mono w-4 text-right">{value}</span>
    </div>
  )
}

function CompactBar({ value }: { value: number }) {
  const pct = (value / 5) * 100
  return (
    <div className="flex-1 h-1 bg-surface-container-highest rounded-full overflow-hidden">
      <div
        className="h-full bg-primary/50 rounded-full"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export function SubRatingBars({ scent, longevity, sillage, value, compact = false }: SubRatingBarsProps) {
  const ratings = SUB_LABELS.map((s) => ({
    ...s,
    value: { scent, longevity, sillage, value }[s.key] as number | null,
  })).filter((r) => r.value !== null && r.value > 0)

  if (ratings.length === 0) return null

  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        {ratings.map((r) => (
          <div key={r.key} className="flex items-center gap-1 flex-1" title={`${r.label}: ${r.value}/5`}>
            <span className="text-[7px] text-secondary/40 uppercase">{r.label.slice(0, 3)}</span>
            <CompactBar value={r.value!} />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      {ratings.map((r) => (
        <RatingBar key={r.key} label={r.label} value={r.value} />
      ))}
    </div>
  )
}
