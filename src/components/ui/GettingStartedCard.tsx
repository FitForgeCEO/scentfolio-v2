import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { getIconChar } from '@/lib/iconUtils'

const DISMISSED_KEY = 'scentfolio_getting_started_dismissed'

interface ChecklistItem {
  id: string
  icon: string
  label: string
  description: string
  route: string
  check: () => Promise<boolean>
}

/**
 * Getting Started checklist card shown on HomeScreen for new users.
 * Disappears once all tasks complete or user dismisses.
 */
export function GettingStartedCard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [completed, setCompleted] = useState<Set<string>>(new Set())
  const [dismissed, setDismissed] = useState(true)
  const [loading, setLoading] = useState(true)

  const items: ChecklistItem[] = [
    {
      id: 'add_fragrance',
      icon: 'add_circle',
      label: 'Add your first fragrance',
      description: 'Search and add a scent to your collection',
      route: '/explore',
      check: async () => {
        if (!user) return false
        const { count } = await supabase
          .from('user_collections')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('status', 'own')
        return (count ?? 0) > 0
      },
    },
    {
      id: 'log_wear',
      icon: 'calendar_today',
      label: 'Log a wear',
      description: 'Record what you wore today',
      route: '/',
      check: async () => {
        if (!user) return false
        const { count } = await supabase
          .from('wear_logs')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
        return (count ?? 0) > 0
      },
    },
    {
      id: 'write_review',
      icon: 'rate_review',
      label: 'Write a review',
      description: 'Share your thoughts on a fragrance',
      route: '/collection',
      check: async () => {
        if (!user) return false
        const { count } = await supabase
          .from('reviews')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
        return (count ?? 0) > 0
      },
    },
    {
      id: 'scent_quiz',
      icon: 'quiz',
      label: 'Take the scent quiz',
      description: 'Discover your fragrance personality',
      route: '/scent-quiz',
      check: async () => {
        if (!user) return false
        // Check Supabase profile first
        const { data } = await supabase
          .from('profiles')
          .select('scent_profile')
          .eq('id', user.id)
          .single()
        if (data?.scent_profile) return true
        // Fallback to localStorage
        const local = localStorage.getItem(`scentfolio_scent_profile_${user.id}`)
        return local !== null
      },
    },
    {
      id: 'explore_boards',
      icon: 'dashboard',
      label: 'Create a scent board',
      description: 'Curate themed fragrance collections',
      route: '/boards',
      check: async () => {
        if (!user) return false
        const { count } = await supabase
          .from('scent_boards')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
        return (count ?? 0) > 0
      },
    },
  ]

  useEffect(() => {
    if (!user) { setLoading(false); return }

    const key = `${DISMISSED_KEY}_${user.id}`
    if (localStorage.getItem(key)) {
      setDismissed(true)
      setLoading(false)
      return
    }

    setDismissed(false)
    checkAll()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function checkAll() {
    const done = new Set<string>()
    const results = await Promise.all(items.map(async (item) => {
      const ok = await item.check()
      return { id: item.id, ok }
    }))
    results.forEach(r => { if (r.ok) done.add(r.id) })
    setCompleted(done)

    // Auto-dismiss if all done
    if (done.size === items.length && user) {
      const key = `${DISMISSED_KEY}_${user.id}`
      localStorage.setItem(key, 'true')
      setDismissed(true)
    }
    setLoading(false)
  }

  function handleDismiss() {
    if (!user) return
    const key = `${DISMISSED_KEY}_${user.id}`
    localStorage.setItem(key, 'true')
    setDismissed(true)
  }

  if (dismissed || loading || !user) return null

  const completedCount = completed.size
  const totalCount = items.length
  const progress = completedCount / totalCount

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] uppercase tracking-[0.15em] font-label text-secondary">GETTING STARTED</h3>
        <button onClick={handleDismiss} className="text-[10px] text-secondary/40 hover:opacity-80">
          Dismiss
        </button>
      </div>

      <div className="bg-surface-container rounded-sm overflow-hidden">
        {/* Progress header */}
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-on-surface font-medium">
              {completedCount === totalCount ? 'All done!' : `${completedCount} of ${totalCount} complete`}
            </p>
            <span className="text-[10px] text-primary font-bold">{Math.round(progress * 100)}%</span>
          </div>
          <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-700"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>

        {/* Checklist */}
        <div className="px-2 pb-2">
          {items.map((item) => {
            const isDone = completed.has(item.id)
            return (
              <button
                key={item.id}
                onClick={() => !isDone && navigate(item.route)}
                disabled={isDone}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-sm text-left transition-all ${
                  isDone ? 'opacity-50' : 'hover:opacity-80 active:bg-surface-container-highest/50'
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  isDone ? 'bg-primary/20' : 'bg-surface-container-highest'
                }`}>
                  {isDone ? (
                    <span className="text-primary">✓</span>
                  ) : (
                    <span className="text-secondary/60">{getIconChar(item.icon)}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${isDone ? 'text-secondary/50 line-through' : 'text-on-surface'}`}>
                    {item.label}
                  </p>
                  <p className="text-[10px] text-secondary/50">{item.description}</p>
                </div>
                {!isDone && <span className="text-secondary/30">?</span>}
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
