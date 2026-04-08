/**
 * User blocking hooks.
 * Uses the user_blocks table: { blocker_id, blocked_id, created_at }
 * Falls back gracefully if table doesn't exist yet.
 */

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

/** Check if current user has blocked a target user */
export function useIsBlocked(targetUserId: string | undefined) {
  const { user } = useAuth()
  const [blocked, setBlocked] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user || !targetUserId || user.id === targetUserId) {
      setLoading(false)
      return
    }

    const check = async () => {
      try {
        const { data } = await supabase
          .from('user_blocks')
          .select('id')
          .eq('blocker_id', user.id)
          .eq('blocked_id', targetUserId)
          .maybeSingle()
        setBlocked(!!data)
      } catch {
        // Table might not exist
      }
      setLoading(false)
    }

    check()
  }, [user, targetUserId])

  const toggleBlock = useCallback(async () => {
    if (!user || !targetUserId) return
    try {
      if (blocked) {
        await supabase
          .from('user_blocks')
          .delete()
          .eq('blocker_id', user.id)
          .eq('blocked_id', targetUserId)
        setBlocked(false)
      } else {
        await supabase
          .from('user_blocks')
          .insert({ blocker_id: user.id, blocked_id: targetUserId })
        setBlocked(true)

        // Also unfollow if following
        await supabase
          .from('user_follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', targetUserId)
      }
    } catch {
      // Graceful fallback
    }
  }, [user, targetUserId, blocked])

  return { blocked, loading, toggleBlock }
}

/** Get all blocked user IDs for filtering feeds */
export function useBlockedUserIds() {
  const { user } = useAuth()
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!user) return

    const fetch = async () => {
      try {
        const { data } = await supabase
          .from('user_blocks')
          .select('blocked_id')
          .eq('blocker_id', user.id)

        if (data) {
          setBlockedIds(new Set(data.map(r => r.blocked_id)))
        }
      } catch {
        // Table might not exist
      }
    }

    fetch()
  }, [user])

  return blockedIds
}

export interface BlockedUser {
  id: string
  display_name: string
  avatar_url: string | null
  blocked_at: string
}

/** Get list of blocked users with profiles */
export function useBlockedUsers() {
  const { user } = useAuth()
  const [users, setUsers] = useState<BlockedUser[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!user) { setLoading(false); return }
    try {
      const { data } = await supabase
        .from('user_blocks')
        .select('blocked_id, created_at, profile:profiles!user_blocks_blocked_id_fkey(id, display_name, avatar_url)')
        .eq('blocker_id', user.id)
        .order('created_at', { ascending: false })

      type Row = { blocked_id: string; created_at: string; profile: { id: string; display_name: string; avatar_url: string | null } | null }
      if (data) {
        setUsers(
          (data as unknown as Row[])
            .filter(r => r.profile)
            .map(r => ({
              id: r.profile!.id,
              display_name: r.profile!.display_name,
              avatar_url: r.profile!.avatar_url,
              blocked_at: r.created_at,
            }))
        )
      }
    } catch {
      // Table might not exist
    }
    setLoading(false)
  }, [user])

  useEffect(() => { fetch() }, [fetch])

  const unblock = useCallback(async (targetId: string) => {
    if (!user) return
    try {
      await supabase
        .from('user_blocks')
        .delete()
        .eq('blocker_id', user.id)
        .eq('blocked_id', targetId)
      setUsers(prev => prev.filter(u => u.id !== targetId))
    } catch {
      // Graceful fallback
    }
  }, [user])

  return { users, loading, unblock, refetch: fetch }
}
