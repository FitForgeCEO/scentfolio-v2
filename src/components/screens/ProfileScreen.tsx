import { useAuth } from '@/contexts/AuthContext'
import { AuthScreen } from './AuthScreen'
import { Icon } from '../ui/Icon'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types/database'

export function ProfileScreen() {
  const { user, signOut, loading: authLoading } = useAuth()

  if (authLoading) {
    return (
      <main className="pt-24 pb-32 px-6 min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </main>
    )
  }

  if (!user) return <AuthScreen />

  return <ProfileContent userId={user.id} email={user.email ?? ''} onSignOut={signOut} />
}

function ProfileContent({ userId, email, onSignOut }: { userId: string; email: string; onSignOut: () => void }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [collectionCount, setCollectionCount] = useState(0)
  const [wearCount, setWearCount] = useState(0)
  const [reviewCount, setReviewCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
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
  }, [userId])

  if (loading) {
    return (
      <main className="pt-24 pb-32 px-6 min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </main>
    )
  }

  return (
    <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen">
      {/* Avatar + Name */}
      <section className="flex flex-col items-center mb-10">
        <div className="w-20 h-20 rounded-full bg-surface-container flex items-center justify-center mb-4 ring-2 ring-primary/20">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
          ) : (
            <Icon name="person" className="text-3xl text-primary/40" />
          )}
        </div>
        <h2 className="font-headline text-2xl text-on-surface">{profile?.display_name ?? 'Fragrance Lover'}</h2>
        <p className="text-xs text-secondary/50 mt-1">{email}</p>

        {/* Level badge */}
        <div className="mt-3 flex items-center gap-2 bg-surface-container rounded-full px-4 py-1.5">
          <Icon name="emoji_events" filled className="text-primary text-sm" />
          <span className="font-label text-[10px] tracking-widest text-primary font-bold uppercase">
            Level {profile?.level ?? 1}
          </span>
          <span className="text-secondary/40 text-[10px]">·</span>
          <span className="text-[10px] text-secondary/60">{profile?.xp ?? 0} XP</span>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-3 gap-3 mb-10">
        {[
          { label: 'Collection', value: collectionCount, icon: 'water_drop' },
          { label: 'Wears', value: wearCount, icon: 'checkroom' },
          { label: 'Reviews', value: reviewCount, icon: 'rate_review' },
        ].map((stat) => (
          <div key={stat.label} className="bg-surface-container rounded-xl p-4 text-center">
            <Icon name={stat.icon} className="text-primary/60 text-xl mb-2" />
            <p className="font-headline text-2xl text-on-surface">{stat.value}</p>
            <p className="font-label text-[9px] tracking-[0.15em] text-secondary/50 uppercase mt-1">{stat.label}</p>
          </div>
        ))}
      </section>

      {/* Menu Items */}
      <section className="space-y-2 mb-10">
        {[
          { icon: 'tune', label: 'Scent Preferences', subtitle: 'Coming soon' },
          { icon: 'bar_chart', label: 'Insights & Stats', subtitle: 'Coming soon' },
          { icon: 'share', label: 'Share Profile', subtitle: 'Coming soon' },
        ].map((item) => (
          <div
            key={item.label}
            className="flex items-center gap-4 bg-surface-container rounded-xl px-4 py-3.5 opacity-50"
          >
            <Icon name={item.icon} className="text-primary" />
            <div className="flex-1">
              <p className="text-sm text-on-surface font-medium">{item.label}</p>
              <p className="text-[10px] text-secondary/50">{item.subtitle}</p>
            </div>
            <Icon name="chevron_right" className="text-secondary/30" />
          </div>
        ))}
      </section>

      {/* Sign Out */}
      <button
        onClick={onSignOut}
        className="w-full bg-surface-container rounded-xl px-4 py-3.5 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
      >
        <Icon name="logout" className="text-error/70" />
        <span className="text-sm text-error/70 font-medium">Sign out</span>
      </button>
    </main>
  )
}
