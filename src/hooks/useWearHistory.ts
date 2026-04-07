import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Fragrance } from '@/types/database'

export interface WearEntry {
  id: string
  wear_date: string
  occasion: string | null
  notes: string | null
  created_at: string
  fragrance: Fragrance
}

export interface MostWornFragrance {
  fragrance: Fragrance
  count: number
}

export function useWearHistory(userId: string | undefined) {
  const [entries, setEntries] = useState<WearEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(() => {
    if (!userId) {
      setEntries([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    supabase
      .from('wear_logs')
      .select('*, fragrance:fragrances(*)')
      .eq('user_id', userId)
      .order('wear_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data, error: err }) => {
        if (err) setError(err.message)
        else if (data) setEntries(data as WearEntry[])
        setLoading(false)
      })
  }, [userId])

  useEffect(() => { fetch() }, [fetch])

  // Derive most-worn fragrances from entries
  const mostWorn: MostWornFragrance[] = (() => {
    const counts = new Map<string, { fragrance: Fragrance; count: number }>()
    for (const entry of entries) {
      const existing = counts.get(entry.fragrance.id)
      if (existing) {
        existing.count++
      } else {
        counts.set(entry.fragrance.id, { fragrance: entry.fragrance, count: 1 })
      }
    }
    return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 5)
  })()

  // Group entries by month for timeline
  const groupedByMonth: Map<string, WearEntry[]> = (() => {
    const groups = new Map<string, WearEntry[]>()
    for (const entry of entries) {
      const d = new Date(entry.wear_date)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const existing = groups.get(key)
      if (existing) existing.push(entry)
      else groups.set(key, [entry])
    }
    return groups
  })()

  // Occasion breakdown
  const occasionBreakdown: { occasion: string; count: number }[] = (() => {
    const counts = new Map<string, number>()
    for (const entry of entries) {
      const occ = entry.occasion ?? 'unspecified'
      counts.set(occ, (counts.get(occ) ?? 0) + 1)
    }
    return [...counts.entries()]
      .map(([occasion, count]) => ({ occasion, count }))
      .sort((a, b) => b.count - a.count)
  })()

  return { entries, mostWorn, groupedByMonth, occasionBreakdown, loading, error, retry: fetch }
}
