import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../ui/Icon'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import type { Fragrance } from '@/types/database'

interface SeasonalItem {
  fragrance: Fragrance
  score: number
  reasons: string[]
}

type Season = 'spring' | 'summer' | 'autumn' | 'winter'

const SEASON_CONFIG: Record<Season, { icon: string; label: string; color: string; months: number[]; accords: string[] }> = {
  spring: {
    icon: 'local_florist',
    label: 'Spring',
    color: '#6B8F71',
    months: [3, 4, 5],
    accords: ['floral', 'green', 'citrus', 'fresh', 'aquatic', 'fruity', 'white floral', 'powdery', 'rose'],
  },
  summer: {
    icon: 'wb_sunny',
    label: 'Summer',
    color: '#D4845A',
    months: [6, 7, 8],
    accords: ['citrus', 'aquatic', 'fresh', 'aromatic', 'clean', 'coconut', 'tropical', 'marine', 'green'],
  },
  autumn: {
    icon: 'eco',
    label: 'Autumn',
    color: '#C4A35A',
    months: [9, 10, 11],
    accords: ['woody', 'amber', 'spicy', 'warm spicy', 'leather', 'smoky', 'oriental', 'vanilla', 'earthy'],
  },
  winter: {
    icon: 'ac_unit',
    label: 'Winter',
    color: '#5BA3C9',
    months: [12, 1, 2],
    accords: ['vanilla', 'amber', 'oud', 'spicy', 'warm spicy', 'woody', 'sweet', 'oriental', 'smoky', 'leather'],
  },
}

function getCurrentSeason(): Season {
  const month = new Date().getMonth() + 1
  if (month >= 3 && month <= 5) return 'spring'
  if (month >= 6 && month <= 8) return 'summer'
  if (month >= 9 && month <= 11) return 'autumn'
  return 'winter'
}

export function SeasonalSuggestScreen() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [season, setSeason] = useState<Season>(getCurrentSeason())
  const [items, setItems] = useState<SeasonalItem[]>([])
  const [loading, setLoading] = useState(true)
  const [allFragrances, setAllFragrances] = useState<Fragrance[]>([])

  useEffect(() => {
    if (!user) { setLoading(false); return }

    async function fetchCollection() {
      const { data } = await supabase
        .from('user_collections')
        .select('fragrance:fragrances(*)')
        .eq('user_id', user!.id)
        .eq('status', 'own')

      type Row = { fragrance: Fragrance | null }
      const fragrances = ((data ?? []) as unknown as Row[])
        .map((r) => r.fragrance)
        .filter((f): f is Fragrance => f !== null)

      setAllFragrances(fragrances)
      setLoading(false)
    }

    fetchCollection()
  }, [user])

  useEffect(() => {
    if (allFragrances.length === 0) return
    const config = SEASON_CONFIG[season]
    const scored: SeasonalItem[] = []

    for (const f of allFragrances) {
      let score = 0
      const reasons: string[] = []

      // Check season_ranking data
      if (f.season_ranking) {
        for (const sr of f.season_ranking) {
          if (sr.name.toLowerCase() === season || sr.name.toLowerCase().includes(season)) {
            score += sr.score * 2
            if (sr.score >= 3) {
              reasons.push(`Rated ${sr.score}/5 for ${config.label}`)
            }
          }
        }
      }

      // Check accords match
      if (f.accords) {
        const matchingAccords = f.accords.filter((a) =>
          config.accords.includes(a.toLowerCase())
        )
        score += matchingAccords.length * 1.5
        if (matchingAccords.length > 0 && reasons.length === 0) {
          reasons.push(`${matchingAccords.slice(0, 2).join(' & ')} accords are perfect for ${config.label}`)
        }
      }

      if (score > 0) {
        scored.push({ fragrance: f, score, reasons })
      }
    }

    scored.sort((a, b) => b.score - a.score)
    setItems(scored.slice(0, 20))
  }, [season, allFragrances])

  if (!user) {
    return (
      <main className="pt-24 pb-32 px-6 flex flex-col items-center justify-center min-h-screen gap-4">
        <Icon name="calendar_month" className="text-5xl text-primary/30" />
        <p className="text-secondary/60 text-sm">Sign in for seasonal suggestions</p>
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

  const currentConfig = SEASON_CONFIG[season]

  return (
    <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen">
      <section className="text-center mb-6">
        <div
          className="w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-3"
          style={{ backgroundColor: `${currentConfig.color}20` }}
        >
          <Icon name={currentConfig.icon} filled className="text-3xl" style={{ color: currentConfig.color }} />
        </div>
        <h2 className="font-headline text-xl mb-1">Seasonal Picks</h2>
        <p className="text-[10px] text-secondary/50">The best from your collection for each season</p>
      </section>

      {/* Season Tabs */}
      <div className="grid grid-cols-4 gap-2 mb-6">
        {(['spring', 'summer', 'autumn', 'winter'] as Season[]).map((s) => {
          const cfg = SEASON_CONFIG[s]
          const isCurrent = s === getCurrentSeason()
          return (
            <button
              key={s}
              onClick={() => setSeason(s)}
              className={`flex flex-col items-center gap-1 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 ${
                season === s ? 'bg-primary/15 text-primary' : 'bg-surface-container text-secondary/50'
              }`}
            >
              <Icon name={cfg.icon} size={16} />
              <span>{cfg.label}</span>
              {isCurrent && (
                <span className="text-[7px] normal-case tracking-normal text-primary/60">now</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Results */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16">
          <Icon name={currentConfig.icon} className="text-4xl text-secondary/20" />
          <p className="text-sm text-secondary/50 text-center">
            No strong {currentConfig.label.toLowerCase()} matches in your collection
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item, idx) => (
            <button
              key={item.fragrance.id}
              onClick={() => navigate(`/fragrance/${item.fragrance.id}`)}
              className="w-full bg-surface-container rounded-xl p-3 flex items-center gap-3 active:scale-[0.98] transition-transform text-left"
            >
              {/* Rank */}
              <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0`}
                style={{ backgroundColor: idx < 3 ? `${currentConfig.color}20` : undefined }}
              >
                <span className={`text-[10px] font-bold ${idx < 3 ? '' : 'text-secondary/50'}`}
                  style={idx < 3 ? { color: currentConfig.color } : undefined}
                >
                  {idx + 1}
                </span>
              </div>

              {/* Image */}
              <div className="w-11 h-11 rounded-lg overflow-hidden bg-surface-container-low flex-shrink-0">
                {item.fragrance.image_url ? (
                  <img src={item.fragrance.image_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Icon name="water_drop" className="text-secondary/20" size={18} />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <p className="text-[9px] uppercase tracking-[0.1em] text-secondary/50">{item.fragrance.brand}</p>
                <p className="text-sm text-on-surface font-medium truncate">{item.fragrance.name}</p>
                {item.reasons[0] && (
                  <p className="text-[9px] text-secondary/40 mt-0.5 truncate">{item.reasons[0]}</p>
                )}
              </div>

              {/* Season score */}
              <div className="flex-shrink-0" style={{ color: currentConfig.color }}>
                <Icon name={currentConfig.icon} size={20} />
              </div>
            </button>
          ))}
        </div>
      )}
    </main>
  )
}
