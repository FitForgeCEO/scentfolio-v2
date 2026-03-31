import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../ui/Icon'
import { useUserCollection } from '@/hooks/useFragrances'
import { useAuth } from '@/contexts/AuthContext'

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
  const { data: collection, loading } = useUserCollection(userId)

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
          <button className="p-2 bg-surface-container rounded-lg text-primary active:scale-95 transition-transform">
            <Icon name="grid_view" />
          </button>
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
      {loading ? (
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
              onClick={() => navigate(`/fragrance/${item.fragrance.id}`)}
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
    </main>
  )
}
