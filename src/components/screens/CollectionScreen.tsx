import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { FragranceImage } from '../ui/FragranceImage'
import { InlineError } from '../ui/InlineError'
import { useUserCollection } from '@/hooks/useFragrances'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { awardXP } from '@/lib/xp'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { useToast } from '@/contexts/ToastContext'
import { PullToRefresh } from '../ui/PullToRefresh'
import { RecommendationCarousel } from '../ui/RecommendationCarousel'
import { useAllUserTags, useFragrancesByTag } from '@/hooks/useUserTags'
import type { Fragrance } from '@/types/database'

// ── Noir helpers (shared voice with HomeScreen) ──
const WORDS_20 = [
  'none', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen', 'twenty',
]
function numberToWord(n: number): string {
  if (n < 0) return String(n)
  if (n <= 20) return WORDS_20[n]
  return String(n)
}
function capitalise(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

// ── Catalogue raisonné types ──
const STATUS_TABS = ['ALL', 'OWN', 'WISHLIST', 'SAMPLED', 'SOLD'] as const
type StatusFilter = (typeof STATUS_TABS)[number]

// Roman index + italic serif label for each tab
const TAB_ROMAN: Record<StatusFilter, string> = {
  ALL: 'i',
  OWN: 'ii',
  WISHLIST: 'iii',
  SAMPLED: 'iv',
  SOLD: 'v',
}
const TAB_LABEL: Record<StatusFilter, string> = {
  ALL: 'everything',
  OWN: 'owned',
  WISHLIST: 'in waiting',
  SAMPLED: 'sampled',
  SOLD: 'released',
}

const SORT_OPTIONS = [
  { value: 'recent', label: 'recently added' },
  { value: 'name-asc', label: 'by name, a to z' },
  { value: 'name-desc', label: 'by name, z to a' },
  { value: 'brand-asc', label: 'by house, a to z' },
  { value: 'rating-desc', label: 'most appreciated' },
  { value: 'price-asc', label: 'ascending price' },
  { value: 'price-desc', label: 'descending price' },
] as const
type SortOption = (typeof SORT_OPTIONS)[number]['value']

const GROUP_OPTIONS = [
  { value: 'none', label: 'no grouping' },
  { value: 'brand', label: 'by house' },
  { value: 'family', label: 'by note family' },
  { value: 'concentration', label: 'by concentration' },
  { value: 'season', label: 'by season' },
] as const
type GroupOption = (typeof GROUP_OPTIONS)[number]['value']

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

// Noir style constants
const hairline = {
  height: '1px',
  background:
    'linear-gradient(to right, rgba(229,194,118,0.4) 0%, rgba(229,194,118,0.1) 40%, transparent 100%)',
  width: '100%',
} as const

const hairlineFull = {
  height: '1px',
  background:
    'linear-gradient(to right, transparent, rgba(229,194,118,0.4) 20%, rgba(229,194,118,0.4) 80%, transparent)',
  width: '100%',
} as const

const verticalHairline = {
  width: '1px',
  height: '1rem',
  background:
    'linear-gradient(to bottom, transparent, rgba(229,194,118,0.5), transparent)',
} as const

const ambientGlow = (top: string, left: string) => ({
  position: 'absolute' as const,
  top,
  left,
  width: '300px',
  height: '300px',
  borderRadius: '50%',
  background:
    'radial-gradient(circle, rgba(229,194,118,0.07) 0%, transparent 70%)',
  filter: 'blur(80px)',
  pointerEvents: 'none' as const,
})

export function CollectionScreen() {
  const [activeTab, setActiveTab] = useState<StatusFilter>('ALL')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('recent')
  const [sortMenuOpen, setSortMenuOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'compact'>('grid')
  const [groupBy, setGroupBy] = useState<GroupOption>('none')
  const [groupMenuOpen, setGroupMenuOpen] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [filters, setFilters] = useState<Filters>({ brands: [], concentrations: [], noteFamilies: [], minRating: 0, seasons: [] })
  const navigate = useNavigate()

  const { user } = useAuth()
  const userId = user?.id
  const { data: collection, loading, error, retry } = useUserCollection(userId)
  const toast = useToast()
  const { tags: allUserTags } = useAllUserTags()
  const [filterTag, setFilterTag] = useState<string | null>(null)
  const { fragranceIds: tagFilterIds } = useFragrancesByTag(filterTag)

  // Batch selection
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
      toast.showToast('Could not release the bottles.', 'error')
    } else {
      toast.showToast(`${capitalise(numberToWord(ids.length))} ${ids.length === 1 ? 'bottle' : 'bottles'} released.`, 'success')
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
      toast.showToast('Could not refile the bottles.', 'error')
    } else {
      toast.showToast(`${capitalise(numberToWord(ids.length))} ${ids.length === 1 ? 'bottle' : 'bottles'} refiled.`, 'success')
      retry()
    }
    setBatchProcessing(false)
    clearSelection()
  }

  // Quick-add overlay
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [addQuery, setAddQuery] = useState('')
  const [addResults, setAddResults] = useState<Fragrance[]>([])
  const [addSearching, setAddSearching] = useState(false)
  const [addingSaving, setAddingSaving] = useState<string | null>(null)
  const addTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const quickAddTrapRef = useFocusTrap(quickAddOpen, () => { setQuickAddOpen(false); setAddQuery(''); setAddResults([]) })
  const addStatus = activeTab === 'ALL' || activeTab === 'SOLD' ? 'own' : activeTab.toLowerCase()

  useEffect(() => {
    if (addQuery.length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
    const { data: existing } = await supabase
      .from('user_collections')
      .select('id')
      .eq('user_id', user.id)
      .eq('fragrance_id', frag.id)
      .maybeSingle()
    if (existing) {
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
    retry()
  }

  const activeFilterCount =
    (filters.brands.length > 0 ? 1 : 0) +
    (filters.concentrations.length > 0 ? 1 : 0) +
    (filters.noteFamilies.length > 0 ? 1 : 0) +
    (filters.minRating > 0 ? 1 : 0) +
    (filters.seasons.length > 0 ? 1 : 0)

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
      if (filterTag && tagFilterIds.length > 0 && !tagFilterIds.includes(item.fragrance.id)) return false
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

  const selectAll = () => setSelected(new Set(filtered.map((f) => f.id)))

  const statusCounts = collection.reduce(
    (acc, item) => {
      const key = STATUS_MAP[item.status] || item.status.toUpperCase()
      acc[key] = (acc[key] || 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )

  // Group items
  const groupedItems = useMemo(() => {
    if (groupBy === 'none') return null
    const groups: Record<string, typeof filtered> = {}
    for (const item of filtered) {
      let key: string
      switch (groupBy) {
        case 'brand':
          key = item.fragrance.brand
          break
        case 'family':
          key = item.fragrance.note_family || 'Unclassified'
          break
        case 'concentration':
          key = item.fragrance.concentration || 'Unclassified'
          break
        case 'season': {
          const sr = item.fragrance.season_ranking
          if (sr && sr.length > 0) {
            const best = sr.reduce((a, b) => (b.score > a.score ? b : a))
            key = best.name
          } else {
            key = 'Unclassified'
          }
          break
        }
        default:
          key = 'Other'
      }
      if (!groups[key]) groups[key] = []
      groups[key].push(item)
    }
    return Object.entries(groups).sort((a, b) => {
      if (a[0] === 'Unclassified') return 1
      if (b[0] === 'Unclassified') return -1
      return a[0].localeCompare(b[0])
    })
  }, [filtered, groupBy])

  const toggleGroupCollapse = (groupName: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupName)) next.delete(groupName)
      else next.add(groupName)
      return next
    })
  }

  // Collection summary prose for Frontispiece
  const wishCount = statusCounts['WISHLIST'] || 0
  const sampledCount = statusCounts['SAMPLED'] || 0

  // Colophon derived stats
  const uniqueHouses = new Set(collection.map((c) => c.fragrance.brand)).size
  const uniqueFamilies = new Set(
    collection.map((c) => c.fragrance.note_family).filter(Boolean),
  ).size
  const lastEntry = collection.length > 0
    ? [...collection].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
    : null

  const dateProse = (iso?: string) => {
    if (!iso) return ''
    const d = new Date(iso)
    const day = d.getDate()
    const ordinal = (n: number) => {
      if (n % 100 >= 11 && n % 100 <= 13) return `${n}th`
      switch (n % 10) {
        case 1: return `${n}st`
        case 2: return `${n}nd`
        case 3: return `${n}rd`
        default: return `${n}th`
      }
    }
    const month = d.toLocaleString('en-GB', { month: 'long' })
    return `the ${ordinal(day)} of ${month}`
  }

  // Shared renderer for all three view modes
  const renderItemList = (items: typeof filtered) => {
    if (viewMode === 'grid') {
      return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 md:gap-6">
          {items.map((item) => {
            const isSelected = selected.has(item.id)
            return (
              <div
                key={item.id}
                className={`group cursor-pointer ${isSelected ? 'ring-1 ring-primary/60' : ''}`}
                role="link"
                tabIndex={0}
                onClick={() => {
                  if (selectMode) toggleSelect(item.id)
                  else navigate(`/fragrance/${item.fragrance.id}`)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    if (selectMode) toggleSelect(item.id)
                    else navigate(`/fragrance/${item.fragrance.id}`)
                  }
                }}
              >
                <div className="relative aspect-[3/4] rounded-sm overflow-hidden bg-surface-container-low mb-4">
                  <FragranceImage
                    src={item.fragrance.image_url}
                    alt={item.fragrance.name}
                    noteFamily={item.fragrance.note_family}
                    size="md"
                    className="w-full h-full object-cover transition-all duration-700"
                  />
                  {selectMode && (
                    <div className={`absolute top-3 left-3 w-5 h-5 rounded-full flex items-center justify-center transition-all ${isSelected ? 'bg-primary' : 'bg-black/50 ring-1 ring-primary/40'}`}>
                      {isSelected && <span className="text-on-primary">✓</span>}
                    </div>
                  )}
                </div>
                <p className="font-label text-primary/70 text-[0.6rem] tracking-[0.15em] uppercase mb-1">
                  {item.fragrance.brand}
                </p>
                <h3 className="font-headline italic text-lg text-on-background leading-tight truncate">
                  {item.fragrance.name}
                </h3>
              </div>
            )
          })}
        </div>
      )
    }

    if (viewMode === 'compact') {
      return (
        <ul className="divide-y divide-transparent">
          {items.map((item, idx) => {
            const isSelected = selected.has(item.id)
            return (
              <li
                key={item.id}
                className={`relative ${idx > 0 ? 'pt-4' : ''} pb-4 cursor-pointer group`}
                role="link"
                tabIndex={0}
                onClick={() => {
                  if (selectMode) toggleSelect(item.id)
                  else navigate(`/fragrance/${item.fragrance.id}`)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    if (selectMode) toggleSelect(item.id)
                    else navigate(`/fragrance/${item.fragrance.id}`)
                  }
                }}
              >
                {idx > 0 && <div className="absolute top-0 left-0 right-0" style={hairline} />}
                <div className="flex items-baseline justify-between gap-6">
                  <div className="flex items-baseline gap-4 min-w-0">
                    <span className="font-label text-primary/50 text-[0.55rem] tracking-[0.2em] uppercase w-12 flex-shrink-0">
                      {isSelected ? '●' : String(idx + 1).padStart(2, '0')}
                    </span>
                    <p className="font-headline italic text-base text-on-background truncate">
                      {item.fragrance.name}
                    </p>
                  </div>
                  <p className="font-label text-secondary/50 text-[0.6rem] tracking-[0.15em] uppercase flex-shrink-0">
                    {item.fragrance.brand}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      )
    }

    // Ledger (list) view — two-column editorial rows
    return (
      <div>
        {items.map((item, idx) => {
          const isSelected = selected.has(item.id)
          return (
            <div
              key={item.id}
              className={`relative cursor-pointer group grid grid-cols-[96px_1fr] md:grid-cols-[140px_1fr] gap-6 md:gap-10 py-6 ${isSelected ? 'opacity-70' : ''}`}
              role="link"
              tabIndex={0}
              onClick={() => {
                if (selectMode) toggleSelect(item.id)
                else navigate(`/fragrance/${item.fragrance.id}`)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  if (selectMode) toggleSelect(item.id)
                  else navigate(`/fragrance/${item.fragrance.id}`)
                }
              }}
            >
              {idx > 0 && <div className="absolute top-0 left-0 right-0" style={hairline} />}
              <div className="aspect-[3/4] rounded-sm overflow-hidden bg-surface-container-low">
                <FragranceImage
                  src={item.fragrance.image_url}
                  alt={item.fragrance.name}
                  noteFamily={item.fragrance.note_family}
                  size="sm"
                  className="w-full h-full object-cover transition-all duration-700"
                />
              </div>
              <div className="min-w-0 flex flex-col justify-center">
                <p className="font-label text-primary/70 text-[0.6rem] tracking-[0.2em] uppercase mb-2">
                  {item.fragrance.brand}
                </p>
                <h3 className="font-headline italic text-2xl md:text-3xl text-on-background leading-tight mb-2 truncate">
                  {item.fragrance.name}
                </h3>
                {item.fragrance.note_family && (
                  <p className="font-headline italic text-sm text-secondary/60">
                    filed under {item.fragrance.note_family.toLowerCase()}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <PullToRefresh onRefresh={async () => { retry() }}>
    <main className="relative pt-16 pb-32 px-6 md:px-12 max-w-7xl mx-auto min-h-screen">
      {/* Ambient gold lifts */}
      <div aria-hidden style={ambientGlow('4rem', '-4rem')} />
      <div aria-hidden style={ambientGlow('40rem', 'calc(100% - 10rem)')} />
      <div aria-hidden style={ambientGlow('80rem', '-6rem')} />

      {/* I. THE FRONTISPIECE */}
      <header className="relative mb-16">
        <p className="font-label text-primary/60 text-[0.65rem] tracking-[0.3em] uppercase mb-4">
          THE CELLAR · A PRIVATE ARCHIVE
        </p>
        <h1 className="font-headline italic text-5xl md:text-6xl font-light tracking-tight leading-[1.05] text-on-background mb-6">
          The keeper&rsquo;s shelves.
        </h1>
        {collection.length > 0 ? (
          <p className="font-headline italic text-base md:text-lg text-secondary/70 max-w-2xl">
            <span className="italic">{capitalise(numberToWord(collection.length))}</span>{' '}
            {collection.length === 1 ? 'bottle' : 'bottles'} catalogued,{' '}
            <span className="italic">{numberToWord(wishCount)}</span> in waiting,{' '}
            <span className="italic">{numberToWord(sampledCount)}</span> sampled and filed.
          </p>
        ) : (
          <p className="font-headline italic text-base md:text-lg text-secondary/70 max-w-2xl">
            The shelves are empty. A keeper&rsquo;s archive begins with a single bottle.
          </p>
        )}
        <div className="mt-10" style={hairline} />
        {/* SELECT toggle — understated */}
        {collection.length > 0 && (
          <button
            onClick={() => { if (selectMode) clearSelection(); else setSelectMode(true) }}
            className="absolute top-0 right-0 font-headline italic text-sm text-primary/70 hover:text-primary transition-colors"
          >
            {selectMode ? 'cancel' : 'select'}
          </button>
        )}
      </header>

      {/* II. THE INDEX */}
      <nav className="mb-14" aria-label="Status index">
        <ul className="flex flex-wrap gap-x-12 gap-y-6 items-baseline">
          {STATUS_TABS.map((tab) => {
            const isActive = activeTab === tab
            const count = tab === 'ALL' ? collection.length : statusCounts[tab] || 0
            return (
              <li key={tab} className="relative">
                <button
                  onClick={() => setActiveTab(tab)}
                  className={`font-headline italic text-2xl transition-colors ${
                    isActive ? 'text-primary' : 'text-secondary/40 hover:text-on-background'
                  }`}
                >
                  {TAB_ROMAN[tab]}. {TAB_LABEL[tab]}
                  {tab !== 'ALL' && count > 0 && (
                    <span className="ml-2 font-label text-[0.6rem] not-italic tracking-[0.2em] text-secondary/40 align-top">
                      {count}
                    </span>
                  )}
                </button>
                {isActive && (
                  <div
                    className="absolute left-1/4 right-1/4 -bottom-2 h-px"
                    style={{ background: '#e5c276' }}
                  />
                )}
              </li>
            )
          })}
        </ul>
      </nav>

      {/* III. THE SEARCH */}
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
              aria-label="Search the shelves"
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

      {/* Tag filter row — understated italic chips when tags exist */}
      {allUserTags.length > 0 && (
        <div className="mb-10 flex flex-wrap items-baseline gap-x-5 gap-y-2">
          <span className="font-label text-primary/50 text-[0.6rem] tracking-[0.2em] uppercase">
            tagged
          </span>
          {filterTag && (
            <button
              onClick={() => setFilterTag(null)}
              className="font-headline italic text-sm text-primary hover:text-primary/80 transition-colors"
            >
              clear tag
            </button>
          )}
          {allUserTags.slice(0, 12).map((tag) => {
            const active = filterTag === tag
            return (
              <button
                key={tag}
                onClick={() => setFilterTag(active ? null : tag)}
                className={`font-headline italic text-sm transition-colors ${
                  active ? 'text-primary' : 'text-secondary/50 hover:text-on-background'
                }`}
              >
                {tag}
              </button>
            )
          })}
        </div>
      )}

      {/* IV. THE PROVENANCE */}
      <section className="mb-10 relative">
        <p className="font-headline text-base md:text-lg text-on-background/70">
          Arranged by{' '}
          <button
            onClick={() => { setSortMenuOpen(!sortMenuOpen); setGroupMenuOpen(false) }}
            className="italic text-on-background hover:text-primary transition-colors relative"
          >
            {SORT_OPTIONS.find((o) => o.value === sortBy)?.label}
            <span
              className="absolute left-1/4 right-1/4 -bottom-0.5 h-px"
              style={{ background: '#e5c276' }}
            />
          </button>
          {', grouped by '}
          <button
            onClick={() => { setGroupMenuOpen(!groupMenuOpen); setSortMenuOpen(false) }}
            className="italic text-on-background hover:text-primary transition-colors relative"
          >
            {GROUP_OPTIONS.find((o) => o.value === groupBy)?.label}
            <span
              className="absolute left-1/4 right-1/4 -bottom-0.5 h-px"
              style={{ background: '#e5c276' }}
            />
          </button>
          .
        </p>

        {sortMenuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setSortMenuOpen(false)} />
            <ul className="absolute left-0 top-10 z-20 bg-surface-container-low/95 backdrop-blur-sm rounded-sm py-4 px-6 space-y-2 min-w-[16rem]">
              {SORT_OPTIONS.map((option) => (
                <li key={option.value}>
                  <button
                    onClick={() => { setSortBy(option.value); setSortMenuOpen(false) }}
                    className={`font-headline italic text-base transition-colors ${
                      sortBy === option.value ? 'text-primary' : 'text-secondary/60 hover:text-on-background'
                    }`}
                  >
                    {option.label}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {groupMenuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setGroupMenuOpen(false)} />
            <ul className="absolute left-0 top-10 z-20 bg-surface-container-low/95 backdrop-blur-sm rounded-sm py-4 px-6 space-y-2 min-w-[16rem]">
              {GROUP_OPTIONS.map((option) => (
                <li key={option.value}>
                  <button
                    onClick={() => { setGroupBy(option.value); setGroupMenuOpen(false); setCollapsedGroups(new Set()) }}
                    className={`font-headline italic text-base transition-colors ${
                      groupBy === option.value ? 'text-primary' : 'text-secondary/60 hover:text-on-background'
                    }`}
                  >
                    {option.label}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* V. THE READING ROOM + VI. THE FILTERS */}
      <section className="mb-16 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-5">
          {(['grid', 'list', 'compact'] as const).map((mode, i) => (
            <span key={mode} className="flex items-center gap-5">
              {i > 0 && <span aria-hidden style={verticalHairline} />}
              <button
                onClick={() => setViewMode(mode)}
                className={`font-headline italic text-base transition-colors ${
                  viewMode === mode ? 'text-primary' : 'text-secondary/40 hover:text-on-background'
                }`}
              >
                {mode === 'grid' ? 'portraits' : mode === 'list' ? 'ledger' : 'compact'}
              </button>
            </span>
          ))}
        </div>
        <button
          onClick={() => setFilterOpen(true)}
          className="font-headline text-sm md:text-base text-on-background/70 text-left hover:text-primary transition-colors"
        >
          Refine by{' '}
          <span className="italic relative">
            house
            <span
              className="absolute left-1/4 right-1/4 -bottom-0.5 h-px"
              style={{ background: '#e5c276' }}
            />
          </span>
          ,{' '}
          <span className="italic relative">
            family
            <span
              className="absolute left-1/4 right-1/4 -bottom-0.5 h-px"
              style={{ background: '#e5c276' }}
            />
          </span>
          ,{' '}
          <span className="italic relative">
            season
            <span
              className="absolute left-1/4 right-1/4 -bottom-0.5 h-px"
              style={{ background: '#e5c276' }}
            />
          </span>
          ,{' '}
          <span className="italic relative">
            appreciation
            <span
              className="absolute left-1/4 right-1/4 -bottom-0.5 h-px"
              style={{ background: '#e5c276' }}
            />
          </span>
          .
          {activeFilterCount > 0 && (
            <span className="ml-3 font-label not-italic text-[0.6rem] tracking-[0.2em] uppercase text-primary">
              ({numberToWord(activeFilterCount)} active)
            </span>
          )}
        </button>
      </section>

      <div className="mb-16" style={hairline} />

      {/* VII. THE SHELVES */}
      {error ? (
        <InlineError message="The archive could not be retrieved." onRetry={retry} />
      ) : loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 md:gap-6 mb-16">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i}>
              <div className="aspect-[3/4] rounded-sm bg-surface-container-low animate-pulse mb-4" />
              <div className="h-2 w-20 bg-surface-container-low rounded animate-pulse mb-2" />
              <div className="h-4 w-32 bg-surface-container-low rounded animate-pulse" />
            </div>
          ))}
        </div>
      ) : collection.length === 0 ? (
        /* VIII. THE EMPTY SHELVES — no collection at all */
        <section className="max-w-2xl mb-20">
          <p className="font-headline italic text-xl md:text-2xl text-secondary/70 leading-relaxed mb-8">
            Nothing has been filed yet. You may begin the archive whenever you wish.
          </p>
          <button
            onClick={() => navigate('/explore')}
            className="inline-block px-8 py-3 rounded-sm font-label text-[0.7rem] font-bold tracking-[0.2em] uppercase text-on-primary-container"
            style={{
              background: 'linear-gradient(45deg, #e5c276 0%, #c4a35a 100%)',
            }}
          >
            FILE YOUR FIRST ENTRY
          </button>
        </section>
      ) : filtered.length === 0 ? (
        /* VIII. THE EMPTY SHELVES — filter returned nothing */
        <section className="max-w-2xl mb-20">
          <p className="font-headline italic text-xl md:text-2xl text-secondary/70 leading-relaxed mb-8">
            {search
              ? <>Nothing has been filed under <span className="italic text-on-background">&ldquo;{search}&rdquo;</span> yet.</>
              : <>Nothing has been filed under <span className="italic text-on-background">{TAB_LABEL[activeTab]}</span> yet.</>}
            <br />
            You may begin the archive whenever you wish.
          </p>
          <button
            onClick={() => setQuickAddOpen(true)}
            className="inline-block px-8 py-3 rounded-sm font-label text-[0.7rem] font-bold tracking-[0.2em] uppercase text-on-primary-container"
            style={{
              background: 'linear-gradient(45deg, #e5c276 0%, #c4a35a 100%)',
            }}
          >
            FILE AN ENTRY
          </button>
        </section>
      ) : (
        <>
          {groupedItems ? (
            /* Grouped rendering — editorial departments */
            <div className="space-y-20 mb-20">
              {groupedItems.map(([groupName, items]) => {
                const isCollapsed = collapsedGroups.has(groupName)
                return (
                  <section key={groupName}>
                    <div className="flex items-baseline justify-between mb-6">
                      <h2 className="font-headline italic text-2xl md:text-3xl text-on-background">
                        {groupName}
                        <span className="ml-3 font-label not-italic text-[0.6rem] tracking-[0.2em] uppercase text-secondary/40">
                          {numberToWord(items.length)} {items.length === 1 ? 'bottle' : 'bottles'}
                        </span>
                      </h2>
                      <button
                        onClick={() => toggleGroupCollapse(groupName)}
                        className="font-headline italic text-base text-primary/70 hover:text-primary transition-colors"
                      >
                        {isCollapsed ? 'open' : 'collapse'}
                      </button>
                    </div>
                    <div className="mb-8" style={hairline} />
                    {!isCollapsed && renderItemList(items)}
                  </section>
                )
              })}
            </div>
          ) : (
            <div className="mb-20">{renderItemList(filtered)}</div>
          )}

          {/* Batch Action Bar — discreet editorial */}
          {selectMode && selected.size > 0 && (
            <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[var(--z-fab)] bg-surface-container-low/95 backdrop-blur-sm rounded-sm px-8 py-4 flex items-baseline gap-6 shadow-2xl">
              <span className="font-headline italic text-sm text-secondary/60">
                {numberToWord(selected.size)} selected
              </span>
              <button
                onClick={selectAll}
                className="font-headline italic text-sm text-primary/80 hover:text-primary transition-colors"
              >
                all
              </button>
              <span aria-hidden style={verticalHairline} />
              <button
                onClick={() => handleBatchStatus('own')}
                disabled={batchProcessing}
                className="font-headline italic text-sm text-on-background/80 hover:text-primary transition-colors disabled:opacity-40"
              >
                file as owned
              </button>
              <button
                onClick={() => handleBatchStatus('wishlist')}
                disabled={batchProcessing}
                className="font-headline italic text-sm text-on-background/80 hover:text-primary transition-colors disabled:opacity-40"
              >
                in waiting
              </button>
              <span aria-hidden style={verticalHairline} />
              <button
                onClick={handleBatchDelete}
                disabled={batchProcessing}
                className="font-headline italic text-sm text-error/80 hover:text-error transition-colors disabled:opacity-40"
              >
                release
              </button>
            </div>
          )}
        </>
      )}

      {/* IX. THE KINDRED WORKS */}
      {collection.length >= 4 && (
        <section className="mt-24 mb-24">
          <p className="font-label text-primary/60 text-[0.65rem] tracking-[0.3em] uppercase mb-4">
            KINDRED WORKS
          </p>
          <h3 className="font-headline italic text-2xl md:text-3xl text-on-background mb-2">
            You may also wish to consider&hellip;
          </h3>
          <p className="font-headline italic text-sm md:text-base text-secondary/60 mb-10">
            Titles our editors suspect you will favour.
          </p>
          <div className="mb-8" style={hairline} />
          <RecommendationCarousel />
        </section>
      )}

      {/* X. THE COLOPHON */}
      {collection.length > 0 && (
        <footer className="pt-20 pb-12">
          <div className="mb-16" style={hairlineFull} />
          <div className="text-center max-w-2xl mx-auto">
            <p className="font-headline italic text-base md:text-lg text-secondary/60 leading-relaxed">
              {capitalise(numberToWord(collection.length))}{' '}
              {collection.length === 1 ? 'bottle' : 'bottles'},{' '}
              {numberToWord(uniqueHouses)}{' '}
              {uniqueHouses === 1 ? 'house' : 'houses'},{' '}
              {numberToWord(uniqueFamilies)}{' '}
              {uniqueFamilies === 1 ? 'note family' : 'note families'}.
              {lastEntry && (
                <>
                  <br />
                  Last entry filed on{' '}
                  <span className="text-primary/70">{dateProse(lastEntry.created_at)}</span>.
                </>
              )}
            </p>
          </div>
        </footer>
      )}

      {/* Quick-Add (file an entry) overlay */}
      {quickAddOpen && (
        <div ref={quickAddTrapRef} className="fixed inset-0 z-[var(--z-sheet)] flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="File a bottle">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setQuickAddOpen(false); setAddQuery(''); setAddResults([]) }} />
          <section className="relative w-full max-h-[75vh] bg-surface-container-low rounded-t-sm flex flex-col overflow-hidden" style={{ boxShadow: '0 -20px 60px rgba(0,0,0,0.6)' }}>
            <div className="flex justify-center py-4">
              <div className="w-12 h-px bg-primary/30" />
            </div>
            <header className="px-8 pb-6">
              <p className="font-label text-primary/60 text-[0.6rem] tracking-[0.3em] uppercase mb-2">
                FILE AN ENTRY &middot; {addStatus.toUpperCase()}
              </p>
              <div className="flex items-start justify-between gap-6">
                <h2 className="font-headline italic text-3xl md:text-4xl text-on-background leading-tight">
                  A bottle to be filed.
                </h2>
                <button
                  onClick={() => { setQuickAddOpen(false); setAddQuery(''); setAddResults([]) }}
                  className="font-headline italic text-base text-secondary/60 hover:text-primary transition-colors flex-shrink-0"
                >
                  close
                </button>
              </div>
              <div className="mt-6" style={hairline} />
            </header>
            <div className="px-8 pb-4">
              <div className="relative group">
                <div className="flex items-center gap-4 py-3">
                  <span className="text-primary/60">⌕</span>
                  <input
                    className="flex-1 bg-transparent border-none focus:ring-0 focus:outline-none font-headline italic text-lg text-on-background placeholder:text-secondary/40"
                    placeholder="Request a title, a house…"
                    type="text"
                    value={addQuery}
                    onChange={(e) => setAddQuery(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="absolute bottom-0 left-0 right-0 opacity-60 group-focus-within:opacity-100 transition-opacity" style={hairline} />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-8 pb-12">
              {addSearching ? (
                <div className="py-16 text-center">
                  <p className="font-headline italic text-sm text-secondary/50">searching the catalogue&hellip;</p>
                </div>
              ) : addQuery.length >= 2 && addResults.length === 0 ? (
                <div className="py-16 text-center">
                  <p className="font-headline italic text-sm text-secondary/50">
                    No titles found under &ldquo;{addQuery}&rdquo;.
                  </p>
                </div>
              ) : (
                <ul>
                  {addResults.map((f, i) => {
                    const alreadyInCollection = collection.some((c) => c.fragrance.id === f.id)
                    return (
                      <li key={f.id} className="relative">
                        {i > 0 && <div className="absolute top-0 left-0 right-0" style={hairline} />}
                        <button
                          onClick={() => !alreadyInCollection && handleQuickAdd(f)}
                          disabled={addingSaving === f.id || alreadyInCollection}
                          className="w-full flex items-baseline gap-5 py-5 text-left disabled:opacity-40 group"
                        >
                          <div className="w-12 h-16 rounded-sm overflow-hidden flex-shrink-0 bg-surface-container">
                            {f.image_url ? (
                              <img src={f.image_url} alt={f.name} className="w-full h-full object-cover transition-all duration-700" />
                            ) : (
                              <div className="w-full h-full" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-label text-primary/70 text-[0.6rem] tracking-[0.2em] uppercase mb-1">{f.brand}</p>
                            <p className="font-headline italic text-lg text-on-background truncate">{f.name}</p>
                          </div>
                          <span className="font-headline italic text-sm text-primary/60 flex-shrink-0">
                            {alreadyInCollection ? 'already filed' : addingSaving === f.id ? 'filing…' : 'file'}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
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

      {/* FAB — File an entry */}
      {user && collection.length > 0 && (
        <button
          onClick={() => setQuickAddOpen(true)}
          className="fixed bottom-24 right-6 z-[var(--z-fab)] px-6 py-3 rounded-sm font-label text-[0.65rem] font-bold tracking-[0.2em] uppercase text-on-primary-container"
          style={{
            background: 'linear-gradient(45deg, #e5c276 0%, #c4a35a 100%)',
            boxShadow: '0 10px 40px rgba(229,194,118,0.25)',
          }}
          aria-label="File a bottle"
        >
          FILE AN ENTRY
        </button>
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

  const sectionLabel = 'font-label text-primary/60 text-[0.6rem] tracking-[0.3em] uppercase mb-4'
  const chipBase = 'font-headline italic text-sm transition-colors'
  const chipActive = 'text-primary'
  const chipIdle = 'text-secondary/50 hover:text-on-background'

  return (
    <div ref={trapRef} className="fixed inset-0 z-[var(--z-sheet)] flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="Refine the shelves">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <section className="relative w-full max-h-[85vh] bg-surface-container-low rounded-t-sm flex flex-col overflow-hidden" style={{ boxShadow: '0 -20px 60px rgba(0,0,0,0.6)' }}>
        <div className="flex justify-center py-4">
          <div className="w-12 h-px bg-primary/30" />
        </div>
        <header className="px-8 pb-6">
          <p className="font-label text-primary/60 text-[0.6rem] tracking-[0.3em] uppercase mb-2">
            REFINE THE SHELVES
          </p>
          <div className="flex items-start justify-between gap-6">
            <h2 className="font-headline italic text-3xl md:text-4xl text-on-background leading-tight">
              By house, by family, by season.
            </h2>
            <div className="flex items-baseline gap-5 flex-shrink-0">
              <button
                onClick={clearAll}
                className="font-headline italic text-base text-primary/70 hover:text-primary transition-colors"
              >
                clear
              </button>
              <button
                onClick={onClose}
                className="font-headline italic text-base text-secondary/60 hover:text-on-background transition-colors"
              >
                close
              </button>
            </div>
          </div>
          <div className="mt-6" style={{
            height: '1px',
            background:
              'linear-gradient(to right, rgba(229,194,118,0.4) 0%, rgba(229,194,118,0.1) 40%, transparent 100%)',
            width: '100%',
          }} />
        </header>

        <div className="flex-1 overflow-y-auto px-8 pb-8 space-y-10">
          <div>
            <p className={sectionLabel}>MINIMUM APPRECIATION</p>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {[0, 3, 3.5, 4, 4.5].map((r) => (
                <button
                  key={r}
                  onClick={() => setDraft({ ...draft, minRating: r })}
                  className={`${chipBase} ${draft.minRating === r ? chipActive : chipIdle}`}
                >
                  {r === 0 ? 'any' : `${r} and above`}
                </button>
              ))}
            </div>
          </div>

          {brands.length > 0 && (
            <div>
              <p className={sectionLabel}>HOUSE</p>
              <div className="flex flex-wrap gap-x-6 gap-y-2 max-h-40 overflow-y-auto pr-4">
                {brands.map((b) => (
                  <button
                    key={b}
                    onClick={() => setDraft({ ...draft, brands: toggleArray(draft.brands, b) })}
                    className={`${chipBase} ${draft.brands.includes(b) ? chipActive : chipIdle}`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>
          )}

          {concentrations.length > 0 && (
            <div>
              <p className={sectionLabel}>CONCENTRATION</p>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                {concentrations.map((c) => (
                  <button
                    key={c}
                    onClick={() => setDraft({ ...draft, concentrations: toggleArray(draft.concentrations, c) })}
                    className={`${chipBase} ${draft.concentrations.includes(c) ? chipActive : chipIdle}`}
                  >
                    {c.toLowerCase()}
                  </button>
                ))}
              </div>
            </div>
          )}

          {families.length > 0 && (
            <div>
              <p className={sectionLabel}>NOTE FAMILY</p>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                {families.map((f) => (
                  <button
                    key={f}
                    onClick={() => setDraft({ ...draft, noteFamilies: toggleArray(draft.noteFamilies, f) })}
                    className={`${chipBase} ${draft.noteFamilies.includes(f) ? chipActive : chipIdle}`}
                  >
                    {f.toLowerCase()}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className={sectionLabel}>SEASON</p>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {['SPRING', 'SUMMER', 'FALL', 'WINTER'].map((s) => (
                <button
                  key={s}
                  onClick={() => setDraft({ ...draft, seasons: toggleArray(draft.seasons, s) })}
                  className={`${chipBase} ${draft.seasons.includes(s) ? chipActive : chipIdle}`}
                >
                  {s.toLowerCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="px-8 py-6 relative">
          <div className="absolute top-0 left-0 right-0" style={{
            height: '1px',
            background:
              'linear-gradient(to right, rgba(229,194,118,0.4) 0%, rgba(229,194,118,0.1) 40%, transparent 100%)',
          }} />
          <button
            onClick={() => onApply(draft)}
            className="w-full py-4 rounded-sm font-label text-[0.7rem] font-bold tracking-[0.2em] uppercase text-on-primary-container"
            style={{
              background: 'linear-gradient(45deg, #e5c276 0%, #c4a35a 100%)',
            }}
          >
            REFINE THE SHELVES
          </button>
        </div>
      </section>
    </div>
  )
}
