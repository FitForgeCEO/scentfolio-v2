import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../ui/Icon'
import { InlineError } from '../ui/InlineError'
import { useUserCollection } from '@/hooks/useFragrances'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { awardXP } from '@/lib/xp'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import type { Fragrance } from '@/types/database'

const STATUS_TABS = ['ALL', 'OWN', 'WISHLIST', 'SAMPLED', 'SOLD'] as const
type StatusFilter = (typeof STATUS_TABS)[number]

const STATUS_MAP: Record<string, string> = {
  own: 'OWN',
  wishlist: 'WISHLIST',
  sampled: 'SAMPLED',
  sold: 'SOLD',
}

export function CollectionScreen() {
  const [activeTab, setActiveTab] = useState<StatusFilter>('ALL')
  const [search, setSearch] = useState('')
  const navigate = useNavigate()

  const { user } = useAuth()
  const userId = user?.id
  const { data: collection, loading, error, retry } = useUserCollection(userId)

  // Quick-add overlay state
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [addQuery, setAddQuery] = useState('')
  const [addResults, setAddResults] = useState<Fragrance[]>([])
  const [addSearching, setAddSearching] = useState(false)
  const [addingSaving, setAddingSaving] = useState<string | null>(null)
  const addTimeout = useRef<ReturnType<typeof setTimeout>>()

  const quickAddTrapRef = useFocusTrap(quickAddOpen, () => { setQuickAddOpen(false); setAddQuery(''); setAddResults([]) })

  // Which status to add as — based on active tab
  const addStatus = activeTab === 'ALL' || activeTab === 'SOLD' ? 'own' : activeTab.toLowerCase()

  // Debounced search for quick-add
  useEffect(() => {
    if (addQuery.length < 2) {
      setAddResults([])
      setAddSearching(false)
      return
    }
    setAddSearching(true)
    clearTimeout(addTimeout.current)
    addTimeout.current = setTimeout(() => {
      supabase
        .from('fragrances')
        .select('*')
        .or(`name.ilike.%${addQuery}%,brand.ilike.%${addQuery}%`)
        .not('image_url', 'is', null)
        .order('rating', { ascending: false, nullsFirst: false })
        .limit(10)
        .then(({ data }) => {
          if (data) setAddResults(data as Fragrance[])
          setAddSearching(false)
        })
    }, 300)
    return () => clearTimeout(addTimeout.current)
  }, [addQuery])

  const handleQuickAdd = async (frag: Fragrance) => {
    if (!user) return
    setAddingSaving(frag.id)
    // Check if already in collection
    const { data: existing } = await supabase
      .from('user_collections')
      .select('id')
      .eq('user_id', user.id)
      .eq('fragrance_id', frag.id)
      .maybeSingle()

    if (existing) {
      // Already exists — update status
      await supabase
        .from('user_collections')
        .update({ status: addStatus })
        .eq('user_id', user.id)
        .eq('fragrance_id', frag.id)
    } else {
      await supabase
        .from('user_collections')
        .insert({ user_id: user.id, fragrance_id: frag.id, status: addStatus })
      await awardXP(user.id, 'ADD_TO_COLLECTION')
    }
    setAddingSaving(null)
    setQuickAddOpen(false)
    setAddQuery('')
    setAddResults([])
    retry() // refresh collection
  }

  const filtered = collection
    .filter((item) => {
      if (activeTab !== 'ALL' && STATUS_MAP[item.status]?.toUpperCase() !== activeTab) return false
      if (search.length >= 2) {
        const q = search.toLowerCase()
        return (
          item.fragrance.name.toLowerCase().includes(q) ||
          item.fragrance.brand.toLowerCase().includes(q)
        )
      }
      return true
    })

  const statusCounts = collection.reduce(
    (acc, item) => {
      const key = STATUS_MAP[item.status] || item.status.toUpperCase()
      acc[key] = (acc[key] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  return (
    <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen">
      {/* Header */}
      <header className="mb-8">
        <div className="flex justify-between items-end mb-2">
          <div>
            <h2 className="font-headline text-4xl text-on-surface leading-tight">My Collection</h2>
            <p className="font-body text-sm text-secondary opacity-70 mt-1">
              {collection.length} fragrance{collection.length !== 1 ? 's' : ''}
            </p>
          </div>
          {/* Grid toggle removed — single layout for now */}
        </div>
      </header>

      {/* Search */}
      <section className="mb-6">
        <div className="relative flex items-center bg-surface-container rounded-xl px-4 py-3.5 focus-within:ring-1 ring-primary/30 transition-all">
          <Icon name="search" className="text-secondary opacity-50 mr-3" />
          <input
            className="bg-transparent border-none p-0 focus:ring-0 focus:outline-none text-on-surface placeholder:text-secondary/40 w-full text-sm"
            placeholder="Search your collection..."
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-secondary/60 active:scale-90 transition-transform">
              <Icon name="close" size={18} />
            </button>
          )}
        </div>
      </section>

      {/* Status Tabs */}
      <nav className="sticky top-16 z-40 -mx-6 bg-background/95 backdrop-blur-sm py-4 mb-2 overflow-x-auto no-scrollbar">
        <div className="flex gap-2 px-6">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`whitespace-nowrap px-6 py-2 rounded-full font-label text-[10px] font-bold tracking-widest uppercase transition-all ${
                activeTab === tab
                  ? 'bg-primary text-on-primary-container'
                  : 'bg-surface-container text-secondary hover:bg-surface-container-highest'
              }`}
            >
              {tab}
              {tab !== 'ALL' && statusCounts[tab] ? (
                <span className="ml-1 opacity-60">({statusCounts[tab]})</span>
              ) : null}
            </button>
          ))}
        </div>
      </nav>

      {/* Sort Info */}
      <div className="mb-6 flex items-center justify-between">
        <span className="font-label text-[10px] tracking-[0.15em] text-secondary/60 uppercase">
          Sorted by: <span className="text-primary font-bold">RECENTLY ADDED</span>
        </span>
      </div>

      {/* Content */}
      {error ? (
        <InlineError message="Couldn't load your collection" onRetry={retry} />
      ) : loading ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col">
              <div className="aspect-[3/4] rounded-xl bg-surface-container animate-pulse mb-3" />
              <div className="h-3 w-16 bg-surface-container rounded animate-pulse mb-1" />
              <div className="h-4 w-24 bg-surface-container rounded animate-pulse" />
            </div>
          ))}
        </div>
      ) : collection.length === 0 ? (
        /* Empty State — no auth or no collection items yet */
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="w-20 h-20 rounded-full bg-surface-container flex items-center justify-center mb-6">
            <Icon name="water_drop" className="text-primary/40 text-4xl" />
          </div>
          <h3 className="font-headline text-xl text-on-surface mb-2 text-center">Your collection is empty</h3>
          <p className="text-sm text-secondary/60 text-center mb-8 max-w-[280px]">
            Explore our library of 2,700+ fragrances and start building your scent profile.
          </p>
          <button
            onClick={() => navigate('/explore')}
            className="gold-gradient text-on-primary-container px-8 py-3 rounded-xl font-label text-[10px] font-bold uppercase tracking-widest active:scale-95 transition-all shadow-lg"
          >
            EXPLORE FRAGRANCES
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Icon name="search_off" className="text-4xl text-primary/30 mb-4" />
          <h4 className="font-headline text-xl text-on-surface mb-2">No matches</h4>
          <p className="text-sm text-secondary/60 text-center">
            {search ? `Nothing matching "${search}"` : `No fragrances with status "${activeTab}"`}
          </p>
        </div>
      ) : (
        <section className="grid grid-cols-2 gap-x-4 gap-y-8 mb-16">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="flex flex-col group cursor-pointer"
              role="link"
              tabIndex={0}
              onClick={() => navigate(`/fragrance/${item.fragrance.id}`)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/fragrance/${item.fragrance.id}`) } }}
            >
              <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-surface-container-low mb-3">
                {item.fragrance.image_url ? (
                  <img
                    src={item.fragrance.image_url}
                    alt={item.fragrance.name}
                    className="w-full h-full object-cover grayscale-[20%] group-hover:scale-105 transition-transform duration-700"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-secondary/20">
                    <Icon name="water_drop" size={40} />
                  </div>
                )}
                <div
                  className="absolute top-2 right-2 px-2 py-0.5 backdrop-blur-md rounded text-[8px] font-bold tracking-widest"
                  style={{
                    background:
                      item.status === 'wishlist'
                        ? 'rgba(229, 194, 118, 0.2)'
                        : 'rgba(25, 18, 16, 0.6)',
                    color: '#e5c276',
                  }}
                >
                  {STATUS_MAP[item.status] || item.status.toUpperCase()}
                </div>
                <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-background/80 to-transparent" />
              </div>
              <span className="font-label text-[9px] tracking-[0.2em] text-secondary opacity-60 uppercase mb-0.5">
                {item.fragrance.brand}
              </span>
              <h3 className="font-body text-sm font-medium text-on-surface line-clamp-1 mb-1">
                {item.fragrance.name}
              </h3>
              {(item.personal_rating || item.fragrance.rating) && (
                <div className="flex items-center gap-1">
                  <Icon name="star" filled className="text-[12px] text-primary" />
                  <span className="font-body text-[10px] text-primary font-semibold">
                    {(item.personal_rating || Number(item.fragrance.rating))?.toFixed(1)}
                  </span>
                </div>
              )}
            </div>
          ))}
        </section>
      )}
      {/* FAB — Add Fragrance */}
      {user && (
        <button
          onClick={() => setQuickAddOpen(true)}
          className="fixed bottom-24 right-6 z-50 w-14 h-14 rounded-full gold-gradient shadow-xl flex items-center justify-center active:scale-90 transition-all ambient-glow"
          aria-label="Add fragrance"
        >
          <Icon name="add" className="text-on-primary text-2xl" />
        </button>
      )}

      {/* Quick-Add Overlay */}
      {quickAddOpen && (
        <div ref={quickAddTrapRef} className="fixed inset-0 z-[60] flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="Add fragrance">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setQuickAddOpen(false); setAddQuery(''); setAddResults([]) }} />
          <section className="relative w-full max-h-[70vh] bg-surface-container-low rounded-t-[2.5rem] sheet-shadow flex flex-col overflow-hidden animate-slide-up">
            {/* Handle */}
            <div className="flex justify-center py-4">
              <div className="w-12 h-1 bg-surface-container-highest rounded-full" />
            </div>
            {/* Header */}
            <header className="px-8 pb-4 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-headline font-bold text-on-surface">Add Fragrance</h2>
                <p className="text-[10px] uppercase tracking-[0.15em] text-primary font-bold mt-1">
                  Adding to: {addStatus.toUpperCase()}
                </p>
              </div>
              <button
                onClick={() => { setQuickAddOpen(false); setAddQuery(''); setAddResults([]) }}
                className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center text-on-surface-variant active:scale-90 transition-transform"
              >
                <Icon name="close" size={20} />
              </button>
            </header>
            {/* Search */}
            <div className="px-8 pb-4">
              <div className="flex items-center bg-surface-container rounded-2xl px-4 py-3 focus-within:ring-1 ring-primary/30 transition-all">
                <Icon name="search" className="text-secondary/50 mr-3" size={18} />
                <input
                  className="bg-transparent border-none p-0 focus:ring-0 focus:outline-none text-on-surface placeholder:text-secondary/40 w-full text-sm"
                  placeholder="Search fragrances..."
                  type="text"
                  value={addQuery}
                  onChange={(e) => setAddQuery(e.target.value)}
                  autoFocus
                />
                {addQuery && (
                  <button onClick={() => setAddQuery('')} className="text-secondary/60">
                    <Icon name="close" size={16} />
                  </button>
                )}
              </div>
            </div>
            {/* Results */}
            <div className="flex-1 overflow-y-auto px-8 pb-8">
              {addSearching ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : addQuery.length >= 2 && addResults.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-sm text-secondary/50">No fragrances found</p>
                </div>
              ) : (
                <div className="divide-y divide-outline-variant/10">
                  {addResults.map((f) => {
                    const alreadyInCollection = collection.some((c) => c.fragrance.id === f.id)
                    return (
                      <button
                        key={f.id}
                        onClick={() => !alreadyInCollection && handleQuickAdd(f)}
                        disabled={addingSaving === f.id || alreadyInCollection}
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
                        {alreadyInCollection ? (
                          <span className="text-[9px] font-bold tracking-wider text-primary/50">IN COLLECTION</span>
                        ) : addingSaving === f.id ? (
                          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Icon name="add" className="text-primary" size={18} />
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
      )}
    </main>
  )
}
