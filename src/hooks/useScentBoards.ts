import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Fragrance } from '@/types/database'

export interface ScentBoard {
  id: string
  user_id: string
  title: string
  description: string | null
  cover_style: string | null
  is_public: boolean
  position: number | null
  created_at: string
  updated_at: string
}

export interface ScentBoardItem {
  id: string
  board_id: string
  fragrance_id: string
  note: string | null
  position: number | null
  added_at: string
  fragrance: Fragrance
}

export function useScentBoards(userId: string | undefined) {
  const [boards, setBoards] = useState<ScentBoard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(() => {
    if (!userId) {
      setBoards([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    supabase
      .from('scent_boards')
      .select('*')
      .eq('user_id', userId)
      .order('position', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (err) setError(err.message)
        else if (data) setBoards(data as ScentBoard[])
        setLoading(false)
      })
  }, [userId])

  useEffect(() => { fetch() }, [fetch])

  return { boards, loading, error, retry: fetch, setBoards }
}

export function useBoardItems(boardId: string | undefined) {
  const [items, setItems] = useState<ScentBoardItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(() => {
    if (!boardId) {
      setItems([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    supabase
      .from('scent_board_items')
      .select('*, fragrance:fragrances(*)')
      .eq('board_id', boardId)
      .order('position', { ascending: true, nullsFirst: false })
      .order('added_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (err) setError(err.message)
        else if (data) setItems(data as ScentBoardItem[])
        setLoading(false)
      })
  }, [boardId])

  useEffect(() => { fetch() }, [fetch])

  return { items, loading, error, retry: fetch, setItems }
}

/** Create a new scent board */
export async function createBoard(userId: string, title: string, description?: string): Promise<ScentBoard | null> {
  const { data, error } = await supabase
    .from('scent_boards')
    .insert({ user_id: userId, title, description: description || null })
    .select()
    .single()
  if (error) return null
  return data as ScentBoard
}

/** Delete a scent board */
export async function deleteBoard(boardId: string): Promise<boolean> {
  // Items cascade-delete via FK or we delete manually
  await supabase.from('scent_board_items').delete().eq('board_id', boardId)
  const { error } = await supabase.from('scent_boards').delete().eq('id', boardId)
  return !error
}

/** Add a fragrance to a board */
export async function addToBoard(boardId: string, fragranceId: string, note?: string): Promise<boolean> {
  const { error } = await supabase
    .from('scent_board_items')
    .insert({ board_id: boardId, fragrance_id: fragranceId, note: note || null })
  return !error
}

/** Remove a fragrance from a board */
export async function removeFromBoard(itemId: string): Promise<boolean> {
  const { error } = await supabase.from('scent_board_items').delete().eq('id', itemId)
  return !error
}
