/**
 * LandingPage — the public conversion surface for anonymous visitors at "/".
 *
 * Rebuilt 6 July 2026 (Fable5 Brief 3). The pre-launch page sold the app in
 * the abstract; this one demonstrates the Signature Audit — the Letterboxd
 * pattern of showing the artefact you'd create BEFORE you sign up
 * (Consumer-App-Growth-Deep-Research-04Jul2026 §2.2). Every element either
 * demonstrates the mechanic or routes to /auth with a UTM tag.
 *
 * Renders inside the app's 430px phone-frame column (App.tsx wraps all
 * routes) — desktop chrome comes free, do not add full-width layouts here.
 * Demo data is hard-coded (brief option A): the landing page is critical
 * path, so no DB dependency. It mirrors the DEMOsofia1 seeded audit so the
 * landing, the shareable demo URL and the OG tags all tell the same story.
 *
 * Copy register: noir editorial. No exclamation marks. British English.
 */

import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { trackEvent, AnalyticsEvents } from '@/lib/analytics'
import { CARD_COPY } from '@/lib/signature-audit'

const NOIR = '#191210'
const GOLD = '#e5c276'
const CREAM = '#e8e0d8'

// ── Demo audit data (copy — Dan eyeballs this before merge) ─────────────────
// Mirrors the DEMOsofia1 seed: same DNA split, twin, most-worn and season.
const DEMO = {
  ownerLine: 'An example — Sofia’s Signature, read from 47 logged wears.',
  personality: 'warm, deliberate, evening-first',
  families: [
    { family: 'Amber', pct: 42 },
    { family: 'Woody', pct: 31 },
    { family: 'Aromatic', pct: 27 },
  ],
  twin: {
    brand: 'Maison Francis Kurkdjian',
    name: 'Grand Soir',
    line: 'Same amber warmth as most of your shelf',
  },
  mostWorn: {
    brand: 'Parfums de Marly',
    name: 'Layton',
    line: '14 wears in the last 90 days · your top rotation',
  },
  season: {
    season: 'Winter',
    top: [
      { name: 'Layton', brand: 'Parfums de Marly' },
      { name: 'Tobacco Vanille', brand: 'Tom Ford' },
      { name: 'Herod', brand: 'Parfums de Marly' },
    ],
  },
} as const

const HERO_CTA_URL = '/auth?utm_source=landing_page&utm_medium=hero&utm_campaign=organic&mode=signup'
const FOOTER_CTA_URL = '/auth?utm_source=landing_page&utm_medium=footer&utm_campaign=organic'

// ── Shared fragments ─────────────────────────────────────────────────────────

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-label text-[10px] tracking-[0.3em] uppercase block" style={{ color: GOLD }}>
      {children}
    </span>
  )
}

/** Compact replica of a real audit card — reads as a screenshot of the app. */
function DemoCard({
  index,
  children,
  className = '',
}: {
  index: number
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={`relative rounded-sm px-6 pt-10 pb-9 overflow-hidden ${className}`}
      style={{
        backgroundColor: NOIR,
        border: `1px solid ${GOLD}33`,
        boxShadow: '0 24px 48px -16px rgba(0,0,0,0.7)',
      }}
    >
      <span
        className="absolute top-3.5 right-4 font-label text-[8px] tracking-[0.25em] uppercase"
        style={{ color: `${GOLD}66` }}
      >
        Card {index} of 6
      </span>
      {children}
      <span
        className="absolute bottom-3 inset-x-0 text-center font-headline font-bold text-[9px] tracking-[0.3em] uppercase"
        style={{ color: `${GOLD}59` }}
      >
        ScentFolio
      </span>
    </div>
  )
}

/** Card 1 — the hero visual. */
function DnaDemoCard() {
  return (
    <DemoCard index={1}>
      <span className="font-label text-[9px] tracking-[0.3em] uppercase block mb-3" style={{ color: GOLD }}>
        {CARD_COPY.dna.title}
      </span>
      <p className="font-headline italic text-lg mb-5" style={{ color: CREAM }}>
        {DEMO.personality}
      </p>
      <div className="space-y-3.5">
        {DEMO.families.map((f) => (
          <div key={f.family}>
            <div className="flex justify-between items-baseline mb-1">
              <span className="font-headline text-base" style={{ color: CREAM }}>{f.family}</span>
              <span className="font-label text-[11px] font-bold" style={{ color: GOLD }}>{f.pct}%</span>
            </div>
            <div className="h-[5px] rounded-sm" style={{ backgroundColor: `${GOLD}26` }}>
              <div className="h-full rounded-sm" style={{ width: `${f.pct}%`, backgroundColor: GOLD }} />
            </div>
          </div>
        ))}
      </div>
    </DemoCard>
  )
}

// ── The page ─────────────────────────────────────────────────────────────────

export function LandingPage() {
  const navigate = useNavigate()

  // Once per mount (ref-guarded so StrictMode's dev double-mount stays clean)
  const viewed = useRef(false)
  useEffect(() => {
    if (viewed.current) return
    viewed.current = true
    trackEvent(AnalyticsEvents.LANDING_PAGE_VIEWED, {
      referrer: document.referrer || null,
    })
  }, [])

  const goHero = () => {
    trackEvent(AnalyticsEvents.LANDING_HERO_CTA_CLICKED, {})
    navigate(HERO_CTA_URL)
  }
  const goFooter = () => {
    trackEvent(AnalyticsEvents.LANDING_FOOTER_CTA_CLICKED, {})
    navigate(FOOTER_CTA_URL)
  }

  return (
    <div className="min-h-screen font-body" style={{ backgroundColor: NOIR }}>
      {/* ── HERO — above the fold on 390×844 ── */}
      <section className="relative flex flex-col px-6 pt-6 pb-14">
        {/* Discreet sign-in for returning visitors */}
        <div className="flex justify-between items-center mb-8">
          <span className="font-headline font-bold text-sm tracking-tight" style={{ color: GOLD }}>
            ScentFolio
          </span>
          <button
            onClick={() => navigate('/auth')}
            className="font-label text-[10px] tracking-[0.2em] uppercase min-h-[44px] px-2"
            style={{ color: '#e8e0d899' }}
          >
            Sign in
          </button>
        </div>

        <Kicker>Your fragrance collection</Kicker>
        <h1 className="font-headline italic text-[2.6rem] leading-[1.05] mt-3" style={{ color: GOLD }}>
          Read like a horoscope.
        </h1>
        <p className="font-headline text-lg leading-snug mt-4 max-w-[320px]" style={{ color: CREAM }}>
          Log what you own. See what it says about you.
        </p>

        <button
          onClick={goHero}
          className="mt-6 w-full py-4 rounded-sm font-label text-[11px] font-bold uppercase tracking-[0.2em]"
          style={{ background: GOLD, color: NOIR }}
        >
          Generate mine — free
        </button>
        <a
          href="#example"
          className="mt-3 mb-7 text-center font-label text-[10px] tracking-[0.25em] uppercase min-h-[32px]"
          style={{ color: '#e8e0d899' }}
        >
          See a live example →
        </a>

        <DnaDemoCard />
        <p className="mt-3 text-center font-headline italic text-[11px]" style={{ color: '#e8e0d866' }}>
          {DEMO.ownerLine}
        </p>
      </section>

      {/* ── PREVIEW — what yours will look like ── */}
      <section id="example" className="px-6 py-16" style={{ borderTop: `1px solid ${GOLD}1a` }}>
        <Kicker>The Signature Audit</Kicker>
        <h2 className="font-headline text-[1.7rem] leading-tight mt-3 mb-4" style={{ color: CREAM }}>
          Six cards. Six things you didn’t know about your own shelf.
        </h2>
        <p className="font-headline italic text-sm leading-relaxed mb-8 max-w-[340px]" style={{ color: '#e8e0d8b3' }}>
          The Audit reads a collection the way a graphologist reads a signature — not what you own,
          but what you reach for. Six cards, drawn from your real wear log. Screenshot the ones that
          feel true.
        </p>

        {/* Horizontal-scroll gallery of Cards 2, 3 and 5 */}
        <div className="flex gap-4 overflow-x-auto pb-4 -mx-6 px-6 snap-x snap-mandatory">
          <div className="shrink-0 w-[240px] snap-start">
            <p className="font-label text-[9px] tracking-[0.2em] uppercase mb-2" style={{ color: '#e8e0d880' }}>
              The bottle your taste is asking for
            </p>
            <DemoCard index={2} className="min-h-[240px]">
              <span className="font-label text-[9px] tracking-[0.3em] uppercase block mb-4" style={{ color: GOLD }}>
                {CARD_COPY.twin.title}
              </span>
              <p className="font-label text-[9px] tracking-[0.25em] uppercase" style={{ color: '#e8e0d880' }}>
                {DEMO.twin.brand}
              </p>
              <h3 className="font-headline text-2xl mt-1 mb-3" style={{ color: CREAM }}>
                {DEMO.twin.name}
              </h3>
              <p className="font-label text-[10px] tracking-wide" style={{ color: GOLD }}>
                {DEMO.twin.line}
              </p>
            </DemoCard>
          </div>

          <div className="shrink-0 w-[240px] snap-start">
            <p className="font-label text-[9px] tracking-[0.2em] uppercase mb-2" style={{ color: '#e8e0d880' }}>
              Your actual signature, by the numbers
            </p>
            <DemoCard index={3} className="min-h-[240px]">
              <span className="font-label text-[9px] tracking-[0.3em] uppercase block mb-4" style={{ color: GOLD }}>
                {CARD_COPY.mostWorn.title}
              </span>
              <p className="font-label text-[9px] tracking-[0.25em] uppercase" style={{ color: '#e8e0d880' }}>
                {DEMO.mostWorn.brand}
              </p>
              <h3 className="font-headline text-2xl mt-1 mb-3" style={{ color: CREAM }}>
                {DEMO.mostWorn.name}
              </h3>
              <p className="font-label text-[10px] tracking-wide" style={{ color: GOLD }}>
                {DEMO.mostWorn.line}
              </p>
            </DemoCard>
          </div>

          <div className="shrink-0 w-[240px] snap-start">
            <p className="font-label text-[9px] tracking-[0.2em] uppercase mb-2" style={{ color: '#e8e0d880' }}>
              When you’re most yourself
            </p>
            <DemoCard index={5} className="min-h-[240px]">
              <span className="font-label text-[9px] tracking-[0.3em] uppercase block mb-3" style={{ color: GOLD }}>
                {CARD_COPY.season.title}
              </span>
              <h3 className="font-headline italic text-4xl mb-4" style={{ color: GOLD }}>
                {DEMO.season.season}
              </h3>
              <div className="space-y-1.5">
                {DEMO.season.top.map((b, idx) => (
                  <p key={b.name} className="font-headline text-sm" style={{ color: CREAM }}>
                    <span className="italic mr-2" style={{ color: '#e5c27699' }}>{['I', 'II', 'III'][idx]}</span>
                    {b.name}
                    <span className="font-label text-[8px] uppercase tracking-widest ml-1.5" style={{ color: '#e8e0d866' }}>
                      {b.brand}
                    </span>
                  </p>
                ))}
              </div>
            </DemoCard>
          </div>
        </div>
      </section>

      {/* ── WHY IT EXISTS ── */}
      <section className="px-6 py-16" style={{ borderTop: `1px solid ${GOLD}1a` }}>
        <Kicker>Why it exists</Kicker>
        <p className="font-headline text-xl leading-relaxed mt-5" style={{ color: CREAM }}>
          I built ScentFolio because I couldn’t answer a simple question about my own collection:
          what do I actually reach for, versus what’s on the shelf? Now I can. If you own more
          bottles than you wear, it might tell you something too.
        </p>
        <p className="font-label text-[10px] tracking-[0.2em] uppercase mt-4" style={{ color: '#e8e0d866' }}>
          — Dan, founder
        </p>

        <div className="grid grid-cols-3 gap-3 mt-12">
          {[
            ['I', 'Log wears'],
            ['II', 'Track collection'],
            ['III', 'See your Signature'],
          ].map(([numeral, label]) => (
            <div
              key={numeral}
              className="rounded-sm px-3 py-5 text-center"
              style={{ backgroundColor: '#e5c2760d', border: `1px solid ${GOLD}26` }}
            >
              <span className="font-headline italic text-xl block mb-2" style={{ color: GOLD }}>
                {numeral}
              </span>
              <span className="font-label text-[9px] tracking-[0.15em] uppercase leading-tight block" style={{ color: CREAM }}>
                {label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="px-6 py-16" style={{ borderTop: `1px solid ${GOLD}1a` }}>
        <div
          className="rounded-sm px-6 py-12 text-center"
          style={{ backgroundColor: '#e5c2760d', border: `1px solid ${GOLD}33` }}
        >
          <h2 className="font-headline italic text-3xl mb-8" style={{ color: CREAM }}>
            Ready to see yours?
          </h2>
          <button
            onClick={goFooter}
            className="w-full py-4 rounded-sm font-label text-[11px] font-bold uppercase tracking-[0.2em]"
            style={{ background: GOLD, color: NOIR }}
          >
            Generate my Signature Audit
          </button>
          <p className="font-label text-[9px] tracking-[0.2em] uppercase mt-5" style={{ color: '#e8e0d866' }}>
            Free · No card required · Delete any time
          </p>
        </div>

        {/* Legal footer */}
        <div className="mt-12 flex flex-col items-center gap-3">
          <div className="flex gap-8">
            <button
              onClick={() => navigate('/privacy')}
              className="font-label text-[9px] tracking-[0.2em] uppercase min-h-[32px]"
              style={{ color: '#e8e0d880' }}
            >
              Privacy
            </button>
            <button
              onClick={() => navigate('/terms')}
              className="font-label text-[9px] tracking-[0.2em] uppercase min-h-[32px]"
              style={{ color: '#e8e0d880' }}
            >
              Terms
            </button>
          </div>
          <p className="font-label text-[9px] tracking-[0.25em] uppercase" style={{ color: '#e8e0d840' }}>
            © {new Date().getFullYear()} ScentFolio
          </p>
        </div>
      </section>
    </div>
  )
}
