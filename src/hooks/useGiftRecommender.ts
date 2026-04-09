import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Fragrance } from '@/types/database'

export interface GiftPreferences {
  gender: 'male' | 'female' | 'unisex' | 'any'
  ageRange: '18-25' | '26-35' | '36-50' | '50+' | 'any'
  occasion: string
  budget: 'low' | 'mid' | 'high' | 'any'
  vibes: string[]
}

export interface GiftResult {
  fragrance: Fragrance
  matchScore: number
  reasons: string[]
}

const OCCASION_OPTIONS = ['Birthday', 'Anniversary', 'Holiday', 'Thank You', 'Just Because', 'Wedding', 'Graduation', 'Valentine\'s']
const VIBE_OPTIONS = ['Fresh & Clean', 'Warm & Cosy', 'Sexy & Bold', 'Light & Airy', 'Dark & Mysterious', 'Sweet & Playful', 'Elegant & Classic', 'Sporty & Active']

export { OCCASION_OPTIONS, VIBE_OPTIONS }

const VIBE_FAMILY_MAP: Record<string, string[]> = {
  'Fresh & Clean': ['Fresh', 'Citrus', 'Aquatic', 'Green'],
  'Warm & Cosy': ['Oriental', 'Gourmand', 'Woody'],
  'Sexy & Bold': ['Oriental', 'Leather', 'Spicy', 'Musky'],
  'Light & Airy': ['Fresh', 'Floral', 'Citrus', 'Green'],
  'Dark & Mysterious': ['Leather', 'Woody', 'Chypre', 'Spicy'],
  'Sweet & Playful': ['Gourmand', 'Fruity', 'Floral'],
  'Elegant & Classic': ['Floral', 'Chypre', 'Fougere', 'Powdery'],
  'Sporty & Active': ['Fresh', 'Citrus', 'Aquatic', 'Aromatic'],
}

export function useGiftRecommender() {
  const [prefs, setPrefs] = useState<GiftPreferences>({
    gender: 'any',
    ageRange: 'any',
    occasion: '',
    budget: 'any',
    vibes: [],
  })
  const [results, setResults] = useState<GiftResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const updatePref = useCallback(<K extends keyof GiftPreferences>(key: K, value: GiftPreferences[K]) => {
    setPrefs(prev => ({ ...prev, [key]: value }))
  }, [])

  const toggleVibe = useCallback((vibe: string) => {
    setPrefs(prev => ({
      ...prev,
      vibes: prev.vibes.includes(vibe)
        ? prev.vibes.filter(v => v !== vibe)
        : prev.vibes.length < 3 ? [...prev.vibes, vibe] : prev.vibes,
    }))
  }, [])

  const search = useCallback(async () => {
    setLoading(true)
    setSearched(true)

    let query = supabase.from('fragrances').select('*').eq('is_approved', true).limit(200)

    if (prefs.gender !== 'any') {
      if (prefs.gender === 'male') query = query.in('gender', ['Male', 'Unisex'])
      else if (prefs.gender === 'female') query = query.in('gender', ['Female', 'Unisex'])
      else query = query.eq('gender', 'Unisex')
    }

    const { data } = await query
    const fragrances = (data ?? []) as Fragrance[]

    // Score each fragrance
    const targetFamilies = new Set<string>()
    for (const vibe of prefs.vibes) {
      const families = VIBE_FAMILY_MAP[vibe]
      if (families) families.forEach(f => targetFamilies.add(f))
    }

    const scored: GiftResult[] = fragrances.map(f => {
      let score = 0
      const reasons: string[] = []

      // Family match
      if (targetFamilies.size > 0 && f.note_family && targetFamilies.has(f.note_family)) {
        score += 30
        reasons.push(`${f.note_family} matches selected vibes`)
      }

      // Rating boost
      if (f.rating) {
        const r = Number(f.rating)
        if (r >= 4) { score += 20; reasons.push('Highly rated') }
        else if (r >= 3.5) { score += 10 }
      }

      // Budget filter (approximate by price_value)
      if (prefs.budget !== 'any' && f.price_value) {
        const price = Number(f.price_value)
        if (prefs.budget === 'low' && price <= 50) { score += 15; reasons.push('Budget-friendly') }
        else if (prefs.budget === 'mid' && price > 50 && price <= 120) { score += 15; reasons.push('Mid-range price') }
        else if (prefs.budget === 'high' && price > 120) { score += 15; reasons.push('Premium gift') }
        else { score -= 10 }
      }

      // Popularity boost
      if (f.popularity === 'High' || f.popularity === 'Very High') {
        score += 10
        reasons.push('Popular choice')
      }

      // Age range heuristic
      if (prefs.ageRange !== 'any' && f.note_family) {
        const youthFamilies = ['Fresh', 'Citrus', 'Fruity', 'Aquatic']
        const matureFamilies = ['Oriental', 'Woody', 'Leather', 'Chypre']
        if ((prefs.ageRange === '18-25' || prefs.ageRange === '26-35') && youthFamilies.includes(f.note_family)) {
          score += 10
        }
        if ((prefs.ageRange === '36-50' || prefs.ageRange === '50+') && matureFamilies.includes(f.note_family)) {
          score += 10
        }
      }

      if (reasons.length === 0 && score > 0) reasons.push('Good all-rounder')

      return { fragrance: f, matchScore: score, reasons }
    })

    scored.sort((a, b) => b.matchScore - a.matchScore)
    setResults(scored.filter(r => r.matchScore > 0).slice(0, 20))
    setLoading(false)
  }, [prefs])

  return { prefs, updatePref, toggleVibe, results, loading, searched, search }
}
