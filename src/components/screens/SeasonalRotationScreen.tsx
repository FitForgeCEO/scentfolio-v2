import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../ui/Icon'
import { InlineError } from '../ui/InlineError'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import type { Fragrance, UserCollection, WearLog } from '@/types/database'

type Season = 'SPRING' | 'SUMMER' | 'FALL' | 'WINTER'

const SEASON_CONFIG: Record<Season, { icon: string; color: string; gradient: string }> = {
  SPRING: { icon: 'local_florist', color: '#8BC34A', gradient: 'from-[#8BC34A]/20 to-transparent' },
  SUMMER: { icon: 'wb_sunny', color: '#FF9800', gradient: 'from-[#FF9800]/20 to-transparent' },
  FALL: { icon: 'eco', color: '#D4845A', gradient: 'from-[#D4845A]/20 to-transparent' },
  WINTER: { icon: 'ac_unit', color: '#5BA3C9', gradient: 'from-[#5BA3C9]/20 to-transparent' },
}

const SEASONS: Season[] = ['SPRING', 'SUMMER', 'FALL', 'WINTER']

function getCurrentSeason(): Season {
  const month = new Date().getMonth()
  if (month >= 2 && month <= 4) return 'SPRING'
  if (month >= 5 && month <= 7) return 'SUMMER'
  if (month >= 8 && month <= 10) return 'FALL'
  return 'WINTER'
}

type CollectionItem = UserCollection & { fragrance: Fragrance }

interface ScoredItem {
  item: CollectionItem
  seasonScore: number
  wearCount: number
  rating: number
}

export function SeasonalRotationScreen() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [activeSeason, setActiveSeason] = useState<Season>(getCurrentSeason())
  const [collection, setCollection] = useState<CollectionItem[]>([])
  const [wearLogs, setWearLogs] = useState<WearLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(() => {
    if (!user) { setLoading(false); return }
    setLoading(true)
    setError(null)
    Promise.all([
      supabase.from('user_collections').select('*, fragrance:fragrances(*)').eq('user_id', user.id).eq('status', 'own'),
      supabase.from('wear_logs').select('*').eq('user_id', user.id),
    ]).then(([collRes, wearRes]) => {
      if (collRes.error) { setError(collRes.error.message); setLoading(false); return }
      setCollection((collRes.data ?? []) as CollectionItem[])
      setWearLogs((wearRes.data ?? []) as WearLog[])
      setLoading(false)
    })
  }, [user])

  useEffect(() => { fetchData() }, [fetchData])

  // Score fragrances for the active season
  const scored: ScoredItem[] = collection
    .map((item) => {
      const sr = item.fragrance.season_ranking
      const seasonEntry = sr?.find((s) => s.name.toUpperCase() === activeSeason)
      const seasonScore = seasonEntry ? seasonEntry.score : 0.5 // default to neutral if no data
      const rating = Number(item.personal_rating || item.fragrance.rating) || 0

      // Count wears for this fragrance
      const wearCount = wearLogs.filter((w) => w.fragrance_id === item.fragrance.id).length

      return { item, seasonScore, wearCount, rating }
    })
    .sort((a, b) => {
      // Primary: season score, secondary: rating, tertiary: less worn gets a boost
      const aScore = a.seasonScore * 60 + (a.rating / 5) * 20 + (a.wearCount < 3 ? 10 : 0)
      const bScore = b.seasonScore * 60 + (b.rating / 5) * 20 + (b.wearCount < 3 ? 10 : 0)
      return bScore - aScore
    })

  const capsule = scored.slice(0, 6)
  const others = scored.slice(6)

  const currentSeason = getCurrentSeason()
  const config = SEASON_CONFIG[activeSeason]

  if (!user) {
    return (
      <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen flex flex-col items-center justify-center">
        <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center mb-5">
          <Icon name="calendar_month" className="text-3xl text-primary/40" />
        </div>
        <h3 className="font-headline text-xl text-on-surface mb-2">Sign in to see rotation</h3>
        <button onClick={() => navigate('/profile')} className="gold-gradient text-on-primary-container px-8 py-3 rounded-xl font-label text-[10px] font-bold uppercase tracking-widest active:scale-95 transition-all shadow-lg mt-6">SIGN IN</button>
      </main>
    )
  }

  if (error) return <main className="pt-24 pb-32 px-6"><InlineError message="Couldn't load data" onRetry={fetchData} /></main>

  if (loading) {
    return (
      <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen">
        <div className="space-y-4 pt-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 rounded-xl bg-surface-container animate-pulse" />)}</div>
      </main>
    )
  }

  return (
    <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen space-y-6">
      <header>
        <h2 className="font-headline text-3xl text-on-surface leading-tight mb-1">Seasonal Rotation</h2>
        <p className="font-body text-sm text-secondary opacity-70">Your capsule collection for each season</p>
      </header>

      {/* Season Selector */}
      <nav className="grid grid-cols-4 gap-2">
        {SEASONS.map((s) => {
          const sc = SEASON_CONFIG[s]
          const isActive = s === activeSeason
          const isCurrent = s === currentSeason
          return (
            <button
              key={s}
              onClick={() => setActiveSeason(s)}
              className={`flex flex-col items-center gap-1.5 py-3 rounded-xl transition-all ${isActive ? 'ring-2 ring-primary' : 'bg-surface-container'}`}
              style={isActive ? { backgroundColor: `${sc.color}20` } : undefined}
            >
              <Icon name={sc.icon} style={{ color: isActive ? sc.color : undefined }} className={isActive ? '' : 'text-secondary/50'} size={20} />
              <span className={`text-[9px] font-bold tracking-widest ${isActive ? 'text-on-surface' : 'text-secondary/60'}`}>{s}</span>
              {isCurrent && <span className="text-[7px] text-primary font-bold">NOW</span>}
            </button>
          )
        })}
      </nav>

      {collection.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-20 h-20 rounded-full bg-surface-container flex items-center justify-center mb-6">
            <Icon name={config.icon} style={{ color: config.color }} className="text-4xl" />
          </div>
          <h3 className="font-headline text-xl text-on-surface mb-2">No fragrances yet</h3>
          <p className="text-sm text-secondary/60 text-center mb-8 max-w-[280px]">Add fragrances to your collection to see seasonal recommendations.</p>
          <button onClick={() => navigate('/explore')} className="gold-gradient text-on-primary-container px-8 py-3 rounded-xl font-label text-[10px] font-bold uppercase tracking-widest active:scale-95 transition-all shadow-lg">EXPLORE</button>
        </div>
      ) : (
        <>
          {/* Capsule Collection */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Icon name={config.icon} style={{ color: config.color }} size={18} />
              <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold" style={{ color: config.color }}>
                {activeSeason} CAPSULE ({capsule.length})
              </h3>
            </div>

            {capsule.length === 0 ? (
              <p className="text-sm text-secondary/50 text-center py-4">No fragrances match this season well</p>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {capsule.map(({ item, seasonScore }) => (
                  <div
                    key={item.id}
                    className="space-y-2 group cursor-pointer"
                    role="link"
                    tabIndex={0}
                    onClick={() => navigate(`/fragrance/${item.fragrance.id}`)}
                    onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/fragrance/${item.fragrance.id}`) }}
                  >
                    <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-surface-container-low">
                      {item.fragrance.image_url && (
                        <img src={item.fragrance.image_url} alt={item.fragrance.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      )}
                      {/* Season score badge */}
                      <div
                        className="absolute top-2 right-2 px-2 py-0.5 rounded text-[8px] font-bold backdrop-blur-md"
                        style={{ backgroundColor: `${config.color}30`, color: config.color }}
                      >
                        {Math.round(seasonScore * 100)}%
                      </div>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase tracking-[0.15em] text-secondary/60">{item.fragrance.brand}</span>
                      <h4 className="text-sm font-medium text-on-surface truncate">{item.fragrance.name}</h4>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Other fragrances */}
          {others.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-[10px] uppercase tracking-[0.15em] text-secondary/60 font-bold">ALSO IN COLLECTION ({others.length})</h3>
              <div className="space-y-2">
                {others.slice(0, 10).map(({ item, seasonScore }) => (
                  <button
                    key={item.id}
                    onClick={() => navigate(`/fragrance/${item.fragrance.id}`)}
                    className="w-full flex items-center gap-3 bg-surface-container rounded-xl px-3 py-2.5 text-left active:scale-[0.98] transition-transform"
                  >
                    <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 bg-surface-container-highest">
                      {item.fragrance.image_url && <img src={item.fragrance.image_url} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[8px] uppercase tracking-wider text-primary/60 font-bold">{item.fragrance.brand}</p>
                      <p className="text-xs text-on-surface truncate">{item.fragrance.name}</p>
                    </div>
                    <span className="text-[10px] text-secondary/40">{Math.round(seasonScore * 100)}%</span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </main>
  )
}
