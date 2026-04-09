import { useAuth } from '@/contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { AuthScreen } from './AuthScreen'
import { Icon } from '../ui/Icon'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { getLevelProgress, getXPForNextLevel, getLevelTitle } from '@/lib/xp'
import { EditProfileSheet } from './EditProfileSheet'
import { PullToRefresh } from '../ui/PullToRefresh'
import { useProfileExtras, useSignatureFragrance } from '@/hooks/useProfileExtras'
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

  useEffect(() => { fetchData() }, [userId])

  if (loading) {
    return (
      <main className="pt-24 pb-32 px-6 min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </main>
    )
  }

  return (
    <PullToRefresh onRefresh={async () => fetchData()}>
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

        {/* Bio */}
        {extras.bio && (
          <p className="text-sm text-on-surface-variant/80 mt-3 max-w-[300px] text-center italic leading-relaxed">
            "{extras.bio}"
          </p>
        )}

        {/* Signature Scent */}
        {signatureFragrance && (
          <div className="mt-3 flex items-center gap-2.5 bg-surface-container px-3.5 py-2.5 rounded-2xl">
            <div className="w-8 h-8 rounded-lg overflow-hidden bg-surface-container-highest flex-shrink-0">
              {signatureFragrance.image_url ? (
                <img src={signatureFragrance.image_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Icon name="water_drop" className="text-secondary/30" size={14} />
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
        {extras.favorite_notes.length > 0 && (
          <div className="mt-3 flex flex-wrap justify-center gap-1.5 max-w-[300px]">
            {extras.favorite_notes.map((note) => (
              <span key={note} className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-medium">
                {note}
              </span>
            ))}
          </div>
        )}

        {/* Level + XP progress */}
        {(() => {
          const level = profile?.level ?? 1
          const xp = profile?.xp ?? 0
          const progress = getLevelProgress(xp, level)
          const nextLevelXP = getXPForNextLevel(level)
          const title = getLevelTitle(level)
          return (
            <div className="mt-4 w-full max-w-[280px]">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Icon name="emoji_events" filled className="text-primary text-sm" />
                  <span className="font-label text-[10px] tracking-widest text-primary font-bold uppercase">
                    Level {level}
                  </span>
                  <span className="text-[10px] text-secondary/60">·</span>
                  <span className="text-[10px] text-secondary/60 italic">{title}</span>
                </div>
                <span className="text-[9px] text-secondary/50">{xp} / {nextLevelXP} XP</span>
              </div>
              <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-700"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )
        })()}
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

      {/* My Scent Identity */}
      <section className="mb-10">
        <h3 className="text-[10px] uppercase tracking-[0.15em] font-label text-secondary mb-3">MY SCENT IDENTITY</h3>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => navigate('/dna')}
            className="flex items-center gap-3 bg-surface-container p-4 rounded-xl text-left active:scale-[0.97] transition-transform"
          >
            <Icon name="fingerprint" className="text-primary" />
            <div>
              <p className="text-sm text-on-surface font-medium">DNA Profile</p>
              <p className="text-[10px] text-secondary/50">Your scent radar</p>
            </div>
          </button>
          <button
            onClick={() => navigate('/profile-card')}
            className="flex items-center gap-3 bg-surface-container p-4 rounded-xl text-left active:scale-[0.97] transition-transform"
          >
            <Icon name="badge" className="text-primary" />
            <div>
              <p className="text-sm text-on-surface font-medium">Profile Card</p>
              <p className="text-[10px] text-secondary/50">Share your taste</p>
            </div>
          </button>
          <button
            onClick={() => navigate('/stats')}
            className="flex items-center gap-3 bg-surface-container p-4 rounded-xl text-left active:scale-[0.97] transition-transform"
          >
            <Icon name="analytics" className="text-primary" />
            <div>
              <p className="text-sm text-on-surface font-medium">Stats</p>
              <p className="text-[10px] text-secondary/50">Your taste decoded</p>
            </div>
          </button>
          <button
            onClick={() => navigate('/achievements')}
            className="flex items-center gap-3 bg-surface-container p-4 rounded-xl text-left active:scale-[0.97] transition-transform"
          >
            <Icon name="emoji_events" className="text-primary" />
            <div>
              <p className="text-sm text-on-surface font-medium">Achievements</p>
              <p className="text-[10px] text-secondary/50">Badges & milestones</p>
            </div>
          </button>
          <button
            onClick={() => navigate('/challenges')}
            className="flex items-center gap-3 bg-surface-container p-4 rounded-xl text-left active:scale-[0.97] transition-transform"
          >
            <Icon name="flag" className="text-primary" />
            <div>
              <p className="text-sm text-on-surface font-medium">Challenges</p>
              <p className="text-[10px] text-secondary/50">Goals & rewards</p>
            </div>
          </button>
          <button
            onClick={() => navigate('/collection-insights')}
            className="flex items-center gap-3 bg-surface-container p-4 rounded-xl text-left active:scale-[0.97] transition-transform"
          >
            <Icon name="psychology" className="text-primary" />
            <div>
              <p className="text-sm text-on-surface font-medium">Insights</p>
              <p className="text-[10px] text-secondary/50">Collection decoded</p>
            </div>
          </button>
          <button
            onClick={() => navigate('/collection-health')}
            className="flex items-center gap-3 bg-surface-container p-4 rounded-xl text-left active:scale-[0.97] transition-transform"
          >
            <Icon name="health_and_safety" className="text-primary" />
            <div>
              <p className="text-sm text-on-surface font-medium">Health Score</p>
              <p className="text-[10px] text-secondary/50">Rate your collection</p>
            </div>
          </button>
          <button
            onClick={() => navigate('/brands')}
            className="flex items-center gap-3 bg-surface-container p-4 rounded-xl text-left active:scale-[0.97] transition-transform"
          >
            <Icon name="storefront" className="text-primary" />
            <div>
              <p className="text-sm text-on-surface font-medium">Brands</p>
              <p className="text-[10px] text-secondary/50">Browse by brand</p>
            </div>
          </button>
          <button
            onClick={() => navigate('/families')}
            className="flex items-center gap-3 bg-surface-container p-4 rounded-xl text-left active:scale-[0.97] transition-transform"
          >
            <Icon name="category" className="text-primary" />
            <div>
              <p className="text-sm text-on-surface font-medium">Families</p>
              <p className="text-[10px] text-secondary/50">Browse by note family</p>
            </div>
          </button>
          <button
            onClick={() => navigate('/top-shelf')}
            className="flex items-center gap-3 bg-surface-container p-4 rounded-xl text-left active:scale-[0.97] transition-transform"
          >
            <Icon name="shelves" className="text-primary" />
            <div>
              <p className="text-sm text-on-surface font-medium">Top Shelf</p>
              <p className="text-[10px] text-secondary/50">Your all-time faves</p>
            </div>
          </button>
          <button
            onClick={() => navigate('/milestones')}
            className="flex items-center gap-3 bg-surface-container p-4 rounded-xl text-left active:scale-[0.97] transition-transform"
          >
            <Icon name="workspace_premium" className="text-primary" />
            <div>
              <p className="text-sm text-on-surface font-medium">Milestones</p>
              <p className="text-[10px] text-secondary/50">Track your journey</p>
            </div>
          </button>
        </div>
      </section>

      {/* Personal Tools */}
      <section className="mb-10">
        <h3 className="text-[10px] uppercase tracking-[0.15em] font-label text-secondary mb-3">PERSONAL</h3>
        <div className="space-y-2">
          <button
            onClick={() => navigate('/activity')}
            className="w-full flex items-center gap-4 bg-surface-container rounded-xl px-4 py-3.5 active:scale-[0.98] transition-transform text-left"
          >
            <Icon name="notifications" className="text-primary" />
            <div className="flex-1">
              <p className="text-sm text-on-surface font-medium">Activity & Notifications</p>
              <p className="text-[10px] text-secondary/50">Your recent activity log</p>
            </div>
            <Icon name="chevron_right" className="text-secondary/60" />
          </button>
          <button
            onClick={() => navigate('/scent-quiz')}
            className="w-full flex items-center gap-4 bg-surface-container rounded-xl px-4 py-3.5 active:scale-[0.98] transition-transform text-left"
          >
            <Icon name="quiz" className="text-primary" />
            <div className="flex-1">
              <p className="text-sm text-on-surface font-medium">Scent Quiz</p>
              <p className="text-[10px] text-secondary/50">Discover your profile</p>
            </div>
            <Icon name="chevron_right" className="text-secondary/60" />
          </button>
          <button
            onClick={() => navigate('/gift-finder')}
            className="w-full flex items-center gap-4 bg-surface-container rounded-xl px-4 py-3.5 active:scale-[0.98] transition-transform text-left"
          >
            <Icon name="card_giftcard" className="text-primary" />
            <div className="flex-1">
              <p className="text-sm text-on-surface font-medium">Gift Finder</p>
              <p className="text-[10px] text-secondary/50">Find the perfect gift</p>
            </div>
            <Icon name="chevron_right" className="text-secondary/60" />
          </button>
          <button
            onClick={() => navigate('/dupes')}
            className="w-full flex items-center gap-4 bg-surface-container rounded-xl px-4 py-3.5 active:scale-[0.98] transition-transform text-left"
          >
            <Icon name="compare_arrows" className="text-primary" />
            <div className="flex-1">
              <p className="text-sm text-on-surface font-medium">Dupe Finder</p>
              <p className="text-[10px] text-secondary/50">Similar scents & alternatives</p>
            </div>
            <Icon name="chevron_right" className="text-secondary/60" />
          </button>
          <button
            onClick={() => navigate('/blind-buys')}
            className="w-full flex items-center gap-4 bg-surface-container rounded-xl px-4 py-3.5 active:scale-[0.98] transition-transform text-left"
          >
            <Icon name="shopping_bag" className="text-primary" />
            <div className="flex-1">
              <p className="text-sm text-on-surface font-medium">Blind Buys</p>
              <p className="text-[10px] text-secondary/50">Track unsniffed purchases</p>
            </div>
            <Icon name="chevron_right" className="text-secondary/60" />
          </button>
          <button
            onClick={() => navigate('/wear-predictions')}
            className="w-full flex items-center gap-4 bg-surface-container rounded-xl px-4 py-3.5 active:scale-[0.98] transition-transform text-left"
          >
            <Icon name="smart_toy" className="text-primary" />
            <div className="flex-1">
              <p className="text-sm text-on-surface font-medium">Today's Picks</p>
              <p className="text-[10px] text-secondary/50">Smart wear suggestions</p>
            </div>
            <Icon name="chevron_right" className="text-secondary/60" />
          </button>
          <button
            onClick={() => navigate('/journal')}
            className="w-full flex items-center gap-4 bg-surface-container rounded-xl px-4 py-3.5 active:scale-[0.98] transition-transform text-left"
          >
            <Icon name="edit_note" className="text-primary" />
            <div className="flex-1">
              <p className="text-sm text-on-surface font-medium">Scent Journal</p>
              <p className="text-[10px] text-secondary/50">Your fragrance diary</p>
            </div>
            <Icon name="chevron_right" className="text-secondary/60" />
          </button>
          <button
            onClick={() => navigate('/calendar')}
            className="w-full flex items-center gap-4 bg-surface-container rounded-xl px-4 py-3.5 active:scale-[0.98] transition-transform text-left"
          >
            <Icon name="calendar_month" className="text-primary" />
            <div className="flex-1">
              <p className="text-sm text-on-surface font-medium">Wear Calendar</p>
              <p className="text-[10px] text-secondary/50">Monthly wear overview</p>
            </div>
            <Icon name="chevron_right" className="text-secondary/60" />
          </button>
          <button
            onClick={() => navigate('/heatmap')}
            className="w-full flex items-center gap-4 bg-surface-container rounded-xl px-4 py-3.5 active:scale-[0.98] transition-transform text-left"
          >
            <Icon name="grid_on" className="text-primary" />
            <div className="flex-1">
              <p className="text-sm text-on-surface font-medium">Wear Heatmap</p>
              <p className="text-[10px] text-secondary/50">Activity heatmap & cost per wear</p>
            </div>
            <Icon name="chevron_right" className="text-secondary/60" />
          </button>
          <button
            onClick={() => navigate('/timeline')}
            className="w-full flex items-center gap-4 bg-surface-container rounded-xl px-4 py-3.5 active:scale-[0.98] transition-transform text-left"
          >
            <Icon name="timeline" className="text-primary" />
            <div className="flex-1">
              <p className="text-sm text-on-surface font-medium">Timeline</p>
              <p className="text-[10px] text-secondary/50">Your fragrance journey</p>
            </div>
            <Icon name="chevron_right" className="text-secondary/60" />
          </button>
        </div>
      </section>

      {/* Share & Social */}
      <section className="mb-10">
        <h3 className="text-[10px] uppercase tracking-[0.15em] font-label text-secondary mb-3">SHARE & SOCIAL</h3>
        <button
          onClick={() => navigate('/feed')}
          className="w-full flex items-center gap-4 bg-surface-container rounded-xl px-4 py-3.5 active:scale-[0.98] transition-transform text-left mb-3"
        >
          <Icon name="dynamic_feed" className="text-primary" />
          <div className="flex-1">
            <p className="text-sm text-on-surface font-medium">Social Feed</p>
            <p className="text-[10px] text-secondary/50">See what people you follow are wearing</p>
          </div>
          <Icon name="chevron_right" className="text-secondary/60" />
        </button>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => navigate('/share-collection')}
            className="flex items-center gap-3 bg-surface-container p-4 rounded-xl text-left active:scale-[0.97] transition-transform"
          >
            <Icon name="auto_awesome" className="text-primary" />
            <div>
              <p className="text-sm text-on-surface font-medium">Share Cards</p>
              <p className="text-[10px] text-secondary/50">Wrapped-style cards</p>
            </div>
          </button>
          <button
            onClick={() => navigate('/year-wrapped')}
            className="flex items-center gap-3 bg-surface-container p-4 rounded-xl text-left active:scale-[0.97] transition-transform"
          >
            <Icon name="celebration" className="text-primary" />
            <div>
              <p className="text-sm text-on-surface font-medium">Year Wrapped</p>
              <p className="text-[10px] text-secondary/50">Annual summary</p>
            </div>
          </button>
          <button
            onClick={() => navigate('/month-review')}
            className="flex items-center gap-3 bg-surface-container p-4 rounded-xl text-left active:scale-[0.97] transition-transform"
          >
            <Icon name="calendar_month" className="text-primary" />
            <div>
              <p className="text-sm text-on-surface font-medium">Month Review</p>
              <p className="text-[10px] text-secondary/50">Monthly highlights</p>
            </div>
          </button>
          <button
            onClick={() => navigate('/badges')}
            className="flex items-center gap-3 bg-surface-container p-4 rounded-xl text-left active:scale-[0.97] transition-transform"
          >
            <Icon name="military_tech" className="text-primary" />
            <div>
              <p className="text-sm text-on-surface font-medium">Badges</p>
              <p className="text-[10px] text-secondary/50">Shareable proof</p>
            </div>
          </button>
        </div>
      </section>

      {/* Account */}
      <section className="space-y-2 mb-10">
        <h3 className="text-[10px] uppercase tracking-[0.15em] font-label text-secondary mb-3">ACCOUNT</h3>
        <button
          onClick={() => setEditSheetOpen(true)}
          className="w-full flex items-center gap-4 bg-surface-container rounded-xl px-4 py-3.5 active:scale-[0.98] transition-transform text-left"
        >
          <Icon name="edit" className="text-primary" />
          <div className="flex-1">
            <p className="text-sm text-on-surface font-medium">Edit Profile</p>
            <p className="text-[10px] text-secondary/50">Name, bio, signature scent & notes</p>
          </div>
          <Icon name="chevron_right" className="text-secondary/60" />
        </button>
        <button
          onClick={() => navigate('/settings')}
          className="w-full flex items-center gap-4 bg-surface-container rounded-xl px-4 py-3.5 active:scale-[0.98] transition-transform text-left"
        >
          <Icon name="settings" className="text-primary" />
          <div className="flex-1">
            <p className="text-sm text-on-surface font-medium">Settings</p>
            <p className="text-[10px] text-secondary/50">Preferences, data export, currency</p>
          </div>
          <Icon name="chevron_right" className="text-secondary/60" />
        </button>
        <button
          onClick={() => navigate('/blocked')}
          className="w-full flex items-center gap-4 bg-surface-container rounded-xl px-4 py-3.5 active:scale-[0.98] transition-transform text-left"
        >
          <Icon name="block" className="text-primary" />
          <div className="flex-1">
            <p className="text-sm text-on-surface font-medium">Blocked Users</p>
            <p className="text-[10px] text-secondary/50">Manage blocked accounts</p>
          </div>
          <Icon name="chevron_right" className="text-secondary/60" />
        </button>
      </section>

      {/* Sign Out */}
      <button
        onClick={onSignOut}
        className="w-full bg-surface-container rounded-xl px-4 py-3.5 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
      >
        <Icon name="logout" className="text-error/70" />
        <span className="text-sm text-error/70 font-medium">Sign out</span>
      </button>

      {/* Edit Profile Sheet */}
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
