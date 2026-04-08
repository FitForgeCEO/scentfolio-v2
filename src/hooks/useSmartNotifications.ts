/**
 * Hook that auto-generates contextual in-app notifications
 * based on the user's collection and activity data.
 * Call once at app level (e.g. HomeScreen) — it runs checks on mount.
 */

import { useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import {
  generateWelcomeNotification,
  generateStreakNotification,
  generateCollectionMilestone,
  generateDailyTip,
} from '@/lib/notificationStore'

export function useSmartNotifications(): void {
  const { user } = useAuth()

  useEffect(() => {
    if (!user) return

    // Always generate a daily tip
    generateDailyTip()

    const run = async () => {
      // Check collection size for milestones
      const { count: collectionCount } = await supabase
        .from('user_collections')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'own')

      if (collectionCount !== null) {
        if (collectionCount === 0) {
          generateWelcomeNotification()
        } else {
          generateCollectionMilestone(collectionCount)
        }
      }

      // Check wear streak
      const { data: recentWears } = await supabase
        .from('wear_logs')
        .select('wear_date')
        .eq('user_id', user.id)
        .order('wear_date', { ascending: false })
        .limit(400)

      if (recentWears && recentWears.length > 0) {
        const streak = calculateStreak(recentWears.map((w) => w.wear_date))
        generateStreakNotification(streak)
      }
    }

    run()
  }, [user])
}

/** Calculate consecutive days of wear ending today or yesterday */
function calculateStreak(dates: string[]): number {
  if (dates.length === 0) return 0

  const unique = [...new Set(dates)].sort().reverse()
  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)

  // Streak must include today or yesterday
  if (unique[0] !== today && unique[0] !== yesterday) return 0

  let streak = 1
  for (let i = 1; i < unique.length; i++) {
    const prev = new Date(unique[i - 1])
    const curr = new Date(unique[i])
    const diffDays = (prev.getTime() - curr.getTime()) / 86400000
    if (Math.round(diffDays) === 1) {
      streak++
    } else {
      break
    }
  }
  return streak
}
