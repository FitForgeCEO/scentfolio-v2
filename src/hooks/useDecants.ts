import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Fragrance } from '@/types/database'

export interface Decant {
  id: string
  user_id: string
  fragrance_id: string
  size_type: 'full' | 'travel' | 'decant' | 'sample' | 'discovery'
  size_ml: number | null
  remaining_ml: number | null
  purchase_price: number | null
  currency: string
  source: string | null
  notes: string | null
  created_at: string
  updated_at: string
  fragrance: Fragrance
}

export function useDecants(userId: string | undefined) {
  const [data, setData] = useState<Decant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(() => {
    if (!userId) { setLoading(false); return }
    setLoading(true)
    setError(null)
    supabase
      .from('decants')
      .select('*, fragrance:fragrances(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (err) setError(err.message)
        else setData((data ?? []) as Decant[])
        setLoading(false)
      })
  }, [userId])

  useEffect(() => { fetch() }, [fetch])

  return { data, loading, error, retry: fetch }
}

export async function createDecant(params: {
  user_id: string
  fragrance_id: string
  size_type: string
  size_ml?: number
  remaining_ml?: number
  purchase_price?: number
  currency?: string
  source?: string
  notes?: string
}) {
  const { error } = await supabase.from('decants').insert(params)
  return { error }
}

export async function updateDecantRemaining(id: string, remaining_ml: number) {
  const { error } = await supabase
    .from('decants')
    .update({ remaining_ml, updated_at: new Date().toISOString() })
    .eq('id', id)
  return { error }
}

export async function deleteDecant(id: string) {
  const { error } = await supabase.from('decants').delete().eq('id', id)
  return { error }
}
