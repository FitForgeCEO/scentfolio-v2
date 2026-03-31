import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

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

  useEffect(() => {
    if (!userId) {
      setStats(EMPTY)
      setLoading(false)
      return
    }

    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]

    Promise.all([
      // Owned count
      supabase
        .from('user_collections')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'own'),
      // Wishlist count
      supabase
        .from('user_collections')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'wishlist'),
      // Reviews count
      supabase
        .from('reviews')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId),
      // Boards count
      supabase
        .from('scent_boards')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId),
      // This month's wears
      supabase
        .from('wear_logs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('wear_date', monthStart),
      // Last 7 days of wears for streak calc
      supabase
        .from('wear_logs')
        .select('wear_date')
        .eq('user_id', userId)
        .gte('wear_date', new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0])
        .order('wear_date', { ascending: false }),
    ]).then(([ownRes, wishRes, revRes, boardRes, monthRes, streakRes]) => {
      // Calculate streak from unique wear dates
      let streak = 0
      if (streakRes.data) {
        const uniqueDates = [...new Set(streakRes.data.map((w: { wear_date: string }) => w.wear_date))].sort().reverse()
        const today = new Date().toISOString().split('T')[0]
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

        // Streak must start from today or yesterday
        if (uniqueDates[0] === today || uniqueDates[0] === yesterday) {
          streak = 1
          for (let i = 1; i < uniqueDates.length; i++) {
            const prev = new Date(uniqueDates[i - 1] as string)
            const curr = new Date(uniqueDates[i] as string)
            const diffDays = (prev.getTime() - curr.getTime()) / 86400000
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

  return { stats, loading }
}
