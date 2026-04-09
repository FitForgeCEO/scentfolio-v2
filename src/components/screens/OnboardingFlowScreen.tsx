import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useOnboarding, NOTE_FAMILIES, VIBE_OPTIONS, EXPERIENCE_LEVELS } from '@/hooks/useOnboarding'
import { supabase } from '@/lib/supabase'
import { Icon } from '@/components/ui/Icon'
import { trackEvent, AnalyticsEvents } from '@/lib/analytics'

/* ─── helpers ─── */
function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2 justify-center">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            i === current ? 'w-8 bg-primary' : i < current ? 'w-3 bg-primary/60' : 'w-3 bg-surface-container-highest'
          }`}
        />
      ))}
    </div>
  )
}

/* ═══════════════════════════════════════════
   STEP 1 — WELCOME
   ═══════════════════════════════════════════ */
function WelcomeStep({ onNext, onSkip, displayName }: { onNext: () => void; onSkip: () => void; displayName: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-6 text-center animate-page-enter">
      {/* Brand mark */}
      <div className="w-20 h-20 rounded-2xl gold-gradient flex items-center justify-center mb-6 ambient-glow">
        <span className="text-3xl">✦</span>
      </div>

      <h1 className="font-headline text-3xl text-on-surface mb-2">
        Welcome{displayName ? `, ${displayName}` : ''}
      </h1>
      <p className="text-secondary text-sm max-w-[280px] mb-8 leading-relaxed">
        Let&rsquo;s set up your scent profile so we can personalise your experience.
        This takes about 60 seconds.
      </p>

      {/* Feature preview cards */}
      <div className="w-full max-w-sm space-y-3 mb-10">
        {[
          { icon: 'collections_bookmark', text: 'Track your collection' },
          { icon: 'auto_awesome', text: 'Get personalised recommendations' },
          { icon: 'people', text: 'Connect with fellow enthusiasts' },
        ].map(f => (
          <div key={f.icon} className="flex items-center gap-3 bg-surface-container rounded-xl px-4 py-3">
            <Icon name={f.icon} className="text-primary text-xl" />
            <span className="text-on-surface text-sm">{f.text}</span>
          </div>
        ))}
      </div>

      <button
        onClick={onNext}
        className="w-full max-w-sm py-3.5 rounded-xl gold-gradient text-on-primary font-semibold text-sm ambient-glow active:scale-[0.98] transition-transform"
      >
        Let&rsquo;s Go
      </button>
      <button
        onClick={onSkip}
        className="mt-3 text-secondary text-xs hover:text-on-surface transition-colors"
      >
        Skip for now
      </button>
    </div>
  )
}

/* ═══════════════════════════════════════════
   STEP 2 — TASTE QUIZ
   ═══════════════════════════════════════════ */
function TasteQuizStep({
  onNext,
  onBack,
  preferences,
  updatePreferences,
}: {
  onNext: () => void
  onBack: () => void
  preferences: { favoriteNotes: string[]; vibes: string[]; experienceLevel: 'beginner' | 'intermediate' | 'connoisseur' | null }
  updatePreferences: (p: Partial<typeof preferences>) => void
}) {
  const [subStep, setSubStep] = useState(0) // 0=experience, 1=notes, 2=vibes

  const toggleNote = (id: string) => {
    const current = preferences.favoriteNotes
    if (current.includes(id)) {
      updatePreferences({ favoriteNotes: current.filter(n => n !== id) })
    } else if (current.length < 5) {
      updatePreferences({ favoriteNotes: [...current, id] })
    }
  }

  const toggleVibe = (id: string) => {
    const current = preferences.vibes
    if (current.includes(id)) {
      updatePreferences({ vibes: current.filter(v => v !== id) })
    } else if (current.length < 3) {
      updatePreferences({ vibes: [...current, id] })
    }
  }

  const canContinue =
    subStep === 0 ? !!preferences.experienceLevel :
    subStep === 1 ? preferences.favoriteNotes.length >= 2 :
    true // vibes are optional

  return (
    <div className="flex flex-col min-h-[80vh] px-5 pt-4 animate-page-enter">
      {/* Sub-step indicator */}
      <div className="flex gap-1 mb-6">
        {[0, 1, 2].map(i => (
          <div key={i} className={`h-0.5 flex-1 rounded-full transition-all ${i <= subStep ? 'bg-primary' : 'bg-surface-container-highest'}`} />
        ))}
      </div>

      {/* Sub-step 0: Experience level */}
      {subStep === 0 && (
        <div className="animate-page-enter">
          <h2 className="font-headline text-2xl text-on-surface mb-1">Your fragrance journey</h2>
          <p className="text-secondary text-sm mb-6">Where are you on your scent journey?</p>
          <div className="space-y-3">
            {EXPERIENCE_LEVELS.map(level => (
              <button
                key={level.id}
                onClick={() => updatePreferences({ experienceLevel: level.id })}
                className={`w-full text-left p-4 rounded-xl border transition-all ${
                  preferences.experienceLevel === level.id
                    ? 'border-primary bg-primary/10'
                    : 'border-outline-variant bg-surface-container'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{level.icon}</span>
                  <div>
                    <div className="text-on-surface text-sm font-medium">{level.label}</div>
                    <div className="text-secondary text-xs mt-0.5">{level.description}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sub-step 1: Note families */}
      {subStep === 1 && (
        <div className="animate-page-enter">
          <h2 className="font-headline text-2xl text-on-surface mb-1">Scent families you love</h2>
          <p className="text-secondary text-sm mb-6">
            Pick 2–5 that speak to you
            <span className="text-primary ml-1">({preferences.favoriteNotes.length}/5)</span>
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            {NOTE_FAMILIES.map(note => {
              const selected = preferences.favoriteNotes.includes(note.id)
              return (
                <button
                  key={note.id}
                  onClick={() => toggleNote(note.id)}
                  className={`p-3.5 rounded-xl border text-left transition-all ${
                    selected
                      ? 'border-primary bg-primary/10 scale-[1.02]'
                      : 'border-outline-variant bg-surface-container'
                  } ${!selected && preferences.favoriteNotes.length >= 5 ? 'opacity-40' : ''}`}
                >
                  <span className="text-xl">{note.icon}</span>
                  <div className="text-on-surface text-sm font-medium mt-1">{note.label}</div>
                  <div className="text-secondary text-[10px] mt-0.5">{note.description}</div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Sub-step 2: Vibes */}
      {subStep === 2 && (
        <div className="animate-page-enter">
          <h2 className="font-headline text-2xl text-on-surface mb-1">Your scent vibe</h2>
          <p className="text-secondary text-sm mb-6">
            How do you want to feel? Pick up to 3
            <span className="text-primary ml-1">({preferences.vibes.length}/3)</span>
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            {VIBE_OPTIONS.map(vibe => {
              const selected = preferences.vibes.includes(vibe.id)
              return (
                <button
                  key={vibe.id}
                  onClick={() => toggleVibe(vibe.id)}
                  className={`flex items-center gap-2.5 p-3.5 rounded-xl border transition-all ${
                    selected
                      ? 'border-primary bg-primary/10 scale-[1.02]'
                      : 'border-outline-variant bg-surface-container'
                  } ${!selected && preferences.vibes.length >= 3 ? 'opacity-40' : ''}`}
                >
                  <span className="text-xl">{vibe.icon}</span>
                  <span className="text-on-surface text-sm font-medium">{vibe.label}</span>
                </button>
              )
            })}
          </div>
          <p className="text-secondary/60 text-xs text-center mt-4">This is optional — you can always set these later</p>
        </div>
      )}

      {/* Navigation */}
      <div className="mt-auto pt-6 pb-8 flex gap-3">
        <button
          onClick={subStep === 0 ? onBack : () => setSubStep(s => s - 1)}
          className="flex-1 py-3 rounded-xl border border-outline-variant text-secondary text-sm font-medium active:scale-[0.98] transition-transform"
        >
          Back
        </button>
        <button
          onClick={subStep < 2 ? () => setSubStep(s => s + 1) : onNext}
          disabled={!canContinue}
          className={`flex-1 py-3 rounded-xl text-sm font-semibold active:scale-[0.98] transition-all ${
            canContinue
              ? 'gold-gradient text-on-primary ambient-glow'
              : 'bg-surface-container-highest text-secondary/50'
          }`}
        >
          {subStep < 2 ? 'Continue' : 'Next'}
        </button>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════
   STEP 3 — FIRST FRAGRANCE
   ═══════════════════════════════════════════ */
interface SearchResult {
  id: string
  name: string
  brand: string
  image_url: string | null
  note_family: string | null
}

function FirstFragranceStep({
  onNext,
  onBack,
}: {
  onNext: () => void
  onBack: () => void
}) {
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [added, setAdded] = useState<string[]>([])
  const [adding, setAdding] = useState<string | null>(null)

  // Debounced search
  useEffect(() => {
    if (query.length < 2) { setResults([]); return }
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const { data } = await supabase
          .from('fragrances')
          .select('id, name, brand, image_url, note_family')
          .or(`name.ilike.%${query}%,brand.ilike.%${query}%`)
          .limit(12)
        setResults((data ?? []) as SearchResult[])
      } catch {
        setResults([])
      }
      setSearching(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  const addToCollection = useCallback(async (fragrance: SearchResult) => {
    if (!user || added.includes(fragrance.id)) return
    setAdding(fragrance.id)
    try {
      await supabase.from('user_collections').upsert({
        user_id: user.id,
        fragrance_id: fragrance.id,
        status: 'own',
      }, { onConflict: 'user_id,fragrance_id' })
      setAdded(prev => [...prev, fragrance.id])
    } catch {
      // Silently fail — they can add later
    }
    setAdding(null)
  }, [user, added])

  return (
    <div className="flex flex-col min-h-[80vh] px-5 pt-4 animate-page-enter">
      <h2 className="font-headline text-2xl text-on-surface mb-1">Add your first scents</h2>
      <p className="text-secondary text-sm mb-5">
        Search for fragrances you own or love. You can always add more later.
      </p>

      {/* Search bar */}
      <div className="relative mb-4">
        <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-lg" />
        <input
          type="text"
          placeholder="Search by name or brand…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 rounded-xl bg-surface-container border border-outline-variant text-on-surface text-sm placeholder:text-secondary/50 focus:border-primary focus:outline-none transition-colors"
          autoFocus
        />
        {searching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Added count badge */}
      {added.length > 0 && (
        <div className="flex items-center gap-2 mb-3 px-1">
          <Icon name="check_circle" className="text-primary text-base" />
          <span className="text-primary text-xs font-medium">
            {added.length} fragrance{added.length !== 1 ? 's' : ''} added to your collection
          </span>
        </div>
      )}

      {/* Results */}
      <div className="flex-1 overflow-y-auto space-y-2 pb-4">
        {query.length < 2 && added.length === 0 && (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">🔍</div>
            <p className="text-secondary text-sm">Try searching for your favourite fragrance</p>
            <p className="text-secondary/60 text-xs mt-1">e.g. &ldquo;Bleu de Chanel&rdquo; or &ldquo;Tom Ford&rdquo;</p>
          </div>
        )}

        {query.length >= 2 && !searching && results.length === 0 && (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">😕</div>
            <p className="text-secondary text-sm">No fragrances found for &ldquo;{query}&rdquo;</p>
            <p className="text-secondary/60 text-xs mt-1">Try a different spelling or brand name</p>
          </div>
        )}

        {results.map(f => {
          const isAdded = added.includes(f.id)
          const isAdding = adding === f.id
          return (
            <div
              key={f.id}
              className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                isAdded ? 'border-primary/30 bg-primary/5' : 'border-outline-variant bg-surface-container'
              }`}
            >
              {/* Thumbnail */}
              <div className="w-11 h-11 rounded-lg bg-surface-container-highest flex-shrink-0 overflow-hidden">
                {f.image_url ? (
                  <img src={f.image_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-secondary/40 text-lg">✦</div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="text-on-surface text-sm font-medium truncate">{f.name}</div>
                <div className="text-secondary text-xs truncate">{f.brand}</div>
              </div>

              {/* Add button */}
              <button
                onClick={() => addToCollection(f)}
                disabled={isAdded || isAdding}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isAdded
                    ? 'bg-primary/10 text-primary'
                    : 'gold-gradient text-on-primary active:scale-95'
                }`}
              >
                {isAdding ? (
                  <div className="w-3.5 h-3.5 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin" />
                ) : isAdded ? (
                  <span className="flex items-center gap-1"><Icon name="check" className="text-xs" /> Added</span>
                ) : (
                  '+ Add'
                )}
              </button>
            </div>
          )
        })}
      </div>

      {/* Navigation */}
      <div className="pt-4 pb-8 flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 py-3 rounded-xl border border-outline-variant text-secondary text-sm font-medium active:scale-[0.98] transition-transform"
        >
          Back
        </button>
        <button
          onClick={onNext}
          className="flex-1 py-3 rounded-xl gold-gradient text-on-primary text-sm font-semibold active:scale-[0.98] transition-transform ambient-glow"
        >
          {added.length > 0 ? 'Continue' : 'Skip for now'}
        </button>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════
   STEP 4 — COMPLETE / CELEBRATION
   ═══════════════════════════════════════════ */
function CompleteStep({ onFinish, preferences }: {
  onFinish: () => void
  preferences: { favoriteNotes: string[]; vibes: string[]; experienceLevel: string | null }
}) {
  const [animating, setAnimating] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setAnimating(false), 600)
    return () => clearTimeout(timer)
  }, [])

  const noteLabels = preferences.favoriteNotes
    .map(id => NOTE_FAMILIES.find(n => n.id === id))
    .filter(Boolean)

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-6 text-center animate-page-enter">
      {/* Celebration icon */}
      <div className={`text-6xl mb-4 transition-transform duration-500 ${animating ? 'scale-150' : 'scale-100'}`}>
        ✨
      </div>

      <h1 className="font-headline text-3xl text-on-surface mb-2">You&rsquo;re all set!</h1>
      <p className="text-secondary text-sm max-w-[280px] mb-8">
        Your scent profile is ready. Here&rsquo;s what we know about you so far:
      </p>

      {/* Profile summary */}
      <div className="w-full max-w-sm space-y-3 mb-10">
        {preferences.experienceLevel && (
          <div className="bg-surface-container rounded-xl px-4 py-3 flex items-center gap-3">
            <span className="text-xl">
              {EXPERIENCE_LEVELS.find(l => l.id === preferences.experienceLevel)?.icon}
            </span>
            <span className="text-on-surface text-sm">
              {EXPERIENCE_LEVELS.find(l => l.id === preferences.experienceLevel)?.label}
            </span>
          </div>
        )}

        {noteLabels.length > 0 && (
          <div className="bg-surface-container rounded-xl px-4 py-3">
            <div className="text-secondary text-xs mb-2">Favourite families</div>
            <div className="flex flex-wrap gap-1.5">
              {noteLabels.map(n => n && (
                <span key={n.id} className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs">
                  {n.icon} {n.label}
                </span>
              ))}
            </div>
          </div>
        )}

        {preferences.vibes.length > 0 && (
          <div className="bg-surface-container rounded-xl px-4 py-3">
            <div className="text-secondary text-xs mb-2">Your vibe</div>
            <div className="flex flex-wrap gap-1.5">
              {preferences.vibes.map(v => {
                const vibe = VIBE_OPTIONS.find(o => o.id === v)
                return vibe ? (
                  <span key={v} className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs">
                    {vibe.icon} {vibe.label}
                  </span>
                ) : null
              })}
            </div>
          </div>
        )}
      </div>

      <button
        onClick={onFinish}
        className="w-full max-w-sm py-3.5 rounded-xl gold-gradient text-on-primary font-semibold text-sm ambient-glow active:scale-[0.98] transition-transform"
      >
        Start Exploring
      </button>
    </div>
  )
}

/* ═══════════════════════════════════════════
   MAIN FLOW COMPONENT
   ═══════════════════════════════════════════ */
export function OnboardingFlowScreen() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const onboarding = useOnboarding()

  const handleFinish = useCallback(async () => {
    await onboarding.completeOnboarding()
    trackEvent(AnalyticsEvents.COMPLETE_ONBOARDING, { method: 'completed' })
    navigate('/', { replace: true })
  }, [onboarding, navigate])

  const handleSkip = useCallback(() => {
    onboarding.skipOnboarding()
    trackEvent(AnalyticsEvents.COMPLETE_ONBOARDING, { method: 'skipped' })
    navigate('/', { replace: true })
  }, [onboarding, navigate])

  // Redirect if already complete or not logged in
  useEffect(() => {
    if (!authLoading && !user) navigate('/', { replace: true })
    if (!onboarding.loading && onboarding.isComplete) navigate('/', { replace: true })
  }, [authLoading, user, onboarding.loading, onboarding.isComplete, navigate])

  if (authLoading || onboarding.loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar with progress + skip */}
      <div className="sticky top-0 z-[var(--z-appbar)] bg-background/80 backdrop-blur-xl px-5 py-3 flex items-center justify-between">
        <ProgressDots current={onboarding.stepIndex} total={onboarding.totalSteps} />
        {onboarding.step !== 'complete' && (
          <button
            onClick={handleSkip}
            className="text-secondary text-xs hover:text-on-surface transition-colors"
          >
            Skip
          </button>
        )}
      </div>

      {/* Step content */}
      {onboarding.step === 'welcome' && (
        <WelcomeStep
          onNext={onboarding.nextStep}
          onSkip={handleSkip}
          displayName={user?.user_metadata?.display_name ?? ''}
        />
      )}

      {onboarding.step === 'taste' && (
        <TasteQuizStep
          onNext={onboarding.nextStep}
          onBack={onboarding.prevStep}
          preferences={onboarding.preferences}
          updatePreferences={onboarding.updatePreferences}
        />
      )}

      {onboarding.step === 'first-fragrance' && (
        <FirstFragranceStep
          onNext={onboarding.nextStep}
          onBack={onboarding.prevStep}
        />
      )}

      {onboarding.step === 'complete' && (
        <CompleteStep
          onFinish={handleFinish}
          preferences={onboarding.preferences}
        />
      )}
    </div>
  )
}
