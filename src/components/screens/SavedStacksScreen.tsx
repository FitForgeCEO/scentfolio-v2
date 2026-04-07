import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useLayeringStacks, deleteStack, toggleTriedIt } from '@/hooks/useLayeringStacks'
import { Icon } from '../ui/Icon'
import { InlineError } from '../ui/InlineError'

export function SavedStacksScreen() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { stacks, loading, error, retry, setStacks } = useLayeringStacks(user?.id)
  const [filter, setFilter] = useState<'all' | 'tried' | 'untried'>('all')

  if (!user) {
    return (
      <main className="pt-24 pb-32 px-6 min-h-screen flex flex-col items-center justify-center text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center">
          <Icon name="lock" className="text-2xl text-secondary/40" />
        </div>
        <p className="text-secondary/60 text-sm">Sign in to view saved stacks</p>
        <button onClick={() => navigate('/profile')} className="gold-gradient text-on-primary-container px-6 py-3 rounded-xl font-label text-[10px] font-bold uppercase tracking-widest">
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
        <InlineError message="Couldn't load stacks" onRetry={retry} />
      </main>
    )
  }

  const filtered = stacks.filter((s) => {
    if (filter === 'tried') return s.tried_it
    if (filter === 'untried') return !s.tried_it
    return true
  })

  return (
    <main className="pt-24 pb-32 px-6 space-y-6">
      <div>
        <h2 className="font-headline text-2xl font-bold">Saved Stacks</h2>
        <p className="text-sm text-secondary/60 mt-1">{stacks.length} layering combination{stacks.length !== 1 ? 's' : ''}</p>
      </div>

      {/* Filter pills */}
      {stacks.length > 0 && (
        <div className="flex gap-2">
          {(['all', 'tried', 'untried'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-full text-[10px] font-bold tracking-widest uppercase transition-colors ${
                filter === f ? 'bg-primary text-on-primary' : 'bg-surface-container text-secondary/60'
              }`}
            >
              {f === 'all' ? `ALL (${stacks.length})` : f === 'tried' ? `TRIED (${stacks.filter((s) => s.tried_it).length})` : `TO TRY (${stacks.filter((s) => !s.tried_it).length})`}
            </button>
          ))}
        </div>
      )}

      {stacks.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center pt-16 space-y-4">
          <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center">
            <Icon name="science" className="text-2xl text-secondary/40" />
          </div>
          <h3 className="font-headline text-lg text-on-surface">No saved stacks</h3>
          <p className="text-secondary/60 text-sm max-w-[260px]">
            Head to the Layering Lab to discover fragrance combinations, then save your favourites here
          </p>
          <button onClick={() => navigate('/layering-lab')} className="gold-gradient text-on-primary-container px-6 py-3 rounded-xl font-label text-[10px] font-bold uppercase tracking-widest">
            GO TO LAB
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-secondary/50">No stacks match this filter</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((stack) => (
            <StackCard
              key={stack.id}
              stack={stack}
              onNavigate={() => navigate(`/fragrance/${stack.fragrance.id}`)}
              onToggleTried={async () => {
                const newVal = !stack.tried_it
                setStacks((prev) => prev.map((s) => s.id === stack.id ? { ...s, tried_it: newVal, tried_at: newVal ? new Date().toISOString() : null } : s))
                await toggleTriedIt(stack.id, newVal)
              }}
              onDelete={async () => {
                setStacks((prev) => prev.filter((s) => s.id !== stack.id))
                await deleteStack(stack.id)
              }}
            />
          ))}
        </div>
      )}
    </main>
  )
}

function StackCard({ stack, onNavigate, onToggleTried, onDelete }: {
  stack: ReturnType<typeof useLayeringStacks>['stacks'][number]
  onNavigate: () => void
  onToggleTried: () => void
  onDelete: () => void
}) {
  const [showActions, setShowActions] = useState(false)
  const layeringName = (stack.layering_fragrance as Record<string, string> | null)?.name ?? 'Unknown'

  return (
    <div className="bg-surface-container rounded-xl p-4 space-y-3">
      {/* Header row */}
      <div className="flex items-start gap-3">
        <button onClick={onNavigate} className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-surface-container-highest active:scale-95 transition-transform">
          {stack.fragrance.image_url ? (
            <img src={stack.fragrance.image_url} alt={stack.fragrance.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center"><Icon name="water_drop" className="text-secondary/30" size={20} /></div>
          )}
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[9px] uppercase tracking-[0.15em] text-primary/70 font-bold">{stack.fragrance.brand}</p>
          <p className="text-sm text-on-surface font-medium truncate">{stack.fragrance.name}</p>
          <p className="text-xs text-secondary/50 mt-0.5">+ {layeringName}</p>
        </div>
        <button onClick={() => setShowActions(!showActions)} className="w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center active:scale-90 transition-transform">
          <Icon name="more_vert" className="text-secondary/60 text-sm" />
        </button>
      </div>

      {/* Vibe */}
      {stack.resulting_vibe && (
        <p className="text-xs text-secondary/70 italic">&ldquo;{stack.resulting_vibe}&rdquo;</p>
      )}

      {/* Tags */}
      <div className="flex items-center gap-2">
        {stack.vibe && (
          <span className="px-3 py-1 rounded-full bg-primary/10 text-[9px] font-bold tracking-widest text-primary uppercase">{stack.vibe}</span>
        )}
        {stack.tried_it ? (
          <span className="px-3 py-1 rounded-full bg-green-900/20 text-[9px] font-bold tracking-widest text-green-400 uppercase">TRIED</span>
        ) : (
          <span className="px-3 py-1 rounded-full bg-surface-container-highest text-[9px] font-bold tracking-widest text-secondary/50 uppercase">TO TRY</span>
        )}
        {stack.user_rating && (
          <div className="flex items-center gap-0.5">
            <Icon name="star" filled className="text-[10px] text-primary" />
            <span className="text-[10px] text-primary font-bold">{stack.user_rating}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      {showActions && (
        <div className="flex gap-2 pt-1">
          <button onClick={onToggleTried} className="flex-1 py-2 rounded-lg bg-surface-container-highest text-xs font-medium active:scale-95 transition-transform">
            {stack.tried_it ? 'Mark Untried' : 'Mark as Tried'}
          </button>
          <button onClick={onDelete} className="py-2 px-4 rounded-lg bg-error/10 text-xs font-medium text-error/70 active:scale-95 transition-transform">
            Delete
          </button>
        </div>
      )}
    </div>
  )
}
