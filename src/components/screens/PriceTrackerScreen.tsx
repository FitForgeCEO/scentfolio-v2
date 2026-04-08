import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../ui/Icon'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import type { Fragrance } from '@/types/database'

interface PriceItem {
  fragrance: Fragrance
  priceNum: number
  valueNum: number
  status: 'own' | 'wishlist' | 'sampled' | 'sold'
  personalRating: number | null
}

type SortKey = 'price_asc' | 'price_desc' | 'value_asc' | 'value_desc' | 'name'
type FilterStatus = 'all' | 'own' | 'wishlist'

export function PriceTrackerScreen() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState<PriceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey>('price_desc')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')

  useEffect(() => {
    if (!user) { setLoading(false); return }

    async function fetchPrices() {
      const { data } = await supabase
        .from('user_collections')
        .select('status, personal_rating, fragrance:fragrances(*)')
        .eq('user_id', user!.id)

      type Row = { status: string; personal_rating: number | null; fragrance: Fragrance | null }
      const rows = ((data ?? []) as unknown as Row[])
        .filter((r) => r.fragrance !== null)

      const priceItems: PriceItem[] = []
      for (const row of rows) {
        const f = row.fragrance!
        const priceNum = parsePrice(f.price)
        const valueNum = parsePrice(f.price_value)
        if (priceNum > 0 || valueNum > 0) {
          priceItems.push({
            fragrance: f,
            priceNum,
            valueNum,
            status: row.status as PriceItem['status'],
            personalRating: row.personal_rating,
          })
        }
      }

      setItems(priceItems)
      setLoading(false)
    }

    fetchPrices()
  }, [user])

  function parsePrice(val: string | null): number {
    if (!val) return 0
    const num = parseFloat(val.replace(/[^0-9.]/g, ''))
    return isNaN(num) ? 0 : num
  }

  const filtered = items.filter((item) => {
    if (filterStatus === 'all') return true
    return item.status === filterStatus
  })

  const sorted = [...filtered].sort((a, b) => {
    switch (sortKey) {
      case 'price_asc': return a.priceNum - b.priceNum
      case 'price_desc': return b.priceNum - a.priceNum
      case 'value_asc': return a.valueNum - b.valueNum
      case 'value_desc': return b.valueNum - a.valueNum
      case 'name': return a.fragrance.name.localeCompare(b.fragrance.name)
      default: return 0
    }
  })

  // Stats
  const ownItems = items.filter((i) => i.status === 'own')
  const totalValue = ownItems.reduce((sum, i) => sum + i.priceNum, 0)
  const avgPrice = ownItems.length > 0 ? totalValue / ownItems.length : 0
  const wishlistTotal = items.filter((i) => i.status === 'wishlist').reduce((sum, i) => sum + i.priceNum, 0)

  if (!user) {
    return (
      <main className="pt-24 pb-32 px-6 flex flex-col items-center justify-center min-h-screen gap-4">
        <Icon name="payments" className="text-5xl text-primary/30" />
        <p className="text-secondary/60 text-sm">Sign in to track prices</p>
      </main>
    )
  }

  if (loading) {
    return (
      <main className="pt-24 pb-32 px-6 flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </main>
    )
  }

  return (
    <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen">
      <section className="text-center mb-6">
        <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-3">
          <Icon name="payments" filled className="text-3xl text-primary" />
        </div>
        <h2 className="font-headline text-xl mb-1">Price Tracker</h2>
        <p className="text-[10px] text-secondary/50">Your collection's value at a glance</p>
      </section>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-2 mb-6">
        <div className="bg-surface-container rounded-xl p-3 text-center">
          <p className="font-headline text-lg text-primary">${totalValue.toFixed(0)}</p>
          <p className="text-[8px] uppercase tracking-wider text-secondary/40">Collection Value</p>
        </div>
        <div className="bg-surface-container rounded-xl p-3 text-center">
          <p className="font-headline text-lg text-on-surface">${avgPrice.toFixed(0)}</p>
          <p className="text-[8px] uppercase tracking-wider text-secondary/40">Avg Price</p>
        </div>
        <div className="bg-surface-container rounded-xl p-3 text-center">
          <p className="font-headline text-lg text-secondary/70">${wishlistTotal.toFixed(0)}</p>
          <p className="text-[8px] uppercase tracking-wider text-secondary/40">Wishlist Cost</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-3">
        {(['all', 'own', 'wishlist'] as FilterStatus[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilterStatus(f)}
            className={`flex-1 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 ${
              filterStatus === f ? 'bg-primary/15 text-primary' : 'bg-surface-container text-secondary/50'
            }`}
          >
            {f === 'all' ? 'All' : f === 'own' ? 'Owned' : 'Wishlist'}
          </button>
        ))}
      </div>

      {/* Sort */}
      <div className="flex gap-1 bg-surface-container rounded-xl p-1 mb-6">
        {([
          { key: 'price_desc' as SortKey, label: 'Price ↓' },
          { key: 'price_asc' as SortKey, label: 'Price ↑' },
          { key: 'value_desc' as SortKey, label: 'Value ↓' },
          { key: 'name' as SortKey, label: 'A-Z' },
        ]).map((s) => (
          <button
            key={s.key}
            onClick={() => setSortKey(s.key)}
            className={`flex-1 py-2 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all ${
              sortKey === s.key ? 'bg-primary text-on-primary-container' : 'text-secondary/50'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Price List */}
      {sorted.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16">
          <Icon name="sell" className="text-4xl text-secondary/20" />
          <p className="text-sm text-secondary/50">No pricing data available</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((item) => (
            <button
              key={item.fragrance.id}
              onClick={() => navigate(`/fragrance/${item.fragrance.id}`)}
              className="w-full bg-surface-container rounded-xl p-3 flex items-center gap-3 active:scale-[0.98] transition-transform text-left"
            >
              {/* Image */}
              <div className="w-11 h-11 rounded-lg overflow-hidden bg-surface-container-low flex-shrink-0">
                {item.fragrance.image_url ? (
                  <img src={item.fragrance.image_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Icon name="water_drop" className="text-secondary/20" size={18} />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <p className="text-[9px] uppercase tracking-[0.1em] text-secondary/50">{item.fragrance.brand}</p>
                <p className="text-sm text-on-surface font-medium truncate">{item.fragrance.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-[8px] uppercase px-1.5 py-0.5 rounded-full ${
                    item.status === 'own' ? 'bg-primary/10 text-primary' : 'bg-secondary/10 text-secondary/60'
                  }`}>
                    {item.status}
                  </span>
                  {item.personalRating && (
                    <span className="text-[8px] text-secondary/40 flex items-center gap-0.5">
                      <Icon name="star" filled size={8} className="text-primary" />
                      {item.personalRating}
                    </span>
                  )}
                </div>
              </div>

              {/* Price */}
              <div className="text-right flex-shrink-0">
                {item.priceNum > 0 && (
                  <p className="font-headline text-lg text-primary">${item.priceNum.toFixed(0)}</p>
                )}
                {item.valueNum > 0 && item.valueNum !== item.priceNum && (
                  <p className="text-[8px] text-secondary/40">Value: ${item.valueNum.toFixed(0)}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </main>
  )
}
