import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Fragrance } from '@/types/database'

export interface LayeringStack {
  id: string
  user_id: string
  fragrance_id: string
  vibe: string | null
  body_prep: Record<string, unknown> | null
  layering_fragrance: Record<string, unknown> | null
  technique: string | null
  why_it_works: string | null
  resulting_vibe: string | null
  pro_tip: string | null
  user_rating: number | null
  user_notes: string | null
  tried_it: boolean
  tried_at: string | null
  is_public: boolean
  created_at: string
  fragrance: Fragrance
}

export function useLayeringStacks(userId: string | undefined) {
  const [stacks, setStacks] = useState<LayeringStack[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(() => {
    if (!userId) { setStacks([]); setLoading(false); return }
    setLoading(true)
    setError(null)
    supabase
      .from('layering_stacks')
      .select('*, fragrance:fragrances(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (err) setError(err.message)
        else if (data) setStacks(data as LayeringStack[])
        setLoading(false)
      })
  }, [userId])

  useEffect(() => { fetch() }, [fetch])

  return { stacks, loading, error, retry: fetch, setStacks }
}

export async function deleteStack(stackId: string): Promise<boolean> {
  const { error } = await supabase.from('layering_stacks').delete().eq('id', stackId)
  return !error
}

export async function toggleTriedIt(stackId: string, tried: boolean): Promise<boolean> {
  const { error } = await supabase
    .from('layering_stacks')
    .update({ tried_it: tried, tried_at: tried ? new Date().toISOString() : null })
    .eq('id', stackId)
  return !error
}
