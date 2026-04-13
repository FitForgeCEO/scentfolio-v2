import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { getStale, setCache } from '@/lib/cache'
import type { Fragrance } from '@/types/database'

export type NotePosition = 'top' | 'heart' | 'base' | 'all'

interface NoteEntry {
  name: string
  count: number
  positions: Set<NotePosition>
}

/**
 * Fetch all unique notes across the fragrance database with counts.
 * Uses SWR cache for performance. Groups by note name (case-insensitive).
 */
export function usePopularNotes() {
  const cacheKey = 'notes_explorer_popular'
  const [data, setData] = useState<NoteEntry[]>(() => {
    const cached = getStale<NoteEntry[]>(cacheKey)
    return cached?.data ?? []
  })
  const [loading, setLoading] = useState(() => {
    const cached = getStale<NoteEntry[]>(cacheKey)
    return !cached || cached.isStale
  })

  useEffect(() => {
    // Fetch a sample of fragrances to aggregate notes client-side
    // We fetch fragrances that have notes data
    supabase
      .from('fragrances')
      .select('notes_top, notes_heart, notes_base')
      .not('notes_top', 'is', null)
      .limit(500)
      .then(({ data: rows }) => {
        if (!rows) { setLoading(false); return }

        const noteMap = new Map<string, { count: number; positions: Set<NotePosition> }>()

        for (const row of rows as { notes_top: string[] | null; notes_heart: string[] | null; notes_base: string[] | null }[]) {
          const process = (notes: string[] | null, pos: NotePosition) => {
            for (const n of notes ?? []) {
              const key = n.toLowerCase().trim()
              if (!key) continue
              const existing = noteMap.get(key) ?? { count: 0, positions: new Set<NotePosition>() }
              existing.count++
              existing.positions.add(pos)
              noteMap.set(key, existing)
            }
          }
          process(row.notes_top, 'top')
          process(row.notes_heart, 'heart')
          process(row.notes_base, 'base')
        }

        // Convert to array sorted by count descending
        const entries: NoteEntry[] = Array.from(noteMap.entries())
          .map(([name, info]) => ({
            name: name.charAt(0).toUpperCase() + name.slice(1),
            count: info.count,
            positions: info.positions,
          }))
          .sort((a, b) => b.count - a.count)

        setData(entries)
        setCache(cacheKey, entries)
        setLoading(false)
      })
  }, [])

  return { data, loading }
}

/**
 * Fetch fragrances that contain a specific note.
 */
export function useFragrancesByNote(note: string, position: NotePosition = 'all') {
  const [data, setData] = useState<Fragrance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!note) { setData([]); setLoading(false); return }
    setLoading(true)
    setError(null)

    const searchTerm = note.toLowerCase()

    // Build query based on position filter
    let query = supabase
      .from('fragrances')
      .select('*')

    if (position === 'top') {
      query = query.contains('notes_top', [searchTerm])
    } else if (position === 'heart') {
      query = query.contains('notes_heart', [searchTerm])
    } else if (position === 'base') {
      query = query.contains('notes_base', [searchTerm])
    } else {
      // Search across all note positions using OR
      query = query.or(
        `notes_top.cs.{${searchTerm}},notes_heart.cs.{${searchTerm}},notes_base.cs.{${searchTerm}}`
      )
    }

    const { data: rows, error: queryError } = await query
      .order('rating', { ascending: false, nullsFirst: false })
      .limit(50)

    if (queryError) {
      setError(queryError.message)
    } else if (rows) {
      setData(rows as Fragrance[])
    }
    setLoading(false)
  }, [note, position])

  useEffect(() => { fetchData() }, [fetchData])

  return { data, loading, error }
}

/**
 * Get popular note families with counts.
 */
export function useNoteFamilies() {
  const cacheKey = 'notes_explorer_families'
  const [data, setData] = useState<{ name: string; count: number }[]>(() => {
    const cached = getStale<{ name: string; count: number }[]>(cacheKey)
    return cached?.data ?? []
  })
  const [loading, setLoading] = useState(() => {
    const cached = getStale<{ name: string; count: number }[]>(cacheKey)
    return !cached || cached.isStale
  })

  useEffect(() => {
    supabase
      .from('fragrances')
      .select('note_family')
      .not('note_family', 'is', null)
      .limit(1000)
      .then(({ data: rows }) => {
        if (!rows) { setLoading(false); return }

        const countMap = new Map<string, number>()
        for (const row of rows as { note_family: string }[]) {
          const fam = row.note_family.trim()
          if (!fam) continue
          countMap.set(fam, (countMap.get(fam) ?? 0) + 1)
        }

        const entries = Array.from(countMap.entries())
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)

        setData(entries)
        setCache(cacheKey, entries)
        setLoading(false)
      })
  }, [])

  return { data, loading }
}
