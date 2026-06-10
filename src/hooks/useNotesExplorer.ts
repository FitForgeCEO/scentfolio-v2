import { useState, useEffect, useCallback, useRef } from 'react'
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
 * Uses SWR cache for performance. Groups case-insensitively but keeps the
 * DB's original casing as the canonical name -- note drill-down queries use
 * exact array-containment matching, so the name must round-trip verbatim
 * (e.g. "Pink Pepper", not "Pink pepper").
 */
export function usePopularNotes() {
  // _v2: cache bump -- v1 entries stored re-capitalised names that could
  // never match the DB's casing in useFragrancesByNote.
  const cacheKey = 'notes_explorer_popular_v2'
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

        const noteMap = new Map<string, { display: string; count: number; positions: Set<NotePosition> }>()

        for (const row of rows as { notes_top: string[] | null; notes_heart: string[] | null; notes_base: string[] | null }[]) {
          const process = (notes: string[] | null, pos: NotePosition) => {
            for (const n of notes ?? []) {
              const display = n.trim()
              const key = display.toLowerCase()
              if (!key) continue
              const existing = noteMap.get(key) ?? { display, count: 0, positions: new Set<NotePosition>() }
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
        const entries: NoteEntry[] = Array.from(noteMap.values())
          .map((info) => ({
            name: info.display,
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
 * The note must carry the DB's exact casing (see usePopularNotes) --
 * Postgres array containment is an exact, case-sensitive element match.
 */
export function useFragrancesByNote(note: string, position: NotePosition = 'all') {
  const [data, setData] = useState<Fragrance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const reqRef = useRef(0)

  const fetchData = useCallback(async () => {
    const reqId = ++reqRef.current
    if (!note) { setData([]); setLoading(false); return }
    setLoading(true)
    setError(null)

    // Quotes and backslashes are grammar inside PostgREST array literals;
    // no real note name contains them, so stripping is safe.
    const searchTerm = note.replace(/["\\]/g, '').trim()

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
      // Search across all note positions using OR. Values are quoted so
      // multi-word notes ("Pink Pepper") survive the filter grammar.
      query = query.or(
        `notes_top.cs.{"${searchTerm}"},notes_heart.cs.{"${searchTerm}"},notes_base.cs.{"${searchTerm}"}`
      )
    }

    const { data: rows, error: queryError } = await query
      .order('rating', { ascending: false, nullsFirst: false })
      .limit(50)

    if (reqId !== reqRef.current) return
    if (queryError) {
      setError(queryError.message)
      setData([])
    } else {
      setData((rows ?? []) as Fragrance[])
    }
    setLoading(false)
  }, [note, position])

  useEffect(() => { fetchData() }, [fetchData])

  return { data, loading, error }
}

/**
 * Get popular note families with counts.
 * Pages through the full table -- PostgREST silently caps un-ranged
 * selects at 1000 rows, which undercounted every family by ~3x.
 */
export function useNoteFamilies() {
  const cacheKey = 'notes_explorer_families_v2'
  const [data, setData] = useState<{ name: string; count: number }[]>(() => {
    const cached = getStale<{ name: string; count: number }[]>(cacheKey)
    return cached?.data ?? []
  })
  const [loading, setLoading] = useState(() => {
    const cached = getStale<{ name: string; count: number }[]>(cacheKey)
    return !cached || cached.isStale
  })

  useEffect(() => {
    let cancelled = false

    const fetchAll = async () => {
      const PAGE = 1000
      const countMap = new Map<string, number>()

      for (let page = 0; page < 20; page++) {
        const { data: rows, error } = await supabase
          .from('fragrances')
          .select('note_family')
          .not('note_family', 'is', null)
          .range(page * PAGE, (page + 1) * PAGE - 1)

        if (cancelled) return
        if (error || !rows) break

        for (const row of rows as { note_family: string }[]) {
          const fam = row.note_family.trim()
          if (!fam) continue
          countMap.set(fam, (countMap.get(fam) ?? 0) + 1)
        }

        if (rows.length < PAGE) break
      }

      const entries = Array.from(countMap.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)

      if (cancelled) return
      setData(entries)
      setCache(cacheKey, entries)
      setLoading(false)
    }

    fetchAll()
    return () => { cancelled = true }
  }, [])

  return { data, loading }
}
