import { useState, useEffect, useRef, Fragment } from 'react'
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

// ── Noir editorial calibration: "The Collector Card" ──
// A shareable 9:16 portrait card in the Digital Sommelier voice.
// Typography is the hero; the masthead name is set at 3.5rem Noto Serif.
// No borders — only Ambient Lifts, ghost hairlines, and tonal shifts.

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function formatEst(iso: string): string {
  const d = new Date(iso)
  return MONTHS[d.getMonth()] + ' ' + d.getFullYear()
}

function deriveMemberNumber(userId: string | undefined): string {
  if (!userId) return '00001'
  // Take the first 5 alphanumeric characters of the user id, uppercased.
  // This gives every collector a stable, distinctive member number
  // without exposing the full uuid.
  const stripped = userId.replace(/-/g, '').toUpperCase()
  return stripped.slice(0, 5) || '00001'
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

      const brandMap = new Map<string, number>()
      const familyMap = new Map<string, number>()
      coll.forEach((c) => {
        if (c.fragrance?.brand) brandMap.set(c.fragrance.brand, (brandMap.get(c.fragrance.brand) ?? 0) + 1)
        if (c.fragrance?.note_family) familyMap.set(c.fragrance.note_family, (familyMap.get(c.fragrance.note_family) ?? 0) + 1)
      })

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
        <span className="text-5xl text-primary/30">?</span>
        <p className="text-secondary/60 text-sm">Sign in to create your collector card</p>
      </main>
    )
  }

  if (loading || !stats) {
    return (
      <main className="pt-24 pb-32 px-6 flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-1.5">{[1,2,3].map(i => <div key={i} className="h-1 rounded-sm bg-primary/20 animate-pulse" style={{ width: `${60 - i * 14}px` }} />)}</div>
      </main>
    )
  }

  const displayName = profile?.display_name || 'Collector'
  const joined = formatEst(stats.memberSince)
  const memberNo = deriveMemberNumber(user?.id)
  const stat4 = [
    { label: 'OWNED', value: stats.owned },
    { label: 'WORN', value: stats.wears },
    { label: 'RATED', value: stats.reviews },
    { label: 'WISHLIST', value: stats.wishlist },
  ]

  return (
    <main className="relative pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen">
      {/* Decorative ambient glow — lives behind the card, never interacts */}
      <div className="absolute inset-0 -z-10 opacity-30 pointer-events-none overflow-hidden">
        <div className="absolute top-[10%] left-[20%] w-64 h-64 bg-primary/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[20%] right-[10%] w-80 h-80 bg-surface-container-highest/20 rounded-full blur-[140px]" />
      </div>

      {/* Chapter label — the app shell owns top chrome so this sits inline */}
      <h1 className="font-headline tracking-[0.3em] uppercase text-[11px] text-on-surface/60 text-center mb-8">
        Collector Profile
      </h1>

      {/* The Collector Card — 9:16 shareable portrait */}
      <div
        ref={cardRef}
        className="relative aspect-[9/16] w-full rounded-sm overflow-hidden flex flex-col"
        style={{
          background: 'radial-gradient(circle at 50% 0%, #2a1f1a 0%, #191210 70%)',
          boxShadow: '0 32px 64px -12px rgba(25, 18, 16, 0.6)',
        }}
      >
        {/* TOP THIRD — the masthead */}
        <div className="p-8 pt-10 flex flex-col relative z-10">
          <div className="flex justify-between items-start">
            <div className="flex-1 min-w-0">
              <span className="block text-[11px] tracking-[0.15em] opacity-50 uppercase mb-2">
                Scentfolio Member
              </span>
              <h2 className="font-headline text-[3.5rem] leading-[0.9] text-on-surface -ml-1 uppercase truncate">
                {displayName}
              </h2>
              <p className="text-[10px] tracking-widest uppercase opacity-40 mt-3">
                No. {memberNo} · Est. {joined}
              </p>
            </div>

            {/* Asymmetrical avatar — floats to the right */}
            <div className="relative ml-4 mt-2 flex-shrink-0">
              <div
                className="w-20 h-20 rounded-full border-2 border-primary-container p-1"
                style={{ boxShadow: '0 32px 48px -12px rgba(25, 18, 16, 0.8)' }}
              >
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="w-full h-full object-cover rounded-full" />
                ) : (
                  <div className="w-full h-full rounded-full bg-surface-container flex items-center justify-center">
                    <span className="font-headline text-2xl text-primary">
                      {displayName[0]?.toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* MIDDLE BAND — signature stats with ghost hairline dividers */}
        <div className="px-8 flex items-center justify-between py-6 relative z-10">
          {stat4.map((s, i) => (
            <Fragment key={s.label}>
              <div className="flex flex-col items-center">
                <span className="font-headline text-2xl text-primary mb-1">{s.value}</span>
                <span className="text-[9px] tracking-[0.2em] opacity-50 uppercase">{s.label}</span>
              </div>
              {i < stat4.length - 1 && (
                <div className="h-8 w-px bg-outline-variant/15" />
              )}
            </Fragment>
          ))}
        </div>

        {/* TOP SHELF — horizontal portrait strip */}
        <div className="mt-4 relative z-10 pl-8 overflow-visible">
          <span className="block text-[10px] tracking-[0.2em] opacity-50 uppercase mb-4">
            Top Shelf
          </span>
          <div className="flex gap-4 overflow-x-auto pb-4 pr-8 no-scrollbar">
            {stats.topThree.length > 0 ? (
              stats.topThree.map((scent, i) => (
                <div
                  key={i}
                  className="flex-shrink-0 w-[120px] aspect-[2/3] rounded-sm overflow-hidden relative"
                >
                  {scent.image_url ? (
                    <img src={scent.image_url} alt={scent.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-surface-container-low" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#191210] via-transparent to-transparent" />
                  <span className="absolute bottom-3 left-3 right-3 text-[9px] tracking-widest text-on-surface/90 uppercase truncate">
                    {scent.name}
                  </span>
                </div>
              ))
            ) : (
              [0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="flex-shrink-0 w-[120px] aspect-[2/3] rounded-sm bg-surface-container-low/40"
                />
              ))
            )}
          </div>
        </div>

        {/* BOTTOM BAND — taste profile in two editorial columns */}
        <div className="px-8 mt-auto mb-8 grid grid-cols-2 gap-8 relative z-10">
          <div>
            <span className="block text-[9px] tracking-[0.2em] opacity-40 uppercase mb-3">
              Notes You Live In
            </span>
            <div className="flex flex-wrap gap-2">
              {stats.topFamilies.length > 0 ? (
                stats.topFamilies.map((f) => (
                  <span
                    key={f}
                    className="px-3 py-1 bg-surface-container-highest rounded-full text-[8px] tracking-widest uppercase text-on-surface"
                  >
                    {f}
                  </span>
                ))
              ) : (
                <span className="text-[10px] italic opacity-30">—</span>
              )}
            </div>
          </div>
          <div>
            <span className="block text-[9px] tracking-[0.2em] opacity-40 uppercase mb-3">
              Houses You Trust
            </span>
            <div className="space-y-1">
              {stats.topBrands.length > 0 ? (
                stats.topBrands.map((b) => (
                  <p key={b} className="font-headline italic text-xs opacity-80 truncate">
                    {b}
                  </p>
                ))
              ) : (
                <p className="font-headline italic text-xs opacity-30">—</p>
              )}
            </div>
          </div>
        </div>

        {/* Colophon */}
        <div className="pb-6 relative z-10 flex flex-col items-center">
          <div className="w-8 h-px bg-primary/40 mb-3" />
          <span className="font-headline text-[10px] tracking-[0.3em] text-primary opacity-40 uppercase">
            ScentFolio · Lvl {stats.level} {getLevelTitle(stats.level)}
          </span>
        </div>
      </div>

      {/* BELOW-CARD ACTIONS — primary + ghost */}
      <div className="w-full mt-12 space-y-6 flex flex-col items-center">
        <button
          onClick={handleShare}
          disabled={sharing}
          className="w-full gold-gradient py-4 rounded-sm text-xs tracking-[0.2em] font-bold text-on-primary-container flex items-center justify-center gap-2 hover:opacity-80 transition-transform disabled:opacity-50"
          style={{ boxShadow: '0 24px 48px -16px rgba(25, 18, 16, 0.6)' }}
        >
          <span>↗</span>
          {sharing ? 'GENERATING…' : 'SHARE CARD'}
        </button>
        <button onClick={handleCopyLink} className="relative group">
          <span className="text-xs tracking-[0.2em] text-primary uppercase">Copy Link</span>
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1/2 h-px bg-primary group-active:w-full transition-all duration-300" />
        </button>
      </div>
    </main>
  )
}
