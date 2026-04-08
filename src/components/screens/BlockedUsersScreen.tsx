import { useNavigate } from 'react-router-dom'
import { Icon } from '../ui/Icon'
import { useBlockedUsers } from '@/hooks/useBlockUser'
import { useToast } from '@/contexts/ToastContext'

export function BlockedUsersScreen() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { users, loading, unblock } = useBlockedUsers()

  const handleUnblock = async (userId: string, name: string) => {
    await unblock(userId)
    showToast(`Unblocked ${name}`, 'success')
  }

  return (
    <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen">
      <section className="text-center mb-6">
        <h2 className="font-headline text-xl mb-1">Blocked Users</h2>
        <p className="text-[10px] text-secondary/50">
          Blocked users can't see your profile or interact with you
        </p>
      </section>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 animate-pulse">
              <div className="w-10 h-10 rounded-full bg-surface-container-highest" />
              <div className="flex-1">
                <div className="h-3 bg-surface-container-highest rounded w-28 mb-1" />
                <div className="h-2 bg-surface-container-highest rounded w-20" />
              </div>
            </div>
          ))}
        </div>
      ) : users.length === 0 ? (
        <div className="py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center mx-auto mb-4">
            <Icon name="check_circle" className="text-primary/30 text-3xl" />
          </div>
          <p className="text-sm text-secondary/50 mb-2">No blocked users</p>
          <p className="text-xs text-secondary/30">You haven't blocked anyone</p>
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <div
              key={u.id}
              className="flex items-center gap-3 bg-surface-container rounded-xl px-4 py-3"
            >
              <button
                onClick={() => navigate(`/u/${u.id}`)}
                className="flex items-center gap-3 flex-1 min-w-0 text-left active:opacity-70 transition-opacity"
              >
                <div className="w-10 h-10 rounded-full bg-surface-container-highest overflow-hidden flex-shrink-0">
                  {u.avatar_url ? (
                    <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Icon name="person" className="text-secondary/30" size={18} />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-on-surface font-medium truncate">{u.display_name}</p>
                  <p className="text-[9px] text-secondary/30">
                    Blocked {new Date(u.blocked_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
              </button>
              <button
                onClick={() => handleUnblock(u.id, u.display_name)}
                className="text-[10px] text-error/70 font-bold uppercase tracking-wider px-3 py-2 rounded-lg bg-error/5 active:scale-95 transition-all"
              >
                Unblock
              </button>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
