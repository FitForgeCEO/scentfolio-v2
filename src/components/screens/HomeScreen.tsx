import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../ui/Icon'
import { InlineError } from '../ui/InlineError'
import { WelcomeOverlay } from '../ui/WelcomeOverlay'
import { useTrendingFragrances } from '@/hooks/useFragrances'
import { useHomeStats } from '@/hooks/useHomeStats'
import { useAuth } from '@/contexts/AuthContext'
import { LogWearSheet } from './LogWearSheet'
import { PullToRefresh } from '../ui/PullToRefresh'
import { WearStreakWidget } from './WearStreakWidget'

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export function HomeScreen() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: trending, loading, error: trendingError, retry: retryTrending } = useTrendingFragrances(4)
  const { stats, retry: retryStats } = useHomeStats(user?.id)
  const [logSheetOpen, setLogSheetOpen] = useState(false)

  const displayName = user?.user_metadata?.display_name || 'fragrance lover'

  const handleRefresh = async () => {
    retryTrending()
    retryStats()
  }

  return (
    <PullToRefresh onRefresh={handleRefresh}>
    <main className="pt-24 pb-32 px-6 space-y-10">
      {/* Greeting & Quick Action Hero */}
      <section className="space-y-6">
        <h2 className="font-headline text-2xl font-bold">
          {getGreeting()}, {displayName.split(' ')[0]}
        </h2>
        <div className="relative h-64 w-full rounded-xl overflow-hidden bg-surface-container-low shadow-xl">
          {trending[0]?.image_url && (
            <img
              src={trending[0].image_url}
              alt="Hero Scent"
              className="absolute inset-0 w-full h-full object-cover opacity-60"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
          <div className="absolute inset-0 p-6 flex flex-col justify-between">
            <p className="font-headline text-3xl italic text-on-surface opacity-90 max-w-[200px]">
              What are you wearing today?
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => {
                  if (!user) { navigate('/profile'); return }
                  setLogSheetOpen(true)
                }}
                className="gold-gradient text-on-primary-container px-6 py-3 rounded-xl font-label text-[10px] font-bold uppercase tracking-widest active:scale-95 transition-all shadow-lg"
              >
                LOG WEAR
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Streak Counter */}
      <section className="grid grid-cols-2 gap-4">
        <button
          onClick={() => navigate('/wear-history')}
          className="bg-surface-container p-4 rounded-xl flex flex-col justify-between h-28 text-left active:scale-[0.97] transition-transform"
        >
          <div className="flex items-center gap-2">
            <Icon name="local_fire_department" filled className="text-primary text-sm" />
            <span className="text-[10px] uppercase tracking-[0.1em] font-label text-secondary">
              STREAK
            </span>
          </div>
          <p className="font-headline text-2xl">
            {stats.streak} day{stats.streak !== 1 ? 's' : ''}
          </p>
        </button>
        <button
          onClick={() => navigate('/wear-history')}
          className="bg-surface-container p-4 rounded-xl flex flex-col justify-between h-28 text-left active:scale-[0.97] transition-transform"
        >
          <div className="flex items-center gap-2">
            <Icon name="calendar_month" filled className="text-primary text-sm" />
            <span className="text-[10px] uppercase tracking-[0.1em] font-label text-secondary">
              THIS MONTH
            </span>
          </div>
          <p className="font-headline text-2xl">
            {stats.monthWears} wear{stats.monthWears !== 1 ? 's' : ''}
          </p>
        </button>
      </section>

      {/* Streak Milestones */}
      <section>
        <h3 className="text-[10px] uppercase tracking-[0.15em] font-label text-secondary mb-3">STREAK MILESTONES</h3>
        <div className="flex gap-3">
          {[
            { days: 3, icon: 'bolt', label: '3 Days' },
            { days: 7, icon: 'whatshot', label: '7 Days' },
            { days: 14, icon: 'military_tech', label: '14 Days' },
            { days: 30, icon: 'diamond', label: '30 Days' },
          ].map((m) => {
            const achieved = stats.streak >= m.days
            return (
              <div
                key={m.days}
                className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl transition-all ${
                  achieved ? 'bg-primary/10' : 'bg-surface-container'
                }`}
              >
                <Icon
                  name={m.icon}
                  filled={achieved}
                  className={`text-xl ${achieved ? 'text-primary' : 'text-secondary/50'}`}
                />
                <span className={`text-[9px] font-bold tracking-wider ${achieved ? 'text-primary' : 'text-secondary/60'}`}>
                  {m.label}
                </span>
              </div>
            )
          })}
        </div>
      </section>

      {/* Wear Streak Widget */}
      {user && <WearStreakWidget />}

      {/* Collection Stats Bento */}
      <section className="grid grid-cols-2 gap-4">
        <div className="bg-surface-container p-5 rounded-xl space-y-1">
          <span className="text-[10px] uppercase tracking-[0.1em] font-label text-primary font-bold">OWNED</span>
          <p className="font-headline text-3xl">{stats.owned}</p>
        </div>
        <button onClick={() => navigate('/wishlist')} className="bg-surface-container p-5 rounded-xl space-y-1 text-left active:scale-[0.97] transition-transform">
          <span className="text-[10px] uppercase tracking-[0.1em] font-label text-secondary">WISHLIST</span>
          <p className="font-headline text-3xl">{stats.wishlist}</p>
        </button>
        <div className="bg-surface-container p-5 rounded-xl space-y-1">
          <span className="text-[10px] uppercase tracking-[0.1em] font-label text-secondary">REVIEWS</span>
          <p className="font-headline text-3xl">{stats.reviews}</p>
        </div>
        <button onClick={() => navigate('/boards')} className="bg-surface-container p-5 rounded-xl space-y-1 text-left active:scale-[0.97] transition-transform">
          <span className="text-[10px] uppercase tracking-[0.1em] font-label text-secondary">BOARDS</span>
          <p className="font-headline text-3xl">{stats.boards}</p>
        </button>
      </section>

      {/* Quick Actions */}
      <section className="space-y-3">
        <h3 className="text-[10px] uppercase tracking-[0.15em] font-label text-secondary">QUICK ACTIONS</h3>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => navigate('/daily')} className="flex items-center gap-3 bg-surface-container p-4 rounded-xl text-left active:scale-[0.97] transition-transform">
            <Icon name="wb_sunny" className="text-primary" />
            <div>
              <p className="text-sm text-on-surface font-medium">Daily Pick</p>
              <p className="text-[10px] text-secondary/50">Today's suggestion</p>
            </div>
          </button>
          <button onClick={() => navigate('/rotation')} className="flex items-center gap-3 bg-surface-container p-4 rounded-xl text-left active:scale-[0.97] transition-transform">
            <Icon name="calendar_month" className="text-primary" />
            <div>
              <p className="text-sm text-on-surface font-medium">Rotation</p>
              <p className="text-[10px] text-secondary/50">Seasonal capsule</p>
            </div>
          </button>
          <button onClick={() => navigate('/stats')} className="flex items-center gap-3 bg-surface-container p-4 rounded-xl text-left active:scale-[0.97] transition-transform">
            <Icon name="analytics" className="text-primary" />
            <div>
              <p className="text-sm text-on-surface font-medium">Stats</p>
              <p className="text-[10px] text-secondary/50">Your taste decoded</p>
            </div>
          </button>
          <button onClick={() => navigate('/smart-recs')} className="flex items-center gap-3 bg-surface-container p-4 rounded-xl text-left active:scale-[0.97] transition-transform">
            <Icon name="auto_awesome" className="text-primary" />
            <div>
              <p className="text-sm text-on-surface font-medium">For You</p>
              <p className="text-[10px] text-secondary/50">Smart picks</p>
            </div>
          </button>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <button onClick={() => navigate('/notes')} className="flex flex-col items-center gap-1.5 bg-surface-container p-3 rounded-xl active:scale-[0.97] transition-transform">
            <Icon name="spa" className="text-primary" size={20} />
            <p className="text-[9px] text-on-surface font-medium">Notes</p>
          </button>
          <button onClick={() => navigate('/combos')} className="flex flex-col items-center gap-1.5 bg-surface-container p-3 rounded-xl active:scale-[0.97] transition-transform">
            <Icon name="layers" className="text-primary" size={20} />
            <p className="text-[9px] text-on-surface font-medium">Combos</p>
          </button>
          <button onClick={() => navigate('/lists')} className="flex flex-col items-center gap-1.5 bg-surface-container p-3 rounded-xl active:scale-[0.97] transition-transform">
            <Icon name="bookmarks" className="text-primary" size={20} />
            <p className="text-[9px] text-on-surface font-medium">Lists</p>
          </button>
          <button onClick={() => navigate('/timeline')} className="flex flex-col items-center gap-1.5 bg-surface-container p-3 rounded-xl active:scale-[0.97] transition-transform">
            <Icon name="timeline" className="text-primary" size={20} />
            <p className="text-[9px] text-on-surface font-medium">Timeline</p>
          </button>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <button onClick={() => navigate('/mood')} className="flex flex-col items-center gap-1.5 bg-surface-container p-3 rounded-xl active:scale-[0.97] transition-transform">
            <Icon name="mood" className="text-primary" size={20} />
            <p className="text-[9px] text-on-surface font-medium">Mood</p>
          </button>
          <button onClick={() => navigate('/journal')} className="flex flex-col items-center gap-1.5 bg-surface-container p-3 rounded-xl active:scale-[0.97] transition-transform">
            <Icon name="edit_note" className="text-primary" size={20} />
            <p className="text-[9px] text-on-surface font-medium">Journal</p>
          </button>
          <button onClick={() => navigate('/calendar')} className="flex flex-col items-center gap-1.5 bg-surface-container p-3 rounded-xl active:scale-[0.97] transition-transform">
            <Icon name="calendar_month" className="text-primary" size={20} />
            <p className="text-[9px] text-on-surface font-medium">Calendar</p>
          </button>
          <button onClick={() => navigate('/quick-rate')} className="flex flex-col items-center gap-1.5 bg-surface-container p-3 rounded-xl active:scale-[0.97] transition-transform">
            <Icon name="star_rate" className="text-primary" size={20} />
            <p className="text-[9px] text-on-surface font-medium">Rate</p>
          </button>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <button onClick={() => navigate('/community')} className="flex flex-col items-center gap-1.5 bg-surface-container p-3 rounded-xl active:scale-[0.97] transition-transform">
            <Icon name="forum" className="text-primary" size={20} />
            <p className="text-[9px] text-on-surface font-medium">Feed</p>
          </button>
          <button onClick={() => navigate('/leaderboard')} className="flex flex-col items-center gap-1.5 bg-surface-container p-3 rounded-xl active:scale-[0.97] transition-transform">
            <Icon name="leaderboard" className="text-primary" size={20} />
            <p className="text-[9px] text-on-surface font-medium">Trending</p>
          </button>
          <button onClick={() => navigate('/dna')} className="flex flex-col items-center gap-1.5 bg-surface-container p-3 rounded-xl active:scale-[0.97] transition-transform">
            <Icon name="fingerprint" className="text-primary" size={20} />
            <p className="text-[9px] text-on-surface font-medium">DNA</p>
          </button>
          <button onClick={() => navigate('/layering')} className="flex flex-col items-center gap-1.5 bg-surface-container p-3 rounded-xl active:scale-[0.97] transition-transform">
            <Icon name="layers" className="text-primary" size={20} />
            <p className="text-[9px] text-on-surface font-medium">Layer</p>
          </button>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <button onClick={() => navigate('/prices')} className="flex flex-col items-center gap-1.5 bg-surface-container p-3 rounded-xl active:scale-[0.97] transition-transform">
            <Icon name="payments" className="text-primary" size={20} />
            <p className="text-[9px] text-on-surface font-medium">Prices</p>
          </button>
          <button onClick={() => navigate('/seasonal')} className="flex flex-col items-center gap-1.5 bg-surface-container p-3 rounded-xl active:scale-[0.97] transition-transform">
            <Icon name="eco" className="text-primary" size={20} />
            <p className="text-[9px] text-on-surface font-medium">Seasonal</p>
          </button>
          <button onClick={() => navigate('/duplicates')} className="flex flex-col items-center gap-1.5 bg-surface-container p-3 rounded-xl active:scale-[0.97] transition-transform">
            <Icon name="find_replace" className="text-primary" size={20} />
            <p className="text-[9px] text-on-surface font-medium">Dupes</p>
          </button>
          <button onClick={() => navigate('/profile-card')} className="flex flex-col items-center gap-1.5 bg-surface-container p-3 rounded-xl active:scale-[0.97] transition-transform">
            <Icon name="badge" className="text-primary" size={20} />
            <p className="text-[9px] text-on-surface font-medium">Card</p>
          </button>
        </div>
      </section>

      {/* Trending Now — real Supabase data */}
      <section className="space-y-4">
        <div className="flex justify-between items-end">
          <div>
            <span className="text-[10px] uppercase tracking-[0.1em] font-label text-secondary">COMMUNITY</span>
            <h3 className="font-headline text-xl">Top Rated</h3>
          </div>
        </div>

        {trendingError ? (
          <InlineError message="Couldn't load trending fragrances" onRetry={retryTrending} />
        ) : loading ? (
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="aspect-[3/4] rounded-xl bg-surface-container animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {trending.map((frag) => (
              <div
                key={frag.id}
                className="space-y-2 group cursor-pointer"
                role="link"
                tabIndex={0}
                onClick={() => navigate(`/fragrance/${frag.id}`)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/fragrance/${frag.id}`) } }}
              >
                <div className="aspect-[3/4] rounded-xl overflow-hidden bg-surface-container-low shadow-sm">
                  {frag.image_url ? (
                    <img
                      src={frag.image_url}
                      alt={frag.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-secondary/50">
                      <Icon name="water_drop" size={48} />
                    </div>
                  )}
                </div>
                <div className="px-1">
                  <span className="text-[9px] uppercase tracking-[0.1em] font-label text-secondary">
                    {frag.brand}
                  </span>
                  <h4 className="text-sm font-semibold truncate">{frag.name}</h4>
                  {frag.rating && (
                    <div className="flex items-center gap-1 mt-1">
                      <Icon name="star" filled className="text-[12px] text-primary" />
                      <span className="text-[10px] text-on-surface-variant">
                        {Number(frag.rating).toFixed(1)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Log Wear Sheet (opened from hero CTA — no specific fragrance pre-selected) */}
      <LogWearSheet isOpen={logSheetOpen} onClose={() => setLogSheetOpen(false)} />

      {/* Welcome onboarding for new users */}
      {user && <WelcomeOverlay userId={user.id} />}
    </main>
    </PullToRefresh>
  )
}
