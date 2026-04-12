import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { FollowButton } from '../ui/FollowButton'
import { useFollowList, useFollowCounts } from '@/hooks/useFollows'
import { getIconChar } from '@/lib/iconUtils'

type Tab = 'followers' | 'following'

export function FollowListScreen() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('followers')
  const { followers: followerCount, following: followingCount } = useFollowCounts(userId)
  const { users, loading } = useFollowList(userId, tab)

  if (!userId) {
    return (
      <main className="pt-24 pb-32 px-6 flex flex-col items-center justify-center min-h-screen gap-4">
        <span className="text-5xl text-primary/20">?</span>
        <p className="text-secondary/60 text-sm">User not found</p>
      </main>
    )
  }

  return (
    <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen">
      {/* Tabs */}
      <div className="flex border-b border-outline-variant/10 mb-4">
        {(['followers', 'following'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-colors relative ${
              tab === t ? 'text-primary' : 'text-secondary/40'
            }`}
          >
            {t === 'followers' ? `Followers (${followerCount})` : `Following (${followingCount})`}
            {tab === t && (
              <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-primary rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 animate-pulse">
              <div className="w-10 h-10 rounded-full bg-surface-container-highest" />
              <div className="flex-1">
                <div className="h-3 bg-surface-container-highest rounded w-28 mb-1" />
                <div className="h-2 bg-surface-container-highest rounded w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : users.length === 0 ? (
        <div className="py-16 text-center">
          <span className="text-4xl text-primary/20 mb-4">{getIconChar(tab === 'followers' ? 'group' : 'person_search')}</span>
          <p className="text-sm text-secondary/50">
            {tab === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {users.map((u) => (
            <div key={u.id} className="flex items-center gap-3 px-3 py-2.5 rounded-sm active:bg-surface-container/50 transition-colors">
              <button
                onClick={() => navigate(`/u/${u.id}`)}
                className="flex items-center gap-3 flex-1 min-w-0 text-left"
              >
                <div className="w-10 h-10 rounded-full bg-surface-container-highest overflow-hidden flex-shrink-0">
                  {u.avatar_url ? (
                    <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-surface-container-highest">
                      <span className="text-primary/40">⊚</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-on-surface font-medium truncate">{u.display_name}</p>
                  <p className="text-[10px] text-secondary/40">Level {u.level}</p>
                </div>
              </button>
              <FollowButton targetUserId={u.id} compact />
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
