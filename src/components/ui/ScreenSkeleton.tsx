/**
 * Skeleton loader shown while lazy-loaded screens are being fetched.
 * Content-shaped placeholders that match the general layout of most screens.
 */
export function ScreenSkeleton() {
  return (
    <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen animate-pulse">
      {/* Title skeleton */}
      <div className="h-7 w-40 bg-surface-container rounded-sm mb-2" />
      <div className="h-4 w-56 bg-surface-container rounded mb-8" />

      {/* Content card skeletons */}
      <div className="space-y-4">
        <div className="h-32 w-full bg-surface-container rounded-sm" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-24 bg-surface-container rounded-sm" />
          <div className="h-24 bg-surface-container rounded-sm" />
        </div>
        <div className="h-20 w-full bg-surface-container rounded-sm" />
        <div className="grid grid-cols-3 gap-3">
          <div className="h-16 bg-surface-container rounded-sm" />
          <div className="h-16 bg-surface-container rounded-sm" />
          <div className="h-16 bg-surface-container rounded-sm" />
        </div>
      </div>
    </main>
  )
}

/**
 * Grid skeleton for screens that show fragrance grids (Explore, Collection, etc.)
 */
export function GridSkeleton() {
  return (
    <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen animate-pulse">
      <div className="h-7 w-32 bg-surface-container rounded-sm mb-2" />
      <div className="h-4 w-48 bg-surface-container rounded mb-6" />

      {/* Search bar skeleton */}
      <div className="h-12 w-full bg-surface-container rounded-sm mb-6" />

      {/* Grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-8">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex flex-col">
            <div className="aspect-[3/4] rounded-sm bg-surface-container mb-3" />
            <div className="h-3 w-16 bg-surface-container rounded mb-1" />
            <div className="h-4 w-24 bg-surface-container rounded" />
          </div>
        ))}
      </div>
    </main>
  )
}
