import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect, useCallback } from 'react'
import { Icon } from '../ui/Icon'
import { useFragranceDetail, useFragranceReviews, useFragranceTags } from '@/hooks/useFragrances'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { LogWearSheet } from './LogWearSheet'
import { FragranceNotesPyramid } from '../fragrance/FragranceNotesPyramid'

function accordToPercent(level: string): number {
  switch (level) {
    case 'Dominant': return 95
    case 'Prominent': return 75
    case 'Moderate': return 50
    default: return 30
  }
}

export function FragranceDetailScreen() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: frag, loading } = useFragranceDetail(id)
  const { data: reviews } = useFragranceReviews(id)
  const { data: tags } = useFragranceTags(id)

  // Collection status
  const [collectionStatus, setCollectionStatus] = useState<string | null>(null)
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [logSheetOpen, setLogSheetOpen] = useState(false)

  useEffect(() => {
    if (!user || !id) return
    supabase
      .from('user_collections')
      .select('status')
      .eq('user_id', user.id)
      .eq('fragrance_id', id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setCollectionStatus(data.status)
      })
  }, [user, id])

  const handleAddToCollection = useCallback(async (status: string) => {
    if (!user) { navigate('/profile'); return }
    if (!id) return
    setSaving(true)
    setAddMenuOpen(false)

    if (collectionStatus) {
      // Update existing
      await supabase
        .from('user_collections')
        .update({ status })
        .eq('user_id', user.id)
        .eq('fragrance_id', id)
    } else {
      // Insert new
      await supabase
        .from('user_collections')
        .insert({ user_id: user.id, fragrance_id: id, status })
    }
    setCollectionStatus(status)
    setSaving(false)
  }, [user, id, collectionStatus, navigate])

  if (loading || !frag) {
    return (
      <main className="pt-24 pb-32 px-6 flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </main>
    )
  }

  // Build accords from main_accords_percentage
  const accords = frag.main_accords_percentage
    ? Object.entries(frag.main_accords_percentage)
        .map(([name, level]) => ({ name: name.toUpperCase(), value: accordToPercent(level) }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6)
    : (frag.accords || []).slice(0, 6).map((a, i) => ({ name: a.toUpperCase(), value: 90 - i * 12 }))

  // Season/occasion from rankings
  const seasons = (frag.season_ranking || []).map((s) => ({
    name: s.name.toUpperCase(),
    active: s.score > 0.5,
  }))

  const occasions = (frag.occasion_ranking || []).map((o) => ({
    name: o.name.replace(/_/g, ' ').toUpperCase(),
    active: o.score > 0.5,
  }))

  const longevityFilled = frag.longevity ? Math.round(frag.longevity * 2) : null
  const sillageFilled = frag.sillage ? Math.round(frag.sillage * 2) : null

  return (
    <main className="pb-24">
      {/* Hero Section */}
      <section className="relative w-full aspect-[4/5] overflow-hidden">
        {frag.image_url ? (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url('${frag.image_url}')` }}
          />
        ) : (
          <div className="absolute inset-0 bg-surface-container flex items-center justify-center">
            <Icon name="water_drop" className="text-secondary/20" size={80} />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/30 to-transparent" />
        <div className="absolute bottom-8 left-6 right-6 flex justify-between items-end">
          <div className="space-y-1">
            <p className="text-[10px] font-bold tracking-[0.2em] text-primary/80 uppercase">{frag.brand}</p>
            <h2 className="text-4xl font-headline italic leading-tight text-on-surface">{frag.name}</h2>
            {frag.concentration && (
              <div className="mt-3 inline-block bg-surface-container-highest/60 backdrop-blur-md px-3 py-1 rounded-full">
                <span className="text-[9px] font-bold tracking-widest text-secondary uppercase">
                  {frag.concentration}
                </span>
              </div>
            )}
          </div>
          {frag.rating && (
            <div className="flex items-center gap-1.5 bg-primary/20 backdrop-blur-md px-3 py-1.5 rounded-full mb-1">
              <Icon name="star" filled className="text-primary text-sm" />
              <span className="text-sm font-bold text-primary">{Number(frag.rating).toFixed(1)}</span>
            </div>
          )}
        </div>
      </section>

      {/* Action Bar */}
      <section className="bg-surface-container px-6 py-5 flex justify-between items-center relative">
        {/* ADD button with dropdown */}
        <div className="relative flex flex-col items-center gap-2">
          <button
            onClick={() => {
              if (!user) { navigate('/profile'); return }
              setAddMenuOpen(!addMenuOpen)
            }}
            disabled={saving}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-surface-container-highest active:scale-90 transition-transform"
          >
            <Icon
              name={collectionStatus ? 'check' : 'add'}
              className={collectionStatus ? 'text-primary' : 'text-secondary'}
            />
          </button>
          <span className={`text-[9px] tracking-widest uppercase font-bold ${collectionStatus ? 'text-primary' : 'text-secondary/60'}`}>
            {collectionStatus ? collectionStatus.toUpperCase() : 'ADD'}
          </span>

          {/* Dropdown */}
          {addMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setAddMenuOpen(false)} />
              <div className="absolute top-12 left-1/2 -translate-x-1/2 z-50 bg-surface-container-highest rounded-xl py-2 min-w-[140px] shadow-xl border border-outline-variant/10">
                {['own', 'wishlist', 'sampled', 'sold'].map((status) => (
                  <button
                    key={status}
                    onClick={() => handleAddToCollection(status)}
                    className={`w-full text-left px-4 py-2.5 text-xs font-medium transition-colors ${
                      collectionStatus === status
                        ? 'text-primary bg-primary/10'
                        : 'text-on-surface hover:bg-surface-container'
                    }`}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                    {collectionStatus === status && (
                      <Icon name="check" className="float-right text-primary text-sm" />
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* LOG button */}
        <div className="flex flex-col items-center gap-2 cursor-pointer group" onClick={() => setLogSheetOpen(true)}>
          <div className="w-10 h-10 flex items-center justify-center rounded-full bg-surface-container-highest group-active:scale-90 transition-transform">
            <Icon name="calendar_today" className="text-secondary" />
          </div>
          <span className="text-[9px] tracking-widest uppercase font-bold text-secondary/60">LOG</span>
        </div>

        {/* Other actions (static for now) */}
        {[
          { icon: 'rate_review', label: 'REVIEW' },
          { icon: 'dashboard', label: 'BOARD' },
        ].map((action) => (
          <div key={action.label} className="flex flex-col items-center gap-2 cursor-pointer group">
            <div className="w-10 h-10 flex items-center justify-center rounded-full bg-surface-container-highest group-active:scale-90 transition-transform">
              <Icon name={action.icon} className="text-secondary" />
            </div>
            <span className="text-[9px] tracking-widest uppercase font-bold text-secondary/60">{action.label}</span>
          </div>
        ))}
      </section>

      {/* Log Wear Bottom Sheet */}
      <LogWearSheet isOpen={logSheetOpen} onClose={() => setLogSheetOpen(false)} fragrance={frag} />

      <div className="px-6 mt-10 space-y-12">
        {/* Accords */}
        {accords.length > 0 && (
          <section>
            <h3 className="text-[11px] font-bold tracking-[0.15em] text-primary uppercase mb-6">ACCORDS</h3>
            <div className="space-y-4">
              {accords.map((accord) => (
                <div key={accord.name} className="space-y-1.5">
                  <div className="flex justify-between items-center text-[10px] tracking-widest font-bold text-secondary-fixed-dim">
                    <span>{accord.name}</span>
                    <span>{accord.value}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
                    <div className="h-full bg-primary transition-all duration-700" style={{ width: `${accord.value}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Notes Pyramid */}
        <FragranceNotesPyramid
          notesTop={frag.notes_top ?? undefined}
          notesHeart={frag.notes_heart ?? undefined}
          notesBase={frag.notes_base ?? undefined}
        />

        {/* Performance */}
        {(longevityFilled || sillageFilled) && (
          <section>
            <h3 className="text-[11px] font-bold tracking-[0.15em] text-primary uppercase mb-6">PERFORMANCE</h3>
            <div className="grid grid-cols-2 gap-8">
              {longevityFilled && (
                <div className="space-y-3">
                  <p className="text-[10px] font-bold tracking-widest text-secondary/60">LONGEVITY</p>
                  <div className="flex gap-1">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <div key={i} className={`h-1 flex-1 ${i < longevityFilled ? 'bg-primary' : 'bg-surface-container-highest'}`} />
                    ))}
                  </div>
                  <p className="text-xs text-on-surface-variant italic">{frag.longevity}/5</p>
                </div>
              )}
              {sillageFilled && (
                <div className="space-y-3">
                  <p className="text-[10px] font-bold tracking-widest text-secondary/60">SILLAGE</p>
                  <div className="flex gap-1">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <div key={i} className={`h-1 flex-1 ${i < sillageFilled ? 'bg-primary' : 'bg-surface-container-highest'}`} />
                    ))}
                  </div>
                  <p className="text-xs text-on-surface-variant italic">{frag.sillage}/5</p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Season / Occasion */}
        {(seasons.length > 0 || occasions.length > 0) && (
          <section className="space-y-8">
            {seasons.length > 0 && (
              <div>
                <h3 className="text-[11px] font-bold tracking-[0.15em] text-primary uppercase mb-4">SEASON</h3>
                <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                  {seasons.map((s) => (
                    <div
                      key={s.name}
                      className={`px-5 py-3 rounded-xl bg-surface-container border text-[10px] font-bold tracking-widest shrink-0 ${
                        s.active ? 'border-primary text-primary' : 'border-outline-variant/30 text-secondary/40'
                      }`}
                    >
                      {s.name}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {occasions.length > 0 && (
              <div>
                <h3 className="text-[11px] font-bold tracking-[0.15em] text-primary uppercase mb-4">OCCASION</h3>
                <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                  {occasions.map((o) => (
                    <div
                      key={o.name}
                      className={`px-5 py-3 rounded-xl bg-surface-container border text-[10px] font-bold tracking-widest shrink-0 ${
                        o.active ? 'border-primary text-primary' : 'border-outline-variant/30 text-secondary/40'
                      }`}
                    >
                      {o.name}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Aesthetic Tags */}
        {tags.length > 0 && (
          <section>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-[11px] font-bold tracking-[0.15em] text-primary uppercase">AESTHETIC TAGS</h3>
              <button className="text-[9px] font-bold text-primary-fixed tracking-widest uppercase">+ ADD</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span key={tag} className="px-4 py-2 rounded-full bg-surface-container-highest text-xs text-on-surface-variant">
                  {tag}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Reviews */}
        {reviews.length > 0 && (
          <section>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-[11px] font-bold tracking-[0.15em] text-primary uppercase">REVIEWS</h3>
              <button className="text-[9px] font-bold text-primary-fixed tracking-widest uppercase">
                SEE ALL ({reviews.length})
              </button>
            </div>
            <div className="space-y-4">
              {reviews.map((review) => (
                <div key={review.id} className="p-5 bg-surface-container rounded-2xl space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-surface-container-highest" />
                      <div>
                        <p className="text-xs font-bold text-on-surface">
                          {review.profile?.display_name || 'Anonymous'}
                        </p>
                        <p className="text-[9px] text-secondary/40">
                          {new Date(review.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex text-primary">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Icon key={i} name="star" filled={i < review.overall_rating} className="text-[14px]" />
                      ))}
                    </div>
                  </div>
                  {review.review_text && (
                    <p className="text-[13px] text-secondary/90 leading-relaxed italic">"{review.review_text}"</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
