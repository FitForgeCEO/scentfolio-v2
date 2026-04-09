import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { Fragrance } from '@/types/database'

export interface TopShelfItem {
  fragrance_id: string
  position: number
  fragrance: Fragrance
}

const MAX_SLOTS = 10
const LS_KEY = (uid: string) => `scentfolio-top-shelf-${uid}`

export function useTopShelf() {
  const { user } = useAuth()
  const [items, setItems] = useState<TopShelfItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Load top shelf
  useEffect(() => {
    if (!user) { setLoading(false); return }

    // Try Supabase first, fallback to localStorage
    supabase
      .from('top_shelf')
      .select('fragrance_id, position, fragrance:fragrances(*)')
      .eq('user_id', user.id)
      .order('position')
      .then(({ data, error }) => {
        if (!error && data && data.length > 0) {
          type Row = { fragrance_id: string; position: number; fragrance: Fragrance | null }
          const rows = (data as unknown as Row[]).filter(r => r.fragrance)
          setItems(rows.map(r => ({ fragrance_id: r.fragrance_id, position: r.position, fragrance: r.fragrance! })))
        } else {
          // Fallback to localStorage
          try {
            const stored = localStorage.getItem(LS_KEY(user.id))
            if (stored) {
              const ids: string[] = JSON.parse(stored)
              if (ids.length > 0) {
                supabase
                  .from('fragrances')
                  .select('*')
                  .in('id', ids)
                  .then(({ data: frags }) => {
                    if (frags) {
                      const fragMap = new Map(frags.map(f => [f.id, f as Fragrance]))
                      const restored = ids
                        .map((id, i) => ({ fragrance_id: id, position: i, fragrance: fragMap.get(id)! }))
                        .filter(r => r.fragrance)
                      setItems(restored)
                    }
                  })
              }
            }
          } catch { /* ignore */ }
        }
        setLoading(false)
      })
  }, [user])

  const save = useCallback(async (newItems: TopShelfItem[]) => {
    if (!user) return
    setSaving(true)
    setItems(newItems)

    // Save to localStorage
    const ids = newItems.map(i => i.fragrance_id)
    try { localStorage.setItem(LS_KEY(user.id), JSON.stringify(ids)) } catch { /* ignore */ }

    // Save to Supabase
    try {
      await supabase.from('top_shelf').delete().eq('user_id', user.id)
      if (newItems.length > 0) {
        await supabase.from('top_shelf').insert(
          newItems.map((item, i) => ({ user_id: user.id, fragrance_id: item.fragrance_id, position: i }))
        )
      }
    } catch { /* graceful fallback to localStorage */ }

    setSaving(false)
  }, [user])

  const addToShelf = useCallback((fragrance: Fragrance) => {
    if (items.length >= MAX_SLOTS) return
    if (items.some(i => i.fragrance_id === fragrance.id)) return
    const newItems = [...items, { fragrance_id: fragrance.id, position: items.length, fragrance }]
    save(newItems)
  }, [items, save])

  const removeFromShelf = useCallback((fragranceId: string) => {
    const newItems = items.filter(i => i.fragrance_id !== fragranceId).map((item, i) => ({ ...item, position: i }))
    save(newItems)
  }, [items, save])

  const moveItem = useCallback((fromIndex: number, toIndex: number) => {
    const arr = [...items]
    const [moved] = arr.splice(fromIndex, 1)
    arr.splice(toIndex, 0, moved)
    const reindexed = arr.map((item, i) => ({ ...item, position: i }))
    save(reindexed)
  }, [items, save])

  return { items, loading, saving, addToShelf, removeFromShelf, moveItem, maxSlots: MAX_SLOTS }
}

export function useTopShelfSearch() {
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Fragrance[]>([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (!user || query.trim().length < 2) { setResults([]); return }
    setSearching(true)

    const timeout = setTimeout(() => {
      supabase
        .from('user_collections')
        .select('fragrance:fragrances(id, name, brand, image_url, note_family)')
        .eq('user_id', user.id)
        .eq('status', 'own')
        .then(({ data }) => {
          type Row = { fragrance: Fragrance | null }
          const rows = (data ?? []) as unknown as Row[]
          const q = query.trim().toLowerCase()
          const matched = rows
            .filter(r => r.fragrance && (
              r.fragrance.name.toLowerCase().includes(q) ||
              r.fragrance.brand.toLowerCase().includes(q)
            ))
            .map(r => r.fragrance!)
            .slice(0, 10)
          setResults(matched)
          setSearching(false)
        })
    }, 300)

    return () => clearTimeout(timeout)
  }, [user, query])

  return { query, setQuery, results, searching }
}

export function usePublicTopShelf(userId: string | undefined) {
  const [items, setItems] = useState<TopShelfItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) { setLoading(false); return }

    supabase
      .from('top_shelf')
      .select('fragrance_id, position, fragrance:fragrances(id, name, brand, image_url)')
      .eq('user_id', userId)
      .order('position')
      .then(({ data, error }) => {
        if (!error && data) {
          type Row = { fragrance_id: string; position: number; fragrance: Fragrance | null }
          const rows = (data as unknown as Row[]).filter(r => r.fragrance)
          setItems(rows.map(r => ({ fragrance_id: r.fragrance_id, position: r.position, fragrance: r.fragrance! })))
        }
        setLoading(false)
      })
  }, [userId])

  return { items, loading }
}
