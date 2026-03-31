import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../ui/Icon'
import { useTrendingFragrances } from '@/hooks/useFragrances'
import { useHomeStats } from '@/hooks/useHomeStats'
import { useAuth } from '@/contexts/AuthContext'
import { LogWearSheet } from './LogWearSheet'

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export function HomeScreen() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: trending, loading } = useTrendingFragrances(4)
  const { stats } = useHomeStats(user?.id)
  const [logSheetOpen, setLogSheetOpen] = useState(false)

  const displayName = user?.user_metadata?.display_name || 'fragrance lover'

  return (
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
        <div className="bg-surface-container p-4 rounded-xl flex flex-col justify-between h-28">
          <div className="flex items-center gap-2">
            <Icon name="local_fire_department" filled className="text-primary text-sm" />
            <span className="text-[10px] uppercase tracking-[0.1em] font-label text-secondary">
              STREAK
            </span>
          </div>
          <p className="font-headline text-2xl">
            {stats.streak} day{stats.streak !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="bg-surface-container p-4 rounded-xl flex flex-col justify-between h-28">
          <div className="flex items-center gap-2">
            <Icon name="calendar_month" filled className="text-primary text-sm" />
            <span className="text-[10px] uppercase tracking-[0.1em] font-label text-secondary">
              THIS MONTH
            </span>
          </div>
          <p className="font-headline text-2xl">
            {stats.monthWears} wear{stats.monthWears !== 1 ? 's' : ''}
          </p>
        </div>
      </section>

      {/* Collection Stats Bento */}
      <section className="grid grid-cols-2 gap-4">
        <div className="bg-surface-container p-5 rounded-xl space-y-1">
          <span className="text-[10px] uppercase tracking-[0.1em] font-label text-primary font-bold">OWNED</span>
          <p className="font-headline text-3xl">{stats.owned}</p>
        </div>
        <div className="bg-surface-container p-5 rounded-xl space-y-1">
          <span className="text-[10px] uppercase tracking-[0.1em] font-label text-secondary">WISHLIST</span>
          <p className="font-headline text-3xl">{stats.wishlist}</p>
        </div>
        <div className="bg-surface-container p-5 rounded-xl space-y-1">
          <span className="text-[10px] uppercase tracking-[0.1em] font-label text-secondary">REVIEWS</span>
          <p className="font-headline text-3xl">{stats.reviews}</p>
        </div>
        <div className="bg-surface-container p-5 rounded-xl space-y-1">
          <span className="text-[10px] uppercase tracking-[0.1em] font-label text-secondary">BOARDS</span>
          <p className="font-headline text-3xl">{stats.boards}</p>
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

        {loading ? (
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
                onClick={() => navigate(`/fragrance/${frag.id}`)}
              >
                <div className="aspect-[3/4] rounded-xl overflow-hidden bg-surface-container-low shadow-sm">
                  {frag.image_url ? (
                    <img
                      src={frag.image_url}
                      alt={frag.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-secondary/30">
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
    </main>
  )
}
