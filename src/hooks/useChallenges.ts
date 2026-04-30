/**
 * Collection challenges & goals system.
 * Challenges are defined client-side with progress calculated from real Supabase data.
 * Completion state stored in user_challenges table: { user_id, challenge_id, completed_at }
 */

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

export type ChallengeCategory = 'collection' | 'wearing' | 'discovery' | 'social' | 'review'

export interface ChallengeDefinition {
  id: string
  title: string
  description: string
  icon: string
  category: ChallengeCategory
  target: number
  xpReward: number
  /** Function to fetch current progress from Supabase */
  getProgress: (userId: string) => Promise<number>
}

// ── Challenge definitions ──────────────────────────────────────────

async function countCollection(userId: string): Promise<number> {
  const { count } = await supabase.from('user_collections').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'own')
  return count ?? 0
}

async function countWears(userId: string): Promise<number> {
  const { count } = await supabase.from('wear_logs').select('id', { count: 'exact', head: true }).eq('user_id', userId)
  return count ?? 0
}

async function countReviews(userId: string): Promise<number> {
  const { count } = await supabase.from('reviews').select('id', { count: 'exact', head: true }).eq('user_id', userId)
  return count ?? 0
}

async function countUniqueWearsThisMonth(userId: string): Promise<number> {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const { data } = await supabase.from('wear_logs').select('fragrance_id').eq('user_id', userId).gte('wear_date', startOfMonth)
  if (!data) return 0
  return new Set(data.map(r => r.fragrance_id)).size
}

async function countWearStreak(userId: string): Promise<number> {
  const { data } = await supabase.from('wear_logs').select('wear_date').eq('user_id', userId).order('wear_date', { ascending: false }).limit(60)
  if (!data || data.length === 0) return 0

  const dates = [...new Set(data.map(r => r.wear_date))].sort().reverse()
  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

  if (dates[0] !== today && dates[0] !== yesterday) return 0

  let streak = 1
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1])
    const curr = new Date(dates[i])
    const diffDays = (prev.getTime() - curr.getTime()) / 86400000
    if (diffDays === 1) streak++
    else break
  }
  return streak
}

async function countFollowing(userId: string): Promise<number> {
  try {
    const { count } = await supabase.from('user_follows').select('id', { count: 'exact', head: true }).eq('follower_id', userId)
    return count ?? 0
  } catch { return 0 }
}

async function countBrands(userId: string): Promise<number> {
  const { data } = await supabase
    .from('user_collections')
    .select('fragrance:fragrances(brand)')
    .eq('user_id', userId)
    .eq('status', 'own')

  type Row = { fragrance: { brand: string } | null }
  if (!data) return 0
  const brands = new Set((data as unknown as Row[]).filter(r => r.fragrance).map(r => r.fragrance!.brand))
  return brands.size
}

async function countNoteFamilies(userId: string): Promise<number> {
  const { data } = await supabase
    .from('user_collections')
    .select('fragrance:fragrances(note_family)')
    .eq('user_id', userId)
    .eq('status', 'own')

  type Row = { fragrance: { note_family: string | null } | null }
  if (!data) return 0
  const families = new Set(
    (data as unknown as Row[])
      .filter(r => r.fragrance?.note_family)
      .map(r => r.fragrance!.note_family!)
  )
  return families.size
}

export const CHALLENGES: ChallengeDefinition[] = [
  // Collection challenges
  { id: 'coll-3', title: 'Getting Started', description: 'Add 3 fragrances to your collection', icon: 'water_drop', category: 'collection', target: 3, xpReward: 25, getProgress: countCollection },
  { id: 'coll-10', title: 'Budding Collector', description: 'Build a collection of 10 fragrances', icon: 'collections_bookmark', category: 'collection', target: 10, xpReward: 50, getProgress: countCollection },
  { id: 'coll-25', title: 'Serious Collector', description: 'Own 25 fragrances', icon: 'diamond', category: 'collection', target: 25, xpReward: 100, getProgress: countCollection },
  { id: 'coll-50', title: 'Fragrance Vault', description: 'Amass 50 fragrances', icon: 'account_balance', category: 'collection', target: 50, xpReward: 200, getProgress: countCollection },

  // Wearing challenges
  { id: 'wear-10', title: 'First Steps', description: 'Log 10 wears', icon: 'air', category: 'wearing', target: 10, xpReward: 30, getProgress: countWears },
  { id: 'wear-50', title: 'Daily Wearer', description: 'Log 50 wears', icon: 'checkroom', category: 'wearing', target: 50, xpReward: 75, getProgress: countWears },
  { id: 'wear-100', title: 'Centurion', description: 'Log 100 wears', icon: 'military_tech', category: 'wearing', target: 100, xpReward: 150, getProgress: countWears },
  { id: 'streak-7', title: 'Week Warrior', description: 'Maintain a 7-day wear streak', icon: 'local_fire_department', category: 'wearing', target: 7, xpReward: 75, getProgress: countWearStreak },
  { id: 'streak-30', title: 'Month Master', description: 'Maintain a 30-day wear streak', icon: 'whatshot', category: 'wearing', target: 30, xpReward: 300, getProgress: countWearStreak },
  { id: 'unique-5', title: 'Variety Pack', description: 'Wear 5 different fragrances this month', icon: 'shuffle', category: 'wearing', target: 5, xpReward: 40, getProgress: countUniqueWearsThisMonth },
  { id: 'unique-15', title: 'Rotation Master', description: 'Wear 15 different fragrances this month', icon: 'autorenew', category: 'wearing', target: 15, xpReward: 100, getProgress: countUniqueWearsThisMonth },

  // Discovery challenges
  { id: 'brand-5', title: 'Brand Explorer', description: 'Collect fragrances from 5 different brands', icon: 'explore', category: 'discovery', target: 5, xpReward: 40, getProgress: countBrands },
  { id: 'brand-10', title: 'Brand Connoisseur', description: 'Own fragrances from 10 different brands', icon: 'travel_explore', category: 'discovery', target: 10, xpReward: 80, getProgress: countBrands },
  { id: 'family-3', title: 'Note Novice', description: 'Explore 3 different note families', icon: 'eco', category: 'discovery', target: 3, xpReward: 30, getProgress: countNoteFamilies },
  { id: 'family-6', title: 'Nose Knows', description: 'Explore 6 different note families', icon: 'spa', category: 'discovery', target: 6, xpReward: 80, getProgress: countNoteFamilies },

  // Social challenges
  { id: 'follow-3', title: 'Social Butterfly', description: 'Follow 3 other collectors', icon: 'group_add', category: 'social', target: 3, xpReward: 25, getProgress: countFollowing },
  { id: 'follow-10', title: 'Community Builder', description: 'Follow 10 collectors', icon: 'groups', category: 'social', target: 10, xpReward: 60, getProgress: countFollowing },

  // Review challenges
  { id: 'review-1', title: 'First Words', description: 'Write your first review', icon: 'edit_note', category: 'review', target: 1, xpReward: 25, getProgress: countReviews },
  { id: 'review-5', title: 'Critic', description: 'Write 5 reviews', icon: 'rate_review', category: 'review', target: 5, xpReward: 50, getProgress: countReviews },
  { id: 'review-15', title: 'Trusted Reviewer', description: 'Write 15 reviews', icon: 'workspace_premium', category: 'review', target: 15, xpReward: 120, getProgress: countReviews },
]

// ── Challenge state interface ──────────────────────────────────────

export interface ChallengeState {
  definition: ChallengeDefinition
  progress: number
  completed: boolean
  completedAt: string | null
  claimed: boolean
}

// ── Main hook ──────────────────────────────────────────────────────

export function useChallenges() {
  const { user } = useAuth()
  const [challenges, setChallenges] = useState<ChallengeState[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    if (!user) { setLoading(false); return }

    try {
      // Fetch completed/claimed challenge IDs
      let completedMap = new Map<string, { completed_at: string; claimed: boolean }>()
      try {
        const { data: completedData } = await supabase
          .from('user_challenges')
          .select('challenge_id, completed_at, claimed')
          .eq('user_id', user.id)

        if (completedData) {
          for (const row of completedData) {
            completedMap.set(row.challenge_id, { completed_at: row.completed_at, claimed: row.claimed ?? false })
          }
        }
      } catch {
        // Table might not exist yet
      }

      // Fetch progress for all challenges in parallel
      const results = await Promise.all(
        CHALLENGES.map(async (def) => {
          const existingCompletion = completedMap.get(def.id)
          let progress: number

          if (existingCompletion) {
            // Already completed — set progress to target
            progress = def.target
          } else {
            progress = await def.getProgress(user.id)
          }

          const completed = progress >= def.target || !!existingCompletion

          // Auto-mark as completed in DB if just reached target
          if (completed && !existingCompletion) {
            try {
              await supabase.from('user_challenges').insert({
                user_id: user.id,
                challenge_id: def.id,
                completed_at: new Date().toISOString(),
                claimed: false,
              })
            } catch {
              // Table might not exist
            }
          }

          return {
            definition: def,
            progress: Math.min(progress, def.target),
            completed,
            completedAt: existingCompletion?.completed_at ?? (completed ? new Date().toISOString() : null),
            claimed: existingCompletion?.claimed ?? false,
          }
        })
      )

      setChallenges(results)
    } catch {
      // Graceful fallback
    }
    setLoading(false)
  }, [user])

  useEffect(() => { fetchAll() }, [fetchAll])

  const claimReward = useCallback(async (challengeId: string) => {
    if (!user) return false

    const challenge = challenges.find(c => c.definition.id === challengeId)
    if (!challenge || !challenge.completed || challenge.claimed) return false

    try {
      // Server-side claim_challenge RPC handles atomically:
      //   - UPDATE user_challenges SET claimed=true (rejects double-claim
      //     via WHERE claimed=false guard -- raises challenge_not_claimable)
      //   - Lookup of xpReward from server-side enum (mirrors CHALLENGES)
      //   - profiles.xp + profiles.level update
      //   - xp_ledger audit row (action = 'CHALLENGE:<id>')
      // Direct profiles UPDATE was revoked at column-level on 27 April;
      // this path is now the only way to claim a challenge reward.
      const { error } = await supabase.rpc('claim_challenge', { p_challenge_id: challengeId })
      if (error) return false

      // Update local state
      setChallenges(prev =>
        prev.map(c =>
          c.definition.id === challengeId ? { ...c, claimed: true } : c
        )
      )

      return true
    } catch {
      return false
    }
  }, [user, challenges])

  return { challenges, loading, refetch: fetchAll, claimReward }
}

/** Convenience: get summary stats */
export function useChallengeSummary() {
  const { challenges, loading } = useChallenges()

  const total = challenges.length
  const completed = challenges.filter(c => c.completed).length
  const unclaimed = challenges.filter(c => c.completed && !c.claimed).length
  const activeInProgress = challenges.filter(c => !c.completed && c.progress > 0)
    .sort((a, b) => (b.progress / b.definition.target) - (a.progress / a.definition.target))

  return { total, completed, unclaimed, activeInProgress, loading, challenges }
}
