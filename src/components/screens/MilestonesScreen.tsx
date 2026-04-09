import { useState } from 'react'
import { Icon } from '../ui/Icon'
import { useMilestones } from '@/hooks/useMilestones'
import type { Milestone } from '@/hooks/useMilestones'

const CATEGORY_LABELS: Record<string, { label: string; icon: string }> = {
  collection: { label: 'Collection', icon: 'collections_bookmark' },
  wears: { label: 'Wears', icon: 'checkroom' },
  reviews: { label: 'Reviews', icon: 'rate_review' },
  social: { label: 'Social', icon: 'groups' },
  exploration: { label: 'Exploration', icon: 'travel_explore' },
}

export function MilestonesScreen() {
  const { milestones, achieved, categories, loading } = useMilestones()
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  if (loading) {
    return (
      <main className="pt-24 pb-32 px-6 min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </main>
    )
  }

  const filtered = selectedCategory
    ? milestones.filter(m => m.category === selectedCategory)
    : milestones

  const achievedFiltered = filtered.filter(m => m.achieved)
  const upcomingFiltered = filtered.filter(m => !m.achieved)

  return (
    <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen">
      {/* Header */}
      <section className="mb-6">
        <h1 className="font-headline text-2xl text-on-surface mb-1">Milestones</h1>
        <p className="text-xs text-secondary/50">
          {achieved.length} of {milestones.length} achieved
        </p>
      </section>

      {/* Progress ring */}
      <section className="flex justify-center mb-6">
        <div className="relative w-28 h-28">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="6" className="text-surface-container" />
            <circle
              cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="6"
              className="text-primary"
              strokeDasharray={`${(achieved.length / milestones.length) * 264} 264`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-headline text-2xl text-primary">{achieved.length}</span>
            <span className="text-[8px] text-secondary/40 uppercase tracking-wider">of {milestones.length}</span>
          </div>
        </div>
      </section>

      {/* Category filter */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1 scrollbar-hide">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`px-3 py-1.5 rounded-full text-[10px] font-medium whitespace-nowrap transition-colors ${
            !selectedCategory ? 'bg-primary text-on-primary' : 'bg-surface-container text-secondary/60'
          }`}
        >
          All
        </button>
        {categories.map(cat => {
          const info = CATEGORY_LABELS[cat]
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat ? 'bg-primary text-on-primary' : 'bg-surface-container text-secondary/60'
              }`}
            >
              <Icon name={info?.icon ?? 'category'} size={12} />
              {info?.label ?? cat}
            </button>
          )
        })}
      </div>

      {/* Achieved */}
      {achievedFiltered.length > 0 && (
        <section className="mb-8">
          <h3 className="text-[10px] uppercase tracking-[0.15em] font-label text-secondary mb-3">
            ACHIEVED ({achievedFiltered.length})
          </h3>
          <div className="space-y-2">
            {achievedFiltered.map(m => (
              <MilestoneCard key={m.id} milestone={m} />
            ))}
          </div>
        </section>
      )}

      {/* Upcoming */}
      {upcomingFiltered.length > 0 && (
        <section>
          <h3 className="text-[10px] uppercase tracking-[0.15em] font-label text-secondary mb-3">
            UPCOMING ({upcomingFiltered.length})
          </h3>
          <div className="space-y-2">
            {upcomingFiltered.map(m => (
              <MilestoneCard key={m.id} milestone={m} />
            ))}
          </div>
        </section>
      )}
    </main>
  )
}

function MilestoneCard({ milestone }: { milestone: Milestone }) {
  const progress = Math.min(100, Math.round((milestone.progress / milestone.threshold) * 100))

  return (
    <div className={`bg-surface-container rounded-2xl p-4 transition-all ${
      milestone.achieved ? 'ring-1 ring-primary/20' : 'opacity-70'
    }`}>
      <div className="flex items-center gap-3">
        {/* Icon */}
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
          milestone.achieved ? 'bg-primary/20' : 'bg-surface-container-highest'
        }`}>
          <Icon
            name={milestone.icon}
            className={milestone.achieved ? 'text-primary' : 'text-secondary/30'}
            size={22}
            filled={milestone.achieved}
          />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm text-on-surface font-medium">{milestone.title}</h4>
            {milestone.achieved && (
              <Icon name="check_circle" filled size={14} className="text-primary" />
            )}
          </div>
          <p className="text-[10px] text-secondary/50">{milestone.description}</p>

          {/* Progress bar */}
          {!milestone.achieved && (
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary/50 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-[9px] text-secondary/40">
                {milestone.progress}/{milestone.threshold}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
