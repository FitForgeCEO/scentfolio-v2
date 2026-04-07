import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../ui/Icon'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { supabase } from '@/lib/supabase'
import { awardXP } from '@/lib/xp'
import type { Fragrance, UserCollection, WearLog } from '@/types/database'

type CollectionItem = UserCollection & { fragrance: Fragrance }

const OCCASIONS = [
  { value: 'work', label: 'Work', icon: 'work' },
  { value: 'date', label: 'Date Night', icon: 'favorite' },
  { value: 'casual', label: 'Casual', icon: 'weekend' },
  { value: 'formal', label: 'Formal Event', icon: 'celebration' },
  { value: 'gym', label: 'Gym / Active', icon: 'fitness_center' },
  { value: 'night-out', label: 'Night Out', icon: 'nightlife' },
]

function getCurrentSeason(): string {
  const month = new Date().getMonth()
  if (month >= 2 && month <= 4) return 'SPRING'
  if (month >= 5 && month <= 7) return 'SUMMER'
  if (month >= 8 && month <= 10) return 'FALL'
  return 'WINTER'
}

export function RecommendScreen() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { showToast } = useToast()
  const [collection, setCollection] = useState<CollectionItem[]>([])
  const [recentWears, setRecentWears] = useState<WearLog[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedOccasion, setSelectedOccasion] = useState<string | null>(null)
  const [recommendation, setRecommendation] = useState<Fragrance | null>(null)
  const [runner1, setRunner1] = useState<Fragrance | null>(null)
  const [runner2, setRunner2] = useState<Fragrance | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [loggingWear, setLoggingWear] = useState(false)

  const season = getCurrentSeason()

  const fetchData = useCallback(() => {
    if (!user) { setLoading(false); return }
    setLoading(true)
    Promise.all([
      supabase
        .from('user_collections')
        .select('*, fragrance:fragrances(*)')
        .eq('user_id', user.id)
        .eq('status', 'own'),
      supabase
        .from('wear_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('wear_date', new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0])
        .order('wear_date', { ascending: false }),
    ]).then(([collRes, wearRes]) => {
      if (collRes.data) setCollection(collRes.data as CollectionItem[])
      if (wearRes.data) setRecentWears(wearRes.data as WearLog[])
      setLoading(false)
    })
  }, [user])

  useEffect(() => { fetchData() }, [fetchData])

  const generateRecommendation = () => {
    if (collection.length === 0) return

    const recentIds = new Set(recentWears.map((w) => w.fragrance_id))
    const candidates = collection.map((c) => c.fragrance)

    // Score each fragrance
    const scored = candidates.map((frag) => {
      let score = 50 // base score

      // Season fit (0–30 points)
      const seasonScore = frag.season_ranking?.find((s) => s.name.toUpperCase() === season)?.score ?? 0.5
      score += seasonScore * 30

      // Freshness bonus — prefer not recently worn (0–20 points)
      if (!recentIds.has(frag.id)) score += 20
      else score -= 10

      // Rating bonus (0–15 points)
      if (frag.rating) score += (Number(frag.rating) / 5) * 15

      // Occasion matching (0–10 points)
      if (selectedOccasion && frag.occasion_ranking) {
        const occasionScore = frag.occasion_ranking.find(
          (o) => o.name.toLowerCase().includes(selectedOccasion) || selectedOccasion.includes(o.name.toLowerCase())
        )?.score ?? 0
        score += occasionScore * 10
      }

      // Small random factor for variety (0–10)
      score += Math.random() * 10

      return { frag, score }
    })

    scored.sort((a, b) => b.score - a.score)

    setRecommendation(scored[0]?.frag ?? null)
    setRunner1(scored[1]?.frag ?? null)
    setRunner2(scored[2]?.frag ?? null)
    setShowResult(true)
  }

  const handleLogWear = async () => {
    if (!user || !recommendation) return
    setLoggingWear(true)
    const { error } = await supabase.from('wear_logs').insert({
      user_id: user.id,
      fragrance_id: recommendation.id,
      wear_date: new Date().toISOString().split('T')[0],
      occasion: selectedOccasion,
    })
    if (!error) {
      const result = await awardXP(user.id, 'LOG_WEAR')
      showToast(`Wear logged! +${result ? 10 : 0} XP`, 'success', 'check_circle')
    } else {
      showToast('Failed to log wear', 'error')
    }
    setLoggingWear(false)
  }

  const handleShuffle = () => {
    setShowResult(false)
    setTimeout(() => generateRecommendation(), 100)
  }

  if (!user) {
    return (
      <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen flex flex-col items-center justify-center">
        <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center mb-5">
          <Icon name="auto_awesome" className="text-3xl text-primary/40" />
        </div>
        <h3 className="font-headline text-xl text-on-surface mb-2">Sign in for recommendations</h3>
        <p className="text-sm text-secondary/60 text-center mb-6">We'll pick from your collection based on season, occasion, and what you haven't worn recently.</p>
        <button onClick={() => navigate('/profile')} className="gold-gradient text-on-primary-container px-8 py-3 rounded-xl font-label text-[10px] font-bold uppercase tracking-widest active:scale-95 transition-all shadow-lg">SIGN IN</button>
      </main>
    )
  }

  if (loading) {
    return (
      <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </main>
    )
  }

  if (collection.length === 0) {
    return (
      <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen flex flex-col items-center justify-center">
        <div className="w-20 h-20 rounded-full bg-surface-container flex items-center justify-center mb-6">
          <Icon name="auto_awesome" className="text-primary/40 text-4xl" />
        </div>
        <h3 className="font-headline text-xl text-on-surface mb-2 text-center">No fragrances to pick from</h3>
        <p className="text-sm text-secondary/60 text-center mb-8 max-w-[280px]">Add some fragrances to your collection first, then we can recommend what to wear.</p>
        <button onClick={() => navigate('/explore')} className="gold-gradient text-on-primary-container px-8 py-3 rounded-xl font-label text-[10px] font-bold uppercase tracking-widest active:scale-95 transition-all shadow-lg">EXPLORE</button>
      </main>
    )
  }

  return (
    <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen">
      {!showResult ? (
        /* Selection Phase */
        <div className="space-y-8">
          <header className="text-center">
            <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center mx-auto mb-4">
              <Icon name="auto_awesome" className="text-primary text-3xl" />
            </div>
            <h2 className="font-headline text-3xl text-on-surface mb-2">What to wear?</h2>
            <p className="text-sm text-secondary/70">
              It's {season.charAt(0) + season.slice(1).toLowerCase()} — let's find the perfect scent for today.
            </p>
          </header>

          <section>
            <h3 className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold mb-4">WHAT'S THE OCCASION?</h3>
            <div className="grid grid-cols-2 gap-3">
              {OCCASIONS.map((occ) => (
                <button
                  key={occ.value}
                  onClick={() => setSelectedOccasion(selectedOccasion === occ.value ? null : occ.value)}
                  className={`flex items-center gap-3 p-4 rounded-xl transition-all active:scale-95 ${
                    selectedOccasion === occ.value
                      ? 'bg-primary/15 ring-1 ring-primary/40'
                      : 'bg-surface-container'
                  }`}
                >
                  <Icon name={occ.icon} className={selectedOccasion === occ.value ? 'text-primary' : 'text-secondary/50'} size={20} />
                  <span className={`text-sm font-medium ${selectedOccasion === occ.value ? 'text-primary' : 'text-on-surface'}`}>{occ.label}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="bg-surface-container rounded-xl p-4 flex items-center gap-3">
            <Icon name="thermostat" className="text-primary" />
            <div>
              <p className="text-sm text-on-surface font-medium">Current Season: {season.charAt(0) + season.slice(1).toLowerCase()}</p>
              <p className="text-[10px] text-secondary/50">Recommendations will favour {season.toLowerCase()}-appropriate scents</p>
            </div>
          </section>

          <button
            onClick={generateRecommendation}
            className="w-full py-4 gold-gradient text-on-primary font-bold uppercase tracking-[0.15em] rounded-xl ambient-glow active:scale-[0.98] transition-all text-sm"
          >
            RECOMMEND A SCENT
          </button>

          <p className="text-[10px] text-secondary/40 text-center">
            Picking from {collection.length} fragrance{collection.length !== 1 ? 's' : ''} in your collection
          </p>
        </div>
      ) : recommendation ? (
        /* Result Phase */
        <div className="space-y-6 animate-slide-down">
          <header className="text-center mb-2">
            <p className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold mb-1">TODAY'S PICK</p>
            <h2 className="font-headline text-2xl text-on-surface">Wear this today</h2>
          </header>

          {/* Main Recommendation */}
          <button
            onClick={() => navigate(`/fragrance/${recommendation.id}`)}
            className="w-full bg-surface-container rounded-2xl overflow-hidden active:scale-[0.98] transition-transform"
          >
            <div className="aspect-[4/5] relative">
              {recommendation.image_url ? (
                <img src={recommendation.image_url} alt={recommendation.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-surface-container-highest flex items-center justify-center">
                  <Icon name="water_drop" size={48} className="text-secondary/20" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <p className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold mb-1">{recommendation.brand}</p>
                <h3 className="font-headline text-2xl text-on-surface font-bold mb-2">{recommendation.name}</h3>
                <div className="flex items-center gap-4">
                  {recommendation.rating && (
                    <span className="flex items-center gap-1">
                      <Icon name="star" filled className="text-primary text-sm" />
                      <span className="text-sm text-primary font-semibold">{Number(recommendation.rating).toFixed(1)}</span>
                    </span>
                  )}
                  {recommendation.concentration && (
                    <span className="text-xs text-secondary/60">{recommendation.concentration}</span>
                  )}
                </div>
              </div>
            </div>
          </button>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleLogWear}
              disabled={loggingWear}
              className="flex-1 py-3.5 gold-gradient text-on-primary font-bold uppercase tracking-[0.1em] rounded-xl ambient-glow active:scale-[0.98] transition-all text-sm flex items-center justify-center gap-2"
            >
              {loggingWear ? (
                <div className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Icon name="check" size={18} />
                  LOG WEAR
                </>
              )}
            </button>
            <button
              onClick={handleShuffle}
              className="py-3.5 px-5 bg-surface-container rounded-xl active:scale-95 transition-transform flex items-center gap-2"
            >
              <Icon name="refresh" className="text-primary" size={18} />
              <span className="text-sm text-on-surface font-medium">SHUFFLE</span>
            </button>
          </div>

          {/* Runners Up */}
          {(runner1 || runner2) && (
            <section>
              <h3 className="text-[10px] uppercase tracking-[0.2em] text-secondary/50 font-bold mb-3">ALSO GREAT TODAY</h3>
              <div className="flex gap-3">
                {[runner1, runner2].filter(Boolean).map((frag) => (
                  <button
                    key={frag!.id}
                    onClick={() => navigate(`/fragrance/${frag!.id}`)}
                    className="flex-1 flex items-center gap-3 bg-surface-container rounded-xl p-3 active:scale-95 transition-transform"
                  >
                    <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-surface-container-highest">
                      {frag!.image_url && <img src={frag!.image_url} alt={frag!.name} className="w-full h-full object-cover" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] uppercase tracking-wider text-primary/70 font-bold">{frag!.brand}</p>
                      <p className="text-xs text-on-surface truncate">{frag!.name}</p>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Start Over */}
          <button onClick={() => { setShowResult(false); setSelectedOccasion(null) }} className="w-full text-center text-sm text-secondary/50 py-2 active:text-primary transition-colors">
            Start over
          </button>
        </div>
      ) : null}
    </main>
  )
}
