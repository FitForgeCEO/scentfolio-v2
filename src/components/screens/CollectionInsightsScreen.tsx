import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../ui/Icon'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import type { Fragrance } from '@/types/database'

/* ── Insight generation ─────────────────────────────────── */
interface Insight {
  icon: string
  title: string
  text: string
  color: 'primary' | 'tertiary' | 'secondary' | 'error'
}

interface InsightData {
  fragrances: (Fragrance & { rating: number | null })[]
  wears: { fragrance_id: string; wear_date: string }[]
  totalOwned: number
}

function generateInsights(data: InsightData): Insight[] {
  const { fragrances, wears, totalOwned } = data
  const insights: Insight[] = []

  if (totalOwned === 0) return [{ icon: 'info', title: 'Getting started', text: 'Add fragrances to your collection and we\'ll generate personalised insights about your taste.', color: 'secondary' }]

  // Brand concentration
  const brandMap = new Map<string, number>()
  fragrances.forEach(f => brandMap.set(f.brand, (brandMap.get(f.brand) ?? 0) + 1))
  const topBrand = [...brandMap.entries()].sort((a, b) => b[1] - a[1])[0]
  if (topBrand && topBrand[1] >= 3) {
    const pct = Math.round((topBrand[1] / totalOwned) * 100)
    insights.push({ icon: 'storefront', title: 'Brand loyalist', text: `${pct}% of your collection is ${topBrand[0]}. You clearly know what you like from them — ${topBrand[1]} bottles strong.`, color: 'primary' })
  }

  // Family diversity
  const familyMap = new Map<string, number>()
  fragrances.forEach(f => { if (f.note_family) familyMap.set(f.note_family, (familyMap.get(f.note_family) ?? 0) + 1) })
  const familyCount = familyMap.size
  const topFamily = [...familyMap.entries()].sort((a, b) => b[1] - a[1])[0]

  if (familyCount >= 8) {
    insights.push({ icon: 'diversity_3', title: 'Diverse palette', text: `Your nose explores ${familyCount} different note families. That\'s seriously eclectic taste — you appreciate the full spectrum of perfumery.`, color: 'tertiary' })
  } else if (familyCount <= 3 && totalOwned >= 5) {
    insights.push({ icon: 'center_focus_strong', title: 'Focused collector', text: `You gravitate toward ${[...familyMap.keys()].join(' and ')} fragrances. Consider exploring outside your comfort zone — a ${topFamily?.[0] === 'Woody' ? 'fresh aquatic' : 'rich oriental'} might surprise you.`, color: 'secondary' })
  }

  // Dominant family
  if (topFamily && topFamily[1] >= 3) {
    const pct = Math.round((topFamily[1] / totalOwned) * 100)
    insights.push({ icon: 'spa', title: `${topFamily[0]} lover`, text: `${topFamily[0]} fragrances make up ${pct}% of your collection. This is clearly your signature territory.`, color: 'primary' })
  }

  // Wear patterns
  if (wears.length >= 10) {
    // Day of week analysis
    const dayCount = new Array(7).fill(0) as number[]
    wears.forEach(w => { const d = new Date(w.wear_date).getDay(); dayCount[d]++ })
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const peakDay = dayCount.indexOf(Math.max(...dayCount))
    const lowDay = dayCount.indexOf(Math.min(...dayCount))
    if (dayCount[peakDay] > dayCount[lowDay] * 2) {
      insights.push({ icon: 'calendar_today', title: 'Wear pattern spotted', text: `You wear fragrance most on ${dayNames[peakDay]}s and least on ${dayNames[lowDay]}s. ${peakDay >= 5 ? 'Weekend scenting — you save the best for days off.' : 'Weekday warrior — fragrance is part of your daily routine.'}`, color: 'tertiary' })
    }

    // Monthly trend
    const monthMap = new Map<string, number>()
    wears.forEach(w => { const m = w.wear_date.slice(0, 7); monthMap.set(m, (monthMap.get(m) ?? 0) + 1) })
    const months = [...monthMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    if (months.length >= 3) {
      const recent = months.slice(-2).reduce((s, [, c]) => s + c, 0)
      const earlier = months.slice(0, 2).reduce((s, [, c]) => s + c, 0)
      if (recent > earlier * 1.5) {
        insights.push({ icon: 'trending_up', title: 'Growing habit', text: 'Your wear frequency has been increasing lately. The fragrance obsession is deepening!', color: 'primary' })
      } else if (earlier > recent * 1.5) {
        insights.push({ icon: 'trending_down', title: 'Wearing less', text: 'Your wear frequency has dropped recently. Maybe it\'s time to rediscover some forgotten bottles?', color: 'error' })
      }
    }

    // Rotation diversity
    const uniqueWorn = new Set(wears.map(w => w.fragrance_id)).size
    const rotationPct = totalOwned > 0 ? Math.round((uniqueWorn / totalOwned) * 100) : 0
    if (rotationPct <= 30 && totalOwned >= 10) {
      insights.push({ icon: 'autorenew', title: 'Narrow rotation', text: `You only wear ${rotationPct}% of your collection regularly. ${totalOwned - uniqueWorn} bottles are gathering dust — time for a rotation shake-up?`, color: 'secondary' })
    } else if (rotationPct >= 80) {
      insights.push({ icon: 'all_inclusive', title: 'Full rotation', text: `You actively wear ${rotationPct}% of your collection. Every bottle earns its shelf space — that\'s disciplined collecting.`, color: 'tertiary' })
    }
  }

  // Rating patterns
  const rated = fragrances.filter(f => f.rating !== null)
  if (rated.length >= 5) {
    const avg = rated.reduce((s, f) => s + (f.rating ?? 0), 0) / rated.length
    if (avg >= 4.2) {
      insights.push({ icon: 'thumb_up', title: 'High standards', text: `Your average rating is ${avg.toFixed(1)}/5. You\'re selective — only the best make it into your collection.`, color: 'primary' })
    } else if (avg <= 3.0) {
      insights.push({ icon: 'thumbs_up_down', title: 'Honest critic', text: `Your average rating is ${avg.toFixed(1)}/5. You\'re not afraid to rate honestly — that helps other collectors trust your reviews.`, color: 'secondary' })
    }
  }

  // Price analysis
  const priced = fragrances.filter(f => f.price)
  if (priced.length >= 3) {
    const prices = priced.map(f => parseFloat(f.price!.replace(/[^0-9.]/g, '')) || 0).filter(p => p > 0)
    if (prices.length >= 3) {
      const avg = prices.reduce((s, p) => s + p, 0) / prices.length
      if (avg > 150) {
        insights.push({ icon: 'diamond', title: 'Luxury taste', text: `Your average bottle runs $${Math.round(avg)}. You invest in quality — niche and designer picks that last.`, color: 'primary' })
      } else if (avg < 50) {
        insights.push({ icon: 'savings', title: 'Smart shopper', text: `Average $${Math.round(avg)} per bottle — proof you don\'t need to break the bank for a great-smelling collection.`, color: 'tertiary' })
      }
    }
  }

  // Season distribution from season_ranking data
  const seasonScores = new Map<string, number>([['Spring', 0], ['Summer', 0], ['Autumn', 0], ['Winter', 0]])
  let seasonCount = 0
  fragrances.forEach(f => {
    if (!f.season_ranking) return
    f.season_ranking.forEach(sr => {
      const name = sr.name.charAt(0).toUpperCase() + sr.name.slice(1).toLowerCase()
      if (seasonScores.has(name) && sr.score >= 4) {
        seasonScores.set(name, (seasonScores.get(name) ?? 0) + 1)
        seasonCount++
      }
    })
  })
  if (seasonCount > 0) {
    const topSeason = [...seasonScores.entries()].sort((a, b) => b[1] - a[1])[0]
    if (topSeason[1] >= 3) {
      insights.push({ icon: 'thermostat', title: `${topSeason[0]} collection`, text: `You\'re stacked for ${topSeason[0].toLowerCase()} — ${topSeason[1]} fragrances that excel in that season. ${topSeason[0] === 'Winter' ? 'Cold weather is your signature moment.' : topSeason[0] === 'Summer' ? 'You\'re ready for heat.' : `${topSeason[0]} brings out the best in your bottles.`}`, color: 'primary' })
    }
  }

  return insights.length > 0 ? insights : [{ icon: 'psychology', title: 'Building your profile', text: 'Keep logging wears and rating fragrances — richer insights unlock as your data grows.', color: 'secondary' }]
}

export function CollectionInsightsScreen() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [insights, setInsights] = useState<Insight[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    fetchData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function fetchData() {
    const [collRes, wearsRes] = await Promise.all([
      supabase.from('user_collections').select('personal_rating, fragrance:fragrances(*)').eq('user_id', user!.id).eq('status', 'own'),
      supabase.from('wear_logs').select('fragrance_id, wear_date').eq('user_id', user!.id),
    ])

    type CollRow = { personal_rating: number | null; fragrance: Fragrance | null }
    const coll = (collRes.data ?? []) as unknown as CollRow[]
    const frags = coll.filter(c => c.fragrance).map(c => ({ ...c.fragrance!, rating: c.personal_rating }))
    const wears = (wearsRes.data ?? []) as { fragrance_id: string; wear_date: string }[]

    setInsights(generateInsights({ fragrances: frags, wears, totalOwned: frags.length }))
    setLoading(false)
  }

  const colorMap = { primary: 'text-primary bg-primary/10', tertiary: 'text-tertiary bg-tertiary/10', secondary: 'text-secondary bg-secondary/10', error: 'text-error bg-error/10' }

  if (!user) {
    return (
      <main className="pt-24 pb-32 px-6 flex flex-col items-center justify-center min-h-screen gap-4">
        <Icon name="psychology" className="text-5xl text-primary/30" />
        <p className="text-secondary/60 text-sm">Sign in to see your insights</p>
      </main>
    )
  }

  if (loading) {
    return (
      <main className="pt-24 pb-32 px-6 flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </main>
    )
  }

  return (
    <main className="pt-24 pb-32 px-4 max-w-[430px] mx-auto min-h-screen space-y-4">
      <div className="text-center mb-2">
        <h2 className="font-headline text-lg text-on-surface">Your Collection, Decoded</h2>
        <p className="text-[10px] text-secondary/50">Personalised insights from your data</p>
      </div>

      {insights.map((insight, i) => (
        <div key={i} className="bg-surface-container rounded-xl p-5 space-y-3 animate-fade-in" style={{ animationDelay: `${i * 100}ms` }}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorMap[insight.color]}`}>
              <Icon name={insight.icon} size={20} />
            </div>
            <h3 className="text-sm text-on-surface font-medium">{insight.title}</h3>
          </div>
          <p className="text-sm text-on-surface-variant leading-relaxed">{insight.text}</p>
        </div>
      ))}

      {/* CTA */}
      <div className="pt-4 space-y-3">
        <button onClick={() => navigate('/stats')} className="w-full flex items-center gap-3 bg-surface-container p-4 rounded-xl active:scale-[0.98] transition-transform">
          <Icon name="analytics" className="text-primary" />
          <div className="flex-1">
            <p className="text-sm text-on-surface font-medium">Full Stats</p>
            <p className="text-[10px] text-secondary/50">Deep dive into your numbers</p>
          </div>
          <Icon name="chevron_right" className="text-secondary/40" />
        </button>
        <button onClick={() => navigate('/scent-quiz')} className="w-full flex items-center gap-3 bg-surface-container p-4 rounded-xl active:scale-[0.98] transition-transform">
          <Icon name="quiz" className="text-primary" />
          <div className="flex-1">
            <p className="text-sm text-on-surface font-medium">Scent Quiz</p>
            <p className="text-[10px] text-secondary/50">Refine your profile</p>
          </div>
          <Icon name="chevron_right" className="text-secondary/40" />
        </button>
      </div>
    </main>
  )
}
