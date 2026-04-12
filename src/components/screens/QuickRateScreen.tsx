import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { supabase } from '@/lib/supabase'
import { awardXP } from '@/lib/xp'
import { hapticLight } from '@/lib/haptics'
import type { Fragrance } from '@/types/database'

interface UnratedItem {
  collectionId: string
  fragrance: Fragrance
}

export function QuickRateScreen() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [items, setItems] = useState<UnratedItem[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [loading, setLoading] = useState(true)
  const [hoveredStar, setHoveredStar] = useState(0)
  const [saving, setSaving] = useState(false)
  const [rated, setRated] = useState(0)
  const [skipped, setSkipped] = useState(0)

  useEffect(() => {
    if (!user) { setLoading(false); return }

    supabase
      .from('user_collections')
      .select('id, fragrance:fragrances(*)')
      .eq('user_id', user.id)
      .eq('status', 'own')
      .is('personal_rating', null)
      .limit(50)
      .then(({ data }) => {
        type Row = { id: string; fragrance: Fragrance | null }
        const valid = ((data ?? []) as unknown as Row[])
          .filter((r) => r.fragrance !== null)
          .map((r) => ({ collectionId: r.id, fragrance: r.fragrance! }))
        setItems(valid)
        setLoading(false)
      })
  }, [user])

  const current = items[currentIdx]
  const remaining = items.length - currentIdx
  const progress = items.length > 0 ? ((currentIdx) / items.length) * 100 : 0

  const handleRate = async (rating: number) => {
    if (!user || !current || saving) return
    setSaving(true)

    const { error } = await supabase
      .from('user_collections')
      .update({ personal_rating: rating })
      .eq('id', current.collectionId)
      .eq('user_id', user.id)

    if (error) {
      toast.showToast('Failed to save rating', 'error')
    } else {
      await awardXP(user.id, 'WRITE_REVIEW')
      hapticLight()
      setRated((r) => r + 1)
    }

    setSaving(false)
    setHoveredStar(0)
    goNext()
  }

  const handleSkip = () => {
    setSkipped((s) => s + 1)
    goNext()
  }

  const goNext = () => {
    if (currentIdx < items.length - 1) {
      setCurrentIdx((i) => i + 1)
    } else {
      setCurrentIdx(items.length) // trigger "done" state
    }
  }

  if (!user) {
    return (
      <main className="pt-24 pb-32 px-6 flex flex-col items-center justify-center min-h-screen gap-4">
        <span className="text-5xl text-primary/30">?</span>
        <p className="text-secondary/60 text-sm">Sign in to rate your collection</p>
      </main>
    )
  }

  if (loading) {
    return (
      <main className="pt-24 pb-32 px-6 flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-1.5">{[1,2,3].map(i => <div key={i} className="h-1 rounded-sm bg-primary/20 animate-pulse" style={{ width: `${60 - i * 14}px` }} />)}</div>
      </main>
    )
  }

  // Done state
  if (currentIdx >= items.length) {
    return (
      <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen flex flex-col items-center justify-center gap-6">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
          <span className="text-4xl text-primary">✓</span>
        </div>
        <div className="text-center space-y-2">
          <h2 className="font-headline text-2xl">All caught up!</h2>
          <p className="text-sm text-secondary/60">
            {rated > 0 ? `You rated ${rated} fragrance${rated > 1 ? 's' : ''}.` : 'No unrated fragrances in your collection.'}
            {skipped > 0 ? ` Skipped ${skipped}.` : ''}
          </p>
        </div>
        <button
          onClick={() => navigate('/collection')}
          className="gold-gradient text-on-primary-container px-6 py-3 rounded-sm font-label text-[10px] font-bold uppercase tracking-widest hover:opacity-80"
        >
          BACK TO COLLECTION
        </button>
      </main>
    )
  }

  if (!current) return null

  return (
    <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen">
      {/* Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] text-secondary/50">{remaining} unrated remaining</p>
          <p className="text-[10px] text-primary font-bold">{rated} rated</p>
        </div>
        <div className="w-full bg-surface-container-low rounded-full h-1.5 overflow-hidden">
          <div
            className="h-full gold-gradient transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Fragrance Card */}
      <div className="bg-surface-container rounded-sm overflow-hidden mb-8">
        <div className="aspect-square relative">
          {current.fragrance.image_url ? (
            <img
              src={current.fragrance.image_url}
              alt={current.fragrance.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-surface-container-low">
              <span className="text-secondary/10">?</span>
            </div>
          )}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
            <p className="text-[10px] uppercase tracking-[0.15em] text-white/50">{current.fragrance.brand}</p>
            <h2 className="font-headline text-2xl text-white">{current.fragrance.name}</h2>
            {current.fragrance.concentration && (
              <p className="text-[10px] text-white/40 mt-1">{current.fragrance.concentration}</p>
            )}
          </div>
        </div>

        {/* Details */}
        <div className="p-5 space-y-3">
          {current.fragrance.note_family && (
            <div className="flex items-center gap-2">
              <span className="text-primary">?</span>
              <span className="text-sm text-on-surface">{current.fragrance.note_family}</span>
            </div>
          )}
          {current.fragrance.rating && (
            <div className="flex items-center gap-2">
              <span className="text-secondary/50">?</span>
              <span className="text-sm text-secondary/60">Community: {Number(current.fragrance.rating).toFixed(1)}/5</span>
            </div>
          )}
        </div>
      </div>

      {/* Star Rating */}
      <div className="text-center space-y-4">
        <p className="text-[10px] uppercase tracking-[0.15em] text-secondary font-bold">YOUR RATING</p>
        <div className="flex items-center justify-center gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => handleRate(star)}
              onMouseEnter={() => setHoveredStar(star)}
              onMouseLeave={() => setHoveredStar(0)}
              disabled={saving}
              className="p-1.5 hover:opacity-80 transition-transform disabled:opacity-50"
            >
              <span>★</span>
            </button>
          ))}
        </div>

        {/* Half-star options */}
        <div className="flex items-center justify-center gap-1.5">
          {[0.5, 1.5, 2.5, 3.5, 4.5].map((half) => (
            <button
              key={half}
              onClick={() => handleRate(half)}
              disabled={saving}
              className="px-2.5 py-1 rounded-full bg-surface-container text-[10px] text-secondary/50 font-medium hover:opacity-80 transition-all disabled:opacity-50 hover:bg-surface-container-highest hover:text-primary"
            >
              {half}
            </button>
          ))}
        </div>

        <button
          onClick={handleSkip}
          className="text-[10px] uppercase tracking-widest text-secondary/40 font-bold py-2 hover:opacity-80"
        >
          SKIP →
        </button>
      </div>
    </main>
  )
}
