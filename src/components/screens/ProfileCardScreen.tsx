import { useState, useEffect, useRef } from 'react'
import { Icon } from '../ui/Icon'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { supabase } from '@/lib/supabase'
import { getLevelTitle } from '@/lib/xp'
import type { Profile } from '@/types/database'

interface ProfileStats {
  owned: number
  wishlist: number
  wears: number
  reviews: number
  topBrands: string[]
  topFamilies: string[]
  topThree: { name: string; brand: string; image_url: string | null }[]
  level: number
  memberSince: string
}

export function ProfileCardScreen() {
  const { user } = useAuth()
  const toast = useToast()
  const cardRef = useRef<HTMLDivElement>(null)
  const [stats, setStats] = useState<ProfileStats | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [sharing, setSharing] = useState(false)

  useEffect(() => {
    if (!user) { setLoading(false); return }

    async function fetchData() {
      const [profileRes, ownedRes, wishRes, wearsRes, reviewsRes, collRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user!.id).single(),
        supabase.from('user_collections').select('id', { count: 'exact', head: true }).eq('user_id', user!.id).eq('status', 'own'),
        supabase.from('user_collections').select('id', { count: 'exact', head: true }).eq('user_id', user!.id).eq('status', 'wishlist'),
        supabase.from('wear_logs').select('id', { count: 'exact', head: true }).eq('user_id', user!.id),
        supabase.from('reviews').select('id', { count: 'exact', head: true }).eq('user_id', user!.id),
        supabase.from('user_collections').select('personal_rating, fragrance:fragrances(name, brand, image_url, note_family)').eq('user_id', user!.id).eq('status', 'own'),
      ])

      if (profileRes.data) setProfile(profileRes.data as Profile)

      type CollRow = { personal_rating: number | null; fragrance: { name: string; brand: string; image_url: string | null; note_family: string | null } | null }
      const coll = (collRes.data ?? []) as unknown as CollRow[]

      // Top brands
      const brandMap = new Map<string, number>()
      const familyMap = new Map<string, number>()
      coll.forEach((c) => {
        if (c.fragrance?.brand) brandMap.set(c.fragrance.brand, (brandMap.get(c.fragrance.brand) ?? 0) + 1)
        if (c.fragrance?.note_family) familyMap.set(c.fragrance.note_family, (familyMap.get(c.fragrance.note_family) ?? 0) + 1)
      })

      // Top 3 rated
      const rated = coll
        .filter((c) => c.personal_rating && c.fragrance)
        .sort((a, b) => (b.personal_rating ?? 0) - (a.personal_rating ?? 0))
        .slice(0, 3)
        .map((c) => ({ name: c.fragrance!.name, brand: c.fragrance!.brand, image_url: c.fragrance!.image_url }))

      setStats({
        owned: ownedRes.count ?? 0,
        wishlist: wishRes.count ?? 0,
        wears: wearsRes.count ?? 0,
        reviews: reviewsRes.count ?? 0,
        topBrands: [...brandMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([b]) => b),
        topFamilies: [...familyMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([f]) => f),
        topThree: rated,
        level: profileRes.data?.level ?? 1,
        memberSince: profileRes.data?.created_at ?? new Date().toISOString(),
      })
      setLoading(false)
    }

    fetchData()
  }, [user])

  const handleShare = async () => {
    if (!cardRef.current) return
    setSharing(true)
    try {
      const { toBlob } = await import('html-to-image')
      const blob = await toBlob(cardRef.current, {
        backgroundColor: '#191210',
        pixelRatio: 2,
      })
      if (!blob) throw new Error('Failed to generate image')

      if (navigator.share && navigator.canShare?.({ files: [new File([blob], 'profile.png')] })) {
        await navigator.share({
          files: [new File([blob], 'scentfolio-profile.png', { type: 'image/png' })],
          title: 'My ScentFolio Profile',
        })
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'scentfolio-profile.png'
        a.click()
        URL.revokeObjectURL(url)
        toast.showToast('Profile card saved', 'success')
      }
    } catch {
      toast.showToast('Could not share profile', 'error')
    }
    setSharing(false)
  }

  const handleCopyLink = () => {
    const text = profile
      ? `Check out my ScentFolio profile! ${stats?.owned ?? 0} fragrances collected. Level ${stats?.level ?? 1} — ${getLevelTitle(stats?.level ?? 1)}`
      : 'Check out ScentFolio — the Letterboxd for fragrance lovers!'
    navigator.clipboard.writeText(text)
    toast.showToast('Copied to clipboard', 'success')
  }

  if (!user) {
    return (
      <main className="pt-24 pb-32 px-6 flex flex-col items-center justify-center min-h-screen gap-4">
        <Icon name="badge" className="text-5xl text-primary/30" />
        <p className="text-secondary/60 text-sm">Sign in to create your profile card</p>
      </main>
    )
  }

  if (loading || !stats) {
    return (
      <main className="pt-24 pb-32 px-6 flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </main>
    )
  }

  const displayName = profile?.display_name || 'Fragrance Lover'
  const joined = new Date(stats.memberSince).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  return (
    <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen">
      {/* Shareable Card */}
      <div
        ref={cardRef}
        className="rounded-2xl overflow-hidden mb-6"
        style={{ background: 'linear-gradient(135deg, #191210 0%, #2a1f1a 50%, #191210 100%)' }}
      >
        <div className="p-6 space-y-5">
          {/* Header */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
              ) : (
                <span className="font-headline text-2xl text-primary">{displayName[0]?.toUpperCase()}</span>
              )}
            </div>
            <div>
              <h2 className="font-headline text-xl text-white">{displayName}</h2>
              <p className="text-[10px] text-white/40">Level {stats.level} · {getLevelTitle(stats.level)}</p>
              <p className="text-[9px] text-white/30">Member since {joined}</p>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Owned', value: stats.owned },
              { label: 'Wishlist', value: stats.wishlist },
              { label: 'Wears', value: stats.wears },
              { label: 'Reviews', value: stats.reviews },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <p className="font-headline text-lg text-primary">{s.value}</p>
                <p className="text-[8px] text-white/40 uppercase tracking-wider">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Top 3 Fragrances */}
          {stats.topThree.length > 0 && (
            <div className="space-y-2">
              <p className="text-[9px] uppercase tracking-[0.15em] text-white/30 font-bold">TOP RATED</p>
              <div className="flex gap-2">
                {stats.topThree.map((f, i) => (
                  <div key={i} className="flex-1 bg-white/5 rounded-lg p-2.5 text-center">
                    <div className="w-10 h-10 mx-auto rounded-lg overflow-hidden bg-white/5 mb-1.5">
                      {f.image_url ? (
                        <img src={f.image_url} alt={f.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-white/20 text-xs">#{i + 1}</span>
                        </div>
                      )}
                    </div>
                    <p className="text-[8px] text-white/40 truncate">{f.brand}</p>
                    <p className="text-[9px] text-white/70 font-medium truncate">{f.name}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Taste Profile */}
          <div className="flex gap-4">
            {stats.topBrands.length > 0 && (
              <div className="flex-1">
                <p className="text-[9px] uppercase tracking-[0.15em] text-white/30 font-bold mb-1">TOP BRANDS</p>
                {stats.topBrands.map((b) => (
                  <p key={b} className="text-[10px] text-white/60">{b}</p>
                ))}
              </div>
            )}
            {stats.topFamilies.length > 0 && (
              <div className="flex-1">
                <p className="text-[9px] uppercase tracking-[0.15em] text-white/30 font-bold mb-1">TOP FAMILIES</p>
                {stats.topFamilies.map((f) => (
                  <p key={f} className="text-[10px] text-white/60">{f}</p>
                ))}
              </div>
            )}
          </div>

          {/* Watermark */}
          <div className="flex items-center justify-center gap-1.5 pt-2">
            <Icon name="water_drop" className="text-primary/40" size={12} />
            <span className="text-[8px] text-white/20 tracking-widest uppercase">ScentFolio</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleShare}
          disabled={sharing}
          className="flex-1 gold-gradient text-on-primary-container py-3.5 rounded-xl font-label text-[10px] font-bold uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Icon name="share" size={16} />
          {sharing ? 'GENERATING...' : 'SHARE CARD'}
        </button>
        <button
          onClick={handleCopyLink}
          className="bg-surface-container text-on-surface py-3.5 px-5 rounded-xl font-label text-[10px] font-bold uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <Icon name="content_copy" size={16} />
          COPY
        </button>
      </div>
    </main>
  )
}
