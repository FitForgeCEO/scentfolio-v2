import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { Fragrance } from '@/types/database'

export type BlindBuyOutcome = 'love' | 'like' | 'neutral' | 'dislike' | 'sold'

export interface BlindBuy {
  id: string
  user_id: string
  fragrance_id: string
  purchase_date: string
  price_paid: number | null
  outcome: BlindBuyOutcome | null
  notes: string | null
  created_at: string
  fragrance?: Fragrance
}

const LS_KEY = (uid: string) => `scentfolio-blind-buys-${uid}`

export function useBlindBuys() {
  const { user } = useAuth()
  const [buys, setBuys] = useState<BlindBuy[]>([])
  const [loading, setLoading] = useState(true)

  const fetchBuys = useCallback(async () => {
    if (!user) { setLoading(false); return }

    try {
      const { data, error } = await supabase
        .from('blind_buys')
        .select('*, fragrance:fragrances(id, name, brand, image_url, note_family)')
        .eq('user_id', user.id)
        .order('purchase_date', { ascending: false })

      if (!error && data) {
        setBuys(data as unknown as BlindBuy[])
      } else {
        // Fallback to localStorage
        try {
          const stored = localStorage.getItem(LS_KEY(user.id))
          if (stored) setBuys(JSON.parse(stored))
        } catch { /* ignore */ }
      }
    } catch {
      try {
        const stored = localStorage.getItem(LS_KEY(user.id))
        if (stored) setBuys(JSON.parse(stored))
      } catch { /* ignore */ }
    }
    setLoading(false)
  }, [user])

  useEffect(() => { fetchBuys() }, [fetchBuys])

  const addBlindBuy = useCallback(async (
    fragranceId: string,
    fragrance: Fragrance,
    pricePaid: number | null,
  ) => {
    if (!user) return

    const newBuy: BlindBuy = {
      id: crypto.randomUUID(),
      user_id: user.id,
      fragrance_id: fragranceId,
      purchase_date: new Date().toISOString().split('T')[0],
      price_paid: pricePaid,
      outcome: null,
      notes: null,
      created_at: new Date().toISOString(),
      fragrance,
    }

    const updated = [newBuy, ...buys]
    setBuys(updated)
    try { localStorage.setItem(LS_KEY(user.id), JSON.stringify(updated)) } catch { /* ignore */ }

    try {
      await supabase.from('blind_buys').insert({
        id: newBuy.id,
        user_id: user.id,
        fragrance_id: fragranceId,
        purchase_date: newBuy.purchase_date,
        price_paid: pricePaid,
        outcome: null,
        notes: null,
      })
    } catch { /* localStorage fallback */ }
  }, [user, buys])

  const updateOutcome = useCallback(async (buyId: string, outcome: BlindBuyOutcome, notes: string | null) => {
    if (!user) return

    const updated = buys.map(b => b.id === buyId ? { ...b, outcome, notes } : b)
    setBuys(updated)
    try { localStorage.setItem(LS_KEY(user.id), JSON.stringify(updated)) } catch { /* ignore */ }

    try {
      await supabase.from('blind_buys').update({ outcome, notes }).eq('id', buyId).eq('user_id', user.id)
    } catch { /* localStorage fallback */ }
  }, [user, buys])

  const removeBuy = useCallback(async (buyId: string) => {
    if (!user) return

    const updated = buys.filter(b => b.id !== buyId)
    setBuys(updated)
    try { localStorage.setItem(LS_KEY(user.id), JSON.stringify(updated)) } catch { /* ignore */ }

    try {
      await supabase.from('blind_buys').delete().eq('id', buyId).eq('user_id', user.id)
    } catch { /* localStorage fallback */ }
  }, [user, buys])

  // Stats
  const stats = {
    total: buys.length,
    rated: buys.filter(b => b.outcome).length,
    loves: buys.filter(b => b.outcome === 'love').length,
    likes: buys.filter(b => b.outcome === 'like').length,
    neutrals: buys.filter(b => b.outcome === 'neutral').length,
    dislikes: buys.filter(b => b.outcome === 'dislike').length,
    sold: buys.filter(b => b.outcome === 'sold').length,
    successRate: (() => {
      const rated = buys.filter(b => b.outcome)
      if (rated.length === 0) return 0
      const good = rated.filter(b => b.outcome === 'love' || b.outcome === 'like').length
      return Math.round((good / rated.length) * 100)
    })(),
    totalSpent: buys.reduce((sum, b) => sum + (b.price_paid ?? 0), 0),
  }

  return { buys, loading, addBlindBuy, updateOutcome, removeBuy, stats, refetch: fetchBuys }
}

export function useBlindBuySearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Fragrance[]>([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return }
    setSearching(true)

    const timeout = setTimeout(() => {
      supabase
        .from('fragrances')
        .select('id, name, brand, image_url, note_family')
        .eq('is_approved', true)
        .or(`name.ilike.%${query.trim()}%,brand.ilike.%${query.trim()}%`)
        .limit(8)
        .then(({ data }) => {
          setResults((data ?? []) as Fragrance[])
          setSearching(false)
        })
    }, 300)

    return () => clearTimeout(timeout)
  }, [query])

  return { query, setQuery, results, searching }
}
