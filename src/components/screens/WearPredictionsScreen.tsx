import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../ui/Icon'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { hapticLight } from '@/lib/haptics'
import { HeroListSkeleton } from '../ui/ContentSkeleton'
import type { Fragrance } from '@/types/database'

/* ── Types ─────────────────────────────────────────────── */
interface WearLog {
  fragrance_id: string
  wear_date: string
}

interface CollectionItem {
  fragrance: Fragrance | null
  personal_rating: number | null
}

interface Prediction {
  fragrance: Fragrance
  score: number
  reasons: string[]
}

/* ── Season helpers ────────────────────────────────────── */
const MONTH_TO_SEASON: Record<number, string> = {
  0: 'winter', 1: 'winter', 2: 'spring', 3: 'spring',
  4: 'spring', 5: 'summer', 6: 'summer', 7: 'summer',
  8: 'autumn', 9: 'autumn', 10: 'autumn', 11: 'winter',
}

function getCurrentSeason(): string {
  return MONTH_TO_SEASON[new Date().getMonth()]
}

/* ── Prediction engine ─────────────────────────────────── */
function generatePredictions(
  collection: (Fragrance & { rating: number | null })[],
  wears: WearLog[],
): Prediction[] {
  const now = new Date()
  const today = now.getDay() // 0=Sun
  const currentSeason = getCurrentSeason()

  // Build wear history per fragrance
  const wearHistory = new Map<string, { total: number; dayOfWeek: number[]; recentDays: number }>()

  for (const w of wears) {
    const existing = wearHistory.get(w.fragrance_id) ?? { total: 0, dayOfWeek: new Array(7).fill(0) as number[], recentDays: 0 }
    existing.total++
    const d = new Date(w.wear_date)
    existing.dayOfWeek[d.getDay()]++
    // Recent = last 30 days
    const daysAgo = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
    if (daysAgo <= 30) existing.recentDays++
    wearHistory.set(w.fragrance_id, existing)
  }

  // Last worn date per fragrance
  const lastWorn = new Map<string, string>()
  for (const w of wears) {
    const prev = lastWorn.get(w.fragrance_id)
    if (!prev || w.wear_date > prev) lastWorn.set(w.fragrance_id, w.wear_date)
  }

  // Score each fragrance
  const predictions: Prediction[] = []

  for (const frag of collection) {
    let score = 0
    const reasons: string[] = []
    const history = wearHistory.get(frag.id)

    // 1. Day-of-week affinity (0-25 points)
    if (history && history.total >= 3) {
      const dayPct = history.dayOfWeek[today] / history.total
      const dayScore = Math.round(dayPct * 25)
      score += dayScore
      if (dayScore >= 10) {
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        reasons.push(`You often wear this on ${dayNames[today]}s`)
      }
    }

    // 2. Season match (0-20 points)
    if (frag.season_ranking) {
      const seasonEntry = frag.season_ranking.find(
        s => s.name.toLowerCase() === currentSeason,
      )
      if (seasonEntry && seasonEntry.score >= 4) {
        score += 20
        reasons.push(`Great for ${currentSeason}`)
      } else if (seasonEntry && seasonEntry.score >= 3) {
        score += 10
        reasons.push(`Solid ${currentSeason} pick`)
      }
    }

    // 3. Personal rating boost (0-15 points)
    if (frag.rating) {
      const ratingScore = Math.round((frag.rating / 5) * 15)
      score += ratingScore
      if (frag.rating >= 4) reasons.push(`Rated ${frag.rating}/5`)
    }

    // 4. Rotation balance — favour under-worn (0-20 points)
    if (history) {
      if (history.recentDays === 0) {
        score += 20
        reasons.push('Not worn recently — time to revisit')
      } else if (history.recentDays <= 2) {
        score += 12
        reasons.push('Lightly worn this month')
      }
    } else {
      // Never worn — strong nudge
      score += 18
      reasons.push('Never worn — give it a debut')
    }

    // 5. Recency penalty — avoid repeats from last 3 days (negative)
    const lastDate = lastWorn.get(frag.id)
    if (lastDate) {
      const daysAgo = Math.floor((now.getTime() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24))
      if (daysAgo <= 1) {
        score -= 15
      } else if (daysAgo <= 3) {
        score -= 8
      }
    }

    // 6. Overall frequency bonus — reward favourites (0-10 points)
    if (history && history.total >= 10) {
      score += 10
      reasons.push('One of your go-tos')
    } else if (history && history.total >= 5) {
      score += 5
    }

    // 7. Weekend vs weekday character (0-10 points)
    const isWeekend = today === 0 || today === 6
    if (frag.concentration) {
      const conc = frag.concentration.toLowerCase()
      if (isWeekend && (conc === 'parfum' || conc === 'eau de parfum')) {
        score += 8
        reasons.push('Rich scent for the weekend')
      } else if (!isWeekend && (conc === 'eau de toilette' || conc === 'eau de cologne')) {
        score += 8
        reasons.push('Light & office-friendly')
      }
    }

    if (score > 0 && reasons.length > 0) {
      predictions.push({ fragrance: frag, score, reasons })
    }
  }

  return predictions
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
}

/* ── Component ─────────────────────────────────────────── */
export function WearPredictionsScreen() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    fetchData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function fetchData() {
    const [collRes, wearsRes] = await Promise.all([
      supabase
        .from('user_collections')
        .select('personal_rating, fragrance:fragrances(*)')
        .eq('user_id', user!.id)
        .eq('status', 'own'),
      supabase
        .from('wear_logs')
        .select('fragrance_id, wear_date')
        .eq('user_id', user!.id),
    ])

    const coll = (collRes.data ?? []) as unknown as CollectionItem[]
    const frags = coll.filter(c => c.fragrance).map(c => ({ ...c.fragrance!, rating: c.personal_rating }))
    const wears = (wearsRes.data ?? []) as WearLog[]

    setPredictions(generatePredictions(frags, wears))
    setLoading(false)
  }

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const todayName = dayNames[new Date().getDay()]
  const currentSeason = getCurrentSeason()

  if (!user) {
    return (
      <main className="pt-24 pb-32 px-6 flex flex-col items-center justify-center min-h-screen gap-4">
        <Icon name="smart_toy" className="text-5xl text-primary/30" />
        <p className="text-secondary/60 text-sm">Sign in to see predictions</p>
      </main>
    )
  }

  if (loading) {
    return (
      <main className="pt-24 pb-32 px-4 max-w-[430px] mx-auto min-h-screen space-y-4">
        <div className="text-center mb-2">
          <div className="h-5 w-32 bg-surface-container rounded mx-auto mb-2 animate-pulse" />
          <div className="h-3 w-48 bg-surface-container rounded mx-auto animate-pulse" />
        </div>
        <HeroListSkeleton />
      </main>
    )
  }

  return (
    <main className="pt-24 pb-32 px-4 max-w-[430px] mx-auto min-h-screen space-y-4">
      {/* Header */}
      <div className="text-center mb-2">
        <h2 className="font-headline text-lg text-on-surface">Today's Picks</h2>
        <p className="text-[10px] text-secondary/50">
          {todayName} · {currentSeason.charAt(0).toUpperCase() + currentSeason.slice(1)} · Based on your habits
        </p>
      </div>

      {/* Top pick hero */}
      {predictions.length > 0 && (
        <div className="relative bg-surface-container rounded-2xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/10 to-transparent" />
          <div className="relative p-6 flex flex-col items-center gap-4">
            <div className="flex items-center gap-2 mb-1">
              <Icon name="auto_awesome" className="text-primary text-sm" />
              <span className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">Top Pick</span>
            </div>
            <div className="w-20 h-20 rounded-xl bg-surface-container-highest flex items-center justify-center overflow-hidden">
              {predictions[0].fragrance.image_url ? (
                <img src={predictions[0].fragrance.image_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <Icon name="water_drop" className="text-3xl text-primary/30" />
              )}
            </div>
            <div className="text-center">
              <p className="text-[10px] text-secondary/50 uppercase tracking-wider">{predictions[0].fragrance.brand}</p>
              <h3 className="font-headline text-lg text-on-surface">{predictions[0].fragrance.name}</h3>
              {predictions[0].fragrance.concentration && (
                <p className="text-[10px] text-secondary/50 mt-0.5">{predictions[0].fragrance.concentration}</p>
              )}
            </div>
            <div className="flex flex-wrap justify-center gap-1.5">
              {predictions[0].reasons.slice(0, 3).map((r, i) => (
                <span key={i} className="px-3 py-1 rounded-full bg-primary/15 text-primary text-[10px] font-medium">{r}</span>
              ))}
            </div>
            <button
              onClick={() => { hapticLight(); navigate(`/fragrance/${predictions[0].fragrance.id}`) }}
              className="mt-1 px-6 py-2.5 gold-gradient rounded-xl text-on-primary-container text-xs font-bold uppercase tracking-widest active:scale-[0.97] transition-transform"
            >
              View Details
            </button>
          </div>
        </div>
      )}

      {/* Runner ups */}
      {predictions.length > 1 && (
        <div className="space-y-2">
          <h3 className="text-[10px] uppercase tracking-[0.15em] font-label text-secondary">Also Great Today</h3>
          {predictions.slice(1).map((pred) => (
            <button
              key={pred.fragrance.id}
              onClick={() => {
                hapticLight()
                setSelectedId(selectedId === pred.fragrance.id ? null : pred.fragrance.id)
              }}
              className="w-full bg-surface-container rounded-xl p-4 text-left active:scale-[0.98] transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-surface-container-highest flex-shrink-0 flex items-center justify-center overflow-hidden">
                  {pred.fragrance.image_url ? (
                    <img src={pred.fragrance.image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Icon name="water_drop" className="text-xl text-primary/30" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-secondary/50 uppercase tracking-wider">{pred.fragrance.brand}</p>
                  <p className="text-sm text-on-surface font-medium truncate">{pred.fragrance.name}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-[10px] text-primary font-bold">{Math.min(pred.score, 99)}</span>
                  </div>
                </div>
              </div>
              {/* Expanded reasons */}
              {selectedId === pred.fragrance.id && (
                <div className="mt-3 pt-3 border-t border-outline-variant/10 flex flex-wrap gap-1.5 animate-fade-in">
                  {pred.reasons.map((r, i) => (
                    <span key={i} className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[10px]">{r}</span>
                  ))}
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate(`/fragrance/${pred.fragrance.id}`) }}
                    className="ml-auto text-[10px] text-primary font-medium underline"
                  >
                    View →
                  </button>
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Empty state */}
      {predictions.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-4 py-16">
          <Icon name="smart_toy" className="text-5xl text-primary/20" />
          <div className="text-center space-y-1">
            <p className="text-sm text-on-surface-variant">Not enough data yet</p>
            <p className="text-[10px] text-secondary/50 max-w-[260px]">
              Add fragrances to your collection and log some wears — predictions get smarter over time.
            </p>
          </div>
          <button
            onClick={() => navigate('/explore')}
            className="px-5 py-2.5 bg-primary/15 text-primary text-xs font-medium rounded-xl active:scale-[0.97] transition-transform"
          >
            Explore Fragrances
          </button>
        </div>
      )}

      {/* How it works */}
      <div className="pt-2">
        <button
          onClick={() => setSelectedId(selectedId === '__info' ? null : '__info')}
          className="w-full flex items-center gap-3 bg-surface-container/50 p-4 rounded-xl"
        >
          <Icon name="info" className="text-secondary/40" size={18} />
          <span className="text-[10px] text-secondary/40">How predictions work</span>
          <Icon name={selectedId === '__info' ? 'expand_less' : 'expand_more'} className="text-secondary/40 ml-auto" size={18} />
        </button>
        {selectedId === '__info' && (
          <div className="px-4 py-3 text-[10px] text-secondary/50 leading-relaxed space-y-1 animate-fade-in">
            <p>Predictions are based on your personal wear history and habits:</p>
            <p>• Which day of the week you usually wear each fragrance</p>
            <p>• Season suitability from fragrance data</p>
            <p>• Your personal ratings</p>
            <p>• Rotation balance — favouring under-worn bottles</p>
            <p>• Concentration for weekday vs weekend</p>
            <p>The more you log wears, the smarter predictions become.</p>
          </div>
        )}
      </div>
    </main>
  )
}
