import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../ui/Icon'
import { AuthScreen } from './AuthScreen'
import { supabase } from '@/lib/supabase'
import { trackEvent, AnalyticsEvents } from '@/lib/analytics'

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

/* ─── Feature card ─── */
function FeatureCard({ icon, title, description, delay }: { icon: string; title: string; description: string; delay: number }) {
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
      className={`bg-surface-container rounded-2xl p-5 space-y-3 transition-all duration-500 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
        <Icon name={icon} className="text-primary text-xl" />
      </div>
      <h3 className="text-on-surface text-sm font-semibold">{title}</h3>
      <p className="text-secondary text-xs leading-relaxed">{description}</p>
    </div>
  )
}

/* ─── Testimonial ─── */
function TestimonialCard({ quote, name, detail, initials }: { quote: string; name: string; detail: string; initials: string }) {
  return (
    <div className="bg-surface-container rounded-2xl p-5 space-y-3 min-w-[260px] snap-center">
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map(i => (
          <Icon key={i} name="star" filled className="text-primary text-xs" />
        ))}
      </div>
      <p className="text-on-surface text-sm italic leading-relaxed">&ldquo;{quote}&rdquo;</p>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
          <span className="text-primary text-[10px] font-bold">{initials}</span>
        </div>
        <div>
          <p className="text-on-surface text-xs font-medium">{name}</p>
          <p className="text-secondary text-[10px]">{detail}</p>
        </div>
      </div>
    </div>
  )
}

/* ─── Comparison row ─── */
function CompareRow({ feature, us, them }: { feature: string; us: boolean; them: boolean }) {
  return (
    <div className="grid grid-cols-[1fr_56px_56px] items-center py-2.5 border-b border-outline-variant/30 last:border-0">
      <span className="text-secondary text-xs">{feature}</span>
      <div className="flex justify-center">
        {us
          ? <Icon name="check_circle" filled className="text-primary text-base" />
          : <Icon name="cancel" className="text-secondary/30 text-base" />
        }
      </div>
      <div className="flex justify-center">
        {them
          ? <Icon name="check_circle" filled className="text-secondary/40 text-base" />
          : <Icon name="cancel" className="text-secondary/30 text-base" />
        }
      </div>
    </div>
  )
}

/* ─── FAQ item ─── */
function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-outline-variant/30 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-4 text-left min-h-[44px]"
      >
        <span className="text-on-surface text-sm font-medium pr-4">{question}</span>
        <Icon
          name={open ? 'expand_less' : 'expand_more'}
          className="text-secondary text-lg flex-shrink-0 transition-transform"
        />
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${open ? 'max-h-40 pb-4' : 'max-h-0'}`}>
        <p className="text-secondary text-xs leading-relaxed">{answer}</p>
      </div>
    </div>
  )
}

/* ─── Phone mockup ─── */
function PhoneMockup() {
  return (
    <div className="relative mx-auto w-[220px]">
      {/* Phone frame */}
      <div className="rounded-[32px] border-[3px] border-secondary/20 bg-background p-1.5 shadow-2xl">
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-5 bg-background rounded-b-2xl z-10" />
        {/* Screen content */}
        <div className="rounded-[26px] overflow-hidden bg-background">
          {/* Status bar */}
          <div className="h-10 bg-background flex items-end justify-center pb-1">
            <span className="text-[8px] text-secondary/50 font-medium tracking-wider uppercase">ScentFolio</span>
          </div>
          {/* Fake collection grid */}
          <div className="px-3 pb-3 space-y-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] font-semibold text-on-surface">My Collection</span>
              <span className="text-[8px] text-primary">47 bottles</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {['🫧', '🌹', '🍋', '🌿', '🪵', '☕'].map((emoji, i) => (
                <div key={i} className="aspect-[3/4] rounded-lg bg-surface-container flex flex-col items-center justify-center gap-1">
                  <span className="text-lg">{emoji}</span>
                  <div className="w-8 h-1 rounded-full bg-secondary/20" />
                  <div className="flex gap-0.5">
                    {[1,2,3,4,5].map(s => (
                      <div key={s} className={`w-1 h-1 rounded-full ${s <= 4 ? 'bg-primary' : 'bg-secondary/20'}`} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {/* Fake wear log */}
            <div className="bg-surface-container rounded-lg p-2 mt-1">
              <span className="text-[8px] text-secondary">Today&rsquo;s Wear</span>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm">🌹</span>
                <div>
                  <div className="w-16 h-1.5 rounded-full bg-secondary/20" />
                  <div className="w-10 h-1 rounded-full bg-secondary/10 mt-0.5" />
                </div>
              </div>
            </div>
          </div>
          {/* Fake bottom nav */}
          <div className="flex justify-around items-center py-2 border-t border-outline-variant/20 px-2">
            {['home', 'shelves', 'explore', 'science', 'person'].map((icon, i) => (
              <div key={icon} className={`w-6 h-6 rounded-lg flex items-center justify-center ${i === 1 ? 'bg-primary/15' : ''}`}>
                <Icon name={icon} className={`text-xs ${i === 1 ? 'text-primary' : 'text-secondary/40'}`} />
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Ambient glow behind phone */}
      <div className="absolute -z-10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[180px] h-[280px] rounded-full bg-primary/8 blur-[60px]" />
    </div>
  )
}


/* ═══════════════════════════════════════════
   LANDING PAGE
   ═══════════════════════════════════════════ */
export function LandingPage() {
  const navigate = useNavigate()
  const [showAuth, setShowAuth] = useState(false)
  const [fragranceCount, setFragranceCount] = useState(2700)
  const [userCount, setUserCount] = useState(0)
  const [wearCount, setWearCount] = useState(0)

  // Fetch real stats
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
          className="fixed top-4 left-4 z-50 w-10 h-10 rounded-full bg-surface-container flex items-center justify-center"
        >
          <Icon name="arrow_back" className="text-on-surface text-lg" />
        </button>
        <AuthScreen />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* ── HERO ── */}
      <section className="relative min-h-[85vh] flex flex-col items-center justify-center px-6 text-center overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[300px] h-[300px] rounded-full bg-primary/5 blur-[100px] pointer-events-none" />

        <div className="w-16 h-16 rounded-2xl gold-gradient flex items-center justify-center mb-6 ambient-glow animate-scale-in">
          <span className="text-2xl font-bold text-on-primary">✦</span>
        </div>

        <h1 className="font-headline text-4xl text-on-surface tracking-tight mb-3 animate-page-enter">
          SCENTFOLIO
        </h1>
        <p className="text-primary text-[10px] tracking-[0.4em] uppercase mb-6 animate-page-enter">
          Your Fragrance Journey, Curated
        </p>

        <p className="text-secondary text-sm max-w-[300px] leading-relaxed mb-10 animate-page-enter" style={{ animationDelay: '100ms' }}>
          The beautiful way to track, discover, and share your fragrance collection. Built for scent lovers who appreciate the art of perfumery.
        </p>

        <div className="w-full max-w-[300px] space-y-3 animate-page-enter" style={{ animationDelay: '200ms' }}>
          <button
            onClick={() => { trackEvent(AnalyticsEvents.LANDING_CTA_CLICK, { cta: 'hero_start_collection' }); setShowAuth(true) }}
            className="w-full py-3.5 rounded-xl gold-gradient text-on-primary font-semibold text-sm ambient-glow active:scale-[0.98] transition-transform"
          >
            Start Your Collection — It&rsquo;s Free
          </button>
          <button
            onClick={() => document.getElementById('preview')?.scrollIntoView({ behavior: 'smooth' })}
            className="w-full py-3.5 rounded-xl border border-outline-variant text-secondary text-sm font-medium active:scale-[0.98] transition-transform"
          >
            See What&rsquo;s Inside
          </button>
        </div>

        <div className="absolute bottom-8 animate-bounce">
          <Icon name="expand_more" className="text-secondary/40 text-2xl" />
        </div>
      </section>

      {/* ── STATS BAR ── */}
      <section className="bg-surface-container py-8 px-6">
        <div className="grid grid-cols-3 gap-4 text-center max-w-sm mx-auto">
          <div>
            <p className="font-headline text-2xl text-on-surface">
              <AnimatedCount target={fragranceCount} suffix="+" />
            </p>
            <p className="text-secondary text-[10px] uppercase tracking-wider mt-1">Fragrances</p>
          </div>
          <div>
            <p className="font-headline text-2xl text-on-surface">
              {userCount > 0
                ? <AnimatedCount target={userCount} />
                : <AnimatedCount target={73} />
              }
            </p>
            <p className="text-secondary text-[10px] uppercase tracking-wider mt-1">
              {userCount > 0 ? 'Collectors' : 'Features'}
            </p>
          </div>
          <div>
            <p className="font-headline text-2xl text-on-surface">
              {wearCount > 0
                ? <AnimatedCount target={wearCount} />
                : <AnimatedCount target={100} suffix="%" />
              }
            </p>
            <p className="text-secondary text-[10px] uppercase tracking-wider mt-1">
              {wearCount > 0 ? 'Wears Logged' : 'Free'}
            </p>
          </div>
        </div>
      </section>

      {/* ── APP PREVIEW ── */}
      <section id="preview" className="py-14 px-6 space-y-8">
        <div className="text-center">
          <span className="text-primary text-[10px] tracking-[0.3em] uppercase">See It In Action</span>
          <h2 className="font-headline text-2xl text-on-surface mt-2">Your collection, beautifully organised</h2>
        </div>
        <PhoneMockup />
        <p className="text-secondary text-xs text-center max-w-[280px] mx-auto leading-relaxed">
          Track every bottle, log daily wears, discover new scents, and share your taste — all in a stunning dark-mode interface designed for fragrance lovers.
        </p>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="py-14 px-6 space-y-10 bg-surface-container">
        <div className="text-center">
          <span className="text-primary text-[10px] tracking-[0.3em] uppercase">Everything You Need</span>
          <h2 className="font-headline text-2xl text-on-surface mt-2">Your entire fragrance world, in one place</h2>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FeatureCard icon="collections_bookmark" title="Smart Collection" description="Track owned, wishlisted, and tried fragrances with ratings, notes, and wear history." delay={0} />
          <FeatureCard icon="science" title="Layering Lab" description="Experiment with fragrance combos. Save your best layering stacks and share them." delay={100} />
          <FeatureCard icon="calendar_month" title="Wear Tracking" description="Log daily wears, build streaks, and see heatmaps of your fragrance rotation." delay={200} />
          <FeatureCard icon="auto_awesome" title="AI Recommendations" description="Get smart picks based on weather, mood, occasion, and your taste profile." delay={300} />
          <FeatureCard icon="people" title="Community" description="Follow collectors, share reviews, join challenges, and explore what others wear." delay={400} />
          <FeatureCard icon="analytics" title="Deep Insights" description="Collection DNA, seasonal patterns, brand analysis, and spending breakdowns." delay={500} />
        </div>

        <div className="bg-background rounded-2xl p-5 space-y-4">
          <h3 className="text-on-surface text-sm font-semibold">Plus so much more</h3>
          <div className="grid grid-cols-2 gap-y-3 gap-x-4">
            {[
              { icon: 'grid_view', text: 'Scent Boards' },
              { icon: 'edit_note', text: 'Scent Journal' },
              { icon: 'emoji_events', text: 'Achievements' },
              { icon: 'card_giftcard', text: 'Gift Finder' },
              { icon: 'compare_arrows', text: 'Dupe Finder' },
              { icon: 'visibility_off', text: 'Blind Buy Tracker' },
              { icon: 'timeline', text: 'Price Tracker' },
              { icon: 'workspace_premium', text: 'Top Shelf' },
              { icon: 'water_drop', text: 'Decant Manager' },
              { icon: 'psychology', text: 'Mood Picker' },
              { icon: 'share', text: 'Collection Sharing' },
              { icon: 'local_fire_department', text: 'Wear Streaks' },
            ].map(f => (
              <div key={f.icon} className="flex items-center gap-2">
                <Icon name={f.icon} className="text-primary/60 text-base" />
                <span className="text-secondary text-xs">{f.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHY SCENTFOLIO (comparison) ── */}
      <section className="py-14 px-6 space-y-6">
        <div className="text-center">
          <span className="text-primary text-[10px] tracking-[0.3em] uppercase">Why Switch</span>
          <h2 className="font-headline text-2xl text-on-surface mt-2">Built different</h2>
          <p className="text-secondary text-xs mt-2 max-w-[280px] mx-auto leading-relaxed">
            Tired of spreadsheets and basic fragrance apps? ScentFolio is purpose-built for serious collectors.
          </p>
        </div>

        <div className="bg-surface-container rounded-2xl p-5">
          {/* Header */}
          <div className="grid grid-cols-[1fr_56px_56px] items-center pb-3 border-b border-outline-variant/30">
            <span className="text-secondary text-[10px] uppercase tracking-wider">Feature</span>
            <div className="flex justify-center">
              <span className="text-primary text-[10px] font-bold">SF</span>
            </div>
            <div className="flex justify-center">
              <span className="text-secondary/50 text-[10px]">Others</span>
            </div>
          </div>
          <CompareRow feature="Wear tracking & streaks" us={true} them={false} />
          <CompareRow feature="Layering combinations" us={true} them={false} />
          <CompareRow feature="AI recommendations" us={true} them={false} />
          <CompareRow feature="Collection insights & DNA" us={true} them={false} />
          <CompareRow feature="Dark luxury design" us={true} them={false} />
          <CompareRow feature="Fragrance database" us={true} them={true} />
          <CompareRow feature="Basic collection list" us={true} them={true} />
          <CompareRow feature="Works offline (PWA)" us={true} them={false} />
          <CompareRow feature="Free forever" us={true} them={false} />
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="bg-surface-container py-14 px-6 space-y-8">
        <div className="text-center">
          <span className="text-primary text-[10px] tracking-[0.3em] uppercase">Get Started</span>
          <h2 className="font-headline text-2xl text-on-surface mt-2">Three steps to scent nirvana</h2>
        </div>

        {[
          { step: '01', icon: 'person_add', title: 'Create your profile', desc: 'Take the quick taste quiz to tell us about your scent preferences and experience level.' },
          { step: '02', icon: 'add_circle', title: 'Add your collection', desc: `Search our database of ${fragranceCount.toLocaleString()}+ fragrances and start building your ScentFolio.` },
          { step: '03', icon: 'explore', title: 'Discover & connect', desc: 'Get personalised recommendations, track your wears, and join the fragrance community.' },
        ].map((s, i) => (
          <div key={s.step} className="flex gap-4 items-start">
            <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <span className="font-headline text-primary text-lg">{s.step}</span>
            </div>
            <div className="pt-1">
              <h3 className="text-on-surface text-sm font-semibold">{s.title}</h3>
              <p className="text-secondary text-xs leading-relaxed mt-1">{s.desc}</p>
            </div>
            {i < 2 && <div className="hidden" />}
          </div>
        ))}
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="py-14 px-6 space-y-8">
        <div className="text-center">
          <span className="text-primary text-[10px] tracking-[0.3em] uppercase">What People Say</span>
          <h2 className="font-headline text-2xl text-on-surface mt-2">Loved by fragrance enthusiasts</h2>
        </div>

        <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 -mx-6 px-6 scrollbar-hide">
          <TestimonialCard
            quote="Finally an app that treats fragrance collecting with the respect it deserves. The dark theme is gorgeous."
            name="Marcus J."
            detail="150+ bottle collection"
            initials="MJ"
          />
          <TestimonialCard
            quote="The layering lab is genius. I've discovered combinations I never would have tried on my own."
            name="Sarah K."
            detail="Niche fragrance lover"
            initials="SK"
          />
          <TestimonialCard
            quote="I love the wear tracking and seasonal rotation features. It's like Letterboxd but for perfume."
            name="Alex R."
            detail="Growing collector"
            initials="AR"
          />
          <TestimonialCard
            quote="The collection insights blew my mind. I had no idea I lean so heavily towards woody orientals!"
            name="Priya M."
            detail="42 bottles"
            initials="PM"
          />
          <TestimonialCard
            quote="Switched from a spreadsheet. Never going back. The UI alone is worth it."
            name="James T."
            detail="Fragrance reviewer"
            initials="JT"
          />
        </div>
      </section>

      {/* ── DEVICE PREVIEW ── */}
      <section className="bg-surface-container py-14 px-6 text-center space-y-6">
        <span className="text-primary text-[10px] tracking-[0.3em] uppercase">Works Everywhere</span>
        <h2 className="font-headline text-2xl text-on-surface">Install as an app on any device</h2>
        <p className="text-secondary text-xs max-w-[280px] mx-auto leading-relaxed">
          ScentFolio is a Progressive Web App. Install it on your phone&rsquo;s home screen for a native app experience — no app store needed.
        </p>
        <div className="flex justify-center gap-6 pt-4">
          {[
            { icon: 'phone_iphone', label: 'iOS' },
            { icon: 'phone_android', label: 'Android' },
            { icon: 'laptop_mac', label: 'Desktop' },
          ].map(d => (
            <div key={d.icon} className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-xl bg-surface-container-highest flex items-center justify-center">
                <Icon name={d.icon} className="text-on-surface text-xl" />
              </div>
              <span className="text-secondary text-[10px]">{d.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-14 px-6 space-y-6">
        <div className="text-center">
          <span className="text-primary text-[10px] tracking-[0.3em] uppercase">Questions</span>
          <h2 className="font-headline text-2xl text-on-surface mt-2">Frequently asked</h2>
        </div>

        <div className="bg-surface-container rounded-2xl px-5">
          <FaqItem
            question="Is ScentFolio really free?"
            answer="Yes, 100%. ScentFolio is completely free with no hidden costs, no premium tier, and no ads. We're building this because we love fragrance, not to monetise your data."
          />
          <FaqItem
            question="How many fragrances are in the database?"
            answer={`We currently have ${fragranceCount.toLocaleString()}+ fragrances in our database, covering designer, niche, and indie houses. The database is growing constantly — you can also request additions.`}
          />
          <FaqItem
            question="Can I import my existing collection?"
            answer="Yes! You can import from spreadsheets or manually search and add fragrances. Our database search is fast and covers alternative names, so you'll find everything quickly."
          />
          <FaqItem
            question="What's the Layering Lab?"
            answer="The Layering Lab lets you experiment with fragrance combinations. Select two or more fragrances, get AI-powered harmony scores, save your favourite combos, and share them with the community."
          />
          <FaqItem
            question="Does it work offline?"
            answer="ScentFolio is a Progressive Web App (PWA), which means you can install it on your phone's home screen and use core features offline. Your data syncs when you're back online."
          />
          <FaqItem
            question="Is my collection data private?"
            answer="Absolutely. Your collection is private by default. You choose what to share — whether that's a public profile, specific reviews, or collection stats. You're always in control."
          />
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="py-20 px-6 text-center space-y-6">
        <div className="relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] h-[200px] rounded-full bg-primary/8 blur-[80px] pointer-events-none" />
        </div>

        <h2 className="font-headline text-3xl text-on-surface relative">
          Ready to start your<br />scent journey?
        </h2>
        <p className="text-secondary text-sm max-w-[260px] mx-auto">
          Join a community that appreciates the art and science of fragrance.
        </p>

        <button
          onClick={() => { trackEvent(AnalyticsEvents.LANDING_CTA_CLICK, { cta: 'bottom_create_account' }); setShowAuth(true) }}
          className="w-full max-w-[300px] py-4 rounded-xl gold-gradient text-on-primary font-semibold text-sm ambient-glow active:scale-[0.98] transition-transform"
        >
          Create Free Account
        </button>
        <p className="text-secondary/50 text-[10px]">No credit card required. Free forever.</p>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-surface-container border-t border-outline-variant py-8 px-6 text-center space-y-4">
        <div className="flex items-center justify-center gap-2">
          <div className="w-6 h-6 rounded-md gold-gradient flex items-center justify-center">
            <span className="text-[10px] font-bold text-on-primary">✦</span>
          </div>
          <span className="font-headline text-sm text-on-surface tracking-tight">SCENTFOLIO</span>
        </div>
        <p className="text-secondary/50 text-[10px]">
          &copy; {new Date().getFullYear()} ScentFolio. Built with love for fragrance enthusiasts.
        </p>
        <div className="flex justify-center gap-6">
          <button onClick={() => navigate('/explore')} className="text-secondary text-xs hover:text-on-surface transition-colors">
            Explore
          </button>
          <button onClick={() => setShowAuth(true)} className="text-secondary text-xs hover:text-on-surface transition-colors">
            Sign In
          </button>
        </div>
      </footer>
    </div>
  )
}
