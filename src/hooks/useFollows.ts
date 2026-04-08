/**
 * Social follow system hooks.
 * Uses the user_follows table: { follower_id, following_id, created_at }
 * Falls back gracefully if table doesn't exist yet (returns empty data).
 */

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

interface FollowUser {
  id: string
  display_name: string
  avatar_url: string | null
  level: number
}

/** Check if current user follows a target user */
export function useIsFollowing(targetUserId: string | undefined) {
  const { user } = useAuth()
  const [following, setFollowing] = useState(false)
  const [loading, setLoading] = useState(true)

  const check = useCallback(async () => {
    if (!user || !targetUserId || user.id === targetUserId) {
      setLoading(false)
      return
    }
    try {
      const { data } = await supabase
        .from('user_follows')
        .select('id')
        .eq('follower_id', user.id)
        .eq('following_id', targetUserId)
        .maybeSingle()
      setFollowing(!!data)
    } catch {
      // Table might not exist yet
    }
    setLoading(false)
  }, [user, targetUserId])

  useEffect(() => { check() }, [check])

  const toggleFollow = useCallback(async () => {
    if (!user || !targetUserId) return
    if (following) {
      await supabase
        .from('user_follows')
        .delete()
        .eq('follower_id', user.id)
        .eq('following_id', targetUserId)
      setFollowing(false)
    } else {
      await supabase
        .from('user_follows')
        .insert({ follower_id: user.id, following_id: targetUserId })
      setFollowing(true)
    }
  }, [user, targetUserId, following])

  return { following, loading, toggleFollow }
}

/** Get follower/following counts for a user */
export function useFollowCounts(userId: string | undefined) {
  const [followers, setFollowers] = useState(0)
  const [following, setFollowing] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) { setLoading(false); return }

    const fetch = async () => {
      try {
        const [followersRes, followingRes] = await Promise.all([
          supabase.from('user_follows').select('id', { count: 'exact', head: true }).eq('following_id', userId),
          supabase.from('user_follows').select('id', { count: 'exact', head: true }).eq('follower_id', userId),
        ])
        setFollowers(followersRes.count ?? 0)
        setFollowing(followingRes.count ?? 0)
      } catch {
        // Table might not exist
      }
      setLoading(false)
    }

    fetch()
  }, [userId])

  return { followers, following, loading }
}

/** Get list of followers or following users */
export function useFollowList(userId: string | undefined, type: 'followers' | 'following') {
  const [users, setUsers] = useState<FollowUser[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) { setLoading(false); return }

    const fetch = async () => {
      try {
        if (type === 'followers') {
          const { data } = await supabase
            .from('user_follows')
            .select('follower:profiles!user_follows_follower_id_fkey(id, display_name, avatar_url, level)')
            .eq('following_id', userId)
            .order('created_at', { ascending: false })
            .limit(100)

          type Row = { follower: FollowUser | null }
          if (data) {
            setUsers((data as unknown as Row[]).filter(r => r.follower).map(r => r.follower!))
          }
        } else {
          const { data } = await supabase
            .from('user_follows')
            .select('following:profiles!user_follows_following_id_fkey(id, display_name, avatar_url, level)')
            .eq('follower_id', userId)
            .order('created_at', { ascending: false })
            .limit(100)

          type Row = { following: FollowUser | null }
          if (data) {
            setUsers((data as unknown as Row[]).filter(r => r.following).map(r => r.following!))
          }
        }
      } catch {
        // Table might not exist
      }
      setLoading(false)
    }

    fetch()
  }, [userId, type])

  return { users, loading }
}

/** Get activity feed from followed users */
export function useFollowedActivity(limit = 30) {
  const { user } = useAuth()
  const [items, setItems] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { setLoading(false); return }

    const fetch = async () => {
      try {
        // Get followed user IDs
        const { data: follows } = await supabase
          .from('user_follows')
          .select('following_id')
          .eq('follower_id', user.id)

        if (!follows || follows.length === 0) {
          setLoading(false)
          return
        }

        const followedIds = follows.map(f => f.following_id)
        const feedItems: FeedItem[] = []

        // Fetch recent wears from followed users
        const { data: wears } = await supabase
          .from('wear_logs')
          .select('id, wear_date, created_at, user_id, fragrance:fragrances(name, brand, image_url), profile:profiles!wear_logs_user_id_fkey(display_name, avatar_url)')
          .in('user_id', followedIds)
          .order('created_at', { ascending: false })
          .limit(limit)

        type WearRow = {
          id: string; wear_date: string; created_at: string; user_id: string
          fragrance: { name: string; brand: string; image_url: string | null } | null
          profile: { display_name: string; avatar_url: string | null } | null
        }

        if (wears) {
          for (const w of wears as unknown as WearRow[]) {
            if (!w.fragrance || !w.profile) continue
            feedItems.push({
              id: `wear-${w.id}`,
              type: 'wear',
              userId: w.user_id,
              userName: w.profile.display_name,
              userAvatar: w.profile.avatar_url,
              title: `wore ${w.fragrance.name}`,
              subtitle: w.fragrance.brand,
              imageUrl: w.fragrance.image_url,
              timestamp: w.created_at,
            })
          }
        }

        // Fetch recent reviews from followed users
        const { data: reviews } = await supabase
          .from('reviews')
          .select('id, overall_rating, created_at, user_id, fragrance:fragrances(name, brand, image_url), profile:profiles!reviews_user_id_fkey(display_name, avatar_url)')
          .in('user_id', followedIds)
          .order('created_at', { ascending: false })
          .limit(limit)

        type ReviewRow = {
          id: string; overall_rating: number; created_at: string; user_id: string
          fragrance: { name: string; brand: string; image_url: string | null } | null
          profile: { display_name: string; avatar_url: string | null } | null
        }

        if (reviews) {
          for (const r of reviews as unknown as ReviewRow[]) {
            if (!r.fragrance || !r.profile) continue
            feedItems.push({
              id: `review-${r.id}`,
              type: 'review',
              userId: r.user_id,
              userName: r.profile.display_name,
              userAvatar: r.profile.avatar_url,
              title: `reviewed ${r.fragrance.name}`,
              subtitle: `${r.overall_rating}/5 — ${r.fragrance.brand}`,
              imageUrl: r.fragrance.image_url,
              timestamp: r.created_at,
            })
          }
        }

        // Sort all by timestamp
        feedItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        setItems(feedItems.slice(0, limit))
      } catch {
        // Table might not exist
      }
      setLoading(false)
    }

    fetch()
  }, [user, limit])

  return { items, loading }
}

export interface FeedItem {
  id: string
  type: 'wear' | 'review' | 'collection_add'
  userId: string
  userName: string
  userAvatar: string | null
  title: string
  subtitle: string
  imageUrl: string | null
  timestamp: string
}
