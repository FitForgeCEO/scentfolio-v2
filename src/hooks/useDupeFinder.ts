import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { Fragrance } from '@/types/database'

export interface DupeConnection {
  id: string
  fragrance_a_id: string
  fragrance_b_id: string
  similarity_score: number
  submitted_by: string
  votes: number
  created_at: string
}

export interface DupePair {
  connection: DupeConnection
  otherFragrance: Fragrance
}

export function useDupeSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Fragrance[]>([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return }
    setSearching(true)

    const timeout = setTimeout(() => {
      supabase
        .from('fragrances')
        .select('id, name, brand, image_url, note_family, notes_top, notes_heart, notes_base, accords')
        .eq('is_approved', true)
        .or(`name.ilike.%${query.trim()}%,brand.ilike.%${query.trim()}%`)
        .limit(10)
        .then(({ data }) => {
          setResults((data ?? []) as Fragrance[])
          setSearching(false)
        })
    }, 300)

    return () => clearTimeout(timeout)
  }, [query])

  return { query, setQuery, results, searching }
}

export function useDupesForFragrance(fragranceId: string | null) {
  const [dupes, setDupes] = useState<DupePair[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!fragranceId) { setDupes([]); return }
    setLoading(true)

    // Try community dupes table first, fallback to note-based matching
    supabase
      .from('fragrance_dupes')
      .select('*')
      .or(`fragrance_a_id.eq.${fragranceId},fragrance_b_id.eq.${fragranceId}`)
      .order('votes', { ascending: false })
      .limit(20)
      .then(async ({ data, error }) => {
        if (!error && data && data.length > 0) {
          const connections = data as DupeConnection[]
          const otherIds = connections.map(c =>
            c.fragrance_a_id === fragranceId ? c.fragrance_b_id : c.fragrance_a_id
          )
          const { data: frags } = await supabase
            .from('fragrances')
            .select('*')
            .in('id', otherIds)

          const fragMap = new Map((frags ?? []).map(f => [f.id, f as Fragrance]))
          const pairs = connections
            .map(c => {
              const otherId = c.fragrance_a_id === fragranceId ? c.fragrance_b_id : c.fragrance_a_id
              const otherFrag = fragMap.get(otherId)
              return otherFrag ? { connection: c, otherFragrance: otherFrag } : null
            })
            .filter(Boolean) as DupePair[]

          setDupes(pairs)
        } else {
          // Fallback: find similar by note_family and shared notes
          await findSimilarByNotes(fragranceId, setDupes)
        }
        setLoading(false)
      })
  }, [fragranceId])

  return { dupes, loading }
}

async function findSimilarByNotes(
  fragranceId: string,
  setDupes: (d: DupePair[]) => void
) {
  const { data: source } = await supabase
    .from('fragrances')
    .select('*')
    .eq('id', fragranceId)
    .single()

  if (!source) return

  const frag = source as Fragrance
  if (!frag.note_family) return

  const { data: candidates } = await supabase
    .from('fragrances')
    .select('*')
    .eq('note_family', frag.note_family)
    .neq('id', fragranceId)
    .eq('is_approved', true)
    .limit(50)

  if (!candidates) return

  const sourceNotes = new Set([
    ...(frag.notes_top ?? []),
    ...(frag.notes_heart ?? []),
    ...(frag.notes_base ?? []),
  ].map(n => n.toLowerCase()))

  const scored = (candidates as Fragrance[]).map(c => {
    const cNotes = new Set([
      ...(c.notes_top ?? []),
      ...(c.notes_heart ?? []),
      ...(c.notes_base ?? []),
    ].map(n => n.toLowerCase()))

    let overlap = 0
    for (const n of sourceNotes) {
      if (cNotes.has(n)) overlap++
    }

    const total = new Set([...sourceNotes, ...cNotes]).size
    const similarity = total > 0 ? Math.round((overlap / total) * 100) : 0

    return {
      connection: {
        id: `auto-${fragranceId}-${c.id}`,
        fragrance_a_id: fragranceId,
        fragrance_b_id: c.id,
        similarity_score: similarity,
        submitted_by: 'system',
        votes: 0,
        created_at: new Date().toISOString(),
      },
      otherFragrance: c,
      similarity,
    }
  })

  scored.sort((a, b) => b.similarity - a.similarity)
  setDupes(scored.filter(s => s.similarity >= 25).slice(0, 15))
}

export function useSubmitDupe() {
  const { user } = useAuth()
  const [submitting, setSubmitting] = useState(false)

  const submit = useCallback(async (fragranceAId: string, fragranceBId: string, score: number) => {
    if (!user) return false
    setSubmitting(true)

    try {
      const { error } = await supabase.from('fragrance_dupes').insert({
        fragrance_a_id: fragranceAId,
        fragrance_b_id: fragranceBId,
        similarity_score: score,
        submitted_by: user.id,
        votes: 1,
      })
      setSubmitting(false)
      return !error
    } catch {
      setSubmitting(false)
      return false
    }
  }, [user])

  return { submit, submitting }
}
