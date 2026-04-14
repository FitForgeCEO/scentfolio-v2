import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthScreen } from './AuthScreen'
import { supabase } from '@/lib/supabase'
import { trackEvent, AnalyticsEvents } from '@/lib/analytics'

/* ═══════════════════════════════════════════
   THE DIGITAL SOMMELIER — LANDING PAGE
   An editorial invitation in four movements.
   ═══════════════════════════════════════════ */

/* ─── Animated counter ─── */
function AnimatedCount({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const started = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true
        const duration = 1200
        const startTime = performance.now()
        const animate = (now: number) => {
          const progress = Math.min((now - startTime) / duration, 1)
          const eased = 1 - Math.pow(1 - progress, 3)
          setCount(Math.round(eased * target))
          if (progress < 1) requestAnimationFrame(animate)
        }
        requestAnimationFrame(animate)
      }
    }, { threshold: 0.3 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [target])

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>
}

/* ─── Editorial chapter heading ─── */
function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-label text-[10px] tracking-[0.3em] text-primary uppercase block">
      {children}
    </span>
  )
}

/* ─── Ghost hairline rule ─── */
function Hairline() {
  return (
    <div className="h-px bg-gradient-to-r from-primary/40 via-primary/10 to-transparent" />
  )
}

/* ─── Editorial feature entry (roman numeral) ─── */
function FeatureEntry({ numeral, title, description, delay }: { numeral: string; title: string; description: string; delay: number }) {
  const [visible, setVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect() }
    }, { threshold: 0.2 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={`group transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <span className="font-headline italic text-sm text-primary block mb-3">{numeral}</span>
      <h3 className="font-headline text-2xl md:text-3xl text-on-surface mb-3 group-hover:translate-x-2 transition-transform duration-500">
        {title}
      </h3>
      <p className="text-secondary text-sm leading-relaxed max-w-md">{description}</p>
    </div>
  )
}

/* ─── Ledger row ─── */
function LedgerRow({ label }: { label: string }) {
  return (
    <div className="flex justify-between items-end pb-4">
      <span className="font-label text-[10px] tracking-[0.2em] text-secondary uppercase">{label}</span>
      <span className="font-headline italic text-xs text-primary">ENROLLED</span>
      <div className="absolute bottom-0 left-0 right-0 h-px bg-primary/15" />
    </div>
  )
}

/* ─── Editorial testimonial ─── */
function Blockquote({ quote, name, role, align = 'left' }: { quote: string; name: string; role: string; align?: 'left' | 'right' }) {
  return (
    <blockquote className={align === 'right' ? 'text-right' : ''}>
      <p className="font-headline text-2xl md:text-4xl italic leading-tight text-on-surface mb-6">
        &ldquo;{quote}&rdquo;
      </p>
      <cite className="font-label text-[10px] tracking-[0.2em] text-primary uppercase not-italic">
        — {name}, {role}
      </cite>
    </blockquote>
  )
}

/* ─── Clarification (FAQ) ─── */
function Clarification({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="group relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex justify-between items-center py-8 text-left min-h-[44px]"
      >
        <span className="font-headline text-lg md:text-xl text-on-surface pr-4">{question}</span>
        <span>+</span>
      </button>
      <div className={`overflow-hidden transition-all duration-500 ${open ? 'max-h-60 pb-8' : 'max-h-0'}`}>
        <p className="text-secondary text-sm leading-relaxed max-w-2xl">{answer}</p>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-primary/25 via-primary/8 to-transparent" />
    </div>
  )
}

/* ─── Editorial phone mockup (product view) ─── */
function EditorialPhone() {
  const shelves = ['TF', 'MFK', 'D', 'SL']
  return (
    <div
      className="relative mx-auto w-[280px] md:w-[340px] aspect-[340/700] rounded-[3rem] bg-surface-container p-4"
      style={{
        boxShadow: '0 32px 64px -12px rgba(25,18,16,0.7), inset 0 0 0 8px #3c3330',
      }}
    >
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex justify-between items-center mb-8 px-3 pt-4">
          <span className="font-headline italic text-lg text-on-surface">Shelf</span>
          <span className="text-primary text-lg">⌕</span>
        </div>
        <div className="grid grid-cols-2 gap-4 px-1">
          {shelves.map(label => (
            <div
              key={label}
              className="aspect-[3/4] bg-surface-container-low rounded-sm flex items-center justify-center p-6 relative overflow-hidden"
            >
              <span className="font-headline text-4xl italic text-on-surface/40">{label}</span>
              <div className="absolute top-0 left-0 right-0 h-px bg-primary/10" />
            </div>
          ))}
        </div>
      </div>
      {/* Ambient glow behind device */}
      <div className="absolute -z-10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[260px] h-[420px] rounded-full bg-primary/8 blur-[80px] pointer-events-none" />
    </div>
  )
}

/* ═══════════════════════════════════════════
   LANDING PAGE — main
   ═══════════════════════════════════════════ */
export function LandingPage() {
  const navigate = useNavigate()
  const [showAuth, setShowAuth] = useState(false)
  const [fragranceCount, setFragranceCount] = useState(2700)
  const [userCount, setUserCount] = useState(0)
  const [wearCount, setWearCount] = useState(0)

  // Fetch real stats (kept from v1)
  useEffect(() => {
    supabase
      .from('fragrances')
      .select('id', { count: 'exact', head: true })
      .then(({ count }) => { if (count) setFragranceCount(count) })

    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .then(({ count }) => { if (count) setUserCount(count) })

    supabase
      .from('wear_logs')
      .select('id', { count: 'exact', head: true })
      .then(({ count }) => { if (count) setWearCount(count) })
  }, [])

  if (showAuth) {
    return (
      <div className="min-h-screen bg-background">
        <button
          onClick={() => setShowAuth(false)}
          className="fixed top-6 left-6 z-50 w-11 h-11 rounded-full bg-surface-container flex items-center justify-center"
          style={{ boxShadow: '0 12px 32px rgba(25,18,16,0.6)' }}
          aria-label="Back to landing page"
        >
          <span className="text-primary text-lg">←</span>
        </button>
        <AuthScreen />
      </div>
    )
  }

  const openAuth = (cta: string) => {
    trackEvent(AnalyticsEvents.LANDING_CTA_CLICK, { cta })
    setShowAuth(true)
  }

  const ledgerEntries = [
    'DECANT TRACKER', 'WISHLIST SYNC', 'BATCH CODE SCAN', 'WEAR FREQUENCY',
    'HOUSE ARCHIVES', 'OFFLINE MODE', 'PRICE ANALYSIS', 'COMMUNITY SWAPS',
    'NOTE BREAKDOWN', 'CURATION AI', 'SEASONAL GUIDES', 'SCENT JOURNAL',
  ]

  return (
    <div className="min-h-screen bg-background overflow-x-hidden font-body">
      {/* ─── GLASS HEADER ─── */}
      <header className="fixed top-0 inset-x-0 z-50 glass-surface">
        <div className="max-w-6xl mx-auto flex justify-between items-center px-6 md:px-10 py-6">
          <div className="flex items-center gap-4">
            <span className="text-primary text-xl">☰</span>
            <span className="font-label text-[10px] tracking-[0.25em] text-primary uppercase hidden sm:inline">
              An Invitation · For Collectors
            </span>
          </div>
          <nav className="hidden md:flex gap-12 items-center">
            <a href="#prologue" className="font-label text-[11px] tracking-[0.2em] text-primary uppercase hover:text-on-surface transition-colors">Catalogue</a>
            <a href="#features" className="font-label text-[11px] tracking-[0.2em] text-secondary uppercase hover:text-on-surface transition-colors">Archive</a>
            <a href="#society" className="font-label text-[11px] tracking-[0.2em] text-secondary uppercase hover:text-on-surface transition-colors">Society</a>
          </nav>
          <button
            onClick={() => openAuth('header_sign_in')}
            className="font-label text-[11px] tracking-[0.2em] text-primary uppercase hover:text-on-surface transition-colors"
          >
            Sign In
          </button>
        </div>
      </header>

      <main className="pt-24">
        {/* ─── HERO ─── */}
        <section className="relative min-h-[90vh] flex flex-col items-center justify-center text-center px-6 overflow-hidden bg-surface">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[420px] h-[420px] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />
          <div className="relative z-10 max-w-4xl animate-page-enter">
            <Kicker>An Invitation · For Collectors</Kicker>
            <span className="font-headline text-[12rem] md:text-[16rem] leading-none text-primary opacity-20 select-none block mt-10">
              S
            </span>
            <h1 className="font-headline text-6xl md:text-8xl tracking-tight text-on-surface -mt-24 md:-mt-32 mb-6">
              ScentFolio
            </h1>
            <p className="font-headline italic text-xl md:text-2xl text-secondary max-w-xl mx-auto opacity-80">
              Chronicle your collection. Map your taste. Discover what's next.
            </p>
            <div className="mt-16 flex flex-col items-center gap-4">
              <button
                onClick={() => openAuth('hero_open_volume')}
                className="gold-gradient text-surface font-label font-bold text-xs tracking-[0.2em] uppercase px-10 py-4 rounded-sm hover:scale-[1.03] transition-all"
                style={{ boxShadow: '0 32px 64px -12px rgba(25,18,16,0.6)' }}
              >
                Open Your Volume
              </button>
              <button
                onClick={() => document.getElementById('prologue')?.scrollIntoView({ behavior: 'smooth' })}
                className="font-label text-[10px] tracking-[0.25em] text-secondary uppercase hover:text-primary transition-colors"
              >
                Read the Prologue ↓
              </button>
            </div>
          </div>
        </section>

        {/* ─── PROLOGUE (Editor's Note) ─── */}
        <section id="prologue" className="py-24 md:py-32 px-6 bg-surface-container-low">
          <div className="max-w-3xl mx-auto">
            <Kicker>The Prologue</Kicker>
            <div className="mt-12">
              <p className="font-headline text-2xl md:text-4xl leading-relaxed text-on-surface">
                To collect is to remember. With a growing archive of{' '}
                <span className="text-primary italic">
                  <AnimatedCount target={fragranceCount} suffix="+" /> fragrances
                </span>
                , ScentFolio provides the architecture for your sensory journey. We have meticulously indexed every note — from the smokiest Oud to the most fragile Bergamot — ensuring your personal library is as exquisite as the liquids it contains.
              </p>
            </div>
          </div>
        </section>

        {/* ─── PRODUCT VIEW (editorial phone) ─── */}
        <section className="py-24 md:py-32 px-6 bg-surface overflow-hidden">
          <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-16 md:gap-20 items-center">
            <div className="order-2 md:order-1">
              <EditorialPhone />
            </div>
            <div className="order-1 md:order-2 space-y-8">
              <Kicker>The Shelf</Kicker>
              <h2 className="font-headline text-4xl md:text-5xl leading-tight text-on-surface">
                Your collection,<br />
                <span className="italic text-primary">digitally distilled.</span>
              </h2>
              <p className="text-secondary text-base leading-relaxed max-w-md">
                Organise by house, season or mood. Our interface is designed to disappear, leaving only your curation at the forefront.
              </p>
            </div>
          </div>
        </section>

        {/* ─── FEATURES (four movements, asymmetric) ─── */}
        <section id="features" className="py-24 md:py-32 px-6 bg-surface-container-low">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-20">
              <Kicker>The Movements</Kicker>
              <h2 className="font-headline text-4xl md:text-5xl text-on-surface mt-4">
                Four chapters of <span className="italic text-primary">curation.</span>
              </h2>
            </div>
            <div className="grid md:grid-cols-2 gap-16 md:gap-24">
              <div className="space-y-16">
                <FeatureEntry
                  numeral="I."
                  title="The Catalogue"
                  description="Thousands of fragrances with verified notes, sillage and longevity — searchable, not buried."
                  delay={0}
                />
                <FeatureEntry
                  numeral="II."
                  title="The Layering Bench"
                  description="Discover pairings that work — combinations rated and refined by collectors."
                  delay={100}
                />
              </div>
              <div className="space-y-16 mt-12 md:mt-32">
                <FeatureEntry
                  numeral="III."
                  title="Scent Mapping"
                  description="See your taste at a glance — the notes you favour, the families you lean on, the gaps worth exploring."
                  delay={200}
                />
                <FeatureEntry
                  numeral="IV."
                  title="The Private Archive"
                  description="Journal your daily wears, track performance, and keep the memories scent leaves behind."
                  delay={300}
                />
              </div>
            </div>
          </div>
        </section>

        {/* ─── THE SOCIETY LEDGER (12 items) ─── */}
        <section id="society" className="py-24 md:py-32 px-6 bg-surface">
          <div className="max-w-4xl mx-auto">
            <h2 className="font-headline text-4xl md:text-5xl mb-16 text-center italic text-on-surface">
              The Society Ledger
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-20 gap-y-10">
              {ledgerEntries.map(label => (
                <div key={label} className="relative">
                  <LedgerRow label={label} />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── COMPARISON ─── */}
        <section className="py-24 md:py-32 px-6 bg-surface-container-low">
          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-2">
              <div className="p-10 md:p-12 bg-surface relative">
                <h3 className="font-headline text-2xl mb-10 italic text-primary">ScentFolio</h3>
                <ul className="space-y-6 text-sm tracking-wide text-on-surface">
                  <li className="flex items-center gap-4"><span className="text-primary text-base">✓</span>Editorial layouts</li>
                  <li className="flex items-center gap-4"><span className="text-primary text-base">✓</span>Scientific note weighting</li>
                  <li className="flex items-center gap-4"><span className="text-primary text-base">✓</span>Ad-free environment</li>
                  <li className="flex items-center gap-4"><span className="text-primary text-base">✓</span>High-fidelity assets</li>
                  <li className="flex items-center gap-4"><span className="text-primary text-base">✓</span>Works offline</li>
                  <li className="flex items-center gap-4"><span className="text-primary text-base">✓</span>Free, forever</li>
                </ul>
                <div className="absolute top-0 right-0 bottom-0 w-px bg-gradient-to-b from-primary/20 via-primary/5 to-transparent hidden md:block" />
              </div>
              <div className="p-10 md:p-12 bg-surface-container opacity-60">
                <h3 className="font-headline text-2xl mb-10 italic text-on-surface">The Others</h3>
                <ul className="space-y-6 text-sm tracking-wide text-secondary">
                  <li className="flex items-center gap-4"><span className="text-error text-base">✕</span>Cluttered interfaces</li>
                  <li className="flex items-center gap-4"><span className="text-error text-base">✕</span>User-only data</li>
                  <li className="flex items-center gap-4"><span className="text-error text-base">✕</span>Heavy advertising</li>
                  <li className="flex items-center gap-4"><span className="text-error text-base">✕</span>Static spreadsheets</li>
                  <li className="flex items-center gap-4"><span className="text-error text-base">✕</span>No layering tools</li>
                  <li className="flex items-center gap-4"><span className="text-error text-base">✕</span>Paywalls everywhere</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ─── THE METHODOLOGY ─── */}
        <section className="py-24 md:py-32 px-6 bg-surface">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-20">
              <Kicker>The Methodology</Kicker>
              <h2 className="font-headline text-4xl md:text-5xl text-on-surface mt-4">
                Three acts of <span className="italic text-primary">refinement.</span>
              </h2>
            </div>
            <div className="grid md:grid-cols-3 gap-12 md:gap-16">
              {[
                { numeral: 'I.', title: 'Capture', copy: 'Import your existing collection through our streamlined interface or search our editorial database.' },
                { numeral: 'II.', title: 'Analyse', copy: 'Our engine breaks down your collection into scent families, performance tiers and occasion fit.' },
                { numeral: 'III.', title: 'Refine', copy: 'Receive personalised curation advice on what to seek next to round out your library.' },
              ].map(step => (
                <div key={step.numeral} className="text-center">
                  <span className="font-headline text-4xl italic text-primary block mb-6">{step.numeral}</span>
                  <h5 className="font-label text-[11px] tracking-[0.25em] text-on-surface mb-4 uppercase">{step.title}</h5>
                  <p className="text-secondary text-sm leading-relaxed max-w-xs mx-auto">{step.copy}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── TESTIMONIALS ─── */}
        <section className="py-24 md:py-32 px-6 bg-surface-container-low overflow-hidden">
          <div className="max-w-4xl mx-auto relative">
            <span
              className="material-symbols-outlined absolute -top-12 -left-8 md:-top-16 md:-left-16 text-primary pointer-events-none select-none"
              style={{ fontSize: '8rem', opacity: 0.05 }}
            >
              format_quote
            </span>
            <div className="relative z-10 space-y-20 md:space-y-24">
              <Blockquote
                quote="Finally, a digital space that respects the artistry of perfumery. ScentFolio is as essential as the atomiser itself."
                name="Julian V."
                role="Collector · 80+ bottles"
              />
              <Blockquote
                quote="The mapping feature revealed biases in my collection I never knew I had. My curation is now purposeful."
                name="Elara K."
                role="Curator"
                align="right"
              />
            </div>
          </div>
        </section>

        {/* ─── STATS / DEVICE LINE ─── */}
        <section className="py-16 px-6 bg-surface">
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-3 gap-6 text-center">
              <div>
                <p className="font-headline text-3xl md:text-4xl text-on-surface">
                  <AnimatedCount target={fragranceCount} suffix="+" />
                </p>
                <p className="font-label text-[10px] tracking-[0.25em] text-secondary uppercase mt-2">Fragrances</p>
              </div>
              <div>
                <p className="font-headline text-3xl md:text-4xl text-on-surface">
                  {userCount > 0 ? <AnimatedCount target={userCount} /> : '∞'}
                </p>
                <p className="font-label text-[10px] tracking-[0.25em] text-secondary uppercase mt-2">
                  {userCount > 0 ? 'Collectors' : 'Pairings'}
                </p>
              </div>
              <div>
                <p className="font-headline text-3xl md:text-4xl text-on-surface">
                  {wearCount > 0 ? <AnimatedCount target={wearCount} /> : <AnimatedCount target={100} suffix="%" />}
                </p>
                <p className="font-label text-[10px] tracking-[0.25em] text-secondary uppercase mt-2">
                  {wearCount > 0 ? 'Wears Logged' : 'Ad-Free'}
                </p>
              </div>
            </div>
            <div className="mt-14">
              <Hairline />
            </div>
            <div className="mt-8 text-center">
              <span className="font-label text-[10px] tracking-[0.3em] text-secondary/50 uppercase">
                iPhone · Android · Desktop
              </span>
            </div>
          </div>
        </section>

        {/* ─── FAQ — CLARIFICATIONS ─── */}
        <section className="py-24 md:py-32 px-6 bg-surface-container-low">
          <div className="max-w-3xl mx-auto">
            <h2 className="font-headline text-4xl md:text-5xl mb-12 italic text-on-surface">
              Clarifications
            </h2>
            <div>
              <Clarification
                question="Is my data private?"
                answer="Absolutely. Your collection is private by default. You choose what to share — whether that's a public profile, specific reviews, or collection stats. You remain in control of every note."
              />
              <Clarification
                question="Can I export my library?"
                answer="Yes. Export your entire archive to CSV or JSON at any time. Your collection belongs to you, not to us."
              />
              <Clarification
                question="How often is the database updated?"
                answer={`The archive currently holds ${fragranceCount.toLocaleString()}+ fragrances and grows weekly. You can also request new additions — our editors respond within seven days.`}
              />
              <Clarification
                question="What is the Layering Bench?"
                answer="The Layering Bench lets you experiment with fragrance combinations. Select two or more scents to receive harmony scores, save your favourite stacks, and share them with the Society."
              />
              <Clarification
                question="Does it work offline?"
                answer="ScentFolio is a Progressive Web App. Install it to your home screen, and your core archive travels with you — data syncs the moment you return online."
              />
            </div>
          </div>
        </section>

        {/* ─── FINAL CTA ─── */}
        <section className="py-32 md:py-48 px-6 bg-surface text-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-primary/30 blur-[140px]" />
          </div>
          <div className="relative z-10 max-w-3xl mx-auto">
            <h2 className="font-headline text-5xl md:text-8xl text-on-surface mb-12 leading-tight">
              Begin the <span className="italic text-primary">Archiving.</span>
            </h2>
            <button
              onClick={() => openAuth('final_open_volume')}
              className="gold-gradient text-surface font-label font-bold text-xs tracking-[0.2em] uppercase px-12 py-5 rounded-sm hover:scale-[1.03] transition-all"
              style={{ boxShadow: '0 32px 64px -12px rgba(25,18,16,0.6)' }}
            >
              Open Your Volume
            </button>
            <p className="font-label text-[10px] tracking-[0.25em] text-secondary/60 uppercase mt-8">
              No credit card · Free, forever
            </p>
          </div>
        </section>
      </main>

      {/* ─── IMPRINT / FOOTER ─── */}
      <footer className="bg-surface py-16 md:py-20 px-6 md:px-10 relative">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start gap-12">
          <div>
            <h2 className="font-headline text-3xl text-on-surface mb-3">ScentFolio</h2>
            <p className="font-label text-[10px] tracking-[0.25em] text-secondary uppercase">Est. MMXXIV</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-12">
            <div className="space-y-4">
              <p className="font-label text-[10px] tracking-[0.2em] text-primary uppercase">Catalogue</p>
              <ul className="text-xs text-secondary space-y-2">
                <li><button onClick={() => navigate('/explore')} className="hover:text-primary transition-colors">Explore</button></li>
                <li><button onClick={() => openAuth('footer_sign_in')} className="hover:text-primary transition-colors">Sign In</button></li>
              </ul>
            </div>
            <div className="space-y-4">
              <p className="font-label text-[10px] tracking-[0.2em] text-primary uppercase">Legal</p>
              <ul className="text-xs text-secondary space-y-2">
                <li><a href="#" className="hover:text-primary transition-colors">Privacy</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Terms</a></li>
              </ul>
            </div>
            <div className="space-y-4">
              <p className="font-label text-[10px] tracking-[0.2em] text-primary uppercase">Society</p>
              <ul className="text-xs text-secondary space-y-2">
                <li><a href="#" className="hover:text-primary transition-colors">Instagram</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Journal</a></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-16 pt-8 relative">
          <div className="absolute top-0 inset-x-0 h-px bg-primary/10" />
          <p className="font-label text-[10px] tracking-[0.25em] text-secondary/40 uppercase">
            © {new Date().getFullYear()} ScentFolio Digital Archives · All Rights Reserved
          </p>
        </div>
      </footer>
    </div>
  )
}
