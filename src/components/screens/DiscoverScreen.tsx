import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { fetchPersonalisedRecs } from '@/lib/taste-vector'
import { trackEvent, AnalyticsEvents } from '@/lib/analytics'
import type { Fragrance } from '@/types/database'

// ─────────────────────────────────────────────────────────────
// DiscoverScreen — "The Reading Room / Weekly Bulletin"
// Editorial reframe of discovery as a weekly fragrance gazette.
// Sections become "departments" with roman numerals and italic
// serif deks. Paper-stock rhythm alternates bg-surface and
// bg-surface-container-low between departments. No 1px lines,
// no pill fills — italic serif underlines only.
// ─────────────────────────────────────────────────────────────

interface CollectionItem {
  fragrance: Fragrance | null
  personal_rating: number | null
}

type SectionId = 'top-rated' | 'for-you' | 'for-you-teaser' | 'hidden-gems' | 'niche'

interface Section {
  id: SectionId
  items: Fragrance[]
  brand?: string
}

interface EditorialMeta {
  kicker: string
  dek: string
  showRatings: boolean
  dim?: boolean
}

const SECTION_COPY: Record<SectionId, EditorialMeta> = {
  'top-rated': {
    kicker: 'UNDER THE STARS',
    dek: 'The most revered, this week.',
    showRatings: true,
  },
  'for-you': {
    kicker: 'INSCRIBED FOR YOU',
    dek: 'A reading of your taste.',
    showRatings: true,
  },
  'for-you-teaser': {
    kicker: 'INSCRIBED FOR YOU',
    dek: 'A reading of your taste — unlocked at three fragrances.',
    showRatings: false,
  },
  'hidden-gems': {
    kicker: 'OBSCURA',
    dek: 'Highly regarded, quietly kept.',
    showRatings: false,
    dim: true,
  },
  'niche': {
    kicker: 'FROM THE HOUSE OF',
    dek: '',
    showRatings: true,
  },
}

const NOTE_FAMILY_PICKS = ['Woody', 'Floral', 'Oriental', 'Fresh', 'Citrus', 'Aromatic', 'Gourmand'] as const

// ── Editorial helpers ─────────────────────────────────────────

const ROMAN_TABLE: [number, string][] = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
  [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
  [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
]

function toRoman(n: number): string {
  if (n <= 0) return ''
  let out = ''
  let rem = n
  for (const [val, sym] of ROMAN_TABLE) {
    while (rem >= val) {
      out += sym
      rem -= val
    }
  }
  return out
}

const MONTHS = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
]

function getEditorialDate(): string {
  const d = new Date()
  const day = toRoman(d.getDate())
  const month = MONTHS[d.getMonth()]
  const year = toRoman(d.getFullYear())
  return day + ' ' + month + ' ' + year
}

function getIssueNumber(): string {
  // Week of the year, reset each January — keeps the masthead fresh.
  const d = new Date()
  const start = new Date(d.getFullYear(), 0, 1)
  const diff = (d.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  const week = Math.floor(diff / 7) + 1
  return 'VOL I · NO ' + toRoman(week)
}

// ── Helper components ─────────────────────────────────────────

interface ScentCardProps {
  frag: Fragrance
  showRating: boolean
  dimmed?: boolean
  onClick: () => void
}

function ScentCard({ frag, showRating, dimmed, onClick }: ScentCardProps) {
  const ratingStr = frag.rating
    ? Number(frag.rating).toFixed(1).replace('.', '·')
    : null

  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 w-[180px] text-left transition-opacity hover:opacity-80 ${
        dimmed ? 'opacity-75' : ''
      }`}
    >
      <div className="relative aspect-[3/4] rounded-sm overflow-hidden bg-surface-container-low">
        {frag.image_url ? (
          <img
            src={frag.image_url}
            alt={frag.name}
            className={`w-full h-full object-cover ${dimmed ? 'grayscale contrast-110' : ''}`}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-surface-container-highest" />
        )}

        {/* Bottom-to-top vignette for legibility of overlaid text */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(0deg, rgba(25,18,16,0.85) 0%, rgba(25,18,16,0) 50%)',
          }}
        />

        {showRating && ratingStr && (
          <span className="absolute top-3 right-3 font-headline italic text-primary text-xs tracking-widest">
            {ratingStr}
          </span>
        )}

        <div className="absolute left-3 right-3 bottom-3">
          <p className="text-[9px] uppercase tracking-[0.15em] font-label text-on-background/70 mb-1 truncate">
            {frag.brand}
          </p>
          <p className="font-headline italic text-[15px] leading-tight text-on-background truncate">
            {frag.name}
          </p>
        </div>
      </div>
    </button>
  )
}

interface EmptyWellProps {
  count?: number
  tall?: boolean
}

function EmptyWell({ count = 3, tall }: EmptyWellProps) {
  return (
    <div className="flex gap-4 overflow-hidden opacity-30">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`flex-shrink-0 w-[180px] rounded-sm bg-surface-container-low animate-pulse ${
            tall ? 'aspect-[3/4]' : 'aspect-square'
          }`}
        />
      ))}
    </div>
  )
}

interface DepartmentHeadingProps {
  numeral: string
  kicker: string
  dek: string
  dekIsBrand?: boolean
}

function DepartmentHeading({
  numeral,
  kicker,
  dek,
  dekIsBrand,
}: DepartmentHeadingProps) {
  return (
    <div className="flex items-baseline gap-4 px-6">
      <span className="font-headline italic text-primary/60 text-sm tracking-widest flex-shrink-0">
        {numeral}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-[0.18em] font-label text-on-background/60 mb-1">
          {kicker}
        </p>
        {dek && (dekIsBrand ? (
          <p className="font-headline italic text-primary text-2xl leading-tight truncate">
            {dek}
          </p>
        ) : (
          <p className="font-headline italic text-on-background/80 text-base leading-tight">
            {dek}
          </p>
        ))}
      </div>
    </div>
  )
}

interface IndexCardProps {
  numeral: string
  kicker: string
  headline: string
  dek: string
  onClick: () => void
}

function IndexCard({
  numeral,
  kicker,
  headline,
  dek,
  onClick,
}: IndexCardProps) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-start gap-4 px-6 py-5 text-left transition-opacity hover:opacity-80 group"
    >
      <span className="font-headline italic text-primary/50 text-xs tracking-widest flex-shrink-0 pt-1">
        {numeral}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-[0.18em] font-label text-on-background/60 mb-1">
          {kicker}
        </p>
        <p className="font-headline italic text-on-background text-lg leading-tight mb-1">
          {headline}
        </p>
        <p className="text-[11px] text-on-background/50">{dek}</p>
      </div>
      <span className="font-headline italic text-primary/70 text-xl leading-none pt-1 group-active:text-primary">
        ›
      </span>
    </button>
  )
}

// ── Main screen ───────────────────────────────────────────────

export function DiscoverScreen() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [sections, setSections] = useState<Section[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedFamily, setSelectedFamily] = useState<string>(NOTE_FAMILY_PICKS[0])
  const [familyResults, setFamilyResults] = useState<Fragrance[]>([])
  const [familyLoading, setFamilyLoading] = useState(false)

  useEffect(() => {
    fetchDiscovery()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function fetchDiscovery() {
    const sects: Section[] = []

    // 1. Top rated overall
    const { data: topRated } = await supabase
      .from('fragrances')
      .select('*')
      .not('rating', 'is', null)
      .order('rating', { ascending: false })
      .limit(10)

    if (topRated && topRated.length > 0) {
      sects.push({
        id: 'top-rated',
        items: topRated as Fragrance[],
      })
    }

    // 2. Hidden gems — high rated but fewer reviews
    const { data: hiddenGems } = await supabase
      .from('fragrances')
      .select('*')
      .gte('rating', 4.0)
      .order('rating', { ascending: false })
      .range(50, 70)

    if (hiddenGems && hiddenGems.length > 0) {
      sects.push({
        id: 'hidden-gems',
        items: hiddenGems as Fragrance[],
      })
    }

    // 3. Personalised picks (if logged in, ≥3 owned)
    if (user) {
      const { data: collData } = await supabase
        .from('user_collections')
        .select('personal_rating, fragrance:fragrances(*)')
        .eq('user_id', user.id)
        .eq('status', 'own')

      const coll = (collData ?? []) as unknown as CollectionItem[]
      const owned = coll
        .filter(c => c.fragrance)
        .map(c => ({ ...c.fragrance!, rating: c.personal_rating }))

      if (owned.length >= 3) {
        const personalised = await fetchPersonalisedRecs(owned, 10)

        if (personalised.length > 0) {
          sects.splice(1, 0, {
            id: 'for-you',
            items: personalised,
          })
        }
      } else {
        // Cold-start teaser: show the slot with a CTA explaining the 3-fragrance unlock.
        sects.splice(1, 0, {
          id: 'for-you-teaser',
          items: [],
        })
      }
    }

    // 4. Niche house spotlight
    const nicheHouses = [
      'Maison Francis Kurkdjian',
      'Le Labo',
      'Byredo',
      'Amouage',
      'Parfums de Marly',
      'Xerjoff',
    ]
    const randomNiche =
      nicheHouses[Math.floor(Math.random() * nicheHouses.length)]
    const { data: nicheData } = await supabase
      .from('fragrances')
      .select('*')
      .eq('brand', randomNiche)
      .order('rating', { ascending: false })
      .limit(10)

    if (nicheData && nicheData.length > 0) {
      sects.push({
        id: 'niche',
        items: nicheData as Fragrance[],
        brand: randomNiche,
      })
    }

    setSections(sects)
    setLoading(false)
  }

  // Family explore — loaded on demand
  useEffect(() => {
    setFamilyLoading(true)
    supabase
      .from('fragrances')
      .select('*')
      .eq('note_family', selectedFamily)
      .order('rating', { ascending: false, nullsFirst: false })
      .limit(12)
      .then(({ data }) => {
        setFamilyResults((data ?? []) as Fragrance[])
        setFamilyLoading(false)
      })
  }, [selectedFamily])

  const issueDate = getEditorialDate()
  const issueNumber = getIssueNumber()

  return (
    <main className="pb-32 max-w-[430px] mx-auto bg-surface text-on-background">
      {/* ── The Masthead ───────────────────────────────────── */}
      <section className="relative pt-28 pb-14 overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 60% 40% at 50% 30%, rgba(229,194,118,0.12) 0%, rgba(25,18,16,0) 70%)',
          }}
        />
        <div className="relative text-center">
          <p className="text-[10px] uppercase tracking-[0.2em] font-label text-on-background/50 mb-3">
            THE READING ROOM
          </p>
          <h1 className="font-headline italic text-primary text-3xl leading-none mb-4">
            The Weekly Bulletin
          </h1>
          <div className="flex items-center justify-center gap-3 text-[9px] uppercase tracking-[0.2em] font-label text-on-background/40">
            <span>{issueNumber}</span>
            <span className="text-primary/40">·</span>
            <span>{issueDate}</span>
          </div>
          <div className="mx-auto mt-6 w-10 h-px bg-primary/50" />
        </div>
      </section>

      {loading ? (
        <div className="px-6 py-8">
          <EmptyWell count={3} tall />
        </div>
      ) : (
        <>
          {/* ── Departments ─────────────────────────────────── */}
          {sections.map((section, idx) => {
            const copy = SECTION_COPY[section.id]
            const isNiche = section.id === 'niche'
            const isTeaser = section.id === 'for-you-teaser'
            const numeral = toRoman(idx + 1)
            const bgClass = idx % 2 === 0 ? 'bg-surface' : 'bg-surface-container-low'

            return (
              <section key={section.id} className={`${bgClass} py-14`}>
                <DepartmentHeading
                  numeral={numeral}
                  kicker={copy.kicker}
                  dek={isNiche ? (section.brand ?? '') : copy.dek}
                  dekIsBrand={isNiche}
                />
                {isTeaser ? (
                  <div className="mt-6 px-6">
                    <button
                      onClick={() => navigate('/search')}
                      className="w-full flex items-start gap-4 py-5 text-left transition-opacity hover:opacity-80 group"
                    >
                      <span className="font-headline italic text-primary/50 text-xs tracking-widest flex-shrink-0 pt-1">
                        {toRoman(idx + 2)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] uppercase tracking-[0.18em] font-label text-on-background/60 mb-1">
                          BEGIN THE READING
                        </p>
                        <p className="font-headline italic text-on-background text-lg leading-tight mb-1">
                          Add three fragrances to your wardrobe.
                        </p>
                        <p className="text-[11px] text-on-background/50">
                          A taste reading needs a little to read. Search for what you own.
                        </p>
                      </div>
                      <span className="font-headline italic text-primary/70 text-xl leading-none pt-1 group-active:text-primary">
                        ›
                      </span>
                    </button>
                  </div>
                ) : (
                  <div className="mt-8 flex gap-5 overflow-x-auto no-scrollbar px-6 pb-2">
                    {section.items.map((frag, fidx) => (
                      <ScentCard
                        key={frag.id}
                        frag={frag}
                        showRating={copy.showRatings}
                        dimmed={copy.dim}
                        onClick={() => {
                          if (section.id === 'for-you') {
                            trackEvent(AnalyticsEvents.RECOMMENDER_CLICK, {
                              source: 'discover_personalised',
                              position: fidx,
                              fragrance_id: frag.id,
                            })
                          }
                          navigate(`/fragrance/${frag.id}`)
                        }}
                      />
                    ))}
                  </div>
                )}
              </section>
            )
          })}

          {/* ── Dept N+1 · By Note Family ───────────────────── */}
          {(() => {
            const familyIdx = sections.length
            const bgClass =
              familyIdx % 2 === 0 ? 'bg-surface' : 'bg-surface-container-low'
            return (
              <section className={`${bgClass} py-14`}>
                <DepartmentHeading
                  numeral={toRoman(familyIdx + 1)}
                  kicker="BY NOTE FAMILY"
                  dek="The axes of the library."
                />

                {/* Family selector — italic serif tabs with gold underline */}
                <div className="mt-8 flex gap-6 overflow-x-auto no-scrollbar px-6 pb-2">
                  {NOTE_FAMILY_PICKS.map(f => {
                    const active = selectedFamily === f
                    return (
                      <button
                        key={f}
                        onClick={() => setSelectedFamily(f)}
                        className="flex-shrink-0 pb-2 transition-opacity hover:opacity-80"
                      >
                        <span
                          className={`font-headline italic text-lg transition-colors ${
                            active ? 'text-primary' : 'text-on-background/50'
                          }`}
                        >
                          {f}
                        </span>
                        <div
                          className={`mt-1 h-px transition-all ${
                            active ? 'bg-primary w-full' : 'bg-transparent w-0'
                          }`}
                        />
                      </button>
                    )
                  })}
                </div>

                {/* Family 3×3 grid, separated by gap-px hairlines */}
                {familyLoading ? (
                  <div className="mt-6 px-6">
                    <EmptyWell count={3} />
                  </div>
                ) : (
                  <div className="mt-6 grid grid-cols-3 gap-px bg-surface-container-low">
                    {familyResults.slice(0, 9).map(frag => (
                      <button
                        key={frag.id}
                        onClick={() => navigate(`/fragrance/${frag.id}`)}
                        className="relative aspect-square overflow-hidden bg-surface transition-opacity hover:opacity-80"
                      >
                        {frag.image_url ? (
                          <img
                            src={frag.image_url}
                            alt={frag.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full bg-surface-container-highest" />
                        )}
                        <div
                          className="absolute inset-0 pointer-events-none"
                          style={{
                            background:
                              'linear-gradient(0deg, rgba(25,18,16,0.9) 0%, rgba(25,18,16,0) 60%)',
                          }}
                        />
                        <p className="absolute bottom-2 left-2 right-2 font-headline italic text-on-background text-[11px] leading-tight truncate">
                          {frag.name}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            )
          })()}

          {/* ── Dept N+2 · More to Explore ──────────────────── */}
          {(() => {
            const exploreIdx = sections.length + 1
            const bgClass =
              exploreIdx % 2 === 0 ? 'bg-surface' : 'bg-surface-container-low'
            return (
              <section className={`${bgClass} py-14`}>
                <DepartmentHeading
                  numeral={toRoman(exploreIdx + 1)}
                  kicker="MORE TO EXPLORE"
                  dek="Further reading for the curious."
                />
                <div className="mt-4">
                  <IndexCard
                    numeral={toRoman(exploreIdx + 2)}
                    kicker="A MAP OF NOTES"
                    headline="Notes Explorer"
                    dek="Browse every single accord."
                    onClick={() => navigate('/notes')}
                  />
                  <IndexCard
                    numeral={toRoman(exploreIdx + 3)}
                    kicker="THE LAB"
                    headline="Layering Lab"
                    dek="Experiment with scent combinations."
                    onClick={() => navigate('/layering-lab')}
                  />
                  <IndexCard
                    numeral={toRoman(exploreIdx + 4)}
                    kicker="SEASONAL INDEX"
                    headline="Seasonal Picks"
                    dek="Fragrances chosen for the current air."
                    onClick={() => navigate('/seasonal')}
                  />
                </div>
              </section>
            )
          })()}

          {/* ── Colophon ────────────────────────────────────── */}
          <section className="pt-10 pb-6 text-center">
            <div className="mx-auto w-16 h-px bg-primary/40 mb-5" />
            <p className="text-[9px] uppercase tracking-[0.2em] font-label text-on-background/40 mb-2">
              THE READING ROOM · MMXXVI
            </p>
            <p className="font-headline italic text-on-background/50 text-xs">
              — An index of curiosities for the curious —
            </p>
          </section>
        </>
      )}
    </main>
  )
}
