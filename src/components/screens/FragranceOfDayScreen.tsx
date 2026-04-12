import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import type { Fragrance } from '@/types/database'
import { getIconChar } from '@/lib/iconUtils'

function getCurrentSeason(): string {
  const m = new Date().getMonth()
  if (m >= 2 && m <= 4) return 'SPRING'
  if (m >= 5 && m <= 7) return 'SUMMER'
  if (m >= 8 && m <= 10) return 'FALL'
  return 'WINTER'
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

function getTodaySeed(): number {
  const d = new Date()
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()
}

interface DayPick {
  fragrance: Fragrance
  reason: string
  icon: string
}

export function FragranceOfDayScreen() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [pick, setPick] = useState<DayPick | null>(null)
  const [loading, setLoading] = useState(true)
  const [wearLogged, setWearLogged] = useState(false)

  useEffect(() => {
    if (!user) { setLoading(false); return }

    async function computePick() {
      // Get user's owned collection with fragrances
      const { data: collections } = await supabase
        .from('user_collections')
        .select('fragrance:fragrances(*)')
        .eq('user_id', user!.id)
        .eq('status', 'own')

      type CollRow = { fragrance: Fragrance | null }
      const owned = ((collections ?? []) as unknown as CollRow[])
        .map((c) => c.fragrance)
        .filter((f): f is Fragrance => f !== null)

      if (owned.length === 0) {
        setLoading(false)
        return
      }

      // Get recent wears to avoid repetition
      const { data: recentWears } = await supabase
        .from('wear_logs')
        .select('fragrance_id')
        .eq('user_id', user!.id)
        .order('wear_date', { ascending: false })
        .limit(5)

      const recentIds = new Set((recentWears ?? []).map((w) => w.fragrance_id))
      const season = getCurrentSeason()

      // Score each fragrance
      const scored = owned.map((f) => {
        let score = 50 // base score

        // Season match bonus
        const seasonScore = f.season_ranking?.find((s) => s.name === season)?.score ?? 0.5
        score += seasonScore * 30

        // Rating bonus
        if (f.rating) score += Number(f.rating) * 5

        // Penalty for recently worn
        if (recentIds.has(f.id)) score -= 40

        // Random daily factor (deterministic per fragrance per day)
        score += seededRandom(getTodaySeed() + f.id.charCodeAt(0)) * 20

        return { fragrance: f, score }
      })

      scored.sort((a, b) => b.score - a.score)
      const topPick = scored[0]

      // Determine reason
      const seasonMatch = topPick.fragrance.season_ranking?.find((s) => s.name === season)
      let reason = 'A great choice for today'
      let icon = 'auto_awesome'

      if (seasonMatch && seasonMatch.score > 0.7) {
        reason = `Perfect for ${season.toLowerCase()} — seasonal match ${Math.round(seasonMatch.score * 100)}%`
        icon = 'thermostat'
      } else if (!recentIds.has(topPick.fragrance.id) && owned.length > 5) {
        reason = "You haven't worn this recently — time to revisit"
        icon = 'replay'
      } else if (topPick.fragrance.rating && Number(topPick.fragrance.rating) >= 4.5) {
        reason = 'One of the highest rated in your collection'
        icon = 'star'
      }

      // Check if already worn today
      const today = new Date().toISOString().slice(0, 10)
      const { data: todayWear } = await supabase
        .from('wear_logs')
        .select('id')
        .eq('user_id', user!.id)
        .eq('fragrance_id', topPick.fragrance.id)
        .eq('wear_date', today)
        .maybeSingle()

      if (todayWear) setWearLogged(true)

      setPick({ fragrance: topPick.fragrance, reason, icon })
      setLoading(false)
    }

    computePick()
  }, [user])

  const handleLogWear = async () => {
    if (!user || !pick) return
    const today = new Date().toISOString().slice(0, 10)
    await supabase.from('wear_logs').insert({
      user_id: user.id,
      fragrance_id: pick.fragrance.id,
      wear_date: today,
    })
    setWearLogged(true)
  }

  if (!user) {
    return (
      <main className="pt-24 pb-32 px-6 flex flex-col items-center justify-center min-h-screen gap-4">
        <span className="text-5xl text-primary/30">?</span>
        <p className="text-secondary/60 text-sm">Sign in for daily picks</p>
        <button onClick={() => navigate('/profile')} className="gold-gradient text-on-primary-container px-6 py-3 rounded-sm font-label text-[10px] font-bold uppercase tracking-widest">
          Sign In
        </button>
      </main>
    )
  }

  if (loading) {
    return (
      <main className="pt-24 pb-32 px-6 flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-1.5">{[1,2,3].map(i => <div key={i} className="h-1 rounded-sm bg-primary/20 animate-pulse" style={{ width: `${60 - i * 14}px` }} />)}</div>
      </main>
    )
  }

  if (!pick) {
    return (
      <main className="pt-24 pb-32 px-6 flex flex-col items-center justify-center min-h-screen gap-4">
        <span className="text-5xl text-primary/30">?</span>
        <h3 className="font-headline text-xl">No fragrances yet</h3>
        <p className="text-secondary/60 text-sm text-center max-w-[260px]">
          Add some fragrances to your collection and we'll suggest a daily pick.
        </p>
        <button onClick={() => navigate('/explore')} className="gold-gradient text-on-primary-container px-6 py-3 rounded-sm font-label text-[10px] font-bold uppercase tracking-widest">
          Explore
        </button>
      </main>
    )
  }

  const today = new Date()
  const dateStr = today.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen">
      {/* Date Header */}
      <section className="text-center mb-8">
        <p className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold mb-1">FRAGRANCE OF THE DAY</p>
        <h2 className="font-headline text-lg text-secondary/70">{dateStr}</h2>
      </section>

      {/* Hero Card */}
      <section className="mb-8">
        <div
          className="relative rounded-sm overflow-hidden bg-surface-container-low shadow-xl cursor-pointer hover:opacity-80 transition-transform"
          onClick={() => navigate(`/fragrance/${pick.fragrance.id}`)}
        >
          {pick.fragrance.image_url ? (
            <img
              src={pick.fragrance.image_url}
              alt={pick.fragrance.name}
              className="w-full aspect-[3/4] object-cover"
            />
          ) : (
            <div className="w-full aspect-[3/4] flex items-center justify-center bg-surface-container">
              <span className="text-6xl text-secondary/20">?</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-6">
            <span className="text-[9px] uppercase tracking-[0.2em] text-primary font-bold">
              {pick.fragrance.brand}
            </span>
            <h3 className="font-headline text-3xl text-on-surface mt-1">{pick.fragrance.name}</h3>
            {pick.fragrance.concentration && (
              <p className="text-[10px] text-secondary/60 mt-1">{pick.fragrance.concentration}</p>
            )}
          </div>
        </div>
      </section>

      {/* Reason */}
      <section className="flex items-center gap-3 bg-surface-container rounded-sm p-4 mb-6">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <span className="text-primary">{getIconChar(pick.icon)}</span>
        </div>
        <p className="text-sm text-on-surface/80">{pick.reason}</p>
      </section>

      {/* Quick Details */}
      <section className="grid grid-cols-3 gap-3 mb-8">
        {pick.fragrance.rating && (
          <div className="bg-surface-container rounded-sm p-3 text-center">
            <span className="text-primary text-lg mb-1">★</span>
            <p className="font-headline text-lg">{Number(pick.fragrance.rating).toFixed(1)}</p>
            <p className="text-[9px] text-secondary/50 uppercase">Rating</p>
          </div>
        )}
        {pick.fragrance.longevity && (
          <div className="bg-surface-container rounded-sm p-3 text-center">
            <span className="text-primary text-lg mb-1">?</span>
            <p className="font-headline text-lg">{pick.fragrance.longevity}h</p>
            <p className="text-[9px] text-secondary/50 uppercase">Longevity</p>
          </div>
        )}
        {pick.fragrance.note_family && (
          <div className="bg-surface-container rounded-sm p-3 text-center">
            <span className="text-primary text-lg mb-1">?</span>
            <p className="text-sm font-medium truncate">{pick.fragrance.note_family}</p>
            <p className="text-[9px] text-secondary/50 uppercase">Family</p>
          </div>
        )}
      </section>

      {/* Log Wear CTA */}
      <button
        onClick={handleLogWear}
        disabled={wearLogged}
        className={`w-full py-4 rounded-sm font-bold uppercase tracking-[0.15em] text-sm hover:opacity-80 transition-all ${
          wearLogged
            ? 'bg-surface-container text-primary/60'
            : 'gold-gradient text-on-primary ambient-glow'
        }`}
      >
        {wearLogged ? '✓ LOGGED TODAY' : 'WEAR THIS TODAY'}
      </button>

      {/* View Details */}
      <button
        onClick={() => navigate(`/fragrance/${pick.fragrance.id}`)}
        className="w-full py-3 mt-3 text-sm text-primary font-medium hover:opacity-80 transition-all"
      >
        View Full Details →
      </button>
    </main>
  )
}
