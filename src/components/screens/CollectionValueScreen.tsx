import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../ui/Icon'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import type { Fragrance } from '@/types/database'

interface ValueItem {
  fragrance: Fragrance
  price: number
  wearCount: number
  costPerWear: number | null
  dateAdded: string
}

interface MonthlyValue {
  month: string
  cumulative: number
  added: number
}

function parsePrice(priceStr: string | null): number {
  if (!priceStr) return 0
  const match = priceStr.replace(/[^0-9.]/g, '')
  return parseFloat(match) || 0
}

export function CollectionValueScreen() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const chartRef = useRef<HTMLDivElement>(null)
  const [items, setItems] = useState<ValueItem[]>([])
  const [monthlyData, setMonthlyData] = useState<MonthlyValue[]>([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState<'value' | 'cpw' | 'recent'>('value')

  useEffect(() => {
    if (!user) { setLoading(false); return }
    fetchData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function fetchData() {
    const [collRes, wearsRes] = await Promise.all([
      supabase.from('user_collections').select('date_added, fragrance:fragrances(*)').eq('user_id', user!.id).eq('status', 'own').order('date_added', { ascending: true }),
      supabase.from('wear_logs').select('fragrance_id').eq('user_id', user!.id),
    ])

    type CollRow = { date_added: string; fragrance: Fragrance | null }
    type WearRow = { fragrance_id: string }

    const coll = (collRes.data ?? []) as unknown as CollRow[]
    const wears = (wearsRes.data ?? []) as unknown as WearRow[]

    // Wear counts
    const wearMap = new Map<string, number>()
    wears.forEach(w => wearMap.set(w.fragrance_id, (wearMap.get(w.fragrance_id) ?? 0) + 1))

    // Build value items
    const valueItems: ValueItem[] = coll
      .filter(c => c.fragrance)
      .map(c => {
        const price = parsePrice(c.fragrance!.price)
        const wc = wearMap.get(c.fragrance!.id) ?? 0
        return {
          fragrance: c.fragrance!,
          price,
          wearCount: wc,
          costPerWear: wc > 0 ? price / wc : null,
          dateAdded: c.date_added,
        }
      })

    setItems(valueItems)

    // Monthly cumulative chart data
    const monthMap = new Map<string, number>()
    let cumulative = 0
    valueItems.forEach(item => {
      const monthKey = item.dateAdded.slice(0, 7) // YYYY-MM
      const existing = monthMap.get(monthKey) ?? 0
      monthMap.set(monthKey, existing + item.price)
    })

    const monthly: MonthlyValue[] = []
    for (const [month, added] of [...monthMap.entries()].sort()) {
      cumulative += added
      const label = new Date(month + '-01').toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
      monthly.push({ month: label, cumulative, added })
    }
    setMonthlyData(monthly)
    setLoading(false)
  }

  const totalValue = items.reduce((sum, i) => sum + i.price, 0)
  const avgPrice = items.length > 0 ? totalValue / items.length : 0
  const totalWears = items.reduce((sum, i) => sum + i.wearCount, 0)
  const avgCPW = totalWears > 0 ? totalValue / totalWears : 0
  const mostValuable = [...items].sort((a, b) => b.price - a.price)[0]
  const bestValue = [...items].filter(i => i.costPerWear !== null).sort((a, b) => (a.costPerWear ?? Infinity) - (b.costPerWear ?? Infinity))[0]

  const sorted = [...items].sort((a, b) => {
    if (sortBy === 'value') return b.price - a.price
    if (sortBy === 'cpw') return (a.costPerWear ?? Infinity) - (b.costPerWear ?? Infinity)
    return b.dateAdded.localeCompare(a.dateAdded)
  })

  if (!user) {
    return (
      <main className="pt-24 pb-32 px-6 flex flex-col items-center justify-center min-h-screen gap-4">
        <Icon name="payments" className="text-5xl text-primary/30" />
        <p className="text-secondary/60 text-sm">Sign in to track collection value</p>
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

  const chartMax = monthlyData.length > 0 ? Math.max(...monthlyData.map(d => d.cumulative)) : 0

  return (
    <main className="pt-24 pb-32 px-4 max-w-[430px] mx-auto min-h-screen space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-surface-container rounded-xl p-4 text-center">
          <p className="font-headline text-2xl text-primary">${totalValue.toFixed(0)}</p>
          <p className="text-[9px] text-secondary/50 uppercase tracking-wider">Total Value</p>
        </div>
        <div className="bg-surface-container rounded-xl p-4 text-center">
          <p className="font-headline text-2xl text-on-surface">${avgPrice.toFixed(0)}</p>
          <p className="text-[9px] text-secondary/50 uppercase tracking-wider">Avg Price</p>
        </div>
        <div className="bg-surface-container rounded-xl p-4 text-center">
          <p className="font-headline text-2xl text-tertiary">${avgCPW.toFixed(2)}</p>
          <p className="text-[9px] text-secondary/50 uppercase tracking-wider">Avg Cost/Wear</p>
        </div>
        <div className="bg-surface-container rounded-xl p-4 text-center">
          <p className="font-headline text-2xl text-on-surface">{items.length}</p>
          <p className="text-[9px] text-secondary/50 uppercase tracking-wider">Bottles</p>
        </div>
      </div>

      {/* Highlights */}
      <div className="flex gap-3">
        {mostValuable && mostValuable.price > 0 && (
          <button onClick={() => navigate(`/fragrance/${mostValuable.fragrance.id}`)} className="flex-1 bg-surface-container rounded-xl p-3 text-left active:scale-[0.98] transition-transform">
            <p className="text-[8px] uppercase tracking-[0.12em] text-secondary/40 font-bold">MOST VALUABLE</p>
            <p className="text-xs text-on-surface font-medium mt-1 truncate">{mostValuable.fragrance.name}</p>
            <p className="text-[10px] text-primary">${mostValuable.price.toFixed(0)}</p>
          </button>
        )}
        {bestValue && bestValue.costPerWear !== null && (
          <button onClick={() => navigate(`/fragrance/${bestValue.fragrance.id}`)} className="flex-1 bg-surface-container rounded-xl p-3 text-left active:scale-[0.98] transition-transform">
            <p className="text-[8px] uppercase tracking-[0.12em] text-secondary/40 font-bold">BEST VALUE</p>
            <p className="text-xs text-on-surface font-medium mt-1 truncate">{bestValue.fragrance.name}</p>
            <p className="text-[10px] text-tertiary">${bestValue.costPerWear.toFixed(2)}/wear</p>
          </button>
        )}
      </div>

      {/* Value growth chart */}
      {monthlyData.length > 1 && (
        <div>
          <p className="text-[10px] uppercase tracking-[0.15em] text-secondary/50 font-bold mb-3">VALUE GROWTH</p>
          <div ref={chartRef} className="bg-surface-container rounded-xl p-4">
            <div className="flex items-end gap-1" style={{ height: '100px' }}>
              {monthlyData.map((d, i) => {
                const h = chartMax > 0 ? (d.cumulative / chartMax) * 100 : 0
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full rounded-t" style={{ height: `${Math.max(h, 3)}%`, backgroundColor: `var(--color-primary)`, opacity: 0.3 + (h / 100) * 0.7 }} />
                    {i % Math.max(1, Math.floor(monthlyData.length / 6)) === 0 && (
                      <span className="text-[6px] text-secondary/30 whitespace-nowrap">{d.month}</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Sort & list */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] uppercase tracking-[0.15em] text-secondary/50 font-bold">ALL FRAGRANCES</p>
          <div className="flex gap-1">
            {(['value', 'cpw', 'recent'] as const).map(s => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                className={`px-3 py-1 rounded-full text-[9px] font-medium transition-all ${sortBy === s ? 'bg-primary/15 text-primary' : 'text-secondary/40'}`}
              >
                {s === 'value' ? 'Value' : s === 'cpw' ? 'Cost/Wear' : 'Recent'}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          {sorted.filter(i => i.price > 0).map(item => (
            <button
              key={item.fragrance.id}
              onClick={() => navigate(`/fragrance/${item.fragrance.id}`)}
              className="w-full flex items-center gap-3 bg-surface-container rounded-xl p-3 active:scale-[0.98] transition-transform text-left"
            >
              <div className="w-10 h-10 rounded-lg overflow-hidden bg-surface-container-low flex-shrink-0">
                {item.fragrance.image_url ? (
                  <img src={item.fragrance.image_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Icon name="water_drop" className="text-primary/20" size={16} />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-on-surface font-medium truncate">{item.fragrance.name}</p>
                <p className="text-[9px] text-secondary/50">{item.fragrance.brand}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs text-primary font-bold">${item.price.toFixed(0)}</p>
                {item.costPerWear !== null && (
                  <p className="text-[9px] text-tertiary">${item.costPerWear.toFixed(2)}/wear</p>
                )}
                {item.wearCount > 0 && (
                  <p className="text-[8px] text-secondary/30">{item.wearCount} wears</p>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </main>
  )
}
