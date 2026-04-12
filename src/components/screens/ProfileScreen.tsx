import { useAuth } from '@/contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { AuthScreen } from './AuthScreen'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { getLevelProgress, getXPForNextLevel, getLevelTitle } from '@/lib/xp'
import { EditProfileSheet } from './EditProfileSheet'
import { PullToRefresh } from '../ui/PullToRefresh'
import { useProfileExtras, useSignatureFragrance } from '@/hooks/useProfileExtras'
import type { Profile } from '@/types/database'

/* ── voice helpers ───────────────────────────────────────────── */

const WORDS = [
  'zero','one','two','three','four','five','six','seven','eight','nine',
  'ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen',
  'seventeen','eighteen','nineteen','twenty',
]

function numberToWord(n: number): string {
  if (n >= 0 && n <= 20) return WORDS[n]
  if (n < 100) {
    const tens = ['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety']
    const t = Math.floor(n / 10)
    const u = n % 10
    return u === 0 ? tens[t] : `${tens[t]}-${WORDS[u]}`
  }
  return String(n)
}

/* ── noir style constants ────────────────────────────────────── */

const hairline = 'linear-gradient(to right, rgba(229,194,118,0.4) 0%, rgba(229,194,118,0.1) 40%, transparent 100%)'

function ambientGlow(top: string, left: string) {
  return {
    position: 'absolute' as const,
    top,
    left,
    width: '300px',
    height: '300px',
    background: 'radial-gradient(circle, rgba(229,194,118,0.07) 0%, transparent 70%)',
    filter: 'blur(80px)',
    pointerEvents: 'none' as const,
  }
}

/* ── auth gate ───────────────────────────────────────────────── */

export function ProfileScreen() {
  const { user, signOut, loading: authLoading } = useAuth()

  if (authLoading) {
    return (
      <main className="pt-24 pb-32 px-6 min-h-screen flex items-center justify-center">
        <div className="space-y-4 w-full max-w-[280px]">
          {[1, 2, 3].map(n => (
            <div key={n} className="h-3 rounded-sm animate-pulse" style={{ background: '#3c3330', width: `${60 + n * 10}%` }} />
          ))}
        </div>
      </main>
    )
  }

  if (!user) return <AuthScreen />

  return <ProfileContent userId={user.id} email={user.email ?? ''} onSignOut={signOut} />
}

/* ── main content ────────────────────────────────────────────── */

function ProfileContent({ userId, email, onSignOut }: { userId: string; email: string; onSignOut: () => void }) {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [collectionCount, setCollectionCount] = useState(0)
  const [wearCount, setWearCount] = useState(0)
  const [reviewCount, setReviewCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [editSheetOpen, setEditSheetOpen] = useState(false)
  const { data: extras } = useProfileExtras(userId)
  const signatureFragrance = useSignatureFragrance(extras.signature_fragrance_id)

  const fetchData = () => {
    Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('user_collections').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('wear_logs').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('reviews').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    ]).then(([profileRes, collRes, wearRes, reviewRes]) => {
      if (profileRes.data) setProfile(profileRes.data as Profile)
      setCollectionCount(collRes.count ?? 0)
      setWearCount(wearRes.count ?? 0)
      setReviewCount(reviewRes.count ?? 0)
      setLoading(false)
    })
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData() }, [userId])

  /* derived */
  const level = profile?.level ?? 1
  const xp = profile?.xp ?? 0
  const progress = getLevelProgress(xp, level)
  const nextLevelXP = getXPForNextLevel(level)
  const title = getLevelTitle(level)
  const displayName = profile?.display_name ?? 'Fragrance Lover'

  if (loading) {
    return (
      <main className="relative pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen overflow-hidden">
        <div aria-hidden style={ambientGlow('-5%', '-10%')} />
        <div className="space-y-6">
          {[1, 2, 3, 4, 5].map(n => (
            <div key={n} className="h-3 rounded-sm animate-pulse" style={{ background: '#3c3330', width: `${40 + n * 12}%` }} />
          ))}
        </div>
      </main>
    )
  }

  return (
    <PullToRefresh onRefresh={async () => fetchData()}>
    <main
      className="relative pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen overflow-hidden"
    >
      {/* ── ambient gold lifts ─────────────────────────────── */}
      <div aria-hidden style={ambientGlow('-5%', '-10%')} />
      <div aria-hidden style={ambientGlow('40%', '70%')} />
      <div aria-hidden style={ambientGlow('80%', '-15%')} />

      {/* ── I. THE FRONTISPIECE ────────────────────────────── */}
      <header className="mb-10">
        <p
          className="font-label text-[0.65rem] tracking-[0.3em] uppercase mb-3"
          style={{ color: 'rgba(229,194,118,0.6)' }}
        >
          YOUR PROFILE
        </p>
        <h1 className="font-headline italic text-5xl md:text-6xl leading-tight text-on-background mb-2">
          {displayName}.
        </h1>
        <p className="font-headline italic text-base" style={{ color: 'rgba(168,154,145,0.7)' }}>
          {email}
        </p>
        <div className="mt-6" style={{ height: '1px', background: hairline }} />
      </header>

      {/* ── II. THE CREDENTIALS ────────────────────────────── */}
      <section className="mb-10">
        <div className="flex gap-5 items-start">
          {/* a) Portrait */}
          {profile?.avatar_url && (
            <div
              className="w-[80px] h-[106px] flex-shrink-0 rounded-sm overflow-hidden grayscale hover:grayscale-0 transition-all duration-700"
              style={{ background: '#3c3330' }}
            >
              <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
            </div>
          )}

          <div className="flex-1 space-y-4">
            {/* b) Bio */}
            {extras.bio && (
              <p
                className="font-headline italic text-base leading-relaxed max-w-[300px]"
                style={{ color: 'rgba(168,154,145,0.7)' }}
              >
                &ldquo;{extras.bio}&rdquo;
              </p>
            )}

            {/* c) House signature */}
            {signatureFragrance && (
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-[42px] flex-shrink-0 rounded-sm overflow-hidden grayscale"
                  style={{ background: '#3c3330' }}
                >
                  {signatureFragrance.image_url && (
                    <img src={signatureFragrance.image_url} alt="" className="w-full h-full object-cover" />
                  )}
                </div>
                <div>
                  <p
                    className="font-label text-[0.6rem] tracking-[0.15em] uppercase mb-0.5"
                    style={{ color: 'rgba(229,194,118,0.6)' }}
                  >
                    HOUSE SIGNATURE
                  </p>
                  <p className="font-headline italic text-sm text-on-background">
                    {signatureFragrance.brand} — {signatureFragrance.name}
                  </p>
                </div>
              </div>
            )}

            {/* d) Preferred accords */}
            {extras.favorite_notes.length > 0 && (
              <div>
                <p
                  className="font-label text-[0.6rem] tracking-[0.15em] uppercase mb-1.5"
                  style={{ color: 'rgba(229,194,118,0.6)' }}
                >
                  PREFERRED ACCORDS
                </p>
                <p className="font-headline italic text-sm" style={{ color: 'rgba(168,154,145,0.5)' }}>
                  {extras.favorite_notes.map(n => n.toLowerCase()).join(' · ')}
                </p>
              </div>
            )}
          </div>
        </div>
        <div className="mt-8" style={{ height: '1px', background: hairline }} />
      </section>

      {/* ── III. THE STANDING ──────────────────────────────── */}
      <section className="mb-10">
        <p
          className="font-label text-[0.65rem] tracking-[0.3em] uppercase mb-3"
          style={{ color: 'rgba(229,194,118,0.6)' }}
        >
          STANDING
        </p>
        <p className="font-headline italic text-xl text-on-background mb-3">
          Level {numberToWord(level)} · {title}
        </p>
        <div className="h-[2px] w-full" style={{ background: '#3c3330' }}>
          <div
            className="h-full transition-all duration-700"
            style={{ width: `${progress}%`, background: '#e5c276' }}
          />
        </div>
        <p
          className="text-right font-headline italic mt-1.5"
          style={{ fontSize: '0.65rem', color: 'rgba(168,154,145,0.5)' }}
        >
          {xp} of {nextLevelXP} merit
        </p>
        <div className="mt-6" style={{ height: '1px', background: hairline }} />
      </section>

      {/* ── IV. THE REGISTERS ─────────────────────────────── */}
      <section className="mb-10">
        <div className="grid grid-cols-3 gap-6">
          {[
            { value: collectionCount, label: 'bottles archived' },
            { value: wearCount, label: 'sessions recorded' },
            { value: reviewCount, label: 'reviews written' },
          ].map(stat => (
            <div key={stat.label}>
              <p className="font-headline italic text-3xl text-on-background mb-1">
                {numberToWord(stat.value)}
              </p>
              <p
                className="font-label text-[0.6rem] tracking-[0.15em] uppercase"
                style={{ color: 'rgba(229,194,118,0.6)' }}
              >
                {stat.label}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-8" style={{ height: '1px', background: hairline }} />
      </section>

      {/* ── V. THE PROPRIETOR'S INTERESTS ─────────────────── */}
      <section className="mb-10">
        <p
          className="font-label text-[0.65rem] tracking-[0.3em] uppercase mb-6"
          style={{ color: 'rgba(229,194,118,0.6)' }}
        >
          YOUR COLLECTION
        </p>
        <div className="grid grid-cols-2 gap-x-8 gap-y-6">
          {([
            ['/dna', 'Scent profile', 'your fragrance preferences'],
            ['/profile-card', 'Profile card', 'share your taste'],
            ['/stats', 'Your stats', 'numbers & insights'],
            ['/achievements', 'Achievements', 'honours & milestones'],
            ['/challenges', 'Challenges', 'goals & rewards'],
            ['/collection-insights', 'Collection insights', 'patterns & trends'],
            ['/collection-health', 'Collection health', 'rate your collection'],
            ['/brands', 'Brands', 'browse by brand'],
            ['/families', 'Scent families', 'browse by family'],
            ['/top-shelf', 'Top shelf', 'your all-time favourites'],
            ['/milestones', 'Milestones', 'your fragrance journey'],
          ] as [string, string, string][]).map(([path, name, desc]) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              className="text-left group"
            >
              <p className="font-headline italic text-base text-on-background group-hover:text-primary transition-colors">
                {name}
              </p>
              <p
                className="font-headline italic text-sm mt-0.5"
                style={{ color: 'rgba(168,154,145,0.5)' }}
              >
                {desc}
              </p>
              <div
                className="mt-1.5 w-0 group-hover:w-8 h-[1px] transition-all duration-500"
                style={{ background: '#e5c276' }}
              />
            </button>
          ))}
        </div>
        <div className="mt-8" style={{ height: '1px', background: hairline }} />
      </section>

      {/* ── VI. INSTRUMENTS & RECORDS ─────────────────────── */}
      <section className="mb-10">
        <p
          className="font-label text-[0.65rem] tracking-[0.3em] uppercase mb-6"
          style={{ color: 'rgba(229,194,118,0.6)' }}
        >
          TOOLS & FEATURES
        </p>
        <div className="space-y-0">
          {([
            ['/activity', 'Activity', 'your recent updates'],
            ['/scent-quiz', 'Scent quiz', 'discover your preferences'],
            ['/gift-finder', 'Gift finder', 'find the perfect gift'],
            ['/dupes', 'Alternatives', 'similar scents & dupes'],
            ['/blind-buys', 'Blind buys', 'bottles bought unsmelled'],
            ['/wear-predictions', "Today's pick", 'what to wear today'],
            ['/journal', 'Journal', 'your fragrance diary'],
            ['/calendar', 'Calendar', 'monthly wear overview'],
            ['/heatmap', 'Wear map', 'activity & cost per wear'],
            ['/timeline', 'Timeline', 'your fragrance journey'],
          ] as [string, string, string][]).map(([path, name, desc]) => (
            <div key={path}>
              <button
                onClick={() => navigate(path)}
                className="w-full text-left py-4 group"
              >
                <p className="font-headline italic text-base text-on-background group-hover:text-primary transition-colors">
                  {name}
                </p>
                <p
                  className="font-headline italic text-sm mt-0.5"
                  style={{ color: 'rgba(168,154,145,0.5)' }}
                >
                  {desc}
                </p>
              </button>
              <div style={{ height: '1px', background: hairline }} />
            </div>
          ))}
        </div>
        <div className="mt-4" style={{ height: '1px', background: hairline }} />
      </section>

      {/* ── VII. SALON & SOCIETY ──────────────────────────── */}
      <section className="mb-10">
        <p
          className="font-label text-[0.65rem] tracking-[0.3em] uppercase mb-6"
          style={{ color: 'rgba(229,194,118,0.6)' }}
        >
          SOCIAL & SHARING
        </p>

        {/* full-width lead item */}
        <button
          onClick={() => navigate('/feed')}
          className="w-full text-left py-4 group"
        >
          <p className="font-headline italic text-base text-on-background group-hover:text-primary transition-colors">
            Community feed
          </p>
          <p
            className="font-headline italic text-sm mt-0.5"
            style={{ color: 'rgba(168,154,145,0.5)' }}
          >
            see what others are wearing
          </p>
        </button>
        <div style={{ height: '1px', background: hairline }} />

        {/* 2-col sub-grid */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-6 mt-6">
          {([
            ['/share-collection', 'Share cards', 'wrapped-style cards'],
            ['/year-wrapped', 'Year in review', 'the year in scent'],
            ['/month-review', 'Monthly recap', 'highlights of the month'],
            ['/badges', 'Badges earned', 'shareable proof'],
          ] as [string, string, string][]).map(([path, name, desc]) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              className="text-left group"
            >
              <p className="font-headline italic text-base text-on-background group-hover:text-primary transition-colors">
                {name}
              </p>
              <p
                className="font-headline italic text-sm mt-0.5"
                style={{ color: 'rgba(168,154,145,0.5)' }}
              >
                {desc}
              </p>
              <div
                className="mt-1.5 w-0 group-hover:w-8 h-[1px] transition-all duration-500"
                style={{ background: '#e5c276' }}
              />
            </button>
          ))}
        </div>
        <div className="mt-8" style={{ height: '1px', background: hairline }} />
      </section>

      {/* ── VIII. PRIVATE AFFAIRS ─────────────────────────── */}
      <section className="mb-10">
        <p
          className="font-label text-[0.65rem] tracking-[0.3em] uppercase mb-6"
          style={{ color: 'rgba(229,194,118,0.6)' }}
        >
          ACCOUNT
        </p>
        <div className="space-y-0">
          {([
            [() => setEditSheetOpen(true), 'Edit profile', 'name, bio, signature scent & families'],
            [() => navigate('/settings'), 'Settings', 'preferences, data export, currency'],
            [() => navigate('/blocked'), 'Blocked users', 'manage blocked accounts'],
          ] as [() => void, string, string][]).map(([action, name, desc]) => (
            <div key={name}>
              <button
                onClick={action}
                className="w-full text-left py-4 group"
              >
                <p className="font-headline italic text-base text-on-background group-hover:text-primary transition-colors">
                  {name}
                </p>
                <p
                  className="font-headline italic text-sm mt-0.5"
                  style={{ color: 'rgba(168,154,145,0.5)' }}
                >
                  {desc}
                </p>
              </button>
              <div style={{ height: '1px', background: hairline }} />
            </div>
          ))}
        </div>
        <div className="mt-4" style={{ height: '1px', background: hairline }} />
      </section>

      {/* ── IX. LEAVE-TAKING ──────────────────────────────── */}
      <div className="flex justify-center pt-8 pb-4">
        <button
          onClick={onSignOut}
          className="group flex flex-col items-center space-y-3"
        >
          <div
            className="w-12 h-[1px] group-hover:w-24 transition-all duration-700"
            style={{ background: 'rgba(168,154,145,0.3)' }}
          />
          <span
            className="font-headline italic text-lg tracking-wide group-hover:text-on-background transition-colors"
            style={{ color: 'rgba(168,154,145,0.5)' }}
          >
            Sign out
          </span>
        </button>
      </div>

      {/* ── EDIT PROFILE SHEET ────────────────────────────── */}
      <EditProfileSheet
        isOpen={editSheetOpen}
        onClose={() => setEditSheetOpen(false)}
        userId={userId}
        currentName={profile?.display_name ?? ''}
        onSaved={(newName) => {
          setProfile((prev) => prev ? { ...prev, display_name: newName } : prev)
        }}
      />
    </main>
    </PullToRefresh>
  )
}
