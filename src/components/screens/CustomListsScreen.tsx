import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { InlineError } from '../ui/InlineError'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { supabase } from '@/lib/supabase'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import type { Fragrance } from '@/types/database'

interface CustomList {
  id: string
  user_id: string
  name: string
  icon: string
  color: string
  sort_order: number
  created_at: string
  item_count?: number
}

interface CustomListItem {
  id: string
  list_id: string
  fragrance_id: string
  sort_order: number
  added_at: string
  fragrance: Fragrance
}

/** Maps stored Material icon names → typographic glyphs */
const ICON_GLYPH: Record<string, string> = {
  label: '◈', favorite: '♥', star: '★', bookmark: '⊡',
  local_fire_department: '◆', diamond: '◇', nightlight: '☽',
  work: '▪', flight: '▸', beach_access: '☀', celebration: '✦', spa: '✿',
}
const glyphFor = (name: string) => ICON_GLYPH[name] ?? '◈'

const ICON_OPTIONS = ['label', 'favorite', 'star', 'bookmark', 'local_fire_department', 'diamond', 'nightlight', 'work', 'flight', 'beach_access', 'celebration', 'spa']
const COLOR_OPTIONS = ['#e5c276', '#C77DB5', '#5BA3C9', '#8BC34A', '#D4845A', '#C75B39', '#9E8C7C', '#6B8F71']

export function CustomListsScreen() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const toast = useToast()
  const [lists, setLists] = useState<CustomList[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const fetchLists = useCallback(() => {
    if (!user) { setLoading(false); return }
    setLoading(true)
    setError(null)
    supabase
      .from('custom_lists')
      .select('*')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true })
      .then(async ({ data, error: err }) => {
        if (err) { setError(err.message); setLoading(false); return }
        const listsData = (data ?? []) as CustomList[]
        const counts = await Promise.all(
          listsData.map((l) =>
            supabase.from('custom_list_items').select('id', { count: 'exact', head: true }).eq('list_id', l.id)
          )
        )
        listsData.forEach((l, i) => { l.item_count = counts[i].count ?? 0 })
        setLists(listsData)
        setLoading(false)
      })
  }, [user])

  useEffect(() => { fetchLists() }, [fetchLists])

  const handleDelete = async (id: string) => {
    setLists((prev) => prev.filter((l) => l.id !== id))
    const { error: err } = await supabase.from('custom_lists').delete().eq('id', id)
    if (err) { toast.showToast('Failed to delete', 'error'); fetchLists() }
    else toast.showToast('List deleted', 'success')
  }

  if (!user) {
    return (
      <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen flex flex-col items-center justify-center">
        <div className="w-16 h-16 rounded-sm bg-surface-container flex items-center justify-center mb-5">
          <span className="text-2xl text-primary/40">⊡</span>
        </div>
        <h3 className="font-headline text-xl text-on-surface mb-2">Sign in to create lists</h3>
        <button onClick={() => navigate('/profile')} className="gold-gradient text-on-primary-container px-8 py-3 rounded-sm font-label text-[10px] font-bold uppercase tracking-widest hover:opacity-80 transition-opacity shadow-lg mt-6">SIGN IN</button>
      </main>
    )
  }

  if (error) return <main className="pt-24 pb-32 px-6"><InlineError message="Couldn't load lists" onRetry={fetchLists} /></main>

  return (
    <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen space-y-6">
      <header>
        <h2 className="font-headline text-3xl text-on-surface leading-tight mb-1">My Lists</h2>
        <p className="font-body text-sm text-secondary opacity-70">Custom categories for your collection</p>
      </header>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 rounded-sm bg-surface-container animate-pulse" />)}</div>
      ) : lists.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-20 h-20 rounded-sm bg-surface-container flex items-center justify-center mb-6">
            <span className="text-primary/40 text-3xl">⊡</span>
          </div>
          <h3 className="font-headline text-xl text-on-surface mb-2">No lists yet</h3>
          <p className="text-sm text-secondary/60 text-center mb-8 max-w-[280px]">Create custom lists like "Office Safe", "Date Night", or "Travel" to organise your fragrances.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {lists.map((list) => (
            <div key={list.id} className="bg-surface-container rounded-sm overflow-hidden">
              <button
                onClick={() => navigate(`/lists/${list.id}`)}
                className="w-full flex items-center gap-4 px-4 py-4 text-left hover:bg-surface-container-highest transition-colors"
              >
                <div className="w-10 h-10 rounded-sm flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${list.color}20` }}>
                  <span style={{ color: list.color }} className="text-lg">{glyphFor(list.icon)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-on-surface font-medium">{list.name}</p>
                  <p className="text-[10px] text-secondary/50">{list.item_count ?? 0} fragrance{(list.item_count ?? 0) !== 1 ? 's' : ''}</p>
                </div>
                <span className="text-secondary/40 text-sm">›</span>
              </button>
              <div className="relative">
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-outline-variant/10 via-outline-variant/5 to-transparent" />
                <button
                  onClick={() => handleDelete(list.id)}
                  className="w-full py-2 text-[10px] text-error/60 font-bold tracking-widest uppercase hover:bg-error/5 transition-colors"
                >
                  DELETE
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setCreateOpen(true)}
        className="fixed bottom-24 right-6 z-[var(--z-fab)] w-14 h-14 rounded-sm gold-gradient shadow-xl flex items-center justify-center hover:opacity-80 transition-opacity ambient-glow"
        aria-label="Create list"
      >
        <span className="text-on-primary text-2xl font-light">+</span>
      </button>

      {/* Create List Sheet */}
      {createOpen && (
        <CreateListSheet
          isOpen={createOpen}
          onClose={() => setCreateOpen(false)}
          userId={user.id}
          onCreated={fetchLists}
          nextOrder={lists.length}
        />
      )}
    </main>
  )
}

function CreateListSheet({ isOpen, onClose, userId, onCreated, nextOrder }: {
  isOpen: boolean; onClose: () => void; userId: string; onCreated: () => void; nextOrder: number
}) {
  const toast = useToast()
  const trapRef = useFocusTrap(isOpen, onClose)
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('label')
  const [color, setColor] = useState('#e5c276')
  const [saving, setSaving] = useState(false)

  const handleCreate = async () => {
    if (!name.trim()) return
    setSaving(true)
    const { error } = await supabase.from('custom_lists').insert({
      user_id: userId, name: name.trim(), icon, color, sort_order: nextOrder,
    })
    setSaving(false)
    if (error) { toast.showToast('Failed to create list', 'error'); return }
    toast.showToast('List created!', 'success')
    onCreated()
    onClose()
  }

  return (
    <div ref={trapRef} className="fixed inset-0 z-[var(--z-sheet)] flex flex-col justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <section className="relative w-full bg-surface-container-low rounded-t-[2.5rem] sheet-shadow animate-slide-up">
        <div className="flex justify-center py-4"><div className="w-12 h-1 bg-surface-container-highest rounded-full" /></div>
        <div className="px-8 pb-10 space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-headline font-bold text-on-surface">New List</h2>
            <button onClick={onClose} className="w-10 h-10 rounded-sm bg-surface-container-highest flex items-center justify-center hover:opacity-80 transition-opacity">
              <span className="text-on-surface text-lg">×</span>
            </button>
          </div>

          {/* Preview */}
          <div className="flex items-center gap-3 py-3">
            <div className="w-12 h-12 rounded-sm flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
              <span style={{ color }} className="text-xl">{glyphFor(icon)}</span>
            </div>
            <p className="text-lg font-medium text-on-surface">{name || 'List name'}</p>
          </div>

          {/* Name */}
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Office Safe, Date Night, Travel..."
            maxLength={40}
            autoFocus
            className="w-full bg-surface-container border-none text-on-surface placeholder:text-on-surface-variant/40 rounded-sm px-4 py-3.5 text-sm focus:ring-1 focus:ring-primary/30 focus:outline-none"
          />

          {/* Icon Picker */}
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold mb-3">ICON</p>
            <div className="flex flex-wrap gap-2">
              {ICON_OPTIONS.map((ic) => (
                <button
                  key={ic}
                  onClick={() => setIcon(ic)}
                  className={`w-10 h-10 rounded-sm flex items-center justify-center transition-all ${icon === ic ? 'ring-2 ring-primary bg-primary/10' : 'bg-surface-container'}`}
                >
                  <span style={{ color: icon === ic ? color : undefined }} className={icon === ic ? 'text-lg' : 'text-secondary/60 text-lg'}>{glyphFor(ic)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Colour Picker */}
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold mb-3">COLOUR</p>
            <div className="flex gap-3">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-sm transition-all ${color === c ? 'ring-2 ring-offset-2 ring-offset-surface-container-low ring-primary' : ''}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Create */}
          <button
            onClick={handleCreate}
            disabled={!name.trim() || saving}
            className="w-full py-4 gold-gradient text-on-primary font-bold uppercase tracking-[0.15em] rounded-sm ambient-glow hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? 'CREATING...' : 'CREATE LIST'}
          </button>
        </div>
      </section>
    </div>
  )
}

/** List detail screen — shows items in a specific custom list */
export function ListDetailScreen() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const toast = useToast()
  const [list, setList] = useState<CustomList | null>(null)
  const [items, setItems] = useState<CustomListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)

  const fetchItems = useCallback(() => {
    if (!id || !user) { setLoading(false); return }
    setLoading(true)
    setError(null)
    Promise.all([
      supabase.from('custom_lists').select('*').eq('id', id).single(),
      supabase.from('custom_list_items').select('*, fragrance:fragrances(*)').eq('list_id', id).order('sort_order', { ascending: true }),
    ]).then(([listRes, itemsRes]) => {
      if (listRes.error) { setError(listRes.error.message); setLoading(false); return }
      setList(listRes.data as CustomList)
      setItems((itemsRes.data ?? []) as CustomListItem[])
      setLoading(false)
    })
  }, [id, user])

  useEffect(() => { fetchItems() }, [fetchItems])

  const handleRemoveItem = async (itemId: string) => {
    setItems((prev) => prev.filter((i) => i.id !== itemId))
    const { error: err } = await supabase.from('custom_list_items').delete().eq('id', itemId)
    if (err) { toast.showToast('Failed to remove', 'error'); fetchItems() }
  }

  if (error) return <main className="pt-24 pb-32 px-6"><InlineError message="Couldn't load list" onRetry={fetchItems} /></main>

  if (loading) {
    return (
      <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen">
        <div className="space-y-4 pt-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 rounded-sm bg-surface-container animate-pulse" />)}</div>
      </main>
    )
  }

  return (
    <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen space-y-6">
      {list && (
        <header className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-sm flex items-center justify-center" style={{ backgroundColor: `${list.color}20` }}>
            <span style={{ color: list.color }} className="text-xl">{glyphFor(list.icon)}</span>
          </div>
          <div>
            <h2 className="font-headline text-2xl text-on-surface">{list.name}</h2>
            <p className="text-[10px] text-secondary/50">{items.length} fragrance{items.length !== 1 ? 's' : ''}</p>
          </div>
        </header>
      )}

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <p className="text-sm text-secondary/60 text-center mb-6">This list is empty. Tap + to add fragrances.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {items.map((item) => (
            <div key={item.id} className="relative space-y-2 group">
              <div
                className="aspect-[3/4] rounded-sm overflow-hidden bg-surface-container-low cursor-pointer"
                onClick={() => navigate(`/fragrance/${item.fragrance.id}`)}
              >
                {item.fragrance.image_url && (
                  <img src={item.fragrance.image_url} alt={item.fragrance.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                )}
              </div>
              <button
                onClick={() => handleRemoveItem(item.id)}
                className="absolute top-2 right-2 w-7 h-7 rounded-sm bg-black/50 backdrop-blur-sm flex items-center justify-center hover:opacity-80 transition-opacity opacity-0 group-hover:opacity-100"
              >
                <span className="text-white text-xs">×</span>
              </button>
              <div>
                <span className="text-[9px] uppercase tracking-[0.15em] text-secondary/60">{item.fragrance.brand}</span>
                <h4 className="text-sm font-medium text-on-surface truncate">{item.fragrance.name}</h4>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* FAB */}
      {user && (
        <button
          onClick={() => setAddOpen(true)}
          className="fixed bottom-24 right-6 z-[var(--z-fab)] w-14 h-14 rounded-sm gold-gradient shadow-xl flex items-center justify-center hover:opacity-80 transition-opacity ambient-glow"
          aria-label="Add to list"
        >
          <span className="text-on-primary text-2xl font-light">+</span>
        </button>
      )}

      {/* Add to list sheet */}
      {addOpen && id && (
        <AddToListSheet
          isOpen={addOpen}
          onClose={() => setAddOpen(false)}
          listId={id}
          existingIds={items.map((i) => i.fragrance_id)}
          onAdded={fetchItems}
        />
      )}
    </main>
  )
}

function AddToListSheet({ isOpen, onClose, listId, existingIds, onAdded }: {
  isOpen: boolean; onClose: () => void; listId: string; existingIds: string[]; onAdded: () => void
}) {
  const toast = useToast()
  const trapRef = useFocusTrap(isOpen, onClose)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Fragrance[]>([])
  const [searching, setSearching] = useState(false)
  const [adding, setAdding] = useState<string | null>(null)
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (query.length < 2) { setResults([]); return }
    setSearching(true)
    clearTimeout(timeout.current)
    timeout.current = setTimeout(() => {
      supabase
        .from('fragrances')
        .select('*')
        .or(`name.ilike.%${query}%,brand.ilike.%${query}%`)
        .order('rating', { ascending: false, nullsFirst: false })
        .limit(10)
        .then(({ data }) => {
          setResults((data ?? []) as Fragrance[])
          setSearching(false)
        })
    }, 250)
    return () => clearTimeout(timeout.current)
  }, [query])

  const handleAdd = async (frag: Fragrance) => {
    setAdding(frag.id)
    const { error } = await supabase.from('custom_list_items').insert({ list_id: listId, fragrance_id: frag.id })
    setAdding(null)
    if (error) {
      toast.showToast(error.message.includes('duplicate') ? 'Already in this list' : 'Failed to add', 'error')
      return
    }
    toast.showToast('Added to list', 'success')
    onAdded()
  }

  return (
    <div ref={trapRef} className="fixed inset-0 z-[var(--z-sheet)] flex flex-col justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <section className="relative w-full max-h-[70vh] bg-surface-container-low rounded-t-[2.5rem] sheet-shadow flex flex-col overflow-hidden animate-slide-up">
        <div className="flex justify-center py-4"><div className="w-12 h-1 bg-surface-container-highest rounded-full" /></div>
        <header className="px-8 pb-4 flex justify-between items-center">
          <h2 className="text-2xl font-headline font-bold text-on-surface">Add Fragrance</h2>
          <button onClick={onClose} className="w-10 h-10 rounded-sm bg-surface-container-highest flex items-center justify-center hover:opacity-80 transition-opacity">
            <span className="text-on-surface text-lg">×</span>
          </button>
        </header>
        <div className="px-8 pb-4">
          <div className="flex items-center bg-surface-container rounded-sm px-4 py-3 focus-within:ring-1 ring-primary/30">
            <span className="text-secondary/50 mr-3 text-xs italic">search</span>
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
            <div className="flex flex-col items-center gap-2 py-8">
              {[1,2,3].map(i => <div key={i} className="h-1.5 rounded-sm bg-primary/20 animate-pulse" style={{ width: `${80 - i * 16}px` }} />)}
            </div>
          ) : (
            <div className="space-y-0">
              {results.map((f, idx) => {
                const alreadyIn = existingIds.includes(f.id)
                return (
                  <div key={f.id}>
                    {idx > 0 && <div className="h-px bg-gradient-to-r from-outline-variant/10 via-outline-variant/5 to-transparent" />}
                    <button
                      onClick={() => !alreadyIn && handleAdd(f)}
                      disabled={alreadyIn || adding === f.id}
                      className="w-full flex items-center gap-3 py-3 text-left disabled:opacity-40 hover:bg-surface-container-highest transition-colors"
                    >
                      <div className="w-10 h-10 rounded-sm overflow-hidden flex-shrink-0 bg-surface-container-highest">
                        {f.image_url && <img src={f.image_url} alt="" className="w-full h-full object-cover" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] uppercase tracking-wider text-primary/70 font-bold">{f.brand}</p>
                        <p className="text-sm text-on-surface truncate">{f.name}</p>
                      </div>
                      {alreadyIn ? (
                        <span className="text-[9px] font-bold tracking-wider text-primary/50">IN LIST</span>
                      ) : adding === f.id ? (
                        <span className="text-[9px] uppercase tracking-wider text-primary animate-pulse">Adding…</span>
                      ) : (
                        <div className="w-8 h-8 rounded-sm bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-primary text-lg font-light">+</span>
                        </div>
                      )}
                    </button>
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
