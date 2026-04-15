import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { FragranceImage } from '../ui/FragranceImage'
import { InlineError } from '../ui/InlineError'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { supabase } from '@/lib/supabase'
import { awardXP } from '@/lib/xp'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { PromoteToOwnedSheet } from '../ui/PromoteToOwnedSheet'
import type { Fragrance, UserCollection } from '@/types/database'

/* ── Voice helpers ────────────────────────────────────── */

const WORDS_20 = [
  'none', 'one', 'two', 'three', 'four', 'five', 'six', 'seven',
  'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen',
  'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty',
] as const
function numberToWord(n: number): string {
  return n <= 20 ? WORDS_20[n] : String(n)
}
function capitalise(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s
}

/* ── Noir style constants ─────────────────────────────── */

const hairline: React.CSSProperties = {
  height: '1px',
  background:
    'linear-gradient(to right, rgba(229,194,118,0.4) 0%, rgba(229,194,118,0.1) 40%, transparent 100%)',
  width: '100%',
}

const verticalHairline: React.CSSProperties = {
  width: '1px',
  height: '1rem',
  background:
    'linear-gradient(to bottom, transparent, rgba(229,194,118,0.5), transparent)',
}

const ambientGlow = (
  top: string,
  left: string,
): React.CSSProperties => ({
  position: 'absolute',
  top,
  left,
  width: '300px',
  height: '300px',
  borderRadius: '50%',
  background:
    'radial-gradient(circle, rgba(229,194,118,0.07) 0%, transparent 70%)',
  filter: 'blur(80px)',
  pointerEvents: 'none',
})

/* ── Types ────────────────────────────────────────────── */

type WishlistItem = UserCollection & { fragrance: Fragrance }

/* ── Component ────────────────────────────────────────── */

export function WishlistScreen() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { showToast } = useToast()

  const [items, setItems] = useState<WishlistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [addSheetOpen, setAddSheetOpen] = useState(false)
  const [promoteItem, setPromoteItem] = useState<WishlistItem | null>(null)

  /* ── Data fetching ───────────────────────────────────── */

  const fetchWishlist = useCallback(() => {
    if (!user) { setLoading(false); return }
    setLoading(true)
    setError(null)
    supabase
      .from('user_collections')
      .select('*, fragrance:fragrances(*)')
      .eq('user_id', user.id)
      .eq('status', 'wishlist')
      .order('date_added', { ascending: false })
      .then(({ data, error: err }) => {
        if (err) setError(err.message)
        else setItems((data ?? []) as WishlistItem[])
        setLoading(false)
      })
  }, [user])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchWishlist() }, [fetchWishlist])

  /* ── Actions ─────────────────────────────────────────── */

  /**
   * Promote wishlist → owned.
   * Opens the PromoteToOwnedSheet for optional metadata capture.
   * The sheet calls `onConfirm` (below) with whatever fields the keeper chose to supply.
   */
  const handleOpenPromote = (item: WishlistItem) => {
    setPromoteItem(item)
  }

  const handlePromoteConfirm = async (
    item: WishlistItem,
    meta: { date_acquired: string | null; bottle_size: string | null; purchase_source: string | null },
  ) => {
    // Optimistic removal from the wishlist
    setItems((prev) => prev.filter((i) => i.id !== item.id))
    setPromoteItem(null)

    const { error: err } = await supabase
      .from('user_collections')
      .update({
        status: 'own',
        date_acquired: meta.date_acquired,
        bottle_size: meta.bottle_size,
        purchase_source: meta.purchase_source,
      })
      .eq('id', item.id)

    if (err) {
      setItems((prev) => [item, ...prev])
      showToast('The reclassification could not be completed.', 'error')
      return
    }

    // Award XP for the promotion — doubles the standard add-to-collection reward.
    if (user) {
      await awardXP(user.id, 'PROMOTE_TO_OWNED')
    }
    showToast('Acquired · +10 XP', 'success', 'check_circle')
  }

  const handleRemove = async (item: WishlistItem) => {
    setItems((prev) => prev.filter((i) => i.id !== item.id))
    const { error: err } = await supabase
      .from('user_collections')
      .delete()
      .eq('id', item.id)
    if (err) {
      setItems((prev) => [item, ...prev])
      showToast('The release could not be completed.', 'error')
    } else {
      showToast('Released from the register.', 'info')
    }
  }

  const handleMarkSampled = async (item: WishlistItem) => {
    setItems((prev) => prev.filter((i) => i.id !== item.id))
    const { error: err } = await supabase
      .from('user_collections')
      .update({ status: 'sampled' })
      .eq('id', item.id)
    if (err) {
      setItems((prev) => [item, ...prev])
      showToast('The reclassification could not be completed.', 'error')
    } else {
      showToast(`${item.fragrance.name} has been filed as sampled.`, 'success', 'science')
    }
  }

  /* ── Filtered list ───────────────────────────────────── */

  const filtered = items.filter((item) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      item.fragrance.name.toLowerCase().includes(q) ||
      item.fragrance.brand.toLowerCase().includes(q) ||
      (item.fragrance.note_family ?? '').toLowerCase().includes(q)
    )
  })

  /* ── Not-signed-in gate ──────────────────────────────── */

  if (!user) {
    return (
      <main className="relative pt-16 pb-32 px-6 md:px-12 max-w-7xl mx-auto min-h-screen flex flex-col items-center justify-center">
        <div aria-hidden style={ambientGlow('4rem', '-4rem')} />
        <div aria-hidden style={ambientGlow('40rem', 'calc(100% - 10rem)')} />
        <p className="font-label text-primary/60 text-[0.65rem] tracking-[0.3em] uppercase mb-6">
          THE WAITING ROOM
        </p>
        <p className="font-headline italic text-2xl md:text-3xl text-on-background/70 text-center max-w-md mb-10 leading-relaxed">
          The register requires a keeper. Sign in to begin.
        </p>
        <button
          onClick={() => navigate('/profile')}
          className="py-4 px-10 rounded-sm font-label text-[0.7rem] font-bold tracking-[0.2em] uppercase text-on-primary-container"
          style={{ background: 'linear-gradient(45deg, #e5c276 0%, #c4a35a 100%)' }}
        >
          SIGN IN
        </button>
      </main>
    )
  }

  /* ── Main render ─────────────────────────────────────── */

  return (
    <main className="relative pt-16 pb-32 px-6 md:px-12 max-w-7xl mx-auto min-h-screen">
      {/* Ambient gold lifts */}
      <div aria-hidden style={ambientGlow('4rem', '-4rem')} />
      <div aria-hidden style={ambientGlow('40rem', 'calc(100% - 10rem)')} />
      <div aria-hidden style={ambientGlow('80rem', '-6rem')} />

      {/* I. THE FRONTISPIECE */}
      <header className="relative mb-16">
        <p className="font-label text-primary/60 text-[0.65rem] tracking-[0.3em] uppercase mb-4">
          THE WAITING ROOM · BOTTLES UNDER CONSIDERATION
        </p>
        <h1 className="font-headline italic text-5xl md:text-6xl font-light tracking-tight leading-[1.05] text-on-background mb-6">
          Bottles in waiting.
        </h1>
        {items.length > 0 ? (
          <p className="font-headline italic text-base md:text-lg text-secondary/70 max-w-2xl">
            <span className="italic">{capitalise(numberToWord(items.length))}</span>{' '}
            {items.length === 1 ? 'bottle' : 'bottles'} held in consideration,
            awaiting {items.length === 1 ? 'its' : 'their'} place on the shelves.
          </p>
        ) : (
          <p className="font-headline italic text-base md:text-lg text-secondary/70 max-w-2xl">
            The register is empty. A keeper&rsquo;s desire begins with a single bottle.
          </p>
        )}
        <div className="mt-10" style={hairline} />
      </header>

      {/* II. THE SEARCH */}
      <section className="mb-16">
        <div className="relative group">
          <div className="flex items-center gap-4 py-4">
            <span className="text-primary/60 flex-shrink-0">⌕</span>
            <input
              className="flex-1 bg-transparent border-none focus:ring-0 focus:outline-none font-headline italic text-xl text-on-background placeholder:text-secondary/40 placeholder:italic"
              placeholder="Request a title, a house, a note…"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search the register"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="font-headline italic text-sm text-secondary/50 hover:text-primary transition-colors"
              >
                clear
              </button>
            )}
          </div>
          <div
            className="absolute bottom-0 left-0 right-0 opacity-40 group-focus-within:opacity-100 transition-opacity"
            style={hairline}
          />
        </div>
      </section>

      {/* III. THE REGISTER / IV. THE EMPTY REGISTER */}
      {error ? (
        <InlineError message="The register could not be retrieved." onRetry={fetchWishlist} />
      ) : loading ? (
        <div className="space-y-10">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="grid grid-cols-[80px_1fr] md:grid-cols-[120px_1fr] gap-6 items-start">
              <div className="aspect-[3/4] rounded-sm bg-surface-container-highest animate-pulse" />
              <div className="space-y-3 pt-2">
                <div className="h-2 w-20 bg-surface-container-highest rounded animate-pulse" />
                <div className="h-4 w-40 bg-surface-container-highest rounded animate-pulse" />
                <div className="h-2 w-28 bg-surface-container-highest rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 && !search ? (
        <div className="flex flex-col items-center justify-center py-20">
          <p className="font-headline italic text-xl text-secondary/60 text-center max-w-md mb-10">
            The register is empty. A keeper&rsquo;s desire begins with a single bottle.
          </p>
          <button
            onClick={() => navigate('/explore')}
            className="py-4 px-10 rounded-sm font-label text-[0.7rem] font-bold tracking-[0.2em] uppercase text-on-primary-container"
            style={{ background: 'linear-gradient(45deg, #e5c276 0%, #c4a35a 100%)' }}
          >
            BROWSE THE ARCHIVES
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <p className="font-headline italic text-xl text-secondary/60 text-center max-w-md">
            Nothing under consideration matches &ldquo;{search}&rdquo;.
          </p>
        </div>
      ) : (
        <div className="space-y-0">
          {filtered.map((item) => {
            const frag = item.fragrance
            return (
              <article key={item.id} className="group">
                <div className="grid grid-cols-[80px_1fr] md:grid-cols-[120px_1fr] gap-6 md:gap-10 py-6 items-start">
                  {/* 3:4 portrait */}
                  <button
                    onClick={() => navigate(`/fragrance/${frag.id}`)}
                    className="aspect-[3/4] rounded-sm overflow-hidden bg-surface-container-highest"
                  >
                    {frag.image_url ? (
                      <FragranceImage
                        src={frag.image_url}
                        alt={frag.name}
                        className="w-full h-full object-cover transition-all duration-700"
                      />
                    ) : (
                      <div className="w-full h-full bg-surface-container" />
                    )}
                  </button>

                  {/* Entry text */}
                  <div className="pt-1">
                    <p className="font-label text-primary/70 text-[0.6rem] tracking-[0.15em] uppercase mb-1">
                      {frag.brand}
                    </p>
                    <button
                      onClick={() => navigate(`/fragrance/${frag.id}`)}
                      className="font-headline italic text-lg md:text-xl text-on-background hover:text-primary transition-colors text-left"
                    >
                      {frag.name}
                    </button>
                    {(frag.concentration || frag.note_family) && (
                      <p className="font-headline italic text-sm text-secondary/50 mt-1">
                        {frag.concentration && frag.concentration.toLowerCase()}
                        {frag.concentration && frag.note_family && (
                          <span className="inline-block mx-2 align-middle" style={verticalHairline} />
                        )}
                        {frag.note_family && frag.note_family.toLowerCase()}
                      </p>
                    )}

                    {/* Primary CTA — the main promotion path */}
                    <button
                      onClick={() => handleOpenPromote(item)}
                      className="mt-5 inline-flex items-center gap-2 py-2.5 px-5 rounded-sm font-label text-[0.6rem] font-bold tracking-[0.2em] uppercase text-on-primary-container transition-transform hover:scale-[1.02]"
                      style={{ background: 'linear-gradient(45deg, #e5c276 0%, #c4a35a 100%)' }}
                    >
                      I GOT THIS ONE
                    </button>

                    {/* Secondary action words */}
                    <div className="flex items-center gap-4 mt-3">
                      <button
                        onClick={() => handleMarkSampled(item)}
                        className="font-headline italic text-sm text-secondary/50 hover:text-on-background transition-colors"
                      >
                        sampled
                      </button>
                      <span aria-hidden style={verticalHairline} />
                      <button
                        onClick={() => handleRemove(item)}
                        className="font-headline italic text-sm text-secondary/50 hover:text-on-background transition-colors"
                      >
                        release
                      </button>
                    </div>
                  </div>
                </div>
                <div style={hairline} />
              </article>
            )
          })}
        </div>
      )}

      {/* VI. THE FAB */}
      <button
        onClick={() => setAddSheetOpen(true)}
        className="fixed bottom-24 right-6 z-[var(--z-fab)] py-4 px-6 rounded-sm font-label text-[0.6rem] font-bold tracking-[0.2em] uppercase text-on-primary-container shadow-xl"
        style={{ background: 'linear-gradient(45deg, #e5c276 0%, #c4a35a 100%)' }}
        aria-label="File a desire"
      >
        FILE A DESIRE
      </button>

      {/* V. THE FILING DESK */}
      {addSheetOpen && (
        <FilingDeskSheet
          userId={user.id}
          existingIds={items.map((i) => i.fragrance.id)}
          onClose={() => setAddSheetOpen(false)}
          onAdded={() => { setAddSheetOpen(false); fetchWishlist() }}
        />
      )}

      {/* VII. THE PROMOTION DESK */}
      {promoteItem && (
        <PromoteToOwnedSheet
          item={promoteItem}
          onClose={() => setPromoteItem(null)}
          onConfirm={handlePromoteConfirm}
        />
      )}
    </main>
  )
}

/* ── Filing Desk (bottom sheet) ───────────────────────── */

function FilingDeskSheet({
  userId,
  existingIds,
  onClose,
  onAdded,
}: {
  userId: string
  existingIds: string[]
  onClose: () => void
  onAdded: () => void
}) {
  const trapRef = useFocusTrap(true, onClose)
  const { showToast } = useToast()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Fragrance[]>([])
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    clearTimeout(debounceRef.current)
    if (query.length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    debounceRef.current = setTimeout(() => {
      supabase
        .from('fragrances')
        .select('*')
        .or(`name.ilike.%${query}%,brand.ilike.%${query}%`)
        .order('rating', { ascending: false, nullsFirst: false })
        .limit(15)
        .then(({ data }) => {
          if (data) setResults(data as Fragrance[])
          setSearching(false)
        })
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [query])

  const handleAdd = async (frag: Fragrance) => {
    setSaving(frag.id)
    const { error } = await supabase
      .from('user_collections')
      .insert({ user_id: userId, fragrance_id: frag.id, status: 'wishlist' })
    if (error) {
      showToast('The filing could not be completed.', 'error')
      setSaving(null)
    } else {
      await awardXP(userId, 'ADD_TO_COLLECTION')
      showToast('Filed to the register.', 'success', 'favorite')
      onAdded()
    }
  }

  const hairlineStyle: React.CSSProperties = {
    height: '1px',
    background:
      'linear-gradient(to right, rgba(229,194,118,0.4) 0%, rgba(229,194,118,0.1) 40%, transparent 100%)',
    width: '100%',
  }

  return (
    <div
      ref={trapRef}
      className="fixed inset-0 z-[var(--z-sheet)] flex flex-col justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="File a desire"
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <section
        className="relative w-full max-h-[75vh] bg-surface-container-low rounded-t-sm flex flex-col overflow-hidden"
        style={{ boxShadow: '0 -20px 60px rgba(0,0,0,0.6)' }}
      >
        {/* Grab bar */}
        <div className="flex justify-center py-4">
          <div className="w-12 h-px bg-primary/30" />
        </div>

        {/* Header */}
        <header className="px-8 pb-6">
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="font-label text-primary/60 text-[0.6rem] tracking-[0.3em] uppercase mb-2">
                FILE A DESIRE
              </p>
              <h2 className="font-headline italic text-2xl md:text-3xl text-on-background leading-tight">
                A bottle to be considered.
              </h2>
            </div>
            <button
              onClick={onClose}
              className="font-headline italic text-base text-secondary/60 hover:text-on-background transition-colors flex-shrink-0 pt-1"
            >
              close
            </button>
          </div>
          <div className="mt-6" style={hairlineStyle} />
        </header>

        {/* Search field */}
        <div className="px-8 pb-6">
          <div className="relative group">
            <div className="flex items-center gap-4 py-3">
              <span className="text-primary/60 flex-shrink-0">⌕</span>
              <input
                className="flex-1 bg-transparent border-none focus:ring-0 focus:outline-none font-headline italic text-lg text-on-background placeholder:text-secondary/40 placeholder:italic"
                placeholder="Request a title, a house, a note…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="font-headline italic text-sm text-secondary/50 hover:text-primary transition-colors"
                >
                  clear
                </button>
              )}
            </div>
            <div
              className="absolute bottom-0 left-0 right-0 opacity-40 group-focus-within:opacity-100 transition-opacity"
              style={hairlineStyle}
            />
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-8 pb-8">
          {searching ? (
            <div className="space-y-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="grid grid-cols-[48px_1fr_auto] gap-4 items-center">
                  <div className="aspect-[3/4] rounded-sm bg-surface-container-highest animate-pulse" />
                  <div className="space-y-2">
                    <div className="h-2 w-16 bg-surface-container-highest rounded animate-pulse" />
                    <div className="h-3 w-28 bg-surface-container-highest rounded animate-pulse" />
                  </div>
                  <div className="h-2 w-8 bg-surface-container-highest rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : query.length >= 2 && results.length === 0 ? (
            <p className="font-headline italic text-base text-secondary/40 text-center py-12">
              No titles matched your request.
            </p>
          ) : (
            <div className="space-y-0">
              {results.map((f) => {
                const alreadyAdded = existingIds.includes(f.id)
                return (
                  <div key={f.id}>
                    <div className="grid grid-cols-[48px_1fr_auto] gap-4 items-center py-4">
                      <div className="aspect-[3/4] rounded-sm overflow-hidden flex-shrink-0 bg-surface-container-highest">
                        {f.image_url ? (
                          <FragranceImage
                            src={f.image_url}
                            alt={f.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-surface-container" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-label text-primary/70 text-[0.6rem] tracking-[0.15em] uppercase truncate">
                          {f.brand}
                        </p>
                        <p className="font-headline italic text-base text-on-background truncate">
                          {f.name}
                        </p>
                      </div>
                      {alreadyAdded ? (
                        <span className="font-headline italic text-sm text-primary/40">
                          already filed
                        </span>
                      ) : saving === f.id ? (
                        <span className="font-headline italic text-sm text-secondary/40 animate-pulse">
                          filing…
                        </span>
                      ) : (
                        <button
                          onClick={() => handleAdd(f)}
                          className="font-headline italic text-sm text-secondary/50 hover:text-primary transition-colors"
                        >
                          file
                        </button>
                      )}
                    </div>
                    <div style={hairlineStyle} />
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

