import { useNavigate } from 'react-router-dom'
import { Icon } from './Icon'
import { useChallengeSummary } from '@/hooks/useChallenges'
import { useAuth } from '@/contexts/AuthContext'

export function ChallengesWidget() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { completed, total, unclaimed, activeInProgress, loading } = useChallengeSummary()

  if (!user || loading) return null

  // Show top 2 in-progress challenges
  const topChallenges = activeInProgress.slice(0, 2)

  if (topChallenges.length === 0 && unclaimed === 0) return null

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] uppercase tracking-[0.15em] font-label text-secondary">CHALLENGES</h3>
        <button
          onClick={() => navigate('/challenges')}
          className="text-[10px] text-primary font-bold uppercase tracking-wider active:scale-95 transition-transform"
        >
          {completed}/{total} done →
        </button>
      </div>

      {/* Unclaimed rewards banner */}
      {unclaimed > 0 && (
        <button
          onClick={() => navigate('/challenges')}
          className="w-full flex items-center gap-3 bg-primary/10 rounded-xl px-4 py-3 active:scale-[0.98] transition-transform"
        >
          <Icon name="redeem" className="text-primary" size={20} />
          <span className="text-xs text-primary font-medium">
            {unclaimed} reward{unclaimed > 1 ? 's' : ''} to claim!
          </span>
          <Icon name="chevron_right" className="text-primary/60 ml-auto" size={16} />
        </button>
      )}

      {/* Active challenge cards */}
      {topChallenges.map((ch) => {
        const pct = Math.round((ch.progress / ch.definition.target) * 100)
        return (
          <button
            key={ch.definition.id}
            onClick={() => navigate('/challenges')}
            className="w-full flex items-center gap-3 bg-surface-container rounded-xl px-4 py-3 text-left active:scale-[0.98] transition-transform"
          >
            <div className="w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center flex-shrink-0">
              <Icon name={ch.definition.icon} className="text-primary/60" size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-on-surface font-medium truncate">{ch.definition.title}</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-1 bg-surface-container-highest rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary/60 rounded-full"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-[8px] text-secondary/40 font-mono">{ch.progress}/{ch.definition.target}</span>
              </div>
            </div>
            <span className="text-[8px] text-primary/50 font-bold">+{ch.definition.xpReward} XP</span>
          </button>
        )
      })}
    </section>
  )
}
