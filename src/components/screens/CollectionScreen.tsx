import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../ui/Icon'
import { InlineError } from '../ui/InlineError'
import { useUserCollection } from '@/hooks/useFragrances'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { awardXP } from '@/lib/xp'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { useToast } from '@/contexts/ToastContext'
import { PullToRefresh } from '../ui/PullToRefresh'
import type { Fragrance } from '@/types/database'

const STATUS_TABS = ['ALL', 'OWN', 'WISHLIST', 'SAMPLED', 'SOLD'] as const
type StatusFilter = (typeof STATUS_TABS)[number]

const SORT_OPTIONS = [
  { value: 'recent', label: 'Recently Added' },
  { value: 'name-asc', label: 'Name A–Z' },
  { value: 'name-desc', label: 'Name Z–A' },
  { value: 'brand-asc', label: 'Brand A–Z' },
  { value: 'rating-desc', label: 'Highest Rated' },
  { value: 'price-asc', label: 'Price Low–High' },
  { value: 'price-desc', label: 'Price High–Low' },
] as const
type SortOption = (typeof SORT_OPTIONS)[number]['value']

interface Filters {
  brands: string[]
  concentrations: string[]
  noteFamilies: string[]
  minRating: number
  seasons: string[]
}

const STATUS_MAP: Record<string, string> = {
  own: 'OWN',
  wishlist: 'WISHLIST',
  sampled: 'SAMPLED',
  sold: 'SOLD',
}

export function CollectionScreen() {
  const [activeTab, setActiveTab] = useState<StatusFilter>('ALL')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('recent')
  const [sortMenuOpen, setSortMenuOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [filters, setFilters] = useState<Filters>({ brands: [], concentrations: [], noteFamilies: [], minRating: 0, seasons: [] })
  const navigate = useNavigate()

  const { user } = useAuth()
  const userId = user?.id
  const { data: collection, loading, error, retry } = useUserCollection(userId)
  const toast = useToast()

  // Batch selection state
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [batchProcessing, setBatchProcessing] = useState(false)

  const toggleSelect = (collectionId: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(collectionId)) next.delete(collectionId)
      else next.add(collectionId)
      return next
    })
  }

  const selectAll = () => {
    setSelected(new Set(filtered.map((f) => f.id)))
  }

  const clearSelection = () => {
    setSelected(new Set())
    setSelectMode(false)
  }

  const handleBatchDelete = async () => {
    if (!user || selected.size === 0) return
    setBatchProcessing(true)
    const ids = [...selected]
    const { error: delError } = await supabase
      .from('user_collections')
      .delete()
      .in('id', ids)
      .eq('user_id', user.id)
    if (delError) {
      toast.showToast('Failed to delete', 'error')
    } else {
      toast.showToast(`Removed ${ids.length} fragrance${ids.length > 1 ? 's' : ''}`, 'success')
      retry()
    }
    setBatchProcessing(false)
    clearSelection()
  }

  const handleBatchStatus = async (newStatus: string) => {
    if (!user || selected.size === 0) return
    setBatchProcessing(true)
    const ids = [...selected]
    const { error: updError } = await supabase
      .from('user_collections')
      .update({ status: newStatus })
      .in('id', ids)
      .eq('user_id', user.id)
    if (updError) {
      toast.showToast('Failed to update', 'error')
    } else {
      toast.showToast(`Moved ${ids.length} to ${newStatus}`, 'success')
      retry()
    }
    setBatchProcessing(false)
    clearSelection()
  }

  // Quick-add overlay state
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [addQuery, setAddQuery] = useState('')
  const [addResults, setAddResults] = useState<Fragrance[]>([])
  const [addSearching, setAddSearching] = useState(false)
  const [addingSaving, setAddingSaving] = useState<string | null>(null)
  const addTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

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

  const activeFilterCount = (filters.brands.length > 0 ? 1 : 0) + (filters.concentrations.length > 0 ? 1 : 0) + (filters.noteFamilies.length > 0 ? 1 : 0) + (filters.minRating > 0 ? 1 : 0) + (filters.seasons.length > 0 ? 1 : 0)

  // Derive available filter options from collection
  const allBrands = [...new Set(collection.map((c) => c.fragrance.brand))].sort()
  const allConcentrations = [...new Set(collection.map((c) => c.fragrance.concentration).filter(Boolean))] as string[]
  const allFamilies = [...new Set(collection.map((c) => c.fragrance.note_family).filter(Boolean))] as string[]

  const filtered = collection
    .filter((item) => {
      if (activeTab !== 'ALL' && STATUS_MAP[item.status]?.toUpperCase() !== activeTab) return false
      if (search.length >= 2) {
        const q = search.toLowerCase()
        if (!item.fragrance.name.toLowerCase().includes(q) && !item.fragrance.brand.toLowerCase().includes(q)) return false
      }
      if (filters.brands.length > 0 && !filters.brands.includes(item.fragrance.brand)) return false
      if (filters.concentrations.length > 0 && (!item.fragrance.concentration || !filters.concentrations.includes(item.fragrance.concentration))) return false
      if (filters.noteFamilies.length > 0 && (!item.fragrance.note_family || !filters.noteFamilies.includes(item.fragrance.note_family))) return false
      if (filters.minRating > 0) {
        const r = Number(item.personal_rating || item.fragrance.rating) || 0
        if (r < filters.minRating) return false
      }
      if (filters.seasons.length > 0) {
        const sr = item.fragrance.season_ranking
        if (!sr || !sr.some((s) => filters.seasons.includes(s.name) && s.score > 0.5)) return false
      }
      return true
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name-asc':
          return a.fragrance.name.localeCompare(b.fragrance.name)
        case 'name-desc':
          return b.fragrance.name.localeCompare(a.fragrance.name)
        case 'brand-asc':
          return a.fragrance.brand.localeCompare(b.fragrance.brand) || a.fragrance.name.localeCompare(b.fragrance.name)
        case 'rating-desc':
          return (Number(b.personal_rating || b.fragrance.rating) || 0) - (Number(a.personal_rating || a.fragrance.rating) || 0)
        case 'price-asc':
          return (Number(a.fragrance.price_value) || 9999) - (Number(b.fragrance.price_value) || 9999)
        case 'price-desc':
          return (Number(b.fragrance.price_value) || 0) - (Number(a.fragrance.price_value) || 0)
        default:
          return 0
      }
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
    <PullToRefresh onRefresh={async () => { retry() }}>
    <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen">
      {/* Header */}
      <header className="mb-8">
        <div className="flex justify-between items-end mb-2">
          <div>
            <h2 className="font-headline text-4xl text-on-surface leading-tight">My Collection</h2>
            <p className="font-body text-sm text-secondary opacity-70 mt-1">
              {selectMode ? `${selected.size} selected` : `${collection.length} fragrance${collection.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          {collection.length > 0 && (
            <button
              onClick={() => {
                if (selectMode) clearSelection()
                else setSelectMode(true)
              }}
              className="text-[10px] uppercase tracking-widest font-bold text-primary active:scale-95 transition-transform"
            >
              {selectMode ? 'CANCEL' : 'SELECT'}
            </button>
          )}
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

      {/* Collection Tools */}
      <section className="mb-4">
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-6 px-6 scrollbar-hide">
          <button onClick={() => navigate('/prices')} className="flex items-center gap-1.5 bg-surface-container px-3 py-2 rounded-lg flex-shrink-0 active:scale-95 transition-transform">
            <Icon name="payments" className="text-primary" size={14} />
            <span className="text-[10px] font-medium text-on-surface whitespace-nowrap">Prices</span>
          </button>
          <button onClick={() => navigate('/duplicates')} className="flex items-center gap-1.5 bg-surface-container px-3 py-2 rounded-lg flex-shrink-0 active:scale-95 transition-transform">
            <Icon name="find_replace" className="text-primary" size={14} />
            <span className="text-[10px] font-medium text-on-surface whitespace-nowrap">Duplicates</span>
          </button>
          <button onClick={() => navigate('/import')} className="flex items-center gap-1.5 bg-surface-container px-3 py-2 rounded-lg flex-shrink-0 active:scale-95 transition-transform">
            <Icon name="upload_file" className="text-primary" size={14} />
            <span className="text-[10px] font-medium text-on-surface whitespace-nowrap">Import</span>
          </button>
          <button onClick={() => navigate('/compare')} className="flex items-center gap-1.5 bg-surface-container px-3 py-2 rounded-lg flex-shrink-0 active:scale-95 transition-transform">
            <Icon name="compare_arrows" className="text-primary" size={14} />
            <span className="text-[10px] font-medium text-on-surface whitespace-nowrap">Compare</span>
          </button>
          <button onClick={() => navigate('/budget')} className="flex items-center gap-1.5 bg-surface-container px-3 py-2 rounded-lg flex-shrink-0 active:scale-95 transition-transform">
            <Icon name="account_balance_wallet" className="text-primary" size={14} />
            <span className="text-[10px] font-medium text-on-surface whitespace-nowrap">Budget</span>
          </button>
          <button onClick={() => navigate('/rotation')} className="flex items-center gap-1.5 bg-surface-container px-3 py-2 rounded-lg flex-shrink-0 active:scale-95 transition-transform">
            <Icon name="autorenew" className="text-primary" size={14} />
            <span className="text-[10px] font-medium text-on-surface whitespace-nowrap">Rotation</span>
          </button>
          <button onClick={() => navigate('/combos')} className="flex items-center gap-1.5 bg-surface-container px-3 py-2 rounded-lg flex-shrink-0 active:scale-95 transition-transform">
            <Icon name="layers" className="text-primary" size={14} />
            <span className="text-[10px] font-medium text-on-surface whitespace-nowrap">Combos</span>
          </button>
          <button onClick={() => navigate('/lists')} className="flex items-center gap-1.5 bg-surface-container px-3 py-2 rounded-lg flex-shrink-0 active:scale-95 transition-transform">
            <Icon name="bookmarks" className="text-primary" size={14} />
            <span className="text-[10px] font-medium text-on-surface whitespace-nowrap">Lists</span>
          </button>
        </div>
      </section>

      {/* Status Tabs */}
      <nav className="sticky top-16 z-[var(--z-sticky)] -mx-6 bg-background/95 backdrop-blur-sm py-4 mb-2 overflow-x-auto no-scrollbar">
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

      {/* Sort + Filter Control */}
      <div className="mb-6 flex items-center justify-between relative">
        <button
          onClick={() => setSortMenuOpen(!sortMenuOpen)}
          className="flex items-center gap-1.5 font-label text-[10px] tracking-[0.15em] text-secondary/60 uppercase active:opacity-70 transition-opacity"
        >
          Sorted by: <span className="text-primary font-bold">{SORT_OPTIONS.find((o) => o.value === sortBy)?.label}</span>
          <Icon name="expand_more" size={16} className="text-primary" />
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            className="p-1.5 rounded-lg bg-surface-container active:scale-90 transition-transform"
            aria-label={`Switch to ${viewMode === 'grid' ? 'list' : 'grid'} view`}
          >
            <Icon name={viewMode === 'grid' ? 'view_list' : 'grid_view'} size={16} className="text-secondary" />
          </button>
          <button
            onClick={() => setFilterOpen(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold tracking-widest uppercase transition-all active:scale-95 ${activeFilterCount > 0 ? 'bg-primary text-on-primary-container' : 'bg-surface-container text-secondary'}`}
          >
            <Icon name="tune" size={14} />
            FILTER{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </button>
        </div>
        {sortMenuOpen && (
          <>
            <div className="fixed inset-0 z-[var(--z-sticky)]" onClick={() => setSortMenuOpen(false)} />
            <div className="absolute top-8 left-0 z-[var(--z-dropdown)] bg-surface-container-highest rounded-xl py-2 min-w-[180px] shadow-xl border border-outline-variant/10">
              {SORT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => { setSortBy(option.value); setSortMenuOpen(false) }}
                  className={`w-full text-left px-4 py-2.5 text-xs font-medium transition-colors ${
                    sortBy === option.value
                      ? 'text-primary bg-primary/10'
                      : 'text-on-surface hover:bg-surface-container'
                  }`}
                >
                  {option.label}
                  {sortBy === option.value && (
                    <Icon name="check" className="float-right text-primary text-sm" />
                  )}
                </button>
              ))}
            </div>
          </>
        )}
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
          <h3 className="font-headline text-xl text-on-surface mb-2 text-center">Start your collection</h3>
          <p className="text-sm text-secondary/60 text-center mb-8 max-w-[280px]">
            Browse 2,700+ fragrances, mark what you own, and track what you want to try next.
          </p>
          <button
            onClick={() => navigate('/explore')}
            className="gold-gradient text-on-primary-container px-8 py-3 rounded-xl font-label text-[10px] font-bold uppercase tracking-widest active:scale-95 transition-all shadow-lg"
          >
            EXPLORE FRAGRANCES
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center mb-5">
            <Icon name={search ? 'search_off' : 'filter_list'} className="text-3xl text-primary/40" />
          </div>
          <h4 className="font-headline text-xl text-on-surface mb-2">
            {search ? 'No matches' : 'Nothing here yet'}
          </h4>
          <p className="text-sm text-secondary/60 text-center max-w-[260px]">
            {search
              ? `No fragrances matching "${search}". Try a different search term.`
              : `You don't have any fragrances marked as ${activeTab.toLowerCase()}. Tap + to add one.`}
          </p>
        </div>
      ) : (
        <>
        {viewMode === 'grid' ? (
        <section className="grid grid-cols-2 gap-x-4 gap-y-8 mb-16">
          {filtered.map((item) => {
            const isSelected = selected.has(item.id)
            return (
            <div
              key={item.id}
              className={`flex flex-col group cursor-pointer ${isSelected ? 'ring-2 ring-primary rounded-xl' : ''}`}
              role="link"
              tabIndex={0}
              onClick={() => {
                if (selectMode) toggleSelect(item.id)
                else navigate(`/fragrance/${item.fragrance.id}`)
              }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (selectMode) toggleSelect(item.id); else navigate(`/fragrance/${item.fragrance.id}`) } }}
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
                {selectMode && (
                  <div className={`absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center transition-all ${isSelected ? 'bg-primary' : 'bg-black/40 ring-2 ring-white/40'}`}>
                    {isSelected && <Icon name="check" className="text-on-primary" size={14} />}
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
            )
          })}
        </section>
        ) : (
        <section className="space-y-2 mb-16">
          {filtered.map((item) => {
            const isSelected = selected.has(item.id)
            return (
              <div
                key={item.id}
                className={`flex items-center gap-4 bg-surface-container rounded-xl p-3 cursor-pointer active:scale-[0.98] transition-transform ${isSelected ? 'ring-2 ring-primary' : ''}`}
                role="link"
                tabIndex={0}
                onClick={() => {
                  if (selectMode) toggleSelect(item.id)
                  else navigate(`/fragrance/${item.fragrance.id}`)
                }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (selectMode) toggleSelect(item.id); else navigate(`/fragrance/${item.fragrance.id}`) } }}
              >
                {selectMode && (
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-primary' : 'bg-surface-container-low ring-2 ring-outline-variant/30'}`}>
                    {isSelected && <Icon name="check" className="text-on-primary" size={14} />}
                  </div>
                )}
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-surface-container-low flex-shrink-0">
                  {item.fragrance.image_url ? (
                    <img src={item.fragrance.image_url} alt={item.fragrance.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Icon name="water_drop" className="text-secondary/20" size={20} />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] uppercase tracking-[0.1em] text-secondary/50">{item.fragrance.brand}</p>
                  <p className="text-sm text-on-surface font-medium truncate">{item.fragrance.name}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[8px] uppercase tracking-widest px-2 py-0.5 rounded"
                    style={{
                      background: item.status === 'wishlist' ? 'rgba(229, 194, 118, 0.2)' : 'rgba(25, 18, 16, 0.6)',
                      color: '#e5c276',
                    }}
                  >
                    {STATUS_MAP[item.status] || item.status.toUpperCase()}
                  </span>
                  {(item.personal_rating || item.fragrance.rating) && (
                    <div className="flex items-center gap-0.5">
                      <Icon name="star" filled className="text-primary" size={10} />
                      <span className="text-[10px] text-primary font-semibold">
                        {(item.personal_rating || Number(item.fragrance.rating))?.toFixed(1)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </section>
        )}

        {/* Batch Action Bar */}
        {selectMode && selected.size > 0 && (
          <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[var(--z-fab)] bg-surface-container-highest rounded-2xl px-4 py-3 flex items-center gap-2 shadow-xl animate-slide-up">
            <button onClick={selectAll} className="text-[9px] uppercase tracking-widest text-primary font-bold px-2 py-1.5 rounded-lg active:scale-95">ALL</button>
            <div className="w-px h-6 bg-outline-variant/30" />
            <button onClick={() => handleBatchStatus('own')} disabled={batchProcessing} className="flex items-center gap-1 px-3 py-2 rounded-xl bg-primary/10 text-primary text-[10px] font-bold active:scale-95 disabled:opacity-50">
              <Icon name="inventory_2" size={14} /> OWN
            </button>
            <button onClick={() => handleBatchStatus('wishlist')} disabled={batchProcessing} className="flex items-center gap-1 px-3 py-2 rounded-xl bg-primary/10 text-primary text-[10px] font-bold active:scale-95 disabled:opacity-50">
              <Icon name="favorite" size={14} /> WISH
            </button>
            <button onClick={handleBatchDelete} disabled={batchProcessing} className="flex items-center gap-1 px-3 py-2 rounded-xl bg-error/10 text-error text-[10px] font-bold active:scale-95 disabled:opacity-50">
              <Icon name="delete" size={14} /> DEL
            </button>
          </div>
        )}
        </>
      )}
      {/* FAB — Add Fragrance */}
      {user && (
        <button
          onClick={() => setQuickAddOpen(true)}
          className="fixed bottom-24 right-6 z-[var(--z-fab)] w-14 h-14 rounded-full gold-gradient shadow-xl flex items-center justify-center active:scale-90 transition-all ambient-glow"
          aria-label="Add fragrance"
        >
          <Icon name="add" className="text-on-primary text-2xl" />
        </button>
      )}

      {/* Quick-Add Overlay */}
      {quickAddOpen && (
        <div ref={quickAddTrapRef} className="fixed inset-0 z-[var(--z-sheet)] flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="Add fragrance">
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
      {/* Filter Sheet */}
      {filterOpen && (
        <FilterSheet
          isOpen={filterOpen}
          onClose={() => setFilterOpen(false)}
          filters={filters}
          onApply={(f) => { setFilters(f); setFilterOpen(false) }}
          brands={allBrands}
          concentrations={allConcentrations}
          families={allFamilies}
        />
      )}
    </main>
    </PullToRefresh>
  )
}

function FilterSheet({ isOpen, onClose, filters, onApply, brands, concentrations, families }: {
  isOpen: boolean; onClose: () => void; filters: Filters; onApply: (f: Filters) => void
  brands: string[]; concentrations: string[]; families: string[]
}) {
  const [draft, setDraft] = useState<Filters>({ ...filters })
  const trapRef = useFocusTrap(isOpen, onClose)

  const toggleArray = (arr: string[], val: string) =>
    arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val]

  const clearAll = () => setDraft({ brands: [], concentrations: [], noteFamilies: [], minRating: 0, seasons: [] })

  return (
    <div ref={trapRef} className="fixed inset-0 z-[var(--z-sheet)] flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="Filter collection">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <section className="relative w-full max-h-[80vh] bg-surface-container-low rounded-t-[2.5rem] sheet-shadow flex flex-col overflow-hidden animate-slide-up">
        <div className="flex justify-center py-4"><div className="w-12 h-1 bg-surface-container-highest rounded-full" /></div>
        <header className="px-8 pb-4 flex justify-between items-center">
          <h2 className="text-2xl font-headline font-bold text-on-surface">Filters</h2>
          <div className="flex gap-2">
            <button onClick={clearAll} className="text-[10px] text-primary font-bold uppercase tracking-widest px-3 py-1.5 rounded-full bg-primary/10 active:scale-95 transition-all">CLEAR</button>
            <button onClick={onClose} className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center active:scale-90 transition-transform">
              <Icon name="close" size={20} />
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto px-8 pb-8 space-y-6">
          {/* Min Rating */}
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold mb-3">MINIMUM RATING</p>
            <div className="flex gap-2">
              {[0, 3, 3.5, 4, 4.5].map((r) => (
                <button
                  key={r}
                  onClick={() => setDraft({ ...draft, minRating: r })}
                  className={`flex items-center gap-1 px-3 py-2 rounded-full text-xs font-medium transition-all ${draft.minRating === r ? 'bg-primary text-on-primary-container' : 'bg-surface-container text-on-surface'}`}
                >
                  {r === 0 ? 'Any' : <><Icon name="star" filled className="text-[10px]" /> {r}+</>}
                </button>
              ))}
            </div>
          </div>

          {/* Brands */}
          {brands.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold mb-3">BRAND</p>
              <div className="flex flex-wrap gap-2 max-h-[120px] overflow-y-auto">
                {brands.map((b) => (
                  <button
                    key={b}
                    onClick={() => setDraft({ ...draft, brands: toggleArray(draft.brands, b) })}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-all ${draft.brands.includes(b) ? 'bg-primary text-on-primary-container' : 'bg-surface-container text-on-surface'}`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Concentration */}
          {concentrations.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold mb-3">CONCENTRATION</p>
              <div className="flex flex-wrap gap-2">
                {concentrations.map((c) => (
                  <button
                    key={c}
                    onClick={() => setDraft({ ...draft, concentrations: toggleArray(draft.concentrations, c) })}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-all ${draft.concentrations.includes(c) ? 'bg-primary text-on-primary-container' : 'bg-surface-container text-on-surface'}`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Note Family */}
          {families.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold mb-3">NOTE FAMILY</p>
              <div className="flex flex-wrap gap-2">
                {families.map((f) => (
                  <button
                    key={f}
                    onClick={() => setDraft({ ...draft, noteFamilies: toggleArray(draft.noteFamilies, f) })}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-all ${draft.noteFamilies.includes(f) ? 'bg-primary text-on-primary-container' : 'bg-surface-container text-on-surface'}`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Season */}
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold mb-3">BEST SEASON</p>
            <div className="flex gap-2">
              {['SPRING', 'SUMMER', 'FALL', 'WINTER'].map((s) => (
                <button
                  key={s}
                  onClick={() => setDraft({ ...draft, seasons: toggleArray(draft.seasons, s) })}
                  className={`flex-1 py-2 rounded-xl text-[10px] font-bold tracking-widest uppercase transition-all ${draft.seasons.includes(s) ? 'bg-primary text-on-primary-container' : 'bg-surface-container text-on-surface'}`}
                >
                  {s.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Apply */}
        <div className="px-8 py-4 border-t border-outline-variant/10">
          <button
            onClick={() => onApply(draft)}
            className="w-full py-4 gold-gradient text-on-primary font-bold uppercase tracking-[0.15em] rounded-2xl ambient-glow active:scale-[0.98] transition-all"
          >
            APPLY FILTERS
          </button>
        </div>
      </section>
    </div>
  )
}
