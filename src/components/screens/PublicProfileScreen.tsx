import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { FollowButton } from '../ui/FollowButton'
import { ReportSheet } from '../ui/ReportSheet'
import { useFollowCounts } from '@/hooks/useFollows'
import { useIsBlocked } from '@/hooks/useBlockUser'
import { usePublicProfileExtras, useSignatureFragrance } from '@/hooks/useProfileExtras'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { getLevelTitle } from '@/lib/xp'
import { copyToClipboard, profileLink } from '@/lib/share'
import { useToast } from '@/contexts/ToastContext'
import { getIconChar } from '@/lib/iconUtils'

interface PublicProfile {
  display_name: string
  avatar_url: string | null
  level: number
  xp: number
  created_at: string
}

interface PublicStats {
  owned: number
  wishlist: number
  wears: number
  reviews: number
  topBrands: string[]
  topFamilies: string[]
  recentCollection: { id: string; name: string; brand: string; image_url: string | null }[]
}

export function PublicProfileScreen() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [profile, setProfile] = useState<PublicProfile | null>(null)
  const [stats, setStats] = useState<PublicStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const { user: currentUser } = useAuth()
  const { followers: followerCount, following: followingCount } = useFollowCounts(userId)
  const { blocked, toggleBlock } = useIsBlocked(userId)
  const { data: profileExtras } = usePublicProfileExtras(userId)
  const signatureFragrance = useSignatureFragrance(profileExtras?.signature_fragrance_id ?? null)
  const isOwnProfile = currentUser?.id === userId

  useEffect(() => {
    if (!userId) { setNotFound(true); setLoading(false); return }
    fetchProfile(userId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  async function fetchProfile(uid: string) {
    const { data: profileData, error } = await supabase
      .from('profiles')
      .select('display_name, avatar_url, level, xp, created_at')
      .eq('id', uid)
      .single()

    if (error || !profileData) { setNotFound(true); setLoading(false); return }
    setProfile(profileData as PublicProfile)

    const [ownedRes, wishRes, wearsRes, reviewsRes, collRes] = await Promise.all([
      supabase.from('user_collections').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('status', 'own'),
      supabase.from('user_collections').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('status', 'wishlist'),
      supabase.from('wear_logs').select('id', { count: 'exact', head: true }).eq('user_id', uid),
      supabase.from('reviews').select('id', { count: 'exact', head: true }).eq('user_id', uid),
      supabase.from('user_collections').select('fragrance:fragrances(id, name, brand, image_url, note_family)').eq('user_id', uid).eq('status', 'own').order('date_added', { ascending: false }).limit(12),
    ])

    type CollRow = { fragrance: { id: string; name: string; brand: string; image_url: string | null; note_family: string | null } | null }
    const coll = (collRes.data ?? []) as unknown as CollRow[]
    const frags = coll.filter(c => c.fragrance).map(c => c.fragrance!)

    // Top brands
    const brandMap = new Map<string, number>()
    const familyMap = new Map<string, number>()
    frags.forEach(f => {
      brandMap.set(f.brand, (brandMap.get(f.brand) ?? 0) + 1)
      if (f.note_family) familyMap.set(f.note_family, (familyMap.get(f.note_family) ?? 0) + 1)
    })

    setStats({
      owned: ownedRes.count ?? 0,
      wishlist: wishRes.count ?? 0,
      wears: wearsRes.count ?? 0,
      reviews: reviewsRes.count ?? 0,
      topBrands: [...brandMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([b]) => b),
      topFamilies: [...familyMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([f]) => f),
      recentCollection: frags.slice(0, 12),
    })
    setLoading(false)
  }

  const handleCopyLink = async () => {
    if (!userId) return
    const ok = await copyToClipboard(profileLink(userId))
    showToast(ok ? 'Profile link copied!' : 'Copy failed', ok ? 'success' : 'error')
  }

  const handleShareProfile = async () => {
    if (!userId || !profile) return
    try {
      await navigator.share({
        title: `${profile.display_name} on ScentFolio`,
        text: `Check out ${profile.display_name}'s fragrance collection on ScentFolio!`,
        url: profileLink(userId),
      })
    } catch {
      handleCopyLink()
    }
  }

  if (loading) {
    return (
      <main className="pt-24 pb-32 px-6 flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-1.5">{[1,2,3].map(i => <div key={i} className="h-1 rounded-sm bg-primary/20 animate-pulse" style={{ width: `${60 - i * 14}px` }} />)}</div>
      </main>
    )
  }

  if (notFound || !profile) {
    return (
      <main className="pt-24 pb-32 px-6 flex flex-col items-center justify-center min-h-screen gap-4">
        <span className="text-5xl text-primary/20">?</span>
        <p className="text-secondary/60 text-sm">Profile not found</p>
        <button onClick={() => navigate('/')} className="text-primary text-sm underline">Go home</button>
      </main>
    )
  }

  const joined = new Date(profile.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  return (
    <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen space-y-6">
      {/* Avatar & name */}
      <div className="flex flex-col items-center text-center gap-3">
        <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="font-headline text-3xl text-primary">{profile.display_name[0]?.toUpperCase()}</span>
          )}
        </div>
        <div>
          <h1 className="font-headline text-xl text-on-surface">{profile.display_name}</h1>
          <p className="text-xs text-on-surface-variant">Level {profile.level} · {getLevelTitle(profile.level)}</p>
          <p className="text-[10px] text-secondary/40">Member since {joined}</p>
        </div>

        {/* Bio */}
        {profileExtras?.bio && (
          <p className="text-sm text-on-surface-variant/80 max-w-[300px] text-center italic leading-relaxed">
            "{profileExtras.bio}"
          </p>
        )}

        {/* Signature Scent */}
        {signatureFragrance && (
          <div className="flex items-center gap-2.5 bg-surface-container px-3.5 py-2.5 rounded-sm">
            <div className="w-8 h-8 rounded-sm overflow-hidden bg-surface-container-highest flex-shrink-0">
              {signatureFragrance.image_url ? (
                <img src={signatureFragrance.image_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-secondary/30">?</span>
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[8px] uppercase tracking-[0.15em] text-primary/70 font-bold">Signature Scent</p>
              <p className="text-xs text-on-surface truncate">{signatureFragrance.brand} — {signatureFragrance.name}</p>
            </div>
          </div>
        )}

        {/* Favourite Notes */}
        {profileExtras && profileExtras.favorite_notes.length > 0 && (
          <div className="flex flex-wrap justify-center gap-1.5 max-w-[300px]">
            {profileExtras.favorite_notes.map((note) => (
              <span key={note} className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-medium">
                {note}
              </span>
            ))}
          </div>
        )}

        {/* Follow counts */}
        <div className="flex items-center gap-4 mt-1">
          <button
            onClick={() => navigate(`/u/${userId}/followers`)}
            className="text-center hover:opacity-80 transition-opacity"
          >
            <span className="font-headline text-sm text-on-surface">{followerCount}</span>
            <span className="text-[10px] text-secondary/50 ml-1">Followers</span>
          </button>
          <div className="w-px h-4 bg-outline-variant/20" />
          <button
            onClick={() => navigate(`/u/${userId}/following`)}
            className="text-center hover:opacity-80 transition-opacity"
          >
            <span className="font-headline text-sm text-on-surface">{followingCount}</span>
            <span className="text-[10px] text-secondary/50 ml-1">Following</span>
          </button>
        </div>

        {/* Follow button */}
        {userId && <FollowButton targetUserId={userId} />}
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Owned', value: stats.owned, icon: 'collections_bookmark' },
            { label: 'Wishlist', value: stats.wishlist, icon: 'bookmarks' },
            { label: 'Wears', value: stats.wears, icon: 'checkroom' },
            { label: 'Reviews', value: stats.reviews, icon: 'rate_review' },
          ].map(s => (
            <div key={s.label} className="text-center bg-surface-container rounded-sm p-3">
              <p className="font-headline text-lg text-primary">{s.value}</p>
              <p className="text-[8px] text-on-surface-variant uppercase tracking-wider">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Taste summary */}
      {stats && (stats.topBrands.length > 0 || stats.topFamilies.length > 0) && (
        <div className="flex gap-6">
          {stats.topBrands.length > 0 && (
            <div>
              <p className="text-[9px] uppercase tracking-[0.15em] text-secondary/40 font-bold mb-1">TOP BRANDS</p>
              {stats.topBrands.map(b => <p key={b} className="text-xs text-on-surface-variant">{b}</p>)}
            </div>
          )}
          {stats.topFamilies.length > 0 && (
            <div>
              <p className="text-[9px] uppercase tracking-[0.15em] text-secondary/40 font-bold mb-1">TOP FAMILIES</p>
              {stats.topFamilies.map(f => <p key={f} className="text-xs text-on-surface-variant">{f}</p>)}
            </div>
          )}
        </div>
      )}

      {/* Recent collection grid */}
      {stats && stats.recentCollection.length > 0 && (
        <div>
          <p className="text-[9px] uppercase tracking-[0.15em] text-secondary/40 font-bold mb-3">RECENT COLLECTION</p>
          <div className="grid grid-cols-4 gap-2">
            {stats.recentCollection.map(f => (
              <button
                key={f.id}
                onClick={() => navigate(`/fragrance/${f.id}`)}
                className="aspect-square rounded-sm overflow-hidden bg-surface-container hover:opacity-80 transition-transform"
              >
                {f.image_url ? (
                  <img src={f.image_url} alt={f.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-1">
                    <span className="text-primary/20">?</span>
                    <span className="text-[7px] text-on-surface-variant/40 mt-0.5 text-center line-clamp-2">{f.name}</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Share actions */}
      <div className="flex gap-3">
        <button
          onClick={handleShareProfile}
          className="flex-1 gold-gradient text-on-primary-container py-3.5 rounded-sm font-label text-[10px] font-bold uppercase tracking-widest hover:opacity-80 transition-all flex items-center justify-center gap-2"
        >
          <span>↗</span>
          SHARE PROFILE
        </button>
        <button
          onClick={handleCopyLink}
          className="bg-surface-container text-on-surface py-3.5 px-5 rounded-sm font-label text-[10px] font-bold uppercase tracking-widest hover:opacity-80 transition-all flex items-center justify-center gap-2"
        >
          <span>⟁</span>
        </button>
        {/* Overflow menu (report/block) */}
        {!isOwnProfile && currentUser && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="bg-surface-container text-on-surface py-3.5 px-3 rounded-sm hover:opacity-80 transition-all"
            >
              <span>⋮</span>
            </button>
            {menuOpen && (
              <div className="absolute bottom-full right-0 mb-2 w-48 bg-surface-container-highest rounded-sm shadow-lg overflow-hidden z-[var(--z-dropdown)]">
                <button
                  onClick={() => { setMenuOpen(false); setReportOpen(true) }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-on-surface hover:bg-surface-container transition-colors"
                >
                  <span className="text-secondary/60">?</span>
                  Report User
                </button>
                <button
                  onClick={async () => {
                    setMenuOpen(false)
                    await toggleBlock()
                    showToast(blocked ? 'User unblocked' : 'User blocked', blocked ? 'success' : 'info')
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-error/70 hover:bg-surface-container transition-colors"
                >
                  <span>{getIconChar(blocked ? 'lock_open' : 'block')}</span>
                  {blocked ? 'Unblock User' : 'Block User'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Report Sheet */}
      {userId && profile && (
        <ReportSheet
          isOpen={reportOpen}
          onClose={() => setReportOpen(false)}
          targetType="user"
          targetId={userId}
          targetName={profile.display_name}
        />
      )}
    </main>
  )
}
