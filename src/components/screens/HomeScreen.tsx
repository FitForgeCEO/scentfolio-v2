import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { InlineError } from '../ui/InlineError'
import { WelcomeOverlay } from '../ui/WelcomeOverlay'
import { useTrendingFragrances } from '@/hooks/useFragrances'
import { useHomeStats } from '@/hooks/useHomeStats'
import { useAuth } from '@/contexts/AuthContext'
import { LogWearSheet } from './LogWearSheet'
import { PullToRefresh } from '../ui/PullToRefresh'
import { useSmartNotifications } from '@/hooks/useSmartNotifications'
import { useToast } from '@/contexts/ToastContext'
import { useOnboarding } from '@/hooks/useOnboarding'
import { supabase } from '@/lib/supabase'

/* ──────────────── Noir helpers: "The Morning Edition" voice ──────────────── */

/** "0" → "none", "1" → "one" … "20" → "twenty". Anything > 20 returns the digit as a word-string. */
function numberToWord(n: number): string {
  if (!Number.isFinite(n) || n < 0) return 'none'
  const small = [
    'none', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
    'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen',
    'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty',
  ]
  if (n <= 20) return small[n] ?? 'none'
  return String(n)
}

/** Capitalise the first letter of a prose string. */
function capitalise(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1)
}

/** Integer → lowercase roman numeral, capped at 'c' (100). */
function lowerRoman(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return ''
  const map: Array<[number, string]> = [
    [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'],
    [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i'],
  ]
  let out = ''
  let rem = Math.min(100, Math.floor(n))
  for (const [v, s] of map) {
    while (rem >= v) { out += s; rem -= v }
  }
  return out
}

/** Editorial masthead date: "Wednesday, xi April · MMXXVI" (italic treatment applied at render). */
function dateMasthead(d: Date): string {
  const weekday = d.toLocaleDateString('en-GB', { weekday: 'long' })
  const day = lowerRoman(d.getDate())
  const month = d.toLocaleDateString('en-GB', { month: 'long' })
  const year = yearToLargeRoman(d.getFullYear())
  return `${weekday}, ${day} ${month} · ${year}`
}

/** Full uppercase roman numeral (for years). */
function yearToLargeRoman(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return ''
  const map: Array<[number, string]> = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
    [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ]
  let out = ''
  let rem = Math.floor(n)
  for (const [v, s] of map) {
    while (rem >= v) { out += s; rem -= v }
  }
  return out
}

/** Streak headline — "Eleven days on the run." / "No streak yet." */
function streakHeadline(streak: number): string {
  if (streak <= 0) return 'No streak yet.'
  if (streak === 1) return 'One day on the run.'
  return `${capitalise(numberToWord(streak))} days on the run.`
}

/** Month wears headline — "Twenty-three wears this month." */
function wearsHeadline(n: number): string {
  if (n <= 0) return 'No wears filed this month.'
  if (n === 1) return 'One wear this month.'
  return `${capitalise(numberToWord(n))} wears this month.`
}

/** Relative time prose: "three hours ago" / "six hours ago" / "two days ago". */
function timeAgoProse(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'moments ago'
  if (mins < 60) return `${numberToWord(mins)} minute${mins === 1 ? '' : 's'} ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${numberToWord(hrs)} hour${hrs === 1 ? '' : 's'} ago`
  const days = Math.floor(hrs / 24)
  return `${numberToWord(days)} day${days === 1 ? '' : 's'} ago`
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

/* ──────────────── Community Buzz (dispatches) data hook ──────────────── */

interface BuzzItem {
  id: string
  user_name: string
  fragrance_name: string
  fragrance_brand: string
  created_at: string
  rating?: number
}

function useCommunityBuzz(limit = 3): { buzz: BuzzItem[]; loaded: boolean } {
  const [buzz, setBuzz] = useState<BuzzItem[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function fetch() {
      const items: BuzzItem[] = []
      try {
        const { data } = await supabase
          .from('reviews')
          .select('id, overall_rating, created_at, user_id, fragrance:fragrances(name, brand)')
          .not('review_text', 'is', null)
          .order('created_at', { ascending: false })
          .limit(limit + 2)

        type Row = {
          id: string
          overall_rating: number
          created_at: string
          user_id: string
          fragrance: { name: string; brand: string } | null
        }
        const rows = (data ?? []) as unknown as Row[]
        const userIds = [...new Set(rows.map((r) => r.user_id))]
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name')
          .in('id', userIds)
        type P = { id: string; display_name: string }
        const pMap = new Map<string, string>()
        for (const p of (profiles ?? []) as P[]) pMap.set(p.id, p.display_name)

        for (const r of rows) {
          if (!r.fragrance) continue
          items.push({
            id: `r-${r.id}`,
            user_name: pMap.get(r.user_id) ?? 'A keeper',
            fragrance_name: r.fragrance.name,
            fragrance_brand: r.fragrance.brand,
            created_at: r.created_at,
            rating: r.overall_rating,
          })
        }
      } catch {
        /* swallow — dispatches are optional furniture */
      }

      if (!cancelled) {
        setBuzz(items.slice(0, limit))
        setLoaded(true)
      }
    }
    fetch()
    return () => {
      cancelled = true
    }
  }, [limit])

  return { buzz, loaded }
}

/* ──────────────── The Morning Edition ──────────────── */

export function HomeScreen() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: trending, loading, error: trendingError, retry: retryTrending } = useTrendingFragrances(4)
  const { stats, retry: retryStats } = useHomeStats(user?.id)
  const [logSheetOpen, setLogSheetOpen] = useState(false)

  // Redirect to onboarding if user hasn't completed it
  const onboarding = useOnboarding()
  useEffect(() => {
    if (onboarding.needsOnboarding) {
      navigate('/onboarding', { replace: true })
    }
  }, [onboarding.needsOnboarding, navigate])

  // Generate smart notifications on home screen load
  useSmartNotifications()

  // One-time migration nudge: existing users learn that Stats / Scent DNA moved to Signature.
  // New users (created on or after the IA refactor cutover) never see it.
  const { showToast } = useToast()
  useEffect(() => {
    if (!user) return
    const FLAG = 'scentfolio.ia-refactor-toast.v1'
    if (typeof window === 'undefined') return
    if (window.localStorage.getItem(FLAG)) return
    const created = user.created_at ? new Date(user.created_at) : null
    const cutover = new Date('2026-04-15T00:00:00Z')
    if (!created || created >= cutover) {
      window.localStorage.setItem(FLAG, '1')
      return
    }
    const t = window.setTimeout(() => {
      showToast('Stats & Scent DNA moved to Signature ↓', 'info', '✦')
      window.localStorage.setItem(FLAG, '1')
    }, 1200)
    return () => window.clearTimeout(t)
  }, [user, showToast])

  // Dispatches feed (absorbs CommunityBuzzWidget)
  const { buzz, loaded: buzzLoaded } = useCommunityBuzz(3)

  const displayName = user?.user_metadata?.display_name || 'fragrance lover'
  const firstName = displayName.split(' ')[0]

  const handleRefresh = useCallback(async () => {
    retryTrending()
    retryStats()
  }, [retryTrending, retryStats])

  const handleHeroAction = useCallback(() => {
    if (!user) {
      navigate('/profile')
      return
    }
    setLogSheetOpen(true)
  }, [user, navigate])

  // Four milestone ranks: iii / vii / xiv / xxx
  const milestones: Array<{ days: number; roman: string }> = [
    { days: 3, roman: lowerRoman(3) },
    { days: 7, roman: lowerRoman(7) },
    { days: 14, roman: lowerRoman(14) },
    { days: 30, roman: lowerRoman(30) },
  ]

  // Concierge entries — italic serif lower-roman index + italic serif label
  const concierge: Array<{ index: string; label: string; to: string }> = [
    { index: 'i', label: "Today's suggestion.", to: '/daily' },
    { index: 'ii', label: 'Weather pairing.', to: '/weather' },
    { index: 'iii', label: 'Quick rating.', to: '/quick-rate' },
    { index: 'iv', label: 'The keeper\u2019s picks.', to: '/wear-predictions' },
  ]

  // Daily Brief prose — conditional on whether the keeper has anything underway
  const collectionStarted = stats.owned > 0 || stats.wishlist > 0
  const reviewsStarted = stats.reviews > 0
  const dailyBriefProse: string = !collectionStarted
    ? 'Your folio awaits its first entry. We invite you to shelve a fragrance you already keep, or to pencil in one you long for. The archive begins the moment you do.'
    : !reviewsStarted
    ? 'Your shelves are taking shape. When the mood strikes, file an appreciation of a bottle you know well — even a single line helps the editors build your sensory profile.'
    : 'Three steps remain to refine your sensory profile. A note on your preferred base notes, a thought on vintage reformulations, and an autumn curation await your attention.'

  // Editorial style constants — noir ambient lifts + gradient hairlines (no 1px borders)
  const ambientGlow = {
    position: 'absolute' as const,
    width: 300,
    height: 300,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(229,194,118,0.07) 0%, transparent 70%)',
    filter: 'blur(80px)',
    pointerEvents: 'none' as const,
  }
  const hairline = {
    height: 1,
    background:
      'linear-gradient(to right, rgba(229,194,118,0.4) 0%, rgba(229,194,118,0.1) 40%, transparent 100%)',
  }
  const verticalHairline = {
    width: 1,
    background:
      'linear-gradient(to bottom, transparent 0%, rgba(229,194,118,0.25) 40%, rgba(229,194,118,0.1) 70%, transparent 100%)',
  }

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <main className="relative pt-24 pb-32 px-6 space-y-20 overflow-hidden">
        {/* ambient gold lifts */}
        <div style={{ ...ambientGlow, top: -120, left: -120 }} />
        <div style={{ ...ambientGlow, top: 520, right: -140, opacity: 0.5 }} />
        <div style={{ ...ambientGlow, bottom: 80, left: -100, opacity: 0.35 }} />

        {/* ══════════ I. THE MASTHEAD ══════════ */}
        <header className="relative">
          <p className="font-label text-[0.65rem] uppercase tracking-[0.3em] text-primary/60 mb-3">
            THE MORNING EDITION
          </p>
          <h2 className="font-headline italic text-5xl md:text-6xl leading-[1.05] text-on-background mb-5">
            {getGreeting()}, {firstName}.
          </h2>
          <p className="font-headline italic text-base md:text-lg tracking-widest text-secondary/70">
            {dateMasthead(new Date())}
          </p>
          <div style={hairline} className="mt-10" />
        </header>

        {/* ══════════ II. THE FRONT PAGE ══════════ */}
        <section className="relative group">
          <div className="relative aspect-[4/5] md:aspect-[16/9] w-full overflow-hidden rounded-sm bg-surface-container-low">
            {trending[0]?.image_url ? (
              <img
                src={trending[0].image_url}
                alt="The front page"
                className="absolute inset-0 w-full h-full object-cover opacity-75 transition-transform duration-1000 group-hover:scale-[1.03]"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-surface-container to-surface-container-low" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
            <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-10">
              <p className="font-headline italic text-3xl md:text-5xl text-on-background mb-6 max-w-[18ch] leading-[1.1]">
                What will you wear today?
              </p>
              <div className="flex justify-start">
                <button
                  onClick={handleHeroAction}
                  className="px-7 py-3.5 text-on-primary-container font-label text-[0.7rem] font-bold tracking-[0.2em] uppercase hover:opacity-80 transition-all"
                  style={{
                    background: 'linear-gradient(45deg, #e5c276 0%, #c4a35a 100%)',
                    boxShadow: '0 12px 32px rgba(25,18,16,0.6)',
                  }}
                >
                  LOG TODAY&rsquo;S WEAR
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════ III. THE LEDGER ══════════ */}
        <section className="relative flex flex-col md:flex-row gap-10 md:gap-16 items-start">
          <button
            onClick={() => navigate('/wear-history')}
            className="text-left hover:opacity-80 transition-transform"
          >
            <p className="font-headline italic text-3xl md:text-4xl text-on-background mb-2 leading-tight">
              {streakHeadline(stats.streak)}
            </p>
            <p className="font-label text-[0.65rem] uppercase tracking-[0.2em] text-secondary/50">
              STREAK
            </p>
          </button>
          <div style={verticalHairline} className="self-stretch hidden md:block" />
          <button
            onClick={() => navigate('/wear-history')}
            className="text-left hover:opacity-80 transition-transform"
          >
            <p className="font-headline italic text-3xl md:text-4xl text-on-background mb-2 leading-tight">
              {wearsHeadline(stats.monthWears)}
            </p>
            <p className="font-label text-[0.65rem] uppercase tracking-[0.2em] text-secondary/50">
              THIS MONTH
            </p>
          </button>
        </section>

        {/* ══════════ IV. THE ASCENT ══════════ */}
        <section>
          <h3 className="font-headline italic text-2xl text-on-background mb-10">
            The four milestones.
          </h3>
          <div className="relative flex justify-between items-center max-w-2xl mx-auto py-6">
            <div
              className="absolute inset-x-0"
              style={{
                height: 1,
                background:
                  'linear-gradient(to right, transparent 0%, rgba(229,194,118,0.3) 20%, rgba(229,194,118,0.3) 80%, transparent 100%)',
              }}
            />
            {milestones.map((m) => {
              const achieved = stats.streak >= m.days
              return (
                <div key={m.days} className="relative flex flex-col items-center gap-4">
                  <div
                    className={`w-3 h-3 rounded-full ${achieved ? 'bg-primary' : 'bg-primary/30'}`}
                    style={
                      achieved
                        ? { boxShadow: '0 0 12px rgba(229,194,118,0.55)' }
                        : undefined
                    }
                  />
                  <span
                    className={`font-headline italic text-base ${
                      achieved ? 'text-primary' : 'text-secondary/40'
                    }`}
                  >
                    {m.roman}
                  </span>
                </div>
              )
            })}
          </div>
        </section>

        {/* ══════════ V. THE HOUSE ══════════ */}
        <section>
          <div style={hairline} className="mb-10" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            <div className="p-6 bg-surface-container-low transition-colors hover:bg-surface-container rounded-sm">
              <p className="font-label text-[0.65rem] uppercase tracking-[0.2em] text-secondary/50 mb-3">
                OWNED
              </p>
              <p className="font-headline italic text-3xl text-on-background">
                {numberToWord(stats.owned)}.
              </p>
            </div>
            <button
              onClick={() => navigate('/wishlist')}
              className="p-6 bg-surface-container-low transition-colors hover:bg-surface-container rounded-sm text-left hover:opacity-80"
            >
              <p className="font-label text-[0.65rem] uppercase tracking-[0.2em] text-secondary/50 mb-3">
                WISHLIST
              </p>
              <p className="font-headline italic text-3xl text-on-background">
                {numberToWord(stats.wishlist)}.
              </p>
            </button>
            <div className="p-6 bg-surface-container-low transition-colors hover:bg-surface-container rounded-sm">
              <p className="font-label text-[0.65rem] uppercase tracking-[0.2em] text-secondary/50 mb-3">
                APPRECIATIONS
              </p>
              <p className="font-headline italic text-3xl text-on-background">
                {numberToWord(stats.reviews)}.
              </p>
            </div>
            <button
              onClick={() => navigate('/boards')}
              className="p-6 bg-surface-container-low transition-colors hover:bg-surface-container rounded-sm text-left hover:opacity-80"
            >
              <p className="font-label text-[0.65rem] uppercase tracking-[0.2em] text-secondary/50 mb-3">
                BOARDS
              </p>
              <p className="font-headline italic text-3xl text-on-background">
                {numberToWord(stats.boards)}.
              </p>
            </button>
          </div>
        </section>

        {/* ══════════ VI. THE DAILY BRIEF ══════════ */}
        <section className="max-w-2xl">
          <div style={hairline} className="mb-10" />
          <p className="font-headline italic text-2xl md:text-3xl text-on-background leading-relaxed">
            {dailyBriefProse}{' '}
            <button
              onClick={() => navigate('/search')}
              className="text-primary not-italic hover:underline underline-offset-4 decoration-primary/40 transition-colors"
            >
              begin.
            </button>
          </p>
        </section>

        {/* ══════════ VII. THE CONCIERGE ══════════ */}
        <section>
          <div style={hairline} className="mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 md:gap-x-24">
            {concierge.map((entry) => (
              <button
                key={entry.index}
                onClick={() => navigate(entry.to)}
                className="group flex items-center justify-between py-5 md:py-6 text-left hover:opacity-80 transition-transform"
              >
                <div className="flex items-center gap-6 md:gap-8">
                  <span className="font-headline italic text-primary text-lg w-6" style={{ fontVariantLigatures: 'none', fontFeatureSettings: '"liga" 0, "dlig" 0, "clig" 0, "hlig" 0' }}>
                    {entry.index}
                  </span>
                  <span className="font-headline italic text-xl md:text-2xl text-on-background">
                    {entry.label}
                  </span>
                </div>
                <span className="text-primary text-xl md:text-2xl transform transition-transform group-hover:translate-x-2 group-active:translate-x-1">
                  &rarr;
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* ══════════ VIII. THE DISPATCHES ══════════ */}
        <section>
          <div className="flex justify-between items-baseline mb-10">
            <h3 className="font-label text-[0.65rem] uppercase tracking-[0.3em] text-secondary/60">
              THE DISPATCHES
            </h3>
            <button
              onClick={() => navigate('/community')}
              className="font-label text-[0.65rem] uppercase tracking-[0.2em] text-primary hover:opacity-80 hover:opacity-80 transition"
            >
              the full wire &rarr;
            </button>
          </div>

          {!buzzLoaded ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-8 rounded-sm bg-surface-container-low animate-pulse max-w-2xl" />
              ))}
            </div>
          ) : buzz.length === 0 ? (
            <p className="font-headline italic text-xl text-secondary/50 max-w-2xl leading-relaxed">
              The wire is quiet this morning. Check back after the first dispatches are filed.
            </p>
          ) : (
            <div className="space-y-6">
              {buzz.map((item) => (
                <button
                  key={item.id}
                  onClick={() => navigate('/community')}
                  className="block text-left w-full max-w-3xl hover:opacity-80 transition-transform"
                >
                  <p className="font-body text-lg md:text-xl text-on-background/90 leading-relaxed">
                    <span className="italic">{item.user_name}</span>
                    {' filed an appreciation of '}
                    <span className="italic text-primary/90">{item.fragrance_name}</span>
                    <span className="text-secondary/60">
                      {' ('}{item.fragrance_brand}{')'}
                    </span>
                    {' \u2014 '}
                    <span className="italic text-secondary/60">{timeAgoProse(item.created_at)}</span>.
                  </p>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* ══════════ IX. THE FOLIO ══════════ */}
        <section>
          <div className="flex justify-between items-baseline mb-10">
            <h3 className="font-headline italic text-3xl text-on-background">The Folio.</h3>
            <button
              onClick={() => navigate('/search')}
              className="font-label text-[0.65rem] uppercase tracking-[0.2em] text-primary hover:opacity-80 hover:opacity-80 transition"
            >
              the full archive &rarr;
            </button>
          </div>

          {trendingError ? (
            <InlineError message="Couldn&rsquo;t load the folio" onRetry={retryTrending} />
          ) : loading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5 md:gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="aspect-[3/4] rounded-sm bg-surface-container-low animate-pulse"
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5 md:gap-6">
              {trending.map((frag) => (
                <button
                  key={frag.id}
                  onClick={() => navigate(`/fragrance/${frag.id}`)}
                  className="flex flex-col gap-3 text-left group"
                >
                  <div className="aspect-[3/4] overflow-hidden rounded-sm bg-surface-container-low">
                    {frag.image_url ? (
                      <img
                        src={frag.image_url}
                        alt={frag.name}
                        className="w-full h-full object-cover transition-all duration-700"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-secondary/30 font-headline italic text-4xl">
                        &middot;
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="font-label text-[0.6rem] uppercase tracking-[0.15em] text-primary/70">
                      {frag.brand}
                    </p>
                    <p className="font-headline italic text-lg text-on-background leading-tight truncate">
                      {frag.name}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Log Wear Sheet (opened from hero CTA — no specific fragrance pre-selected) */}
        <LogWearSheet isOpen={logSheetOpen} onClose={() => setLogSheetOpen(false)} />

        {/* Welcome onboarding for new users */}
        {user && <WelcomeOverlay userId={user.id} />}
      </main>
    </PullToRefresh>
  )
}
