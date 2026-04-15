import { supabase } from './supabase'

/**
 * XP thresholds per level.
 * Level 1 → 2 requires 100 XP, scaling gently so it stays achievable solo.
 */
const LEVEL_THRESHOLDS = [
  0,     // Level 1 (start)
  100,   // Level 2
  250,   // Level 3
  500,   // Level 4
  850,   // Level 5
  1300,  // Level 6
  1900,  // Level 7
  2600,  // Level 8
  3500,  // Level 9
  4600,  // Level 10
  6000,  // Level 11
  7800,  // Level 12
  10000, // Level 13
  13000, // Level 14
  17000, // Level 15 (cap for now)
]

const MAX_LEVEL = LEVEL_THRESHOLDS.length

/** XP awards by action */
export const XP_AWARDS = {
  LOG_WEAR: 10,
  WRITE_REVIEW: 25,
  ADD_TO_COLLECTION: 5,
  PROMOTE_TO_OWNED: 10,   // Wishlist → owned: doubles the standard add reward
  FIRST_WEAR: 20,         // Bonus for very first wear log
  STREAK_3: 30,
  STREAK_7: 75,
  STREAK_14: 150,
  STREAK_30: 300,
} as const

export type XPAction = keyof typeof XP_AWARDS

/** Calculate level from total XP */
export function getLevelFromXP(xp: number): number {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) return i + 1
  }
  return 1
}

/** Get XP needed for next level */
export function getXPForNextLevel(level: number): number {
  if (level >= MAX_LEVEL) return LEVEL_THRESHOLDS[MAX_LEVEL - 1]
  return LEVEL_THRESHOLDS[level] // level is 1-indexed, threshold[level] is next level's requirement
}

/** Get XP needed for current level (floor) */
export function getXPForCurrentLevel(level: number): number {
  if (level <= 1) return 0
  return LEVEL_THRESHOLDS[level - 1]
}

/** Calculate progress percentage within current level (0–100) */
export function getLevelProgress(xp: number, level: number): number {
  if (level >= MAX_LEVEL) return 100
  const currentFloor = getXPForCurrentLevel(level)
  const nextCeiling = getXPForNextLevel(level)
  const range = nextCeiling - currentFloor
  if (range <= 0) return 100
  return Math.min(100, Math.round(((xp - currentFloor) / range) * 100))
}

/** Level title based on level number */
export function getLevelTitle(level: number): string {
  if (level <= 2) return 'Newcomer'
  if (level <= 4) return 'Enthusiast'
  if (level <= 6) return 'Collector'
  if (level <= 8) return 'Connoisseur'
  if (level <= 10) return 'Expert'
  if (level <= 12) return 'Aficionado'
  return 'Legend'
}

/** Award XP to a user — updates xp and recalculates level in Supabase */
export async function awardXP(userId: string, action: XPAction): Promise<{ newXP: number; newLevel: number; leveledUp: boolean } | null> {
  const amount = XP_AWARDS[action]

  // Fetch current profile
  const { data: profile, error: fetchError } = await supabase
    .from('profiles')
    .select('xp, level')
    .eq('id', userId)
    .single()

  if (fetchError || !profile) return null

  const newXP = profile.xp + amount
  const newLevel = getLevelFromXP(newXP)
  const leveledUp = newLevel > profile.level

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ xp: newXP, level: newLevel, updated_at: new Date().toISOString() })
    .eq('id', userId)

  if (updateError) return null

  return { newXP, newLevel, leveledUp }
}
