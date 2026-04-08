/**
 * Content-specific skeleton loaders for data-heavy screens.
 * These show while data is being fetched (not code-splitting).
 */

/** Card list skeleton — for screens like Smart Collections, Insights, Badges */
export function CardListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-surface-container rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-surface-container-highest flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-32 bg-surface-container-highest rounded" />
            <div className="h-2.5 w-48 bg-surface-container-highest rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Fragrance row skeleton — for collection lists, predictions, etc. */
export function FragranceListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-surface-container rounded-xl p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-surface-container-highest flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-2.5 w-20 bg-surface-container-highest rounded" />
            <div className="h-3.5 w-36 bg-surface-container-highest rounded" />
          </div>
          <div className="w-8 h-8 rounded-full bg-surface-container-highest" />
        </div>
      ))}
    </div>
  )
}

/** Hero + list skeleton — for screens with a top hero card + list below */
export function HeroListSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Hero card */}
      <div className="bg-surface-container rounded-2xl p-6 flex flex-col items-center gap-4">
        <div className="w-16 h-4 bg-surface-container-highest rounded" />
        <div className="w-20 h-20 rounded-xl bg-surface-container-highest" />
        <div className="space-y-2 w-full flex flex-col items-center">
          <div className="h-3 w-24 bg-surface-container-highest rounded" />
          <div className="h-5 w-40 bg-surface-container-highest rounded" />
        </div>
        <div className="flex gap-2">
          <div className="h-6 w-28 rounded-full bg-surface-container-highest" />
          <div className="h-6 w-24 rounded-full bg-surface-container-highest" />
        </div>
      </div>
      {/* List items */}
      <FragranceListSkeleton count={4} />
    </div>
  )
}

/** Score ring skeleton — for health score, stats screens */
export function ScoreRingSkeleton() {
  return (
    <div className="flex flex-col items-center gap-4 animate-pulse">
      <div className="w-40 h-40 rounded-full border-8 border-surface-container-highest" />
      <div className="flex gap-2">
        <div className="h-6 w-20 rounded-full bg-surface-container-highest" />
        <div className="h-6 w-24 rounded-full bg-surface-container-highest" />
      </div>
    </div>
  )
}

/** Stats grid skeleton — for profile, insights */
export function StatsGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 animate-pulse">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-surface-container rounded-xl p-5 space-y-2">
          <div className="h-3 w-16 bg-surface-container-highest rounded" />
          <div className="h-7 w-12 bg-surface-container-highest rounded" />
        </div>
      ))}
    </div>
  )
}
