import { useState, useEffect } from 'react'
import { Icon } from '../ui/Icon'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

interface StreakData {
  currentStreak: number
  longestStreak: number
  totalWears: number
  last7Days: boolean[] // [today, yesterday, ... 6 days ago]
  todayLogged: boolean
}

export function WearStreakWidget() {
  const { user } = useAuth()
  const [streak, setStreak] = useState<StreakData | null>(null)

  useEffect(() => {
    if (!user) return

    async function computeStreak() {
      // Fetch last 90 days of wear logs
      const cutoff = new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0]
      const { data } = await supabase
        .from('wear_logs')
        .select('wear_date')
        .eq('user_id', user!.id)
        .gte('wear_date', cutoff)
        .order('wear_date', { ascending: false })

      type Row = { wear_date: string }
      const rows = (data ?? []) as Row[]

      // Get unique dates
      const uniqueDates = new Set(rows.map((r) => r.wear_date))
      const today = new Date().toISOString().split('T')[0]

      // Current streak
      let currentStreak = 0
      const checkDate = new Date()
      // Start from today
      while (true) {
        const dateStr = checkDate.toISOString().split('T')[0]
        if (uniqueDates.has(dateStr)) {
          currentStreak++
          checkDate.setDate(checkDate.getDate() - 1)
        } else if (currentStreak === 0) {
          // If today has no wear, check if yesterday started a streak
          checkDate.setDate(checkDate.getDate() - 1)
          const yesterdayStr = checkDate.toISOString().split('T')[0]
          if (uniqueDates.has(yesterdayStr)) {
            currentStreak++
            checkDate.setDate(checkDate.getDate() - 1)
            continue
          }
          break
        } else {
          break
        }
      }

      // Longest streak (simple computation)
      const sortedDates = [...uniqueDates].sort()
      let longestStreak = 0
      let tempStreak = 1
      for (let i = 1; i < sortedDates.length; i++) {
        const prev = new Date(sortedDates[i - 1])
        const curr = new Date(sortedDates[i])
        const diffDays = (curr.getTime() - prev.getTime()) / 86400000
        if (diffDays === 1) {
          tempStreak++
        } else {
          longestStreak = Math.max(longestStreak, tempStreak)
          tempStreak = 1
        }
      }
      longestStreak = Math.max(longestStreak, tempStreak)
      if (sortedDates.length === 0) longestStreak = 0

      // Last 7 days
      const last7Days: boolean[] = []
      for (let i = 0; i < 7; i++) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        last7Days.push(uniqueDates.has(d.toISOString().split('T')[0]))
      }

      setStreak({
        currentStreak,
        longestStreak,
        totalWears: rows.length,
        last7Days,
        todayLogged: uniqueDates.has(today),
      })
    }

    computeStreak()
  }, [user])

  if (!user || !streak) return null

  const dayNames = (() => {
    const names: string[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      names.push(d.toLocaleDateString('en', { weekday: 'short' }).charAt(0))
    }
    return names
  })()

  return (
    <div className="bg-surface-container rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon name="local_fire_department" filled className="text-primary" size={18} />
          <span className="text-xs font-bold text-on-surface">Wear Streak</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="font-headline text-2xl text-primary">{streak.currentStreak}</span>
          <span className="text-[9px] text-secondary/40">day{streak.currentStreak !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* 7-day dots */}
      <div className="flex items-center justify-between mb-3">
        {streak.last7Days.map((active, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                active
                  ? 'bg-primary/20'
                  : i === 0
                    ? 'bg-surface-container-low border-2 border-dashed border-primary/30'
                    : 'bg-surface-container-low'
              }`}
            >
              {active ? (
                <Icon name="local_fire_department" filled className="text-primary" size={14} />
              ) : i === 0 ? (
                <Icon name="add" className="text-primary/40" size={12} />
              ) : (
                <span className="w-1.5 h-1.5 rounded-full bg-secondary/20" />
              )}
            </div>
            <span className="text-[8px] text-secondary/40">{dayNames[i]}</span>
          </div>
        ))}
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-between pt-2 border-t border-outline-variant/10">
        <div className="text-center">
          <p className="text-xs font-bold text-on-surface">{streak.longestStreak}</p>
          <p className="text-[8px] text-secondary/40">Best Streak</p>
        </div>
        <div className="text-center">
          <p className="text-xs font-bold text-on-surface">{streak.totalWears}</p>
          <p className="text-[8px] text-secondary/40">Total Wears</p>
        </div>
        {!streak.todayLogged && (
          <div className="bg-primary/10 px-2.5 py-1 rounded-full">
            <p className="text-[9px] text-primary font-bold">Log today!</p>
          </div>
        )}
      </div>
    </div>
  )
}
