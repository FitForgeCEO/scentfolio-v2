import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export interface ProfileExtras {
  bio: string
  signature_fragrance_id: string | null
  favorite_notes: string[]
}

const DEFAULTS: ProfileExtras = {
  bio: '',
  signature_fragrance_id: null,
  favorite_notes: [],
}

const STORAGE_PREFIX = 'scentfolio-profile-extras-'

/** localStorage key for a given user */
function storageKey(userId: string) {
  return `${STORAGE_PREFIX}${userId}`
}

function readLocal(userId: string): ProfileExtras {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) return { ...DEFAULTS }
    return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULTS }
  }
}

function writeLocal(userId: string, extras: ProfileExtras) {
  localStorage.setItem(storageKey(userId), JSON.stringify(extras))
}

/**
 * Attempt to read/write profile extras from Supabase `profile_extras` table.
 * Falls back to localStorage if table doesn't exist.
 */
async function readSupabase(userId: string): Promise<ProfileExtras | null> {
  try {
    const { data, error } = await supabase
      .from('profile_extras')
      .select('bio, signature_fragrance_id, favorite_notes')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) return null
    if (!data) return null

    return {
      bio: (data as any).bio ?? '',
      signature_fragrance_id: (data as any).signature_fragrance_id ?? null,
      favorite_notes: (data as any).favorite_notes ?? [],
    }
  } catch {
    return null
  }
}

async function writeSupabase(userId: string, extras: ProfileExtras): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('profile_extras')
      .upsert({
        user_id: userId,
        bio: extras.bio,
        signature_fragrance_id: extras.signature_fragrance_id,
        favorite_notes: extras.favorite_notes,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

    return !error
  } catch {
    return false
  }
}

/**
 * Hook to read/save profile extras (bio, signature scent, favourite notes).
 * Tries Supabase first, falls back to localStorage.
 */
export function useProfileExtras(userId: string | undefined) {
  const [data, setData] = useState<ProfileExtras>(() => {
    if (!userId) return { ...DEFAULTS }
    return readLocal(userId)
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!userId) { setLoading(false); return }

    // Try Supabase, fall back to localStorage
    readSupabase(userId).then((remote) => {
      if (remote) {
        setData(remote)
        writeLocal(userId, remote) // sync to local
      } else {
        setData(readLocal(userId))
      }
      setLoading(false)
    })
  }, [userId])

  const save = useCallback(async (updates: Partial<ProfileExtras>) => {
    if (!userId) return
    setSaving(true)

    const merged: ProfileExtras = { ...data, ...updates }
    setData(merged) // optimistic

    // Try Supabase, always save locally
    writeLocal(userId, merged)
    await writeSupabase(userId, merged)

    setSaving(false)
  }, [userId, data])

  return { data, loading, saving, save }
}

/**
 * Read-only hook for viewing another user's profile extras (public profile).
 */
export function usePublicProfileExtras(userId: string | undefined) {
  const [data, setData] = useState<ProfileExtras | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) { setLoading(false); return }

    readSupabase(userId).then((remote) => {
      setData(remote)
      setLoading(false)
    })
  }, [userId])

  return { data, loading }
}

/**
 * Hook to get the signature fragrance details for display.
 */
export function useSignatureFragrance(fragranceId: string | null) {
  const [fragrance, setFragrance] = useState<{
    id: string; name: string; brand: string; image_url: string | null
  } | null>(null)

  useEffect(() => {
    if (!fragranceId) { setFragrance(null); return }

    supabase
      .from('fragrances')
      .select('id, name, brand, image_url')
      .eq('id', fragranceId)
      .single()
      .then(({ data }) => {
        if (data) setFragrance(data as any)
      })
  }, [fragranceId])

  return fragrance
}
