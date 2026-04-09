import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

export type OnboardingStep = 'welcome' | 'taste' | 'first-fragrance' | 'complete'

const STEPS: OnboardingStep[] = ['welcome', 'taste', 'first-fragrance', 'complete']

interface OnboardingPreferences {
  favoriteNotes: string[]
  vibes: string[]
  experienceLevel: 'beginner' | 'intermediate' | 'connoisseur' | null
}

interface OnboardingState {
  step: OnboardingStep
  stepIndex: number
  totalSteps: number
  preferences: OnboardingPreferences
  isComplete: boolean
  loading: boolean
  setStep: (step: OnboardingStep) => void
  nextStep: () => void
  prevStep: () => void
  updatePreferences: (partial: Partial<OnboardingPreferences>) => void
  completeOnboarding: () => Promise<void>
  skipOnboarding: () => void
  needsOnboarding: boolean
}

function getStorageKey(userId: string) {
  return `scentfolio_onboarding_complete_${userId}`
}

export function useOnboarding(): OnboardingState {
  const { user } = useAuth()
  const [step, setStep] = useState<OnboardingStep>('welcome')
  const [preferences, setPreferences] = useState<OnboardingPreferences>({
    favoriteNotes: [],
    vibes: [],
    experienceLevel: null,
  })
  const [isComplete, setIsComplete] = useState(false)
  const [loading, setLoading] = useState(true)

  // Check if onboarding already completed
  useEffect(() => {
    if (!user) { setLoading(false); return }

    const stored = localStorage.getItem(getStorageKey(user.id))
    if (stored === 'true') {
      setIsComplete(true)
      setLoading(false)
      return
    }

    // Also check if they have profile_extras (returning user who already set up)
    supabase
      .from('profile_extras')
      .select('bio, favorite_notes')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data && (data.bio || (data.favorite_notes && data.favorite_notes.length > 0))) {
          localStorage.setItem(getStorageKey(user.id), 'true')
          setIsComplete(true)
        }
        setLoading(false)
      })
  }, [user])

  const stepIndex = STEPS.indexOf(step)

  const nextStep = useCallback(() => {
    const next = stepIndex + 1
    if (next < STEPS.length) setStep(STEPS[next])
  }, [stepIndex])

  const prevStep = useCallback(() => {
    const prev = stepIndex - 1
    if (prev >= 0) setStep(STEPS[prev])
  }, [stepIndex])

  const updatePreferences = useCallback((partial: Partial<OnboardingPreferences>) => {
    setPreferences(prev => ({ ...prev, ...partial }))
  }, [])

  const completeOnboarding = useCallback(async () => {
    if (!user) return

    // Save favorite notes to profile_extras
    if (preferences.favoriteNotes.length > 0) {
      try {
        const { error } = await supabase
          .from('profile_extras')
          .upsert({
            user_id: user.id,
            favorite_notes: preferences.favoriteNotes,
          }, { onConflict: 'user_id' })

        if (error) throw error
      } catch {
        // localStorage fallback
        localStorage.setItem(`scentfolio_profile_extras_${user.id}`, JSON.stringify({
          bio: '',
          signature_fragrance_id: null,
          favorite_notes: preferences.favoriteNotes,
        }))
      }
    }

    localStorage.setItem(getStorageKey(user.id), 'true')
    setIsComplete(true)
  }, [user, preferences])

  const skipOnboarding = useCallback(() => {
    if (!user) return
    localStorage.setItem(getStorageKey(user.id), 'true')
    setIsComplete(true)
  }, [user])

  return {
    step,
    stepIndex,
    totalSteps: STEPS.length,
    preferences,
    isComplete,
    loading,
    setStep,
    nextStep,
    prevStep,
    updatePreferences,
    completeOnboarding,
    skipOnboarding,
    needsOnboarding: !loading && !!user && !isComplete,
  }
}

// Note family options with icons for the taste quiz
export const NOTE_FAMILIES = [
  { id: 'floral', label: 'Floral', icon: '🌸', description: 'Rose, jasmine, lily' },
  { id: 'woody', label: 'Woody', icon: '🪵', description: 'Sandalwood, cedar, oud' },
  { id: 'oriental', label: 'Oriental', icon: '✨', description: 'Vanilla, amber, spice' },
  { id: 'fresh', label: 'Fresh', icon: '🍃', description: 'Citrus, aquatic, green' },
  { id: 'gourmand', label: 'Gourmand', icon: '🍯', description: 'Caramel, chocolate, coffee' },
  { id: 'aromatic', label: 'Aromatic', icon: '🌿', description: 'Lavender, herbs, sage' },
  { id: 'citrus', label: 'Citrus', icon: '🍋', description: 'Bergamot, lemon, orange' },
  { id: 'musky', label: 'Musky', icon: '🌙', description: 'White musk, clean skin' },
  { id: 'smoky', label: 'Smoky', icon: '🔥', description: 'Incense, leather, tobacco' },
  { id: 'aquatic', label: 'Aquatic', icon: '🌊', description: 'Ocean, rain, ozone' },
  { id: 'powdery', label: 'Powdery', icon: '☁️', description: 'Iris, violet, heliotrope' },
  { id: 'fruity', label: 'Fruity', icon: '🍑', description: 'Berry, peach, apple' },
] as const

export const VIBE_OPTIONS = [
  { id: 'confident', label: 'Confident', icon: '👑' },
  { id: 'romantic', label: 'Romantic', icon: '💕' },
  { id: 'mysterious', label: 'Mysterious', icon: '🌑' },
  { id: 'fresh-clean', label: 'Fresh & Clean', icon: '💎' },
  { id: 'cozy', label: 'Cozy', icon: '🧸' },
  { id: 'adventurous', label: 'Adventurous', icon: '🧭' },
  { id: 'elegant', label: 'Elegant', icon: '🦢' },
  { id: 'playful', label: 'Playful', icon: '🎭' },
] as const

export const EXPERIENCE_LEVELS = [
  { id: 'beginner' as const, label: 'Just Starting Out', description: 'I own a few fragrances and want to explore more', icon: '🌱' },
  { id: 'intermediate' as const, label: 'Growing Collector', description: 'I know what I like and have 10+ bottles', icon: '🌿' },
  { id: 'connoisseur' as const, label: 'Connoisseur', description: 'Fragrance is a passion — niche, vintage, the lot', icon: '🏛️' },
] as const
