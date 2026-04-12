import { useState, useEffect, useCallback } from 'react'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { getIconChar } from '@/lib/iconUtils'

const STORAGE_KEY = 'scentfolio_onboarded'

const STEPS = [
  {
    icon: 'water_drop',
    title: 'Welcome to ScentFolio',
    body: 'Your personal fragrance journal. Catalogue your collection, log daily wears, and discover what suits you best.',
  },
  {
    icon: 'search',
    title: 'Search & Discover',
    body: 'Browse 2,700+ fragrances. Add to your collection, wishlist, or explore notes and accords.',
  },
  {
    icon: 'calendar_today',
    title: 'Log Your Wears',
    body: 'Track what you wear each day. Build streaks, earn XP, and see your most-worn scents rise to the top.',
  },
  {
    icon: 'smart_toy',
    title: 'Smart Suggestions',
    body: 'Get daily wear predictions based on your habits, the weather, and what day of the week it is.',
  },
  {
    icon: 'health_and_safety',
    title: 'Collection Health',
    body: 'See your collection score — diversity, usage balance, season coverage, and more. Track how it improves.',
  },
  {
    icon: 'emoji_events',
    title: 'Achievements & Sharing',
    body: "Earn badges, create Wrapped summaries, share profile cards, and see how your taste evolves over time.",
  },
]

interface WelcomeOverlayProps {
  userId: string
}

export function WelcomeOverlay({ userId }: WelcomeOverlayProps) {
  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState(0)

  const handleDismiss = useCallback(() => {
    const key = `${STORAGE_KEY}_${userId}`
    localStorage.setItem(key, 'true')
    setVisible(false)
  }, [userId])

  const trapRef = useFocusTrap(visible, handleDismiss)

  useEffect(() => {
    const key = `${STORAGE_KEY}_${userId}`
    const seen = localStorage.getItem(key)
    if (!seen) {
      setVisible(true)
    }
  }, [userId])

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1)
    } else {
      handleDismiss()
    }
  }

  if (!visible) return null

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  return (
    <div ref={trapRef} className="fixed inset-0 z-[var(--z-overlay)] flex items-center justify-center" role="dialog" aria-modal="true" aria-label="Welcome to ScentFolio">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Card */}
      <div className="relative mx-8 max-w-sm w-full bg-surface-container-low rounded-3xl p-8 flex flex-col items-center text-center">
        {/* Skip */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 text-[10px] uppercase tracking-widest text-secondary/50 font-bold hover:opacity-80"
        >
          SKIP
        </button>

        {/* Icon */}
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
          <span className="text-primary text-3xl">{getIconChar(current.icon)}</span>
        </div>

        {/* Content */}
        <h2 className="font-headline text-2xl text-on-surface mb-3">{current.title}</h2>
        <p className="text-sm text-secondary/70 leading-relaxed mb-8">{current.body}</p>

        {/* Progress dots */}
        <div className="flex gap-2 mb-6">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step ? 'w-6 bg-primary' : 'w-1.5 bg-surface-container-highest'
              }`}
            />
          ))}
        </div>

        {/* Button */}
        <button
          onClick={handleNext}
          className="w-full py-3.5 gold-gradient text-on-primary font-bold uppercase tracking-[0.15em] rounded-sm hover:opacity-80 transition-all text-sm"
        >
          {isLast ? "LET'S GO" : 'NEXT'}
        </button>
      </div>
    </div>
  )
}
