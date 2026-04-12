import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { supabase } from '@/lib/supabase'
import { awardXP } from '@/lib/xp'
import type { Fragrance } from '@/types/database'
import { getIconChar } from '@/lib/iconUtils'

interface Mood {
  id: string
  label: string
  icon: string
  families: string[]
  accords: string[]
  description: string
}

const MOODS: Mood[] = [
  {
    id: 'confident',
    label: 'Confident',
    icon: 'local_fire_department',
    families: ['Woody', 'Leather', 'Spicy'],
    accords: ['leather', 'oud', 'tobacco', 'amber', 'woody'],
    description: 'Bold, commanding, powerful',
  },
  {
    id: 'romantic',
    label: 'Romantic',
    icon: 'favorite',
    families: ['Floral', 'Oriental', 'Sweet'],
    accords: ['rose', 'jasmine', 'vanilla', 'musk', 'powdery'],
    description: 'Soft, sensual, intimate',
  },
  {
    id: 'fresh',
    label: 'Fresh & Clean',
    icon: 'water_drop',
    families: ['Citrus', 'Aquatic', 'Green'],
    accords: ['citrus', 'aquatic', 'ozonic', 'green', 'fresh'],
    description: 'Light, clean, energising',
  },
  {
    id: 'cosy',
    label: 'Cosy',
    icon: 'local_cafe',
    families: ['Gourmand', 'Oriental', 'Amber'],
    accords: ['vanilla', 'caramel', 'coffee', 'cinnamon', 'warm spicy'],
    description: 'Warm, comforting, sweet',
  },
  {
    id: 'adventurous',
    label: 'Adventurous',
    icon: 'hiking',
    families: ['Aromatic', 'Fougere', 'Woody'],
    accords: ['aromatic', 'herbal', 'earthy', 'mossy', 'pine'],
    description: 'Outdoorsy, rugged, natural',
  },
  {
    id: 'elegant',
    label: 'Elegant',
    icon: 'diamond',
    families: ['Chypre', 'Floral', 'Powdery'],
    accords: ['iris', 'violet', 'bergamot', 'sandalwood', 'saffron'],
    description: 'Refined, sophisticated, classic',
  },
]

export function MoodPickerScreen() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [selectedMood, setSelectedMood] = useState<Mood | null>(null)
  const [results, setResults] = useState<Fragrance[]>([])
  const [loading, setLoading] = useState(false)
  const [wearingId, setWearingId] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedMood || !user) return
    findFragrances(selectedMood)
  }, [selectedMood])

  async function findFragrances(mood: Mood) {
    setLoading(true)
    setResults([])

    // First try from user's owned collection
    const { data: collection } = await supabase
      .from('user_collections')
      .select('fragrance:fragrances(*)')
      .eq('user_id', user!.id)
      .eq('status', 'own')

    type CollRow = { fragrance: Fragrance | null }
    const owned = ((collection ?? []) as unknown as CollRow[])
      .map((c) => c.fragrance)
      .filter((f): f is Fragrance => f !== null)

    // Score owned fragrances by mood match
    const scored = owned.map((f) => {
      let score = 0
      // Family match
      if (f.note_family && mood.families.some((fam) => f.note_family!.toLowerCase().includes(fam.toLowerCase()))) {
        score += 30
      }
      // Accord match
      const allNotes = [...(f.notes_top ?? []), ...(f.notes_heart ?? []), ...(f.notes_base ?? []), ...(f.accords ?? [])].map((n) => n.toLowerCase())
      for (const accord of mood.accords) {
        if (allNotes.some((n) => n.includes(accord))) score += 10
      }
      return { frag: f, score }
    })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((s) => s.frag)

    // If we have enough from collection, use those
    if (scored.length >= 3) {
      setResults(scored)
      setLoading(false)
      return
    }

    // Otherwise supplement from database
    const ownedIds = new Set(owned.map((f) => f.id))
    const { data: dbFrags } = await supabase
      .from('fragrances')
      .select('*')
      .in('note_family', mood.families)
      .order('rating', { ascending: false })
      .limit(20)

    const extras = ((dbFrags ?? []) as Fragrance[]).filter((f) => !ownedIds.has(f.id)).slice(0, 5 - scored.length)
    setResults([...scored, ...extras])
    setLoading(false)
  }

  const handleWear = async (frag: Fragrance) => {
    if (!user) return
    setWearingId(frag.id)
    try {
      const today = new Date().toISOString().slice(0, 10)
      await supabase.from('wear_logs').insert({ user_id: user.id, fragrance_id: frag.id, wear_date: today })
      await awardXP(user.id, 'LOG_WEAR')
      toast.showToast(`Wearing ${frag.name} today!`, 'success')
    } catch {
      toast.showToast('Failed to log wear', 'error')
    }
    setWearingId(null)
  }

  if (!user) {
    return (
      <main className="pt-24 pb-32 px-6 flex flex-col items-center justify-center min-h-screen gap-4">
        <span className="text-5xl text-primary/30">?</span>
        <p className="text-secondary/60 text-sm">Sign in to use the mood picker</p>
      </main>
    )
  }

  return (
    <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen">
      {!selectedMood ? (
        <>
          {/* Mood Selection */}
          <section className="text-center mb-8">
            <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <span className="text-3xl text-primary">?</span>
            </div>
            <h2 className="font-headline text-xl mb-1">How are you feeling?</h2>
            <p className="text-[10px] text-secondary/50">Pick your mood and we'll suggest the perfect scent</p>
          </section>

          <div className="grid grid-cols-2 gap-3">
            {MOODS.map((mood) => (
              <button
                key={mood.id}
                onClick={() => setSelectedMood(mood)}
                className="bg-surface-container rounded-sm p-5 flex flex-col items-center gap-3 hover:opacity-80 transition-all hover:bg-surface-container-high text-center"
              >
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-primary text-2xl">{getIconChar(mood.icon)}</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-on-surface">{mood.label}</p>
                  <p className="text-[9px] text-secondary/50">{mood.description}</p>
                </div>
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          {/* Results */}
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => { setSelectedMood(null); setResults([]) }} className="p-2 rounded-full hover:opacity-80">
              <span className="text-on-surface">←</span>
            </button>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-primary">{getIconChar(selectedMood.icon)}</span>
              </div>
              <div>
                <h2 className="font-headline text-lg">{selectedMood.label}</h2>
                <p className="text-[10px] text-secondary/50">{selectedMood.description}</p>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="flex flex-col items-center gap-1.5">{[1,2,3].map(i => <div key={i} className="h-1 rounded-sm bg-primary/20 animate-pulse" style={{ width: `${60 - i * 14}px` }} />)}</div>
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-16">
              <span className="text-4xl text-secondary/20">?</span>
              <p className="text-sm text-secondary/50">No matches found for this mood</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-[10px] uppercase tracking-[0.15em] text-secondary font-bold">
                {results.length > 0 ? 'PERFECT MATCHES' : 'SUGGESTIONS'}
              </p>
              {results.map((frag) => (
                <div
                  key={frag.id}
                  className="bg-surface-container rounded-sm p-4 flex items-center gap-4"
                >
                  <button
                    onClick={() => navigate(`/fragrance/${frag.id}`)}
                    className="flex items-center gap-4 flex-1 min-w-0 text-left"
                  >
                    <div className="w-14 h-14 rounded-sm overflow-hidden bg-surface-container-low flex-shrink-0">
                      {frag.image_url ? (
                        <img src={frag.image_url} alt={frag.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-secondary/20">?</span>
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[9px] uppercase tracking-[0.1em] text-secondary/50">{frag.brand}</p>
                      <p className="text-sm text-on-surface font-medium truncate">{frag.name}</p>
                      {frag.note_family && (
                        <p className="text-[9px] text-primary/60">{frag.note_family}</p>
                      )}
                    </div>
                  </button>
                  <button
                    onClick={() => handleWear(frag)}
                    disabled={wearingId === frag.id}
                    className="flex-shrink-0 bg-primary/10 text-primary p-2.5 rounded-sm hover:opacity-80 transition-all disabled:opacity-50"
                    title="Wear today"
                  >
                    <span>{getIconChar(wearingId === frag.id ? 'check' : 'checkroom')}</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  )
}
