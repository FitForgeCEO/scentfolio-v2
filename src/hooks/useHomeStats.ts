import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

const ONE_DAY_MS = 86_400_000

interface HomeStats {
  owned: number
  wishlist: number
  reviews: number
  boards: number
  monthWears: number
  streak: number
}

const EMPTY: HomeStats = { owned: 0, wishlist: 0, reviews: 0, boards: 0, monthWears: 0, streak: 0 }

export function useHomeStats(userId: string | undefined) {
  const [stats, setStats] = useState<HomeStats>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(() => {
    if (!userId) {
      setStats(EMPTY)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]

    Promise.all([
      supabase
        .from('user_collections')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'own'),
      supabase
        .from('user_collections')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'wishlist'),
      supabase
        .from('reviews')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId),
      supabase
        .from('scent_boards')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId),
      supabase
        .from('wear_logs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('wear_date', monthStart),
      supabase
        .from('wear_logs')
        .select('wear_date')
        .eq('user_id', userId)
        .gte('wear_date', new Date(Date.now() - 7 * ONE_DAY_MS).toISOString().split('T')[0])
        .order('wear_date', { ascending: false }),
    ]).then(([ownRes, wishRes, revRes, boardRes, monthRes, streakRes]) => {
      // Check for any errors
      const firstError = [ownRes, wishRes, revRes, boardRes, monthRes, streakRes].find((r) => r.error)
      if (firstError?.error) {
        setError(firstError.error.message)
        setLoading(false)
        return
      }

      // Calculate streak from unique wear dates
      let streak = 0
      if (streakRes.data) {
        const uniqueDates = [...new Set(streakRes.data.map((w: { wear_date: string }) => w.wear_date))].sort().reverse()
        const today = new Date().toISOString().split('T')[0]
        const yesterday = new Date(Date.now() - ONE_DAY_MS).toISOString().split('T')[0]

        if (uniqueDates[0] === today || uniqueDates[0] === yesterday) {
          streak = 1
          for (let i = 1; i < uniqueDates.length; i++) {
            const prev = new Date(uniqueDates[i - 1] as string)
            const curr = new Date(uniqueDates[i] as string)
            const diffDays = (prev.getTime() - curr.getTime()) / ONE_DAY_MS
            if (diffDays === 1) streak++
            else break
          }
        }
      }

      setStats({
        owned: ownRes.count ?? 0,
        wishlist: wishRes.count ?? 0,
        reviews: revRes.count ?? 0,
        boards: boardRes.count ?? 0,
        monthWears: monthRes.count ?? 0,
        streak,
      })
      setLoading(false)
    })
  }, [userId])

  useEffect(() => { fetch() }, [fetch])

  return { stats, loading, error, retry: fetch }
}
