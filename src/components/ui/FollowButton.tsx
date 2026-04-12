import { useIsFollowing } from '@/hooks/useFollows'
import { useAuth } from '@/contexts/AuthContext'
import { getIconChar } from '@/lib/iconUtils'

interface Props {
  targetUserId: string
  compact?: boolean
}

export function FollowButton({ targetUserId, compact = false }: Props) {
  const { user } = useAuth()
  const { following, loading, toggleFollow } = useIsFollowing(targetUserId)

  // Don't show for own profile or unauthenticated
  if (!user || user.id === targetUserId) return null
  if (loading) return <div className="w-20 h-8 rounded-full bg-surface-container animate-pulse" />

  if (compact) {
    return (
      <button
        onClick={toggleFollow}
        className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all hover:opacity-80 ${
          following
            ? 'bg-surface-container text-secondary/60 ring-1 ring-outline-variant/20'
            : 'gold-gradient text-on-primary-container'
        }`}
      >
        {following ? 'Following' : 'Follow'}
      </button>
    )
  }

  return (
    <button
      onClick={toggleFollow}
      className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all hover:opacity-80 ${
        following
          ? 'bg-surface-container text-secondary/70 ring-1 ring-outline-variant/20'
          : 'gold-gradient text-on-primary-container shadow-lg'
      }`}
    >
      <span>{getIconChar(following ? 'person_remove' : 'person_add')}</span>
      {following ? 'Following' : 'Follow'}
    </button>
  )
}
