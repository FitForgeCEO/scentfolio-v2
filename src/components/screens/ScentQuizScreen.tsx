import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../ui/Icon'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { supabase } from '@/lib/supabase'
import { hapticLight, hapticSuccess } from '@/lib/haptics'

/* ── Quiz structure ─────────────────────────────────────── */
interface QuizQuestion {
  id: string
  question: string
  subtitle: string
  options: { label: string; icon: string; value: string }[]
}

const QUESTIONS: QuizQuestion[] = [
  {
    id: 'warmth',
    question: 'Warm or fresh?',
    subtitle: 'What draws you in first?',
    options: [
      { label: 'Warm & cosy', icon: 'local_fire_department', value: 'warm' },
      { label: 'Cool & crisp', icon: 'ac_unit', value: 'fresh' },
      { label: 'Both equally', icon: 'balance', value: 'balanced' },
    ],
  },
  {
    id: 'weight',
    question: 'Light or heavy?',
    subtitle: 'How much presence do you want?',
    options: [
      { label: 'Skin scent — just for me', icon: 'spa', value: 'light' },
      { label: 'Moderate trail', icon: 'air', value: 'moderate' },
      { label: 'Beast mode — announce my arrival', icon: 'storm', value: 'heavy' },
    ],
  },
  {
    id: 'occasion',
    question: 'When do you wear fragrance most?',
    subtitle: 'Your primary scent situation',
    options: [
      { label: 'Daily / office', icon: 'work', value: 'daily' },
      { label: 'Nights out & dates', icon: 'nightlife', value: 'evening' },
      { label: 'Weekends & casual', icon: 'weekend', value: 'casual' },
      { label: 'All the time', icon: 'schedule', value: 'allday' },
    ],
  },
  {
    id: 'families',
    question: 'Pick your favourites',
    subtitle: 'Select all that appeal to you',
    options: [
      { label: 'Woody', icon: 'park', value: 'woody' },
      { label: 'Floral', icon: 'local_florist', value: 'floral' },
      { label: 'Citrus', icon: 'emoji_nature', value: 'citrus' },
      { label: 'Oriental', icon: 'auto_awesome', value: 'oriental' },
      { label: 'Aquatic', icon: 'water_drop', value: 'aquatic' },
      { label: 'Gourmand', icon: 'cake', value: 'gourmand' },
      { label: 'Aromatic', icon: 'grass', value: 'aromatic' },
      { label: 'Leather', icon: 'style', value: 'leather' },
    ],
  },
  {
    id: 'adventurous',
    question: 'How adventurous are you?',
    subtitle: 'With trying new scents',
    options: [
      { label: 'I stick to what I know', icon: 'favorite', value: 'conservative' },
      { label: 'Open to new things', icon: 'explore', value: 'moderate' },
      { label: 'Always hunting for the next gem', icon: 'rocket_launch', value: 'adventurous' },
    ],
  },
  {
    id: 'season',
    question: 'Your favourite scent season?',
    subtitle: 'When fragrances feel best to you',
    options: [
      { label: 'Spring', icon: 'local_florist', value: 'spring' },
      { label: 'Summer', icon: 'wb_sunny', value: 'summer' },
      { label: 'Autumn', icon: 'eco', value: 'autumn' },
      { label: 'Winter', icon: 'ac_unit', value: 'winter' },
    ],
  },
]

export interface ScentProfile {
  warmth: string
  weight: string
  occasion: string
  families: string[]
  adventurous: string
  season: string
  completedAt: string
}

function generateProfileSummary(profile: ScentProfile): string {
  const parts: string[] = []

  if (profile.warmth === 'warm') parts.push('warm and enveloping')
  else if (profile.warmth === 'fresh') parts.push('fresh and invigorating')
  else parts.push('versatile')

  if (profile.weight === 'heavy') parts.push('bold projection')
  else if (profile.weight === 'light') parts.push('intimate skin scents')
  else parts.push('moderate sillage')

  if (profile.families.length > 0) parts.push(profile.families.slice(0, 3).join(', '))

  if (profile.adventurous === 'adventurous') parts.push('always exploring')
  else if (profile.adventurous === 'conservative') parts.push('loyal to favourites')

  return `You love ${parts.join(' · ')}`
}

export function ScentQuizScreen() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({})
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<ScentProfile | null>(null)

  const currentQ = QUESTIONS[step]
  const isMultiSelect = currentQ?.id === 'families'
  const totalSteps = QUESTIONS.length

  const handleSelect = (value: string) => {
    hapticLight()
    if (isMultiSelect) {
      const current = (answers[currentQ.id] as string[]) || []
      const updated = current.includes(value) ? current.filter(v => v !== value) : [...current, value]
      setAnswers(prev => ({ ...prev, [currentQ.id]: updated }))
    } else {
      setAnswers(prev => ({ ...prev, [currentQ.id]: value }))
      // Auto-advance for single select
      if (step < totalSteps - 1) {
        setTimeout(() => setStep(s => s + 1), 300)
      }
    }
  }

  const handleNext = () => {
    if (step < totalSteps - 1) setStep(s => s + 1)
    else handleFinish()
  }

  const handleFinish = async () => {
    const profile: ScentProfile = {
      warmth: (answers.warmth as string) ?? 'balanced',
      weight: (answers.weight as string) ?? 'moderate',
      occasion: (answers.occasion as string) ?? 'allday',
      families: (answers.families as string[]) ?? [],
      adventurous: (answers.adventurous as string) ?? 'moderate',
      season: (answers.season as string) ?? 'autumn',
      completedAt: new Date().toISOString(),
    }

    setResult(profile)
    hapticSuccess()

    // Save to Supabase if logged in
    if (user) {
      setSaving(true)
      try {
        await supabase
          .from('profiles')
          .update({ scent_profile: profile as unknown as Record<string, unknown> })
          .eq('id', user.id)
        showToast('Scent profile saved!', 'success')
      } catch {
        // Save to localStorage as fallback
        localStorage.setItem('scentfolio-scent-profile', JSON.stringify(profile))
        showToast('Profile saved locally', 'success')
      }
      setSaving(false)
    } else {
      localStorage.setItem('scentfolio-scent-profile', JSON.stringify(profile))
    }
  }

  if (!currentQ && !result) return null

  // Results screen
  if (result) {
    const summary = generateProfileSummary(result)
    return (
      <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen flex flex-col items-center justify-center gap-6 animate-fade-in">
        <div className="w-20 h-20 rounded-full gold-gradient flex items-center justify-center ambient-glow">
          <Icon name="auto_awesome" size={36} style={{ color: '#3f2e00' }} />
        </div>

        <div className="text-center space-y-2">
          <h2 className="font-headline text-2xl text-on-surface">Your Scent Profile</h2>
          <p className="text-sm text-on-surface-variant leading-relaxed max-w-[280px]">{summary}</p>
        </div>

        {/* Profile breakdown */}
        <div className="w-full space-y-3">
          <div className="flex justify-between bg-surface-container rounded-xl p-4">
            <span className="text-xs text-secondary/50">Temperature</span>
            <span className="text-xs text-on-surface font-medium capitalize">{result.warmth}</span>
          </div>
          <div className="flex justify-between bg-surface-container rounded-xl p-4">
            <span className="text-xs text-secondary/50">Projection</span>
            <span className="text-xs text-on-surface font-medium capitalize">{result.weight}</span>
          </div>
          <div className="flex justify-between bg-surface-container rounded-xl p-4">
            <span className="text-xs text-secondary/50">Occasion</span>
            <span className="text-xs text-on-surface font-medium capitalize">{result.occasion}</span>
          </div>
          {result.families.length > 0 && (
            <div className="bg-surface-container rounded-xl p-4">
              <span className="text-xs text-secondary/50 block mb-2">Favourite families</span>
              <div className="flex flex-wrap gap-1.5">
                {result.families.map(f => (
                  <span key={f} className="px-3 py-1 rounded-full bg-primary/15 text-primary text-[10px] font-medium capitalize">{f}</span>
                ))}
              </div>
            </div>
          )}
          <div className="flex justify-between bg-surface-container rounded-xl p-4">
            <span className="text-xs text-secondary/50">Favourite season</span>
            <span className="text-xs text-on-surface font-medium capitalize">{result.season}</span>
          </div>
        </div>

        <button
          onClick={() => navigate('/profile')}
          disabled={saving}
          className="w-full py-3.5 gold-gradient text-on-primary-container font-bold uppercase tracking-[0.1em] rounded-xl ambient-glow active:scale-[0.98] transition-all text-sm"
        >
          {saving ? 'SAVING...' : 'DONE'}
        </button>

        <button onClick={() => { setResult(null); setStep(0); setAnswers({}) }} className="text-xs text-secondary/40 underline">
          Retake quiz
        </button>
      </main>
    )
  }

  // Quiz screen
  const selectedValue = answers[currentQ.id]
  const canProceed = isMultiSelect ? ((selectedValue as string[])?.length > 0) : !!selectedValue

  return (
    <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen">
      {/* Progress */}
      <div className="flex gap-1.5 mb-8">
        {QUESTIONS.map((_, i) => (
          <div key={i} className={`flex-1 h-1 rounded-full transition-all ${i <= step ? 'bg-primary' : 'bg-surface-container-highest'}`} />
        ))}
      </div>

      {/* Question */}
      <div className="mb-8 animate-fade-in" key={step}>
        <p className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold mb-2">{step + 1} OF {totalSteps}</p>
        <h2 className="font-headline text-2xl text-on-surface mb-1">{currentQ.question}</h2>
        <p className="text-sm text-on-surface-variant">{currentQ.subtitle}</p>
      </div>

      {/* Options */}
      <div className={`${isMultiSelect ? 'grid grid-cols-2 gap-3' : 'space-y-3'} mb-8 animate-fade-in`} key={`opts-${step}`}>
        {currentQ.options.map(opt => {
          const isSelected = isMultiSelect
            ? ((selectedValue as string[]) ?? []).includes(opt.value)
            : selectedValue === opt.value

          return (
            <button
              key={opt.value}
              onClick={() => handleSelect(opt.value)}
              className={`w-full flex items-center gap-3 p-4 rounded-xl text-left transition-all active:scale-[0.97] ${
                isSelected
                  ? 'bg-primary/15 ring-2 ring-primary'
                  : 'bg-surface-container hover:bg-surface-container-high'
              }`}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isSelected ? 'bg-primary/20' : 'bg-surface-container-highest'}`}>
                <Icon name={opt.icon} className={isSelected ? 'text-primary' : 'text-secondary/50'} size={20} />
              </div>
              <span className={`text-sm font-medium ${isSelected ? 'text-primary' : 'text-on-surface'}`}>{opt.label}</span>
              {isSelected && <Icon name="check_circle" className="text-primary ml-auto" size={20} />}
            </button>
          )
        })}
      </div>

      {/* Navigation */}
      <div className="flex gap-3">
        {step > 0 && (
          <button
            onClick={() => setStep(s => s - 1)}
            className="px-6 py-3.5 bg-surface-container rounded-xl text-sm font-medium active:scale-95 transition-transform"
          >
            Back
          </button>
        )}
        {(isMultiSelect || step === totalSteps - 1) && (
          <button
            onClick={handleNext}
            disabled={!canProceed}
            className="flex-1 py-3.5 gold-gradient text-on-primary-container font-bold uppercase tracking-[0.1em] rounded-xl active:scale-[0.98] transition-all text-sm disabled:opacity-30"
          >
            {step === totalSteps - 1 ? 'SEE RESULTS' : 'NEXT'}
          </button>
        )}
      </div>
    </main>
  )
}
