import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../ui/Icon'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { ScoreRingSkeleton, CardListSkeleton } from '../ui/ContentSkeleton'
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

interface HealthDimension {
  name: string
  icon: string
  score: number
  maxScore: number
  label: string
  tip: string
}

interface HealthResult {
  overall: number
  grade: string
  gradeColor: string
  dimensions: HealthDimension[]
  highlights: string[]
}

/* ── Health score engine ───────────────────────────────── */
function computeHealth(
  fragrances: (Fragrance & { rating: number | null })[],
  wears: WearLog[],
): HealthResult {
  const dimensions: HealthDimension[] = []
  const highlights: string[] = []
  const total = fragrances.length

  if (total === 0) {
    return {
      overall: 0,
      grade: 'N/A',
      gradeColor: 'text-secondary/50',
      dimensions: [],
      highlights: ['Add fragrances to see your health score'],
    }
  }

  // 1. Diversity (0-20) — note family spread
  const families = new Set(fragrances.map(f => f.note_family).filter(Boolean))
  const familyCount = families.size
  let diversityScore: number
  let diversityLabel: string
  let diversityTip: string

  if (familyCount >= 8) {
    diversityScore = 20
    diversityLabel = 'Excellent diversity'
    diversityTip = 'Your collection spans many scent families — well rounded.'
    highlights.push(`${familyCount} note families represented`)
  } else if (familyCount >= 5) {
    diversityScore = 15
    diversityLabel = 'Good variety'
    diversityTip = 'Solid range. A couple more families would round things out.'
  } else if (familyCount >= 3) {
    diversityScore = 10
    diversityLabel = 'Moderate'
    diversityTip = 'Try exploring outside your usual families for more versatility.'
  } else {
    diversityScore = 5
    diversityLabel = 'Narrow'
    diversityTip = 'Your collection is heavily focused — consider branching out.'
  }
  dimensions.push({ name: 'Diversity', icon: 'diversity_3', score: diversityScore, maxScore: 20, label: diversityLabel, tip: diversityTip })

  // 2. Usage Balance (0-25) — how evenly you wear your collection
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const recentWears = wears.filter(w => new Date(w.wear_date) >= thirtyDaysAgo)
  const wornRecently = new Set(recentWears.map(w => w.fragrance_id))
  const usagePct = total > 0 ? wornRecently.size / total : 0

  let usageScore: number
  let usageLabel: string
  let usageTip: string

  if (usagePct >= 0.7) {
    usageScore = 25
    usageLabel = 'Outstanding rotation'
    usageTip = 'You wear most of your collection regularly. Every bottle earns its place.'
    highlights.push(`${Math.round(usagePct * 100)}% of bottles worn in the last 30 days`)
  } else if (usagePct >= 0.5) {
    usageScore = 20
    usageLabel = 'Good rotation'
    usageTip = 'Most bottles get worn. A few could use more love.'
  } else if (usagePct >= 0.3) {
    usageScore = 12
    usageLabel = 'Some neglected'
    usageTip = `${total - wornRecently.size} bottles haven't been worn in 30 days. Try setting a rotation goal.`
  } else if (recentWears.length > 0) {
    usageScore = 6
    usageLabel = 'Heavy favouritism'
    usageTip = 'You stick to a few favourites. Explore your shelf — forgotten gems await.'
  } else {
    usageScore = 0
    usageLabel = 'No recent wears'
    usageTip = 'Start logging wears to unlock this dimension.'
  }
  dimensions.push({ name: 'Usage Balance', icon: 'autorenew', score: usageScore, maxScore: 25, label: usageLabel, tip: usageTip })

  // 3. Season Coverage (0-20) — fragrances suitable for all 4 seasons
  const seasonCoverage = new Map<string, number>([['spring', 0], ['summer', 0], ['autumn', 0], ['winter', 0]])
  fragrances.forEach(f => {
    if (!f.season_ranking) return
    f.season_ranking.forEach(sr => {
      const name = sr.name.toLowerCase()
      if (seasonCoverage.has(name) && sr.score >= 4) {
        seasonCoverage.set(name, (seasonCoverage.get(name) ?? 0) + 1)
      }
    })
  })
  const coveredSeasons = [...seasonCoverage.values()].filter(v => v >= 1).length
  let seasonScore: number
  let seasonLabel: string
  let seasonTip: string

  if (coveredSeasons === 4) {
    seasonScore = 20
    seasonLabel = 'All seasons covered'
    seasonTip = 'You have something for every time of year. Year-round readiness.'
    highlights.push('Full season coverage')
  } else if (coveredSeasons === 3) {
    seasonScore = 15
    seasonLabel = '3 of 4 seasons'
    const missing = [...seasonCoverage.entries()].find(([, v]) => v === 0)?.[0] ?? ''
    seasonTip = `Consider adding a ${missing} fragrance to complete your year.`
  } else if (coveredSeasons === 2) {
    seasonScore = 10
    seasonLabel = 'Partial coverage'
    seasonTip = 'You\'re missing scents for half the year. Branch into new seasons.'
  } else {
    seasonScore = 5
    seasonLabel = 'Limited'
    seasonTip = 'Your collection favours one season heavily. Diversify for year-round wear.'
  }
  dimensions.push({ name: 'Season Coverage', icon: 'thermostat', score: seasonScore, maxScore: 20, label: seasonLabel, tip: seasonTip })

  // 4. Rating Quality (0-15) — high personal ratings
  const rated = fragrances.filter(f => f.rating !== null)
  let ratingScore: number
  let ratingLabel: string
  let ratingTip: string

  if (rated.length === 0) {
    ratingScore = 0
    ratingLabel = 'No ratings yet'
    ratingTip = 'Rate your fragrances to unlock this insight.'
  } else {
    const avg = rated.reduce((s, f) => s + (f.rating ?? 0), 0) / rated.length
    const ratedPct = rated.length / total
    if (avg >= 4.0 && ratedPct >= 0.7) {
      ratingScore = 15
      ratingLabel = 'Curated excellence'
      ratingTip = `Average ${avg.toFixed(1)}/5 across ${rated.length} ratings. You know what you like.`
      highlights.push(`${avg.toFixed(1)}/5 average rating`)
    } else if (avg >= 3.5) {
      ratingScore = 10
      ratingLabel = 'Mostly satisfied'
      ratingTip = `Average ${avg.toFixed(1)}/5. Consider moving lower-rated bottles to your sell list.`
    } else {
      ratingScore = 5
      ratingLabel = 'Mixed feelings'
      ratingTip = `Average ${avg.toFixed(1)}/5. Your collection might benefit from a cull.`
    }
  }
  dimensions.push({ name: 'Rating Quality', icon: 'star', score: ratingScore, maxScore: 15, label: ratingLabel, tip: ratingTip })

  // 5. Completeness (0-10) — data filled in (notes, accords, season_ranking)
  let dataPoints = 0
  let totalPoints = 0
  fragrances.forEach(f => {
    totalPoints += 5
    if (f.accords && f.accords.length > 0) dataPoints++
    if (f.note_family) dataPoints++
    if (f.notes_top && f.notes_top.length > 0) dataPoints++
    if (f.season_ranking && f.season_ranking.length > 0) dataPoints++
    if (f.rating !== null) dataPoints++
  })
  const completeness = totalPoints > 0 ? dataPoints / totalPoints : 0
  let completenessScore: number
  let completenessLabel: string
  let completenessTip: string

  if (completeness >= 0.8) {
    completenessScore = 10
    completenessLabel = 'Data-rich'
    completenessTip = 'Your collection has excellent data coverage — predictions and insights are reliable.'
  } else if (completeness >= 0.5) {
    completenessScore = 7
    completenessLabel = 'Good coverage'
    completenessTip = 'Most fragrances have good data. Fill in ratings to improve recommendations.'
  } else {
    completenessScore = 3
    completenessLabel = 'Sparse data'
    completenessTip = 'Rate your fragrances and ensure they have notes/accords for better insights.'
  }
  dimensions.push({ name: 'Completeness', icon: 'checklist', score: completenessScore, maxScore: 10, label: completenessLabel, tip: completenessTip })

  // 6. Collection Size (0-10)
  let sizeScore: number
  let sizeLabel: string
  let sizeTip: string

  if (total >= 20) {
    sizeScore = 10
    sizeLabel = 'Serious collector'
    sizeTip = `${total} bottles — you have plenty to choose from.`
  } else if (total >= 10) {
    sizeScore = 8
    sizeLabel = 'Solid collection'
    sizeTip = `${total} bottles — a well-curated wardrobe of scent.`
  } else if (total >= 5) {
    sizeScore = 5
    sizeLabel = 'Growing'
    sizeTip = `${total} bottles. Keep adding — more variety means better insights.`
  } else {
    sizeScore = 2
    sizeLabel = 'Just starting'
    sizeTip = 'A small collection. Add more fragrances to unlock richer analysis.'
  }
  dimensions.push({ name: 'Collection Size', icon: 'inventory_2', score: sizeScore, maxScore: 10, label: sizeLabel, tip: sizeTip })

  // Overall
  const overall = dimensions.reduce((s, d) => s + d.score, 0)
  let grade: string
  let gradeColor: string

  if (overall >= 85) { grade = 'S'; gradeColor = 'text-primary' }
  else if (overall >= 70) { grade = 'A'; gradeColor = 'text-primary' }
  else if (overall >= 55) { grade = 'B'; gradeColor = 'text-tertiary' }
  else if (overall >= 40) { grade = 'C'; gradeColor = 'text-on-surface' }
  else if (overall >= 25) { grade = 'D'; gradeColor = 'text-secondary' }
  else { grade = 'E'; gradeColor = 'text-error' }

  return { overall, grade, gradeColor, dimensions, highlights }
}

/* ── SVG ring component ────────────────────────────────── */
function ScoreRing({ score, grade, gradeColor }: { score: number; grade: string; gradeColor: string }) {
  const radius = 60
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference

  return (
    <div className="relative w-40 h-40">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="currentColor" strokeWidth="8" className="text-surface-container-highest" />
        <circle
          cx="70" cy="70" r={radius} fill="none"
          stroke="currentColor" strokeWidth="8" strokeLinecap="round"
          className="text-primary transition-all duration-1000"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`font-headline text-3xl ${gradeColor}`}>{grade}</span>
        <span className="text-[10px] text-secondary/50">{score}/100</span>
      </div>
    </div>
  )
}

/* ── Main component ────────────────────────────────────── */
export function CollectionHealthScreen() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [health, setHealth] = useState<HealthResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedDim, setExpandedDim] = useState<string | null>(null)

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

    setHealth(computeHealth(frags, wears))
    setLoading(false)
  }

  if (!user) {
    return (
      <main className="pt-24 pb-32 px-6 flex flex-col items-center justify-center min-h-screen gap-4">
        <Icon name="health_and_safety" className="text-5xl text-primary/30" />
        <p className="text-secondary/60 text-sm">Sign in to see your collection health</p>
      </main>
    )
  }

  if (loading || !health) {
    return (
      <main className="pt-24 pb-32 px-4 max-w-[430px] mx-auto min-h-screen space-y-6">
        <div className="text-center">
          <div className="h-5 w-40 bg-surface-container rounded mx-auto mb-4 animate-pulse" />
        </div>
        <ScoreRingSkeleton />
        <CardListSkeleton count={6} />
      </main>
    )
  }

  return (
    <main className="pt-24 pb-32 px-4 max-w-[430px] mx-auto min-h-screen space-y-6">
      {/* Hero score */}
      <div className="flex flex-col items-center gap-4">
        <h2 className="font-headline text-lg text-on-surface">Collection Health</h2>
        <ScoreRing score={health.overall} grade={health.grade} gradeColor={health.gradeColor} />

        {/* Highlights */}
        {health.highlights.length > 0 && (
          <div className="flex flex-wrap justify-center gap-1.5">
            {health.highlights.map((h, i) => (
              <span key={i} className="px-3 py-1 rounded-full bg-primary/15 text-primary text-[10px] font-medium">{h}</span>
            ))}
          </div>
        )}
      </div>

      {/* Dimensions */}
      <div className="space-y-2">
        <h3 className="text-[10px] uppercase tracking-[0.15em] font-label text-secondary">Score Breakdown</h3>
        {health.dimensions.map((dim) => (
          <button
            key={dim.name}
            onClick={() => setExpandedDim(expandedDim === dim.name ? null : dim.name)}
            className="w-full bg-surface-container rounded-xl p-4 text-left active:scale-[0.98] transition-all"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Icon name={dim.icon} className="text-primary" size={18} />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-on-surface font-medium">{dim.name}</p>
                  <span className="text-[10px] text-secondary/50">{dim.score}/{dim.maxScore}</span>
                </div>
                <p className="text-[10px] text-secondary/50">{dim.label}</p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-700"
                style={{ width: `${(dim.score / dim.maxScore) * 100}%` }}
              />
            </div>

            {/* Expanded tip */}
            {expandedDim === dim.name && (
              <p className="mt-3 pt-3 border-t border-outline-variant/10 text-[11px] text-on-surface-variant leading-relaxed animate-fade-in">
                {dim.tip}
              </p>
            )}
          </button>
        ))}
      </div>

      {/* Actions */}
      <div className="space-y-2">
        <h3 className="text-[10px] uppercase tracking-[0.15em] font-label text-secondary">Improve Your Score</h3>
        <button
          onClick={() => navigate('/smart-collections')}
          className="w-full flex items-center gap-3 bg-surface-container p-4 rounded-xl active:scale-[0.98] transition-transform text-left"
        >
          <Icon name="auto_awesome" className="text-primary" />
          <div className="flex-1">
            <p className="text-sm text-on-surface font-medium">Smart Collections</p>
            <p className="text-[10px] text-secondary/50">Find forgotten gems & under-worn bottles</p>
          </div>
          <Icon name="chevron_right" className="text-secondary/40" />
        </button>
        <button
          onClick={() => navigate('/explore')}
          className="w-full flex items-center gap-3 bg-surface-container p-4 rounded-xl active:scale-[0.98] transition-transform text-left"
        >
          <Icon name="explore" className="text-primary" />
          <div className="flex-1">
            <p className="text-sm text-on-surface font-medium">Explore New Scents</p>
            <p className="text-[10px] text-secondary/50">Expand your collection diversity</p>
          </div>
          <Icon name="chevron_right" className="text-secondary/40" />
        </button>
      </div>
    </main>
  )
}
