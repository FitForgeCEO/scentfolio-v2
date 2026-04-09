import { useState, useEffect, useRef } from 'react'
import { Icon } from '../ui/Icon'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { supabase } from '@/lib/supabase'
import { captureElement, shareImage } from '@/lib/share'

/* ── Badge definitions ─────────────────────────────────── */
interface Badge {
  id: string
  name: string
  description: string
  icon: string
  tier: 'bronze' | 'silver' | 'gold' | 'diamond'
  earned: boolean
  progress: number // 0-100
  requirement: string
}

const TIER_COLORS = {
  bronze: { bg: '#cd7f32', text: '#fff', glow: 'rgba(205, 127, 50, 0.3)' },
  silver: { bg: '#c0c0c0', text: '#1a1a1a', glow: 'rgba(192, 192, 192, 0.3)' },
  gold: { bg: '#e5c276', text: '#3f2e00', glow: 'rgba(229, 194, 118, 0.4)' },
  diamond: { bg: '#b9f2ff', text: '#0a3d4a', glow: 'rgba(185, 242, 255, 0.4)' },
}

interface BadgeStats {
  ownedCount: number
  wearCount: number
  reviewCount: number
  uniqueFamilies: number
  uniqueBrands: number
  streakMax: number
  listsCreated: number
  boardsCreated: number
}

function computeBadges(stats: BadgeStats): Badge[] {
  const { ownedCount, wearCount, reviewCount, uniqueFamilies, uniqueBrands, streakMax } = stats

  return [
    // Collection size
    { id: 'collector-10', name: 'Collector', description: 'Own 10+ fragrances', icon: 'collections_bookmark', tier: 'bronze', earned: ownedCount >= 10, progress: Math.min(100, (ownedCount / 10) * 100), requirement: `${ownedCount}/10 fragrances` },
    { id: 'collector-25', name: 'Connoisseur', description: 'Own 25+ fragrances', icon: 'collections_bookmark', tier: 'silver', earned: ownedCount >= 25, progress: Math.min(100, (ownedCount / 25) * 100), requirement: `${ownedCount}/25 fragrances` },
    { id: 'collector-50', name: 'Aficionado', description: 'Own 50+ fragrances', icon: 'collections_bookmark', tier: 'gold', earned: ownedCount >= 50, progress: Math.min(100, (ownedCount / 50) * 100), requirement: `${ownedCount}/50 fragrances` },
    { id: 'collector-100', name: 'Perfumista', description: 'Own 100+ fragrances', icon: 'collections_bookmark', tier: 'diamond', earned: ownedCount >= 100, progress: Math.min(100, (ownedCount / 100) * 100), requirement: `${ownedCount}/100 fragrances` },

    // Wears
    { id: 'wear-50', name: 'Regular Wearer', description: 'Log 50+ wears', icon: 'checkroom', tier: 'bronze', earned: wearCount >= 50, progress: Math.min(100, (wearCount / 50) * 100), requirement: `${wearCount}/50 wears` },
    { id: 'wear-200', name: 'Daily Driver', description: 'Log 200+ wears', icon: 'checkroom', tier: 'silver', earned: wearCount >= 200, progress: Math.min(100, (wearCount / 200) * 100), requirement: `${wearCount}/200 wears` },
    { id: 'wear-500', name: 'Scent Devotee', description: 'Log 500+ wears', icon: 'checkroom', tier: 'gold', earned: wearCount >= 500, progress: Math.min(100, (wearCount / 500) * 100), requirement: `${wearCount}/500 wears` },

    // Reviews
    { id: 'review-5', name: 'Critic', description: 'Write 5+ reviews', icon: 'rate_review', tier: 'bronze', earned: reviewCount >= 5, progress: Math.min(100, (reviewCount / 5) * 100), requirement: `${reviewCount}/5 reviews` },
    { id: 'review-25', name: 'Top Reviewer', description: 'Write 25+ reviews', icon: 'rate_review', tier: 'silver', earned: reviewCount >= 25, progress: Math.min(100, (reviewCount / 25) * 100), requirement: `${reviewCount}/25 reviews` },
    { id: 'review-50', name: 'Master Critic', description: 'Write 50+ reviews', icon: 'rate_review', tier: 'gold', earned: reviewCount >= 50, progress: Math.min(100, (reviewCount / 50) * 100), requirement: `${reviewCount}/50 reviews` },

    // Diversity
    { id: 'diverse-5', name: 'Explorer', description: 'Own 5+ note families', icon: 'explore', tier: 'bronze', earned: uniqueFamilies >= 5, progress: Math.min(100, (uniqueFamilies / 5) * 100), requirement: `${uniqueFamilies}/5 families` },
    { id: 'diverse-10', name: 'Diverse Nose', description: 'Own 10+ note families', icon: 'explore', tier: 'gold', earned: uniqueFamilies >= 10, progress: Math.min(100, (uniqueFamilies / 10) * 100), requirement: `${uniqueFamilies}/10 families` },

    // Brands
    { id: 'brands-10', name: 'Brand Explorer', description: 'Own from 10+ brands', icon: 'storefront', tier: 'bronze', earned: uniqueBrands >= 10, progress: Math.min(100, (uniqueBrands / 10) * 100), requirement: `${uniqueBrands}/10 brands` },
    { id: 'brands-25', name: 'Brand Connoisseur', description: 'Own from 25+ brands', icon: 'storefront', tier: 'silver', earned: uniqueBrands >= 25, progress: Math.min(100, (uniqueBrands / 25) * 100), requirement: `${uniqueBrands}/25 brands` },

    // Streaks
    { id: 'streak-7', name: 'Streak Starter', description: '7-day wear streak', icon: 'local_fire_department', tier: 'bronze', earned: streakMax >= 7, progress: Math.min(100, (streakMax / 7) * 100), requirement: `${streakMax}/7 days` },
    { id: 'streak-30', name: 'Streak Master', description: '30-day wear streak', icon: 'local_fire_department', tier: 'gold', earned: streakMax >= 30, progress: Math.min(100, (streakMax / 30) * 100), requirement: `${streakMax}/30 days` },
    { id: 'streak-100', name: 'Iron Nose', description: '100-day wear streak', icon: 'local_fire_department', tier: 'diamond', earned: streakMax >= 100, progress: Math.min(100, (streakMax / 100) * 100), requirement: `${streakMax}/100 days` },
  ]
}

export function BadgesScreen() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const cardRef = useRef<HTMLDivElement>(null)
  const [badges, setBadges] = useState<Badge[]>([])
  const [loading, setLoading] = useState(true)
  const [sharing, setSharing] = useState(false)
  const [displayName, setDisplayName] = useState('Fragrance Lover')

  useEffect(() => {
    if (!user) { setLoading(false); return }
    fetchBadgeData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function fetchBadgeData() {
    const [profileRes, collRes, wearsRes, reviewsRes] = await Promise.all([
      supabase.from('profiles').select('display_name').eq('id', user!.id).single(),
      supabase.from('user_collections').select('fragrance:fragrances(brand, note_family)').eq('user_id', user!.id).eq('status', 'own'),
      supabase.from('wear_logs').select('wear_date').eq('user_id', user!.id).order('wear_date', { ascending: true }),
      supabase.from('reviews').select('id', { count: 'exact', head: true }).eq('user_id', user!.id),
    ])

    type CollRow = { fragrance: { brand: string; note_family: string | null } | null }
    const coll = (collRes.data ?? []) as unknown as CollRow[]
    const wearDates = ((wearsRes.data ?? []) as { wear_date: string }[]).map(w => w.wear_date)

    setDisplayName(profileRes.data?.display_name ?? 'Fragrance Lover')

    const families = new Set<string>()
    const brands = new Set<string>()
    coll.forEach(c => {
      if (c.fragrance?.brand) brands.add(c.fragrance.brand)
      if (c.fragrance?.note_family) families.add(c.fragrance.note_family)
    })

    // Compute max streak
    let maxStreak = 0
    let currentStreak = 0
    const sortedDates = [...new Set(wearDates)].sort()
    for (let i = 0; i < sortedDates.length; i++) {
      if (i === 0) { currentStreak = 1; maxStreak = 1; continue }
      const prev = new Date(sortedDates[i - 1])
      const curr = new Date(sortedDates[i])
      const diffDays = (curr.getTime() - prev.getTime()) / (24 * 60 * 60 * 1000)
      if (diffDays === 1) { currentStreak++; maxStreak = Math.max(maxStreak, currentStreak) }
      else { currentStreak = 1 }
    }

    const stats: BadgeStats = {
      ownedCount: coll.length,
      wearCount: wearDates.length,
      reviewCount: reviewsRes.count ?? 0,
      uniqueFamilies: families.size,
      uniqueBrands: brands.size,
      streakMax: maxStreak,
      listsCreated: 0,
      boardsCreated: 0,
    }

    setBadges(computeBadges(stats))
    setLoading(false)
  }

  const earnedCount = badges.filter(b => b.earned).length

  const handleShareBadges = async () => {
    if (!cardRef.current) return
    setSharing(true)
    const blob = await captureElement(cardRef.current)
    if (!blob) { showToast('Failed to generate image', 'error'); setSharing(false); return }
    const result = await shareImage(blob, 'scentfolio-badges.png', 'My ScentFolio Badges', `${earnedCount}/${badges.length} badges earned on ScentFolio!`)
    if (result === 'downloaded') showToast('Image saved!', 'success')
    else if (result === 'shared') showToast('Shared!', 'success')
    else showToast('Could not share', 'error')
    setSharing(false)
  }

  if (!user) {
    return (
      <main className="pt-24 pb-32 px-6 flex flex-col items-center justify-center min-h-screen gap-4">
        <Icon name="military_tech" className="text-5xl text-primary/30" />
        <p className="text-secondary/60 text-sm">Sign in to earn badges</p>
      </main>
    )
  }

  if (loading) {
    return (
      <main className="pt-24 pb-32 px-6 flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </main>
    )
  }

  const earned = badges.filter(b => b.earned)
  const inProgress = badges.filter(b => !b.earned && b.progress > 0)
  const locked = badges.filter(b => !b.earned && b.progress === 0)

  return (
    <main className="pt-24 pb-32 px-4 max-w-[430px] mx-auto min-h-screen space-y-6">
      {/* Summary */}
      <div className="text-center">
        <p className="font-headline text-3xl text-primary">{earnedCount}<span className="text-on-surface-variant text-lg">/{badges.length}</span></p>
        <p className="text-[10px] text-secondary/50 uppercase tracking-wider">Badges Earned</p>
      </div>

      {/* Shareable badge card */}
      {earned.length > 0 && (
        <>
          <div ref={cardRef} className="rounded-2xl overflow-hidden p-5" style={{ background: 'linear-gradient(135deg, #191210 0%, #2a1f1a 50%, #191210 100%)' }}>
            <div style={{ textAlign: 'center', marginBottom: '12px' }}>
              <p style={{ color: '#e5c276', fontSize: '9px', letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 700 }}>SCENTFOLIO BADGES</p>
              <p style={{ color: '#f0dfdb', fontSize: '14px', fontWeight: 600, marginTop: '2px' }}>{displayName}</p>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
              {earned.map(b => {
                const tc = TIER_COLORS[b.tier]
                return (
                  <div key={b.id} style={{ width: '60px', textAlign: 'center' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: tc.bg, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 12px ${tc.glow}` }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '20px', color: tc.text }}>{b.icon}</span>
                    </div>
                    <p style={{ color: '#f0dfdb80', fontSize: '7px', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</p>
                  </div>
                )
              })}
            </div>
            <div style={{ textAlign: 'center', marginTop: '12px', paddingTop: '8px', borderTop: '1px solid #f0dfdb20' }}>
              <span style={{ color: '#f0dfdb20', fontSize: '8px', letterSpacing: '0.2em', textTransform: 'uppercase' }}>scentfolio.app</span>
            </div>
          </div>

          <button onClick={handleShareBadges} disabled={sharing} className="w-full py-3 gold-gradient text-on-primary-container font-bold uppercase tracking-[0.1em] rounded-xl active:scale-[0.98] transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            {sharing ? <div className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" /> : <><Icon name="share" size={16} />SHARE BADGES</>}
          </button>
        </>
      )}

      {/* Earned badges */}
      {earned.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-[0.15em] text-secondary/50 font-bold mb-3">EARNED</p>
          <div className="grid grid-cols-3 gap-3">
            {earned.map(b => <BadgeCard key={b.id} badge={b} />)}
          </div>
        </div>
      )}

      {/* In progress */}
      {inProgress.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-[0.15em] text-secondary/50 font-bold mb-3">IN PROGRESS</p>
          <div className="grid grid-cols-3 gap-3">
            {inProgress.map(b => <BadgeCard key={b.id} badge={b} />)}
          </div>
        </div>
      )}

      {/* Locked */}
      {locked.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-[0.15em] text-secondary/50 font-bold mb-3">LOCKED</p>
          <div className="grid grid-cols-3 gap-3">
            {locked.map(b => <BadgeCard key={b.id} badge={b} />)}
          </div>
        </div>
      )}
    </main>
  )
}

function BadgeCard({ badge }: { badge: Badge }) {
  const tc = TIER_COLORS[badge.tier]
  return (
    <div className={`bg-surface-container rounded-xl p-3 text-center ${badge.earned ? '' : 'opacity-40'}`}>
      <div
        className="w-12 h-12 rounded-full mx-auto flex items-center justify-center mb-2"
        style={{ backgroundColor: badge.earned ? tc.bg : 'var(--color-surface-container-highest)', boxShadow: badge.earned ? `0 4px 12px ${tc.glow}` : 'none' }}
      >
        <Icon name={badge.earned ? badge.icon : 'lock'} size={22} style={{ color: badge.earned ? tc.text : 'var(--color-secondary)' }} />
      </div>
      <p className="text-[10px] text-on-surface font-medium truncate">{badge.name}</p>
      <p className="text-[8px] text-secondary/40 mt-0.5">{badge.requirement}</p>
      {!badge.earned && badge.progress > 0 && (
        <div className="mt-1.5 h-1 bg-surface-container-highest rounded-full overflow-hidden">
          <div className="h-full bg-primary/50 rounded-full transition-all" style={{ width: `${badge.progress}%` }} />
        </div>
      )}
    </div>
  )
}
