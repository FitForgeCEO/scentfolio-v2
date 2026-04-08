import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../ui/Icon'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import type { Fragrance } from '@/types/database'

interface LayerPair {
  base: Fragrance
  complement: Fragrance
  reason: string
  score: number
}

// Accord compatibility map — which accords layer well together
const LAYER_COMPAT: Record<string, string[]> = {
  'woody': ['vanilla', 'amber', 'citrus', 'floral', 'spicy', 'aromatic'],
  'citrus': ['woody', 'floral', 'aquatic', 'aromatic', 'green'],
  'floral': ['woody', 'vanilla', 'musky', 'citrus', 'powdery', 'fruity'],
  'vanilla': ['woody', 'amber', 'floral', 'musky', 'sweet', 'spicy'],
  'amber': ['woody', 'vanilla', 'floral', 'spicy', 'musky'],
  'musky': ['floral', 'vanilla', 'woody', 'amber', 'powdery', 'clean'],
  'spicy': ['woody', 'vanilla', 'amber', 'sweet', 'oriental'],
  'aquatic': ['citrus', 'aromatic', 'green', 'woody', 'fresh'],
  'aromatic': ['citrus', 'woody', 'aquatic', 'green', 'fresh'],
  'fresh': ['citrus', 'aquatic', 'aromatic', 'green', 'woody'],
  'sweet': ['vanilla', 'floral', 'fruity', 'spicy', 'amber'],
  'fruity': ['floral', 'sweet', 'citrus', 'vanilla', 'musky'],
  'green': ['citrus', 'aromatic', 'aquatic', 'fresh', 'floral'],
  'powdery': ['floral', 'musky', 'vanilla', 'amber', 'woody'],
  'oriental': ['spicy', 'amber', 'vanilla', 'woody', 'floral'],
  'leather': ['woody', 'spicy', 'amber', 'smoky', 'aromatic'],
  'smoky': ['woody', 'leather', 'spicy', 'amber', 'vanilla'],
  'clean': ['musky', 'citrus', 'aquatic', 'fresh', 'green'],
  'white floral': ['woody', 'vanilla', 'musky', 'citrus', 'green'],
  'warm spicy': ['woody', 'vanilla', 'amber', 'sweet', 'oriental'],
  'rose': ['woody', 'musky', 'vanilla', 'citrus', 'spicy'],
  'oud': ['woody', 'rose', 'amber', 'spicy', 'vanilla'],
}

export function LayeringSuggestionsScreen() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [pairs, setPairs] = useState<LayerPair[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPair, setSelectedPair] = useState<LayerPair | null>(null)

  useEffect(() => {
    if (!user) { setLoading(false); return }

    async function computePairs() {
      const { data } = await supabase
        .from('user_collections')
        .select('fragrance:fragrances(*)')
        .eq('user_id', user!.id)
        .eq('status', 'own')

      type Row = { fragrance: Fragrance | null }
      const fragrances = ((data ?? []) as unknown as Row[])
        .map((r) => r.fragrance)
        .filter((f): f is Fragrance => f !== null && f.accords !== null && f.accords.length > 0)

      const layerPairs: LayerPair[] = []

      // Compare all pairs
      for (let i = 0; i < fragrances.length; i++) {
        for (let j = i + 1; j < fragrances.length; j++) {
          const a = fragrances[i]
          const b = fragrances[j]
          const { score, reasons } = computeCompatibility(a, b)
          if (score > 0 && reasons.length > 0) {
            layerPairs.push({
              base: a,
              complement: b,
              reason: reasons[0],
              score,
            })
          }
        }
      }

      // Sort by score descending, take top 15
      layerPairs.sort((a, b) => b.score - a.score)
      setPairs(layerPairs.slice(0, 15))
      setLoading(false)
    }

    computePairs()
  }, [user])

  function computeCompatibility(a: Fragrance, b: Fragrance): { score: number; reasons: string[] } {
    const aAccords = (a.accords ?? []).map((s) => s.toLowerCase())
    const bAccords = (b.accords ?? []).map((s) => s.toLowerCase())
    let score = 0
    const reasons: string[] = []

    // Check accord compatibility
    for (const accord of aAccords) {
      const compatList = LAYER_COMPAT[accord]
      if (!compatList) continue
      for (const bAccord of bAccords) {
        if (compatList.includes(bAccord)) {
          score += 2
          if (reasons.length === 0) {
            reasons.push(`${capitalize(accord)} + ${capitalize(bAccord)} create a beautiful blend`)
          }
        }
      }
    }

    // Bonus for complementary (not identical) note families
    if (a.note_family && b.note_family && a.note_family !== b.note_family) {
      score += 1
    }

    // Penalty for too-similar fragrances (same brand + same family)
    if (a.brand === b.brand && a.note_family === b.note_family) {
      score -= 3
    }

    // Bonus if different concentrations (EDP + EDT layer well)
    if (a.concentration && b.concentration && a.concentration !== b.concentration) {
      score += 1
    }

    return { score, reasons }
  }

  function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1)
  }

  if (!user) {
    return (
      <main className="pt-24 pb-32 px-6 flex flex-col items-center justify-center min-h-screen gap-4">
        <Icon name="layers" className="text-5xl text-primary/30" />
        <p className="text-secondary/60 text-sm">Sign in to see layering suggestions</p>
      </main>
    )
  }

  if (loading) {
    return (
      <main className="pt-24 pb-32 px-6 flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </main>
    )
  }

  return (
    <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen">
      <section className="text-center mb-6">
        <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-3">
          <Icon name="layers" filled className="text-3xl text-primary" />
        </div>
        <h2 className="font-headline text-xl mb-1">Layering Suggestions</h2>
        <p className="text-[10px] text-secondary/50">Discover which fragrances in your collection pair beautifully</p>
      </section>

      {pairs.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16">
          <Icon name="science" className="text-4xl text-secondary/20" />
          <p className="text-sm text-secondary/50 text-center">
            Add more fragrances with accords to unlock layering suggestions
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {pairs.map((pair, idx) => (
            <button
              key={`${pair.base.id}-${pair.complement.id}`}
              onClick={() => setSelectedPair(selectedPair?.base.id === pair.base.id && selectedPair?.complement.id === pair.complement.id ? null : pair)}
              className="w-full bg-surface-container rounded-xl p-4 text-left active:scale-[0.98] transition-transform"
            >
              <div className="flex items-center gap-3">
                {/* Rank */}
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                  idx < 3 ? 'bg-primary/15' : 'bg-surface-container-low'
                }`}>
                  <span className={`text-[10px] font-bold ${idx < 3 ? 'text-primary' : 'text-secondary/50'}`}>
                    {idx + 1}
                  </span>
                </div>

                {/* Two fragrance images */}
                <div className="flex -space-x-2">
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-surface-container-low border-2 border-surface-container">
                    {pair.base.image_url ? (
                      <img src={pair.base.image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Icon name="water_drop" className="text-secondary/20" size={14} />
                      </div>
                    )}
                  </div>
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-surface-container-low border-2 border-surface-container">
                    {pair.complement.image_url ? (
                      <img src={pair.complement.image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Icon name="water_drop" className="text-secondary/20" size={14} />
                      </div>
                    )}
                  </div>
                </div>

                {/* Names */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-on-surface font-medium truncate">{pair.base.name}</p>
                  <div className="flex items-center gap-1">
                    <Icon name="add" className="text-primary" size={10} />
                    <p className="text-xs text-on-surface font-medium truncate">{pair.complement.name}</p>
                  </div>
                </div>

                {/* Score badge */}
                <div className="bg-primary/10 px-2 py-1 rounded-full flex-shrink-0">
                  <span className="text-[10px] font-bold text-primary">{Math.min(pair.score, 10)}/10</span>
                </div>
              </div>

              {/* Expanded detail */}
              {selectedPair?.base.id === pair.base.id && selectedPair?.complement.id === pair.complement.id && (
                <div className="mt-3 pt-3 border-t border-outline-variant/10 space-y-3">
                  <p className="text-xs text-secondary/60 italic">{pair.reason}</p>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/fragrance/${pair.base.id}`) }}
                      className="bg-surface-container-low rounded-lg p-2.5 active:scale-95 transition-transform"
                    >
                      <p className="text-[9px] uppercase tracking-[0.1em] text-secondary/50">{pair.base.brand}</p>
                      <p className="text-xs text-on-surface font-medium truncate">{pair.base.name}</p>
                      {pair.base.accords && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {pair.base.accords.slice(0, 3).map((a) => (
                            <span key={a} className="text-[8px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full capitalize">{a}</span>
                          ))}
                        </div>
                      )}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/fragrance/${pair.complement.id}`) }}
                      className="bg-surface-container-low rounded-lg p-2.5 active:scale-95 transition-transform"
                    >
                      <p className="text-[9px] uppercase tracking-[0.1em] text-secondary/50">{pair.complement.brand}</p>
                      <p className="text-xs text-on-surface font-medium truncate">{pair.complement.name}</p>
                      {pair.complement.accords && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {pair.complement.accords.slice(0, 3).map((a) => (
                            <span key={a} className="text-[8px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full capitalize">{a}</span>
                          ))}
                        </div>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </main>
  )
}
