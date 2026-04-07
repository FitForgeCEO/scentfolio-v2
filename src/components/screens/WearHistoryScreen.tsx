import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useWearHistory } from '@/hooks/useWearHistory'
import { Icon } from '../ui/Icon'
import { InlineError } from '../ui/InlineError'
import type { WearEntry } from '@/hooks/useWearHistory'

const OCCASION_ICONS: Record<string, string> = {
  casual: 'sunny',
  office: 'work',
  date_night: 'favorite',
  night_out: 'nightlife',
  special_event: 'celebration',
  unspecified: 'help_outline',
}

function formatMonthLabel(key: string): string {
  const [year, month] = key.split('-')
  const d = new Date(Number(year), Number(month) - 1)
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

function formatOccasion(occ: string): string {
  return occ.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function WearHistoryScreen() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { entries, mostWorn, groupedByMonth, occasionBreakdown, loading, error, retry } = useWearHistory(user?.id)

  if (!user) {
    return (
      <main className="pt-24 pb-32 px-6 min-h-screen flex flex-col items-center justify-center text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center">
          <Icon name="lock" className="text-2xl text-secondary/40" />
        </div>
        <p className="text-secondary/60 text-sm">Sign in to view your wear history</p>
        <button
          onClick={() => navigate('/profile')}
          className="gold-gradient text-on-primary-container px-6 py-3 rounded-xl font-label text-[10px] font-bold uppercase tracking-widest"
        >
          SIGN IN
        </button>
      </main>
    )
  }

  if (loading) {
    return (
      <main className="pt-24 pb-32 px-6 min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </main>
    )
  }

  if (error) {
    return (
      <main className="pt-24 pb-32 px-6">
        <InlineError message="Couldn't load wear history" onRetry={retry} />
      </main>
    )
  }

  if (entries.length === 0) {
    return (
      <main className="pt-24 pb-32 px-6 min-h-screen flex flex-col items-center justify-center text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center">
          <Icon name="checkroom" className="text-2xl text-secondary/40" />
        </div>
        <h3 className="font-headline text-lg text-on-surface">No wears logged yet</h3>
        <p className="text-secondary/60 text-sm max-w-[260px]">
          Start logging what you wear each day to build your fragrance timeline
        </p>
        <button
          onClick={() => navigate('/')}
          className="gold-gradient text-on-primary-container px-6 py-3 rounded-xl font-label text-[10px] font-bold uppercase tracking-widest"
        >
          LOG YOUR FIRST WEAR
        </button>
      </main>
    )
  }

  return (
    <main className="pt-24 pb-32 px-6 space-y-10">
      {/* Summary Stats */}
      <section className="grid grid-cols-3 gap-3">
        <div className="bg-surface-container p-4 rounded-xl text-center">
          <p className="font-headline text-2xl text-on-surface">{entries.length}</p>
          <p className="font-label text-[9px] tracking-[0.15em] text-secondary/50 uppercase mt-1">Total Wears</p>
        </div>
        <div className="bg-surface-container p-4 rounded-xl text-center">
          <p className="font-headline text-2xl text-on-surface">{mostWorn.length}</p>
          <p className="font-label text-[9px] tracking-[0.15em] text-secondary/50 uppercase mt-1">Fragrances</p>
        </div>
        <div className="bg-surface-container p-4 rounded-xl text-center">
          <p className="font-headline text-2xl text-on-surface">{occasionBreakdown.length}</p>
          <p className="font-label text-[9px] tracking-[0.15em] text-secondary/50 uppercase mt-1">Occasions</p>
        </div>
      </section>

      {/* Most Worn */}
      {mostWorn.length > 0 && (
        <section className="space-y-4">
          <h3 className="text-[10px] uppercase tracking-[0.15em] font-label text-secondary">MOST WORN</h3>
          <div className="space-y-2">
            {mostWorn.map(({ fragrance, count }, i) => (
              <button
                key={fragrance.id}
                onClick={() => navigate(`/fragrance/${fragrance.id}`)}
                className="w-full flex items-center gap-3 bg-surface-container rounded-xl p-3 active:scale-[0.98] transition-transform text-left"
              >
                <span className="font-headline text-lg text-primary/60 w-6 text-center">{i + 1}</span>
                <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-surface-container-highest">
                  {fragrance.image_url ? (
                    <img src={fragrance.image_url} alt={fragrance.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Icon name="water_drop" className="text-secondary/30" size={16} />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] uppercase tracking-[0.15em] text-primary/70 font-bold">{fragrance.brand}</p>
                  <p className="text-sm text-on-surface truncate">{fragrance.name}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <span className="text-sm font-headline text-primary">{count}</span>
                  <span className="text-[9px] text-secondary/50">wear{count !== 1 ? 's' : ''}</span>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Occasion Breakdown */}
      {occasionBreakdown.length > 0 && (
        <section className="space-y-4">
          <h3 className="text-[10px] uppercase tracking-[0.15em] font-label text-secondary">BY OCCASION</h3>
          <div className="grid grid-cols-2 gap-2">
            {occasionBreakdown.map(({ occasion, count }) => (
              <div key={occasion} className="bg-surface-container rounded-xl p-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Icon
                    name={OCCASION_ICONS[occasion] ?? 'help_outline'}
                    className="text-primary text-sm"
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-on-surface truncate">{formatOccasion(occasion)}</p>
                  <p className="text-[10px] text-secondary/50">{count} wear{count !== 1 ? 's' : ''}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Timeline */}
      <section className="space-y-6">
        <h3 className="text-[10px] uppercase tracking-[0.15em] font-label text-secondary">TIMELINE</h3>
        {[...groupedByMonth.entries()].map(([monthKey, monthEntries]) => (
          <div key={monthKey} className="space-y-3">
            <h4 className="text-xs font-bold text-primary/80 tracking-wide">
              {formatMonthLabel(monthKey)}
            </h4>
            <div className="space-y-2 pl-3 border-l-2 border-primary/10">
              {monthEntries.map((entry: WearEntry) => (
                <button
                  key={entry.id}
                  onClick={() => navigate(`/fragrance/${entry.fragrance.id}`)}
                  className="w-full flex items-center gap-3 bg-surface-container rounded-xl p-3 active:scale-[0.98] transition-transform text-left relative"
                >
                  {/* Timeline dot */}
                  <div className="absolute -left-[calc(0.75rem+5px)] top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-primary/40" />

                  <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-surface-container-highest">
                    {entry.fragrance.image_url ? (
                      <img src={entry.fragrance.image_url} alt={entry.fragrance.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Icon name="water_drop" className="text-secondary/30" size={16} />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] uppercase tracking-[0.15em] text-primary/70 font-bold">{entry.fragrance.brand}</p>
                    <p className="text-sm text-on-surface truncate">{entry.fragrance.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-secondary/50">{formatDate(entry.wear_date)}</span>
                      {entry.occasion && (
                        <>
                          <span className="text-[10px] text-secondary/30">&middot;</span>
                          <span className="text-[10px] text-secondary/50">{formatOccasion(entry.occasion)}</span>
                        </>
                      )}
                    </div>
                    {entry.notes && (
                      <p className="text-[10px] text-secondary/40 mt-1 italic truncate">{entry.notes}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>
    </main>
  )
}
