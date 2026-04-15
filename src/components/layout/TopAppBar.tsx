import { useNavigate, useLocation } from 'react-router-dom'
import { NotificationBell } from '../ui/NotificationCenter'
import { useAuth } from '@/contexts/AuthContext'

interface TopAppBarProps {
  title?: string
  showBack?: boolean
  showSearch?: boolean
  showMenu?: boolean
  rightAction?: React.ReactNode
}

function monogramFor(name?: string | null, email?: string | null): string {
  const source = (name || email || '').trim()
  if (!source) return '❧'
  const parts = source.split(/[\s@._-]+/).filter(Boolean)
  if (parts.length === 0) return source.charAt(0).toUpperCase()
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase()
}

export function TopAppBar({
  title = 'ScentFolio',
  showBack = false,
  showSearch = false,
  rightAction,
}: TopAppBarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const isHome = location.pathname === '/'
  const isSearch = location.pathname === '/search'
  const { user } = useAuth()
  const avatarUrl = (user?.user_metadata as { avatar_url?: string } | undefined)?.avatar_url
  const displayName = (user?.user_metadata as { display_name?: string } | undefined)?.display_name
  const monogram = monogramFor(displayName, user?.email)

  return (
    <>
    {/* Skip to content — visible only on keyboard focus */}
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[200] focus:px-4 focus:py-2 focus:bg-primary focus:text-on-primary focus:rounded-sm focus:text-sm focus:font-bold"
    >
      Skip to content
    </a>
    <header role="banner" className="fixed top-0 w-full z-[var(--z-appbar)] glass-surface flex justify-between items-center px-6 h-16 pt-[env(safe-area-inset-top)]">
      {/* Left */}
      <div className="flex items-center gap-4">
        {showBack ? (
          <button
            onClick={() => navigate(-1)}
            aria-label="Go back"
            className="w-10 h-10 rounded-sm bg-surface/40 backdrop-blur-xl flex items-center justify-center transition-opacity hover:opacity-80"
          >
            <span className="text-primary text-lg leading-none">←</span>
          </button>
        ) : null}

        {isHome && !showBack ? (
          <h1 className="font-headline text-xl tracking-tight text-primary">{title}</h1>
        ) : null}
      </div>

      {/* Centre title (for non-home pages) */}
      {!isHome || showBack ? (
        <h1 className="font-headline tracking-[0.1em] uppercase text-xs text-primary">
          {title}
        </h1>
      ) : null}

      {/* Right */}
      <div className="flex items-center gap-3">
        {rightAction}
        {showSearch && !isSearch && (
          <button
            onClick={() => navigate('/search')}
            aria-label="Search fragrances"
            className="w-10 h-10 flex items-center justify-center transition-opacity hover:opacity-80"
          >
            <span className="text-primary text-xs font-label uppercase tracking-widest">Search</span>
          </button>
        )}
        {isHome && !showBack && (
          <>
            <button
              onClick={() => navigate('/search')}
              aria-label="Search fragrances"
              className="px-2 py-1 flex items-center justify-center transition-opacity hover:opacity-80"
            >
              <span className="text-primary text-[10px] font-label uppercase tracking-widest">Search</span>
            </button>
            <button
              onClick={() => navigate('/community')}
              aria-label="Community feed"
              className="px-2 py-1 flex items-center justify-center transition-opacity hover:opacity-80"
            >
              <span className="text-primary text-[10px] font-label uppercase tracking-widest">Forum</span>
            </button>
            <NotificationBell />
            <button
              onClick={() => navigate('/profile')}
              aria-label="Profile"
              className="flex items-center gap-2 transition-opacity hover:opacity-80"
            >
              <div className="w-8 h-8 rounded-sm overflow-hidden bg-surface-container-highest flex items-center justify-center">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="font-headline text-[11px] tracking-[0.1em] uppercase text-primary">{monogram}</span>
                )}
              </div>
            </button>
          </>
        )}
      </div>
    </header>
    </>
  )
}
