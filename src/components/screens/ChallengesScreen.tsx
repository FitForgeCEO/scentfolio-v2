import { useState } from 'react'
import { useChallenges, type ChallengeState, type ChallengeCategory } from '@/hooks/useChallenges'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { hapticMedium } from '@/lib/haptics'
import { getIconChar } from '@/lib/iconUtils'

const CATEGORY_META: Record<ChallengeCategory, { label: string; icon: string }> = {
  collection: { label: 'Collection', icon: 'water_drop' },
  wearing: { label: 'Wearing', icon: 'checkroom' },
  discovery: { label: 'Discovery', icon: 'explore' },
  social: { label: 'Social', icon: 'group' },
  review: { label: 'Reviews', icon: 'rate_review' },
}

type Tab = 'active' | 'completed'
type FilterCategory = ChallengeCategory | 'all'

export function ChallengesScreen() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const { challenges, loading, claimReward } = useChallenges()
  const [tab, setTab] = useState<Tab>('active')
  const [filter, setFilter] = useState<FilterCategory>('all')
  const [claiming, setClaiming] = useState<string | null>(null)

  if (!user) {
    return (
      <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen flex flex-col items-center justify-center gap-4">
        <span className="text-5xl text-primary/20">?</span>
        <p className="text-sm text-secondary/50">Sign in to track challenges</p>
      </main>
    )
  }

  const active = challenges.filter(c => !c.completed)
  const completed = challenges.filter(c => c.completed)
  const unclaimed = completed.filter(c => !c.claimed).length

  const displayed = (tab === 'active' ? active : completed)
    .filter(c => filter === 'all' || c.definition.category === filter)

  const handleClaim = async (challengeId: string) => {
    setClaiming(challengeId)
    hapticMedium()
    const ok = await claimReward(challengeId)
    if (ok) {
      const ch = challenges.find(c => c.definition.id === challengeId)
      showToast(`+${ch?.definition.xpReward ?? 0} XP claimed!`, 'success')
    } else {
      showToast('Failed to claim reward', 'error')
    }
    setClaiming(null)
  }

  // Summary stats
  const totalXPAvailable = active.reduce((sum, c) => sum + c.definition.xpReward, 0)
  const totalXPEarned = completed.reduce((sum, c) => sum + c.definition.xpReward, 0)

  return (
    <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen">
      {/* Header stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-surface-container rounded-sm p-3 text-center">
          <p className="font-headline text-2xl text-primary">{completed.length}</p>
          <p className="text-[8px] text-secondary/40 uppercase tracking-wider">Completed</p>
        </div>
        <div className="bg-surface-container rounded-sm p-3 text-center">
          <p className="font-headline text-2xl text-on-surface">{active.length}</p>
          <p className="text-[8px] text-secondary/40 uppercase tracking-wider">In Progress</p>
        </div>
        <div className="bg-surface-container rounded-sm p-3 text-center">
          <p className="font-headline text-2xl text-primary">{totalXPEarned}</p>
          <p className="text-[8px] text-secondary/40 uppercase tracking-wider">XP Earned</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-outline-variant/10 mb-4">
        <button
          onClick={() => setTab('active')}
          className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-colors relative ${tab === 'active' ? 'text-primary' : 'text-secondary/40'}`}
        >
          Active ({active.length})
          {tab === 'active' && <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-primary rounded-full" />}
        </button>
        <button
          onClick={() => setTab('completed')}
          className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-colors relative ${tab === 'completed' ? 'text-primary' : 'text-secondary/40'}`}
        >
          Completed ({completed.length})
          {unclaimed > 0 && (
            <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-[8px] text-on-primary font-bold">
              {unclaimed}
            </span>
          )}
          {tab === 'completed' && <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-primary rounded-full" />}
        </button>
      </div>

      {/* Category filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide -mx-6 px-6">
        {(['all', 'collection', 'wearing', 'discovery', 'social', 'review'] as const).map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all hover:opacity-80 ${
              filter === cat
                ? 'bg-primary/15 text-primary'
                : 'bg-surface-container text-secondary/40'
            }`}
          >
            {cat !== 'all' && <span>{getIconChar(CATEGORY_META[cat].icon)}</span>}
            {cat === 'all' ? 'All' : CATEGORY_META[cat].label}
          </button>
        ))}
      </div>

      {/* Challenge list */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-surface-container rounded-sm p-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-surface-container-highest" />
                <div className="flex-1">
                  <div className="h-3 bg-surface-container-highest rounded w-32 mb-2" />
                  <div className="h-2 bg-surface-container-highest rounded w-48" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <div className="py-12 text-center">
          <span className="text-4xl text-primary/20 mb-3">{getIconChar(tab === 'active' ? 'emoji_events' : 'check_circle')}</span>
          <p className="text-sm text-secondary/50">
            {tab === 'active' ? 'All challenges completed!' : 'No completed challenges yet'}
          </p>
          {tab === 'active' && totalXPAvailable === 0 && (
            <p className="text-xs text-secondary/30 mt-1">You've conquered them all — legend status.</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map((ch) => (
            <ChallengeCard
              key={ch.definition.id}
              challenge={ch}
              onClaim={handleClaim}
              claiming={claiming === ch.definition.id}
            />
          ))}
        </div>
      )}
    </main>
  )
}

function ChallengeCard({
  challenge: ch,
  onClaim,
  claiming,
}: {
  challenge: ChallengeState
  onClaim: (id: string) => void
  claiming: boolean
}) {
  const pct = Math.round((ch.progress / ch.definition.target) * 100)
  const isClaimable = ch.completed && !ch.claimed

  return (
    <div className={`bg-surface-container rounded-sm p-4 transition-all ${isClaimable ? 'ring-1 ring-primary/30' : ''}`}>
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
          ch.completed ? 'bg-primary/15' : 'bg-surface-container-highest'
        }`}>
          <span>{getIconChar(ch.definition.icon)}</span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-sm text-on-surface font-medium truncate">{ch.definition.title}</p>
            <span className="text-[8px] text-primary/60 font-bold bg-primary/5 px-1.5 py-0.5 rounded">
              +{ch.definition.xpReward} XP
            </span>
          </div>
          <p className="text-[10px] text-secondary/50 mb-2">{ch.definition.description}</p>

          {/* Progress bar */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  ch.completed ? 'bg-primary' : 'bg-primary/60'
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-[9px] text-secondary/40 font-mono tabular-nums">
              {ch.progress}/{ch.definition.target}
            </span>
          </div>
        </div>

        {/* Claim button */}
        {isClaimable && (
          <button
            onClick={() => onClaim(ch.definition.id)}
            disabled={claiming}
            className="flex-shrink-0 gold-gradient text-on-primary-container px-3 py-1.5 rounded-sm font-label text-[9px] font-bold uppercase tracking-widest hover:opacity-80 transition-all disabled:opacity-50"
          >
            {claiming ? '...' : 'CLAIM'}
          </button>
        )}

        {/* Claimed check */}
        {ch.claimed && (
          <span className="text-primary/60 flex-shrink-0">✓</span>
        )}
      </div>
    </div>
  )
}
