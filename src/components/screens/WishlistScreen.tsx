import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../ui/Icon'
import { InlineError } from '../ui/InlineError'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { supabase } from '@/lib/supabase'
import { awardXP } from '@/lib/xp'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import type { Fragrance, UserCollection } from '@/types/database'

type WishlistItem = UserCollection & { fragrance: Fragrance }

export function WishlistScreen() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { showToast } = useToast()
  const [items, setItems] = useState<WishlistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addSheetOpen, setAddSheetOpen] = useState(false)

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

  useEffect(() => { fetchWishlist() }, [fetchWishlist])

  const handleMarkOwned = async (item: WishlistItem) => {
    // Optimistic
    setItems((prev) => prev.filter((i) => i.id !== item.id))
    const { error: err } = await supabase
      .from('user_collections')
      .update({ status: 'own' })
      .eq('id', item.id)
    if (err) {
      setItems((prev) => [item, ...prev])
      showToast('Failed to update', 'error')
    } else {
      showToast(`${item.fragrance.name} moved to collection!`, 'success', 'check_circle')
    }
  }

  const handleRemove = async (item: WishlistItem) => {
    setItems((prev) => prev.filter((i) => i.id !== item.id))
    const { error: err } = await supabase
      .from('user_collections')
      .delete()
      .eq('id', item.id)
    if (err) {
      setItems((prev) => [item, ...prev])
      showToast('Failed to remove', 'error')
    } else {
      showToast('Removed from wishlist', 'info')
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
      showToast('Failed to update', 'error')
    } else {
      showToast(`${item.fragrance.name} marked as sampled`, 'success', 'science')
    }
  }

  if (!user) {
    return (
      <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen flex flex-col items-center justify-center">
        <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center mb-5">
          <Icon name="favorite" className="text-3xl text-primary/40" />
        </div>
        <h3 className="font-headline text-xl text-on-surface mb-2">Sign in to track your wishlist</h3>
        <p className="text-sm text-secondary/60 text-center mb-6">Keep a list of fragrances you want to try next.</p>
        <button onClick={() => navigate('/profile')} className="gold-gradient text-on-primary-container px-8 py-3 rounded-xl font-label text-[10px] font-bold uppercase tracking-widest active:scale-95 transition-all shadow-lg">
          SIGN IN
        </button>
      </main>
    )
  }

  return (
    <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen">
      <header className="mb-6">
        <h2 className="font-headline text-3xl text-on-surface leading-tight mb-1">Want to Try</h2>
        <p className="font-body text-sm text-secondary opacity-70">
          {items.length} fragrance{items.length !== 1 ? 's' : ''} on your radar
        </p>
      </header>

      {error ? (
        <InlineError message="Couldn't load wishlist" onRetry={fetchWishlist} />
      ) : loading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-surface-container animate-pulse">
              <div className="w-16 h-16 rounded-lg bg-surface-container-highest" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-20 bg-surface-container-highest rounded" />
                <div className="h-4 w-32 bg-surface-container-highest rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-20 h-20 rounded-full bg-surface-container flex items-center justify-center mb-6">
            <Icon name="favorite_border" className="text-primary/40 text-4xl" />
          </div>
          <h3 className="font-headline text-xl text-on-surface mb-2 text-center">Your wishlist is empty</h3>
          <p className="text-sm text-secondary/60 text-center mb-8 max-w-[280px]">
            Found something you want to try? Browse the library and tap the heart to save it here.
          </p>
          <button onClick={() => navigate('/explore')} className="gold-gradient text-on-primary-container px-8 py-3 rounded-xl font-label text-[10px] font-bold uppercase tracking-widest active:scale-95 transition-all shadow-lg">
            EXPLORE FRAGRANCES
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <WishlistCard
              key={item.id}
              item={item}
              onTap={() => navigate(`/fragrance/${item.fragrance.id}`)}
              onMarkOwned={() => handleMarkOwned(item)}
              onMarkSampled={() => handleMarkSampled(item)}
              onRemove={() => handleRemove(item)}
            />
          ))}
        </div>
      )}

      {/* FAB — Quick Add */}
      {user && (
        <button
          onClick={() => setAddSheetOpen(true)}
          className="fixed bottom-24 right-6 z-[var(--z-fab)] w-14 h-14 rounded-full gold-gradient shadow-xl flex items-center justify-center active:scale-90 transition-all ambient-glow"
          aria-label="Add to wishlist"
        >
          <Icon name="add" className="text-on-primary text-2xl" />
        </button>
      )}

      {addSheetOpen && (
        <AddToWishlistSheet
          userId={user.id}
          existingIds={items.map((i) => i.fragrance.id)}
          onClose={() => setAddSheetOpen(false)}
          onAdded={() => { setAddSheetOpen(false); fetchWishlist() }}
        />
      )}
    </main>
  )
}

function WishlistCard({
  item,
  onTap,
  onMarkOwned,
  onMarkSampled,
  onRemove,
}: {
  item: WishlistItem
  onTap: () => void
  onMarkOwned: () => void
  onMarkSampled: () => void
  onRemove: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const frag = item.fragrance

  return (
    <div className="bg-surface-container rounded-xl overflow-hidden">
      <button onClick={onTap} className="w-full flex items-center gap-4 p-4 text-left active:bg-surface-container-high transition-colors">
        <div className="w-16 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-surface-container-highest">
          {frag.image_url ? (
            <img src={frag.image_url} alt={frag.name} className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Icon name="water_drop" className="text-secondary/30" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[9px] uppercase tracking-[0.15em] text-primary/70 font-bold">{frag.brand}</p>
          <p className="text-sm text-on-surface font-medium truncate">{frag.name}</p>
          {frag.concentration && (
            <p className="text-[10px] text-secondary/50 mt-0.5">{frag.concentration}</p>
          )}
          <div className="flex items-center gap-3 mt-2">
            {frag.rating && (
              <span className="flex items-center gap-1">
                <Icon name="star" filled className="text-[11px] text-primary" />
                <span className="text-[10px] text-primary font-semibold">{Number(frag.rating).toFixed(1)}</span>
              </span>
            )}
            {frag.note_family && (
              <span className="text-[10px] text-secondary/50 bg-surface-container-highest px-2 py-0.5 rounded-full">{frag.note_family}</span>
            )}
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }}
          aria-label="More actions"
          className="w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center flex-shrink-0 active:scale-90 transition-transform"
        >
          <Icon name={expanded ? 'expand_less' : 'more_vert'} size={18} className="text-secondary/60" />
        </button>
      </button>

      {/* Expandable Actions */}
      {expanded && (
        <div className="flex gap-2 px-4 pb-4 animate-slide-down">
          <button
            onClick={onMarkOwned}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-primary/10 active:scale-95 transition-transform"
          >
            <Icon name="check_circle" className="text-primary" size={16} />
            <span className="text-[10px] font-bold tracking-wider text-primary uppercase">GOT IT</span>
          </button>
          <button
            onClick={onMarkSampled}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-tertiary/10 active:scale-95 transition-transform"
          >
            <Icon name="science" className="text-tertiary" size={16} />
            <span className="text-[10px] font-bold tracking-wider text-tertiary uppercase">SAMPLED</span>
          </button>
          <button
            onClick={onRemove}
            className="flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-lg bg-error/10 active:scale-95 transition-transform"
          >
            <Icon name="delete_outline" className="text-error/70" size={16} />
          </button>
        </div>
      )}
    </div>
  )
}

function AddToWishlistSheet({
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
    if (query.length < 2) { setResults([]); return }
    setSearching(true)
    debounceRef.current = setTimeout(() => {
      supabase
        .from('fragrances')
        .select('*')
        .or(`name.ilike.%${query}%,brand.ilike.%${query}%`)
        .not('image_url', 'is', null)
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
      showToast('Failed to add', 'error')
      setSaving(null)
    } else {
      await awardXP(userId, 'ADD_TO_COLLECTION')
      showToast(`${frag.name} added to wishlist!`, 'success', 'favorite')
      onAdded()
    }
  }

  return (
    <div ref={trapRef} className="fixed inset-0 z-[var(--z-sheet)] flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="Add to wishlist">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <section className="relative w-full max-h-[75vh] bg-surface-container-low rounded-t-[2.5rem] sheet-shadow flex flex-col overflow-hidden animate-slide-up">
        <div className="flex justify-center py-4"><div className="w-12 h-1 bg-surface-container-highest rounded-full" /></div>
        <header className="px-8 pb-4 flex justify-between items-center">
          <h2 className="text-2xl font-headline font-bold text-on-surface">Add to Wishlist</h2>
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center text-on-surface-variant active:scale-90 transition-transform">
            <Icon name="close" size={20} />
          </button>
        </header>
        <div className="px-8 pb-4">
          <div className="flex items-center bg-surface-container rounded-2xl px-4 py-3 focus-within:ring-1 ring-primary/30 transition-all">
            <Icon name="search" className="text-secondary/50 mr-3" size={18} />
            <input
              className="bg-transparent border-none p-0 focus:ring-0 focus:outline-none text-on-surface placeholder:text-secondary/40 w-full text-sm"
              placeholder="Search fragrances..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-8 pb-8">
          {searching ? (
            <div className="flex justify-center py-12">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : query.length >= 2 && results.length === 0 ? (
            <p className="text-center text-sm text-secondary/50 py-12">No fragrances found</p>
          ) : (
            <div className="divide-y divide-outline-variant/10">
              {results.map((f) => {
                const alreadyAdded = existingIds.includes(f.id)
                return (
                  <button
                    key={f.id}
                    onClick={() => !alreadyAdded && handleAdd(f)}
                    disabled={saving === f.id || alreadyAdded}
                    className="w-full flex items-center gap-3 py-3 text-left disabled:opacity-50 active:bg-surface-container-highest transition-colors"
                  >
                    <div className="w-11 h-11 rounded-lg overflow-hidden flex-shrink-0 bg-surface-container-highest">
                      {f.image_url ? (
                        <img src={f.image_url} alt={f.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Icon name="water_drop" className="text-secondary/30" size={16} />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[9px] uppercase tracking-[0.15em] text-primary/70 font-bold">{f.brand}</p>
                      <p className="text-sm text-on-surface truncate">{f.name}</p>
                    </div>
                    {alreadyAdded ? (
                      <span className="text-[9px] font-bold tracking-wider text-primary/50">ON LIST</span>
                    ) : saving === f.id ? (
                      <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Icon name="favorite" className="text-primary" size={18} />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
