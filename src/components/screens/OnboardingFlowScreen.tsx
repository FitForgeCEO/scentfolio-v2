import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useOnboarding, NOTE_FAMILIES, VIBE_OPTIONS, EXPERIENCE_LEVELS } from '@/hooks/useOnboarding'
import { supabase } from '@/lib/supabase'
import { Icon } from '@/components/ui/Icon'
import { trackEvent, AnalyticsEvents } from '@/lib/analytics'

/* ─── shared editorial chrome ─── */
const ROMAN = ['ONE', 'TWO', 'THREE', 'FOUR'] as const

function ChapterMasthead({
  chapter,
  onSkip,
}: {
  chapter: number
  onSkip?: () => void
}) {
  return (
    <header className="flex justify-between items-center px-6 md:px-8 py-6">
      <span className="text-[10px] tracking-[0.25em] font-medium text-primary uppercase">
        Chapter {ROMAN[chapter - 1]} of Four
      </span>
      {onSkip && (
        <button
          onClick={onSkip}
          className="text-[10px] tracking-[0.2em] font-medium text-secondary hover:text-on-surface transition-colors uppercase"
        >
          Skip
        </button>
      )}
    </header>
  )
}

function ChapterNav({
  onBack,
  onNext,
  nextLabel = 'Next',
  nextDisabled,
}: {
  onBack?: () => void
  onNext: () => void
  nextLabel?: string
  nextDisabled?: boolean
}) {
  return (
    <div className="flex justify-between items-center px-6 md:px-8 pb-10 pt-6 mt-auto">
      {onBack ? (
        <button
          onClick={onBack}
          className="flex items-center gap-3 text-secondary hover:text-primary transition-colors group"
        >
          <Icon name="arrow_back" className="text-lg group-hover:-translate-x-0.5 transition-transform" />
          <span className="text-[10px] tracking-[0.2em] uppercase font-medium">Back</span>
        </button>
      ) : (
        <div />
      )}
      <button
        onClick={onNext}
        disabled={nextDisabled}
        className="flex items-center gap-3 gold-gradient text-on-primary rounded-lg px-10 py-3 font-bold disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.98] transition-transform"
        style={{ boxShadow: '0 12px 32px rgba(25,18,16,0.6)' }}
      >
        <span className="text-[10px] tracking-[0.2em] uppercase">{nextLabel}</span>
        <Icon name="arrow_forward" className="text-lg" />
      </button>
    </div>
  )
}

/* ═══════════════════════════════════════════
   CHAPTER ONE — WELCOME (The Frontispiece)
   ═══════════════════════════════════════════ */
function WelcomeStep({
  onNext,
  onSkip,
  displayName,
}: {
  onNext: () => void
  onSkip: () => void
  displayName: string
}) {
  const firstName = displayName.trim().split(' ')[0] || ''
  return (
    <main className="relative min-h-screen flex flex-col overflow-x-hidden">
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{ background: 'radial-gradient(circle at top right, rgba(229,194,118,0.12) 0%, rgba(25,18,16,0) 60%)' }}
      />
      <div className="relative z-10 flex flex-col flex-grow min-h-screen">
        <ChapterMasthead chapter={1} onSkip={onSkip} />

        <section className="flex-grow flex flex-col px-6 md:px-16 pt-8 pb-6 max-w-5xl">
          {/* Editorial header — asymmetric left-aligned */}
          <div className="mb-12">
            <span className="text-primary text-[10px] tracking-[0.3em] font-bold uppercase block mb-4">
              Issue No. 01 · MMXXVI
            </span>
            <h1 className="font-headline text-5xl md:text-7xl lg:text-8xl text-on-background leading-[1.05] mb-6">
              Welcome{firstName && ','}
              {firstName && <><br />{firstName}.</>}
            </h1>
            <p className="font-headline italic text-lg md:text-2xl text-secondary max-w-xl leading-relaxed">
              A quiet room for the scents that mean something.
            </p>
          </div>

          {/* Manifesto — three entries, italic serif */}
          <div className="space-y-10 mb-12 max-w-2xl">
            {[
              { numeral: 'i.', label: 'The Intent', body: 'We do not document fragrances to fill a list. We archive them to preserve the memory of a place, a person, or a season that once was.' },
              { numeral: 'ii.', label: 'The Ritual', body: 'Treat the act of sampling as a slow conversation. Let the heart notes speak before you form your final verdict.' },
              { numeral: 'iii.', label: 'The Curation', body: 'Your journal is personal. There are no right notes, only the ones that resonate with your own olfactory narrative.' },
            ].map(entry => (
              <div key={entry.numeral} className="flex items-start gap-6">
                <span className="font-headline text-primary text-2xl pt-1 flex-shrink-0">{entry.numeral}</span>
                <div className="flex-1">
                  <h3 className="text-[10px] tracking-[0.2em] uppercase text-outline mb-2 font-medium">{entry.label}</h3>
                  <p className="font-headline italic text-base md:text-lg text-on-surface-variant leading-relaxed">
                    {entry.body}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* CTA — gold button + ghost defer */}
          <div className="flex flex-col items-start gap-4 mt-auto">
            <button
              onClick={onNext}
              className="gold-gradient text-on-primary rounded-lg px-10 py-4 font-bold uppercase tracking-[0.2em] text-[11px] active:scale-[0.98] transition-transform"
              style={{ boxShadow: '0 12px 32px rgba(25,18,16,0.6)' }}
            >
              Begin the Journal
            </button>
            <button
              onClick={onSkip}
              className="font-headline italic text-sm text-outline hover:text-primary transition-colors ml-2"
            >
              i'll do this later
            </button>
          </div>
        </section>
      </div>
    </main>
  )
}

/* ═══════════════════════════════════════════
   CHAPTER TWO — TASTE PROFILE (Experience · Notes · Vibes)
   ═══════════════════════════════════════════ */
function TasteQuizStep({
  onNext,
  onBack,
  onSkip,
  preferences,
  updatePreferences,
}: {
  onNext: () => void
  onBack: () => void
  onSkip: () => void
  preferences: { favoriteNotes: string[]; vibes: string[]; experienceLevel: 'beginner' | 'intermediate' | 'connoisseur' | null }
  updatePreferences: (p: Partial<typeof preferences>) => void
}) {
  const [subStep, setSubStep] = useState<0 | 1 | 2>(0)

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
    true

  const headings = [
    { kicker: 'Experience Level', title: 'Where are you in the journey?', tagline: 'There is no wrong answer.' },
    { kicker: 'The Families', title: 'The notes you live in.', tagline: `Pick two to five that resonate. (${preferences.favoriteNotes.length}/5)` },
    { kicker: 'The Mood', title: 'How do you want to feel?', tagline: `Pick up to three. Optional. (${preferences.vibes.length}/3)` },
  ] as const
  const current = headings[subStep]

  const handleBack = () => { if (subStep === 0) onBack(); else setSubStep(s => (s - 1) as 0 | 1 | 2) }
  const handleNext = () => { if (subStep < 2) setSubStep(s => (s + 1) as 0 | 1 | 2); else onNext() }

  return (
    <main className="relative min-h-screen flex flex-col overflow-x-hidden">
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{ background: 'radial-gradient(circle at bottom left, rgba(229,194,118,0.1) 0%, rgba(25,18,16,0) 60%)' }}
      />
      <div className="relative z-10 flex flex-col flex-grow min-h-screen">
        <ChapterMasthead chapter={2} onSkip={onSkip} />

        <section className="flex-grow flex flex-col px-6 md:px-8 pt-8 pb-4 max-w-2xl mx-auto w-full">
          {/* Sub-step hairlines */}
          <div className="flex gap-2 mb-10">
            {[0, 1, 2].map(i => (
              <div key={i} className={`h-px flex-1 transition-all ${i <= subStep ? 'bg-primary' : 'bg-outline-variant/30'}`} />
            ))}
          </div>

          {/* Editorial header */}
          <div className="text-center mb-10">
            <span className="font-label text-[10px] uppercase tracking-[0.3em] text-primary mb-4 block">{current.kicker}</span>
            <h1 className="font-headline text-4xl md:text-5xl text-on-background mb-4 leading-tight">{current.title}</h1>
            <p className="font-headline italic text-base md:text-lg text-secondary/80">{current.tagline}</p>
          </div>

          {/* Sub-step 0: Experience cards */}
          {subStep === 0 && (
            <div className="space-y-5">
              {EXPERIENCE_LEVELS.map(level => {
                const selected = preferences.experienceLevel === level.id
                return (
                  <button
                    key={level.id}
                    onClick={() => updatePreferences({ experienceLevel: level.id })}
                    className={`relative w-full text-left overflow-hidden rounded-lg p-6 md:p-8 transition-all duration-500 ${
                      selected
                        ? 'bg-surface-container-highest'
                        : 'bg-surface-container hover:bg-surface-container-high'
                    }`}
                    style={selected ? { boxShadow: 'inset 0 0 20px rgba(229,194,118,0.15)' } : undefined}
                  >
                    {selected && <div className="absolute top-0 left-0 w-[3px] h-full bg-primary" />}
                    <div className="flex justify-between items-start gap-6 relative z-10">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-3">
                          <h3 className={`font-label text-base uppercase tracking-[0.15em] ${selected ? 'text-primary' : 'text-on-surface'}`}>
                            {level.label}
                          </h3>
                          {selected && (
                            <span className="bg-primary-container/20 text-primary text-[9px] tracking-[0.15em] px-2 py-0.5 rounded-full font-bold uppercase">
                              Selected
                            </span>
                          )}
                        </div>
                        <p className="font-headline italic text-sm md:text-base text-on-surface-variant leading-relaxed max-w-md">
                          {level.description}
                        </p>
                      </div>
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                        selected ? 'bg-primary text-on-primary' : 'bg-surface-container-highest text-outline'
                      }`}>
                        <Icon name={selected ? 'check' : 'radio_button_unchecked'} className="text-lg" />
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {/* Sub-step 1: Note families grid */}
          {subStep === 1 && (
            <div className="grid grid-cols-2 gap-3">
              {NOTE_FAMILIES.map(note => {
                const selected = preferences.favoriteNotes.includes(note.id)
                const muted = !selected && preferences.favoriteNotes.length >= 5
                return (
                  <button
                    key={note.id}
                    onClick={() => toggleNote(note.id)}
                    disabled={muted}
                    className={`relative text-left rounded-lg p-4 transition-all duration-300 ${
                      selected ? 'bg-surface-container-highest' : 'bg-surface-container hover:bg-surface-container-high'
                    } ${muted ? 'opacity-30' : ''}`}
                    style={selected ? { boxShadow: 'inset 0 0 16px rgba(229,194,118,0.15)' } : undefined}
                  >
                    {selected && <div className="absolute top-0 left-0 w-[3px] h-full bg-primary rounded-l-lg" />}
                    <span className="text-xl block mb-2">{note.icon}</span>
                    <div className={`font-label text-xs uppercase tracking-[0.1em] font-medium ${selected ? 'text-primary' : 'text-on-surface'}`}>
                      {note.label}
                    </div>
                    <div className="font-headline italic text-[11px] text-on-surface-variant mt-1 leading-snug">
                      {note.description}
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {/* Sub-step 2: Vibes grid */}
          {subStep === 2 && (
            <div className="grid grid-cols-2 gap-3">
              {VIBE_OPTIONS.map(vibe => {
                const selected = preferences.vibes.includes(vibe.id)
                const muted = !selected && preferences.vibes.length >= 3
                return (
                  <button
                    key={vibe.id}
                    onClick={() => toggleVibe(vibe.id)}
                    disabled={muted}
                    className={`relative flex items-center gap-3 rounded-lg p-4 transition-all duration-300 ${
                      selected ? 'bg-surface-container-highest' : 'bg-surface-container hover:bg-surface-container-high'
                    } ${muted ? 'opacity-30' : ''}`}
                    style={selected ? { boxShadow: 'inset 0 0 16px rgba(229,194,118,0.15)' } : undefined}
                  >
                    {selected && <div className="absolute top-0 left-0 w-[3px] h-full bg-primary rounded-l-lg" />}
                    <span className="text-xl">{vibe.icon}</span>
                    <span className={`font-label text-xs uppercase tracking-[0.1em] font-medium ${selected ? 'text-primary' : 'text-on-surface'}`}>
                      {vibe.label}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </section>

        <ChapterNav
          onBack={handleBack}
          onNext={handleNext}
          nextLabel={subStep < 2 ? 'Continue' : 'Next'}
          nextDisabled={!canContinue}
        />
      </div>
    </main>
  )
}

/* ═══════════════════════════════════════════
   CHAPTER THREE — YOUR FIRST BOTTLES
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
  onSkip,
}: {
  onNext: () => void
  onBack: () => void
  onSkip: () => void
}) {
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [added, setAdded] = useState<string[]>([])
  const [adding, setAdding] = useState<string | null>(null)

  // Debounced search — preserved from original
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
    <main className="relative min-h-screen flex flex-col overflow-x-hidden">
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{ background: 'radial-gradient(circle at top right, rgba(229,194,118,0.12) 0%, rgba(25,18,16,0) 60%)' }}
      />
      <div className="relative z-10 flex flex-col flex-grow min-h-screen">
        <ChapterMasthead chapter={3} onSkip={onSkip} />

        <section className="flex-grow flex flex-col px-6 md:px-8 pt-8 pb-4 max-w-2xl mx-auto w-full">
          {/* Editorial header */}
          <div className="mb-10">
            <span className="text-primary text-[10px] uppercase tracking-[0.2em] font-medium mb-4 block">Chapter Three</span>
            <h1 className="font-headline text-4xl md:text-5xl text-on-background leading-[1.1] mb-8">
              What&rsquo;s already on your shelf?
            </h1>

            {/* Editorial search */}
            <div className="relative">
              <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
                <Icon name="search" className="text-outline text-xl" />
              </div>
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search for a scent…"
                autoFocus
                className="w-full bg-surface-container border-none py-5 pl-14 pr-14 rounded-xl text-on-surface placeholder:font-headline placeholder:italic placeholder:text-outline/60 focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all text-base"
              />
              {searching && (
                <div className="absolute right-5 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                </div>
              )}
            </div>
          </div>

          {/* Count band — no divider line, hairline only */}
          <div className="flex justify-between items-baseline mb-8 pb-4 border-b border-outline-variant/15">
            <span className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">Added count</span>
            <span className="font-headline italic text-base text-secondary">
              {added.length.toString().padStart(2, '0')} fragrance{added.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Results */}
          <div className="flex-grow">
            {query.length < 2 && results.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 opacity-40">
                <span className="text-[10px] uppercase tracking-[0.3em] text-primary font-bold">Start Typing</span>
                <p className="font-headline italic text-sm text-outline mt-3 max-w-xs text-center">
                  e.g. &ldquo;Bleu de Chanel&rdquo; or &ldquo;Tom Ford&rdquo;
                </p>
              </div>
            )}

            {query.length >= 2 && !searching && results.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 opacity-50">
                <span className="text-[10px] uppercase tracking-[0.3em] text-secondary font-bold">Nothing Found</span>
                <p className="font-headline italic text-sm text-outline mt-3 max-w-xs text-center">
                  No fragrances for &ldquo;{query}&rdquo;. Try a different spelling.
                </p>
              </div>
            )}

            <div className="space-y-6">
              {results.map(f => {
                const isAdded = added.includes(f.id)
                const isAdding = adding === f.id
                return (
                  <article key={f.id} className="flex gap-6 items-center group">
                    <div className="relative w-20 h-28 flex-shrink-0 bg-surface-container-low rounded-lg overflow-hidden">
                      {f.image_url ? (
                        <img src={f.image_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-outline/40 text-2xl">✦</div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    </div>
                    <div className="flex-grow min-w-0">
                      <h3 className="font-body text-base text-on-surface font-medium leading-tight mb-1 truncate">{f.name}</h3>
                      <p className="font-headline italic text-secondary text-sm truncate">{f.brand}</p>
                    </div>
                    <button
                      onClick={() => addToCollection(f)}
                      disabled={isAdded || isAdding}
                      className="flex flex-col items-center group/btn cursor-pointer min-w-[56px]"
                    >
                      {isAdding ? (
                        <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                      ) : isAdded ? (
                        <>
                          <span className="text-[10px] uppercase tracking-[0.15em] text-primary font-bold mb-1">Added</span>
                          <Icon name="check_circle" className="text-primary text-lg" />
                        </>
                      ) : (
                        <>
                          <span className="text-[10px] uppercase tracking-[0.15em] text-secondary group-hover/btn:text-primary transition-colors mb-1 font-bold">+ Add</span>
                          <div className="w-1/2 h-px bg-primary opacity-30 group-hover/btn:opacity-100 transition-opacity" />
                        </>
                      )}
                    </button>
                  </article>
                )
              })}
            </div>
          </div>
        </section>

        <ChapterNav
          onBack={onBack}
          onNext={onNext}
          nextLabel={added.length > 0 ? 'Continue' : 'Skip for now'}
        />
      </div>
    </main>
  )
}

/* ─── Chapter 4 — Ready (The closing page) ─── */
function CompleteStep({
  preferences,
  onFinish,
  onBack,
  loading,
}: {
  preferences: { favoriteNotes: string[]; vibes: string[]; experienceLevel: 'beginner' | 'intermediate' | 'connoisseur' | null }
  onFinish: () => void
  onBack: () => void
  loading: boolean
}) {
  const experienceLabel =
    EXPERIENCE_LEVELS.find(l => l.id === preferences.experienceLevel)?.label ?? 'Just beginning'
  const noteLabels = preferences.favoriteNotes
    .map(id => NOTE_FAMILIES.find(n => n.id === id)?.name)
    .filter(Boolean) as string[]
  const vibeLabels = preferences.vibes
    .map(id => VIBE_OPTIONS.find(v => v.id === id)?.name)
    .filter(Boolean) as string[]

  return (
    <main className="relative min-h-screen flex flex-col overflow-x-hidden">
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{ background: 'radial-gradient(circle at top right, rgba(229,194,118,0.14) 0%, rgba(25,18,16,0) 65%)' }}
      />
      <div className="relative z-10 flex flex-col flex-grow min-h-screen">
        <ChapterMasthead chapter={4} />

        <section className="flex-grow flex flex-col px-6 md:px-16 pt-8 pb-6 max-w-4xl">
          {/* Masthead */}
          <div className="mb-16">
            <span className="text-primary text-[10px] tracking-[0.3em] font-bold uppercase block mb-4">
              Chapter Four · Ready
            </span>
            <h1 className="font-headline text-5xl md:text-6xl lg:text-7xl leading-[1.05] mb-6 text-on-background">
              Your shelf
              <br />
              is ready.
            </h1>
            <p className="font-body text-secondary text-lg md:text-xl max-w-md opacity-80 leading-relaxed">
              Here&rsquo;s what we know about you so far.
            </p>
          </div>

          {/* Three editorial sections */}
          <div className="space-y-14">
            {/* EXPERIENCE */}
            <section>
              <div className="flex justify-between items-end mb-4">
                <h3 className="text-primary text-[10px] tracking-[0.25em] font-semibold uppercase">
                  Experience
                </h3>
              </div>
              <div className="h-px w-full bg-gradient-to-r from-primary/40 via-primary/10 to-transparent mb-6" />
              <p className="font-headline italic text-2xl md:text-3xl text-on-surface-variant leading-relaxed">
                {experienceLabel}
              </p>
            </section>

            {/* FAMILIES YOU LIVE IN */}
            {noteLabels.length > 0 && (
              <section>
                <div className="flex justify-between items-end mb-4">
                  <h3 className="text-primary text-[10px] tracking-[0.25em] font-semibold uppercase">
                    Families you live in
                  </h3>
                </div>
                <div className="h-px w-full bg-gradient-to-r from-primary/40 via-primary/10 to-transparent mb-6" />
                <div className="flex flex-wrap gap-3">
                  {noteLabels.map((label, idx) => (
                    <span
                      key={idx}
                      className="px-5 py-2.5 rounded-full bg-surface-container-highest text-on-surface text-sm tracking-wide"
                      style={{ boxShadow: 'inset 0 0 12px rgba(229,194,118,0.08)' }}
                    >
                      {label}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* THE MOOD YOU WANT */}
            {vibeLabels.length > 0 && (
              <section>
                <div className="flex justify-between items-end mb-4">
                  <h3 className="text-primary text-[10px] tracking-[0.25em] font-semibold uppercase">
                    The mood you want
                  </h3>
                </div>
                <div className="h-px w-full bg-gradient-to-r from-primary/40 via-primary/10 to-transparent mb-6" />
                <div
                  className="bg-surface-container p-8 rounded-xl relative overflow-hidden"
                  style={{ boxShadow: '0 12px 32px rgba(25,18,16,0.6)' }}
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16" />
                  <p className="font-headline italic text-2xl md:text-3xl text-on-surface leading-tight relative">
                    {vibeLabels.map((label, idx) => (
                      <span key={idx}>
                        <span className="text-primary not-italic font-bold">{label}</span>
                        {idx < vibeLabels.length - 1 && (
                          <span className="text-primary/40 mx-2">·</span>
                        )}
                      </span>
                    ))}
                  </p>
                </div>
              </section>
            )}
          </div>

          {/* Finish CTA — centred, Ambient Lift */}
          <div className="mt-20 mb-8 flex flex-col items-center gap-6">
            <button
              onClick={onFinish}
              disabled={loading}
              className="gold-gradient text-on-primary rounded-lg px-12 py-5 font-bold uppercase tracking-[0.2em] text-sm hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 disabled:opacity-60 disabled:hover:scale-100"
              style={{ boxShadow: '0 12px 32px rgba(25,18,16,0.6)' }}
            >
              {loading ? 'Opening…' : 'Open ScentFolio'}
            </button>
            <button
              onClick={onBack}
              className="text-secondary hover:text-on-surface transition-colors text-[10px] tracking-[0.2em] font-medium uppercase flex items-center gap-2"
            >
              <Icon name="arrow_back" className="text-sm" />
              Back
            </button>
          </div>
        </section>
      </div>
    </main>
  )
}

/* ─── Main orchestrator ─── */
export function OnboardingFlowScreen() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const onboarding = useOnboarding()
  const [finishing, setFinishing] = useState(false)

  const displayName =
    (user?.user_metadata?.['display_name'] as string | undefined) ??
    (user?.user_metadata?.['full_name'] as string | undefined) ??
    user?.email?.split('@')[0] ??
    ''

  const handleFinish = useCallback(async () => {
    setFinishing(true)
    try {
      await onboarding.completeOnboarding()
      trackEvent(AnalyticsEvents.COMPLETE_ONBOARDING, { method: 'completed' })
      navigate('/', { replace: true })
    } finally {
      setFinishing(false)
    }
  }, [onboarding, navigate])

  const handleSkip = useCallback(() => {
    onboarding.skipOnboarding()
    trackEvent(AnalyticsEvents.COMPLETE_ONBOARDING, { method: 'skipped' })
    navigate('/', { replace: true })
  }, [onboarding, navigate])

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/', { replace: true })
      return
    }
    if (!onboarding.loading && onboarding.isComplete) {
      navigate('/', { replace: true })
    }
  }, [authLoading, user, onboarding.loading, onboarding.isComplete, navigate])

  if (authLoading || onboarding.loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <span className="text-[10px] tracking-[0.25em] text-secondary uppercase animate-pulse">
          Preparing the journal…
        </span>
      </main>
    )
  }

  switch (onboarding.step) {
    case 'welcome':
      return (
        <WelcomeStep
          displayName={displayName}
          onNext={onboarding.nextStep}
          onSkip={handleSkip}
        />
      )
    case 'taste':
      return (
        <TasteQuizStep
          preferences={onboarding.preferences}
          updatePreferences={onboarding.updatePreferences}
          onNext={onboarding.nextStep}
          onBack={onboarding.prevStep}
          onSkip={handleSkip}
        />
      )
    case 'first-fragrance':
      return (
        <FirstFragranceStep
          onNext={onboarding.nextStep}
          onBack={onboarding.prevStep}
          onSkip={handleSkip}
        />
      )
    case 'complete':
      return (
        <CompleteStep
          preferences={onboarding.preferences}
          onFinish={handleFinish}
          onBack={onboarding.prevStep}
          loading={finishing}
        />
      )
    default:
      return null
  }
}
