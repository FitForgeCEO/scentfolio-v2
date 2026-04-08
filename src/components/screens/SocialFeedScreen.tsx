import { useNavigate } from 'react-router-dom'
import { Icon } from '../ui/Icon'
import { useAuth } from '@/contexts/AuthContext'
import { useFollowedActivity, type FeedItem } from '@/hooks/useFollows'

function formatTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export function SocialFeedScreen() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { items, loading } = useFollowedActivity(40)

  if (!user) {
    return (
      <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen flex flex-col items-center justify-center">
        <Icon name="group" className="text-4xl text-primary/20 mb-4" />
        <h3 className="font-headline text-xl text-on-surface mb-2">Sign in to see your feed</h3>
        <button onClick={() => navigate('/profile')} className="gold-gradient text-on-primary-container px-8 py-3 rounded-xl font-label text-[10px] font-bold uppercase tracking-widest active:scale-95 transition-all shadow-lg mt-4">SIGN IN</button>
      </main>
    )
  }

  return (
    <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-headline text-2xl text-on-surface">Feed</h2>
        <button
          onClick={() => navigate('/community')}
          className="text-[10px] text-primary font-bold uppercase tracking-wider active:scale-95 transition-transform"
        >
          Discover people
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-surface-container rounded-xl p-4 animate-pulse">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-surface-container-highest" />
                <div className="h-3 bg-surface-container-highest rounded w-32" />
              </div>
              <div className="h-16 bg-surface-container-highest rounded-xl" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="py-16 text-center">
          <div className="w-20 h-20 rounded-full bg-surface-container flex items-center justify-center mx-auto mb-6">
            <Icon name="group_add" className="text-primary/30 text-4xl" />
          </div>
          <h3 className="font-headline text-xl text-on-surface mb-2">Your feed is empty</h3>
          <p className="text-sm text-secondary/50 mb-6 max-w-[280px] mx-auto">
            Follow other fragrance enthusiasts to see what they're wearing and reviewing.
          </p>
          <button
            onClick={() => navigate('/community')}
            className="gold-gradient text-on-primary-container px-6 py-3 rounded-xl font-label text-[10px] font-bold uppercase tracking-widest active:scale-95 transition-all shadow-lg"
          >
            FIND PEOPLE TO FOLLOW
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <FeedCard key={item.id} item={item} navigate={navigate} />
          ))}
        </div>
      )}
    </main>
  )
}

function FeedCard({ item, navigate }: { item: FeedItem; navigate: (path: string) => void }) {
  const typeIcon = item.type === 'wear' ? 'air' : item.type === 'review' ? 'rate_review' : 'add_circle'
  const typeColor = item.type === 'wear' ? 'text-blue-400' : item.type === 'review' ? 'text-amber-400' : 'text-emerald-400'

  return (
    <div className="bg-surface-container rounded-xl overflow-hidden">
      {/* User header */}
      <button
        onClick={() => navigate(`/u/${item.userId}`)}
        className="w-full flex items-center gap-3 px-4 pt-3 pb-2 text-left active:opacity-70 transition-opacity"
      >
        <div className="w-8 h-8 rounded-full bg-surface-container-highest overflow-hidden flex-shrink-0">
          {item.userAvatar ? (
            <img src={item.userAvatar} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-surface-container-highest">
              <Icon name="person" className="text-primary/40" size={16} />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-xs text-on-surface font-bold truncate">{item.userName}</p>
            <Icon name={typeIcon} className={typeColor} size={14} />
            <p className="text-xs text-secondary/50">{item.title}</p>
          </div>
          <p className="text-[10px] text-secondary/30">{formatTime(item.timestamp)}</p>
        </div>
      </button>

      {/* Content card */}
      <div className="px-4 pb-3">
        <div className="bg-surface-container-highest/40 rounded-xl p-3 flex items-center gap-3">
          {item.imageUrl && (
            <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
              <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-on-surface font-medium truncate">{item.title.replace(/^(wore|reviewed) /, '')}</p>
            <p className="text-[10px] text-secondary/50">{item.subtitle}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
