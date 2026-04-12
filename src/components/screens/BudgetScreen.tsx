import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { InlineError } from '../ui/InlineError'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import type { Fragrance, UserCollection, WearLog } from '@/types/database'
import type { Decant } from '@/hooks/useDecants'

type CollectionItem = UserCollection & { fragrance: Fragrance }

interface MonthlySpend {
  month: string // YYYY-MM
  label: string // "Jan 2026"
  amount: number
}

interface BrandSpend {
  brand: string
  amount: number
  count: number
}

interface CostPerWearItem {
  fragrance: Fragrance
  totalSpent: number
  wearCount: number
  cpw: number
}

export function BudgetScreen() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [collection, setCollection] = useState<CollectionItem[]>([])
  const [decants, setDecants] = useState<Decant[]>([])
  const [wearLogs, setWearLogs] = useState<WearLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(() => {
    if (!user) { setLoading(false); return }
    setLoading(true)
    setError(null)
    Promise.all([
      supabase.from('user_collections').select('*, fragrance:fragrances(*)').eq('user_id', user.id).eq('status', 'own'),
      supabase.from('decants').select('*, fragrance:fragrances(*)').eq('user_id', user.id),
      supabase.from('wear_logs').select('*').eq('user_id', user.id),
    ]).then(([collRes, decRes, wearRes]) => {
      if (collRes.error || decRes.error) { setError(collRes.error?.message ?? decRes.error?.message ?? 'Error'); setLoading(false); return }
      setCollection((collRes.data ?? []) as CollectionItem[])
      setDecants((decRes.data ?? []) as Decant[])
      setWearLogs((wearRes.data ?? []) as WearLog[])
      setLoading(false)
    })
  }, [user])

  useEffect(() => { fetchData() }, [fetchData])

  // Compute budget data
  const { totalValue, totalDecantValue, brandSpends, monthlySpends, costPerWear, maxMonthly } = useMemo(() => {
    // Total collection value from price_value
    const totalValue = collection.reduce((sum, c) => {
      const pv = Number(c.fragrance.price_value) || 0
      return sum + pv
    }, 0)

    const totalDecantValue = decants.reduce((sum, d) => sum + (d.purchase_price ?? 0), 0)

    // Brand spending breakdown
    const brandMap = new Map<string, { amount: number; count: number }>()
    collection.forEach((c) => {
      const price = Number(c.fragrance.price_value) || 0
      const existing = brandMap.get(c.fragrance.brand)
      if (existing) { existing.amount += price; existing.count++ }
      else brandMap.set(c.fragrance.brand, { amount: price, count: 1 })
    })
    decants.forEach((d) => {
      const price = d.purchase_price ?? 0
      const brand = d.fragrance.brand
      const existing = brandMap.get(brand)
      if (existing) { existing.amount += price; existing.count++ }
      else brandMap.set(brand, { amount: price, count: 1 })
    })
    const brandSpends: BrandSpend[] = [...brandMap.entries()]
      .map(([brand, info]) => ({ brand, ...info }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8)

    // Monthly spending from collection date_added + decant created_at
    const monthMap = new Map<string, number>()
    collection.forEach((c) => {
      const month = c.date_added?.substring(0, 7)
      if (month) {
        const price = Number(c.fragrance.price_value) || 0
        monthMap.set(month, (monthMap.get(month) || 0) + price)
      }
    })
    decants.forEach((d) => {
      const month = d.created_at?.substring(0, 7)
      if (month) {
        monthMap.set(month, (monthMap.get(month) || 0) + (d.purchase_price ?? 0))
      }
    })
    const monthlySpends: MonthlySpend[] = [...monthMap.entries()]
      .map(([month, amount]) => {
        const d = new Date(month + '-01')
        const label = d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
        return { month, label, amount }
      })
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-6)
    const maxMonthly = Math.max(...monthlySpends.map((m) => m.amount), 1)

    // Cost per wear
    const wearCounts = new Map<string, number>()
    wearLogs.forEach((w) => { wearCounts.set(w.fragrance_id, (wearCounts.get(w.fragrance_id) || 0) + 1) })

    const cpwItems: CostPerWearItem[] = collection
      .filter((c) => Number(c.fragrance.price_value) > 0)
      .map((c) => {
        const spent = Number(c.fragrance.price_value) || 0
        const wearCount = wearCounts.get(c.fragrance.id) ?? 0
        const cpw = wearCount > 0 ? spent / wearCount : spent
        return { fragrance: c.fragrance, totalSpent: spent, wearCount, cpw }
      })
      .sort((a, b) => {
        // Best cpw first (exclude 0 wears to the end)
        if (a.wearCount === 0 && b.wearCount > 0) return 1
        if (b.wearCount === 0 && a.wearCount > 0) return -1
        return a.cpw - b.cpw
      })
      .slice(0, 8)

    return { totalValue, totalDecantValue, brandSpends, monthlySpends, costPerWear: cpwItems, maxMonthly }
  }, [collection, decants, wearLogs])

  if (!user) {
    return (
      <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen flex flex-col items-center justify-center">
        <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center mb-5">
          <span className="text-3xl text-primary/40">?</span>
        </div>
        <h3 className="font-headline text-xl text-on-surface mb-2">Sign in to track budget</h3>
        <button onClick={() => navigate('/profile')} className="gold-gradient text-on-primary-container px-8 py-3 rounded-sm font-label text-[10px] font-bold uppercase tracking-widest hover:opacity-80 transition-all shadow-lg mt-6">SIGN IN</button>
      </main>
    )
  }

  if (error) return <main className="pt-24 pb-32 px-6"><InlineError message="Couldn't load budget data" onRetry={fetchData} /></main>

  if (loading) {
    return (
      <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen">
        <div className="space-y-4 pt-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 rounded-sm bg-surface-container animate-pulse" />)}
        </div>
      </main>
    )
  }

  return (
    <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen space-y-8">
      <header>
        <h2 className="font-headline text-3xl text-on-surface leading-tight mb-1">Budget Tracker</h2>
        <p className="font-body text-sm text-secondary opacity-70">Your fragrance spending at a glance</p>
      </header>

      {/* Total Value */}
      <section className="grid grid-cols-2 gap-3">
        <div className="bg-surface-container rounded-sm p-5 space-y-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-primary">?</span>
            <span className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">COLLECTION VALUE</span>
          </div>
          <p className="font-headline text-2xl text-on-surface">£{totalValue.toFixed(0)}</p>
          <p className="text-[10px] text-secondary/50">{collection.length} bottles</p>
        </div>
        <div className="bg-surface-container rounded-sm p-5 space-y-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-primary">?</span>
            <span className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">DECANT VALUE</span>
          </div>
          <p className="font-headline text-2xl text-on-surface">£{totalDecantValue.toFixed(0)}</p>
          <p className="text-[10px] text-secondary/50">{decants.length} decants</p>
        </div>
      </section>

      {/* Monthly Spending Chart */}
      {monthlySpends.length > 0 && (
        <section className="bg-surface-container rounded-sm p-5 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-primary">?</span>
            <h3 className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">MONTHLY SPENDING</h3>
          </div>
          <div className="flex items-end gap-2 h-32">
            {monthlySpends.map((m) => {
              const height = Math.max(4, (m.amount / maxMonthly) * 100)
              return (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[9px] text-primary font-bold">£{m.amount.toFixed(0)}</span>
                  <div className="w-full rounded-t-lg bg-primary transition-all" style={{ height: `${height}%` }} />
                  <span className="text-[8px] text-secondary/50 whitespace-nowrap">{m.label}</span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Brand Spending */}
      {brandSpends.length > 0 && (
        <section className="bg-surface-container rounded-sm p-5 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-primary">?</span>
            <h3 className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">SPENDING BY BRAND</h3>
          </div>
          <div className="space-y-3">
            {brandSpends.map((b) => {
              const pct = Math.round((b.amount / (totalValue + totalDecantValue || 1)) * 100)
              return (
                <div key={b.brand}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-on-surface">{b.brand}</span>
                    <span className="text-[10px] text-secondary/60">£{b.amount.toFixed(0)} ({pct}%)</span>
                  </div>
                  <div className="h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Cost Per Wear */}
      {costPerWear.length > 0 && (
        <section className="bg-surface-container rounded-sm p-5 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-primary">?</span>
            <h3 className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">COST PER WEAR</h3>
          </div>
          <div className="space-y-3">
            {costPerWear.map((item) => (
              <button
                key={item.fragrance.id}
                onClick={() => navigate(`/fragrance/${item.fragrance.id}`)}
                className="w-full flex items-center gap-3 py-1 text-left hover:opacity-80 transition-opacity"
              >
                <div className="w-10 h-10 rounded-sm overflow-hidden flex-shrink-0 bg-surface-container-highest">
                  {item.fragrance.image_url && <img src={item.fragrance.image_url} alt={item.fragrance.name} className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] uppercase tracking-[0.15em] text-primary/70 font-bold">{item.fragrance.brand}</p>
                  <p className="text-sm text-on-surface truncate">{item.fragrance.name}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-bold text-on-surface">£{item.cpw.toFixed(2)}</p>
                  <p className="text-[9px] text-secondary/50">{item.wearCount} wear{item.wearCount !== 1 ? 's' : ''}</p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {(collection.length === 0 && decants.length === 0) && (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-20 h-20 rounded-full bg-surface-container flex items-center justify-center mb-6">
            <span className="text-primary/40 text-4xl">?</span>
          </div>
          <h3 className="font-headline text-xl text-on-surface mb-2">No spending data yet</h3>
          <p className="text-sm text-secondary/60 text-center mb-8 max-w-[280px]">Add fragrances to your collection to start tracking your fragrance budget.</p>
          <button onClick={() => navigate('/explore')} className="gold-gradient text-on-primary-container px-8 py-3 rounded-sm font-label text-[10px] font-bold uppercase tracking-widest hover:opacity-80 transition-all shadow-lg">EXPLORE</button>
        </div>
      )}
    </main>
  )
}
