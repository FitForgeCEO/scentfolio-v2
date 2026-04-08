import { useNavigate, useLocation } from 'react-router-dom'
import { Icon } from '../ui/Icon'
import { NotificationBell } from '../ui/NotificationCenter'

interface TopAppBarProps {
  title?: string
  showBack?: boolean
  showSearch?: boolean
  showMenu?: boolean
  rightAction?: React.ReactNode
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

  return (
    <>
    {/* Skip to content — visible only on keyboard focus */}
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[200] focus:px-4 focus:py-2 focus:bg-primary focus:text-on-primary focus:rounded-lg focus:text-sm focus:font-bold"
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
            className="w-10 h-10 rounded-full bg-surface-container-highest/40 backdrop-blur-xl flex items-center justify-center active:scale-95 transition-transform"
          >
            <Icon name="arrow_back" className="text-primary" />
          </button>
        ) : null}

        {isHome && !showBack ? (
          <h1 className="font-headline text-xl tracking-tight text-primary">{title}</h1>
        ) : null}
      </div>

      {/* Center title (for non-home pages) */}
      {!isHome || showBack ? (
        <h1 className="font-headline tracking-[0.1em] uppercase text-xs text-primary">
          {title}
        </h1>
      ) : null}

      {/* Right */}
      <div className="flex items-center gap-3">
        {rightAction}
        {showSearch && (
          <button
            onClick={() => navigate('/search')}
            aria-label="Search fragrances"
            className="w-10 h-10 flex items-center justify-center active:scale-95 transition-transform"
          >
            <Icon name="search" className="text-primary" />
          </button>
        )}
        {isHome && !showBack && (
          <>
            <button
              onClick={() => navigate('/search')}
              aria-label="Search fragrances"
              className="w-10 h-10 flex items-center justify-center active:scale-95 transition-transform"
            >
              <Icon name="search" className="text-primary" />
            </button>
            <NotificationBell />
            <button
              onClick={() => navigate('/profile')}
              aria-label="Profile"
              className="flex items-center gap-2 active:scale-95 transition-transform"
            >
              <div className="w-8 h-8 rounded-full overflow-hidden bg-surface-container-highest">
                <div className="w-full h-full bg-gradient-to-br from-primary/30 to-surface-container-highest" />
              </div>
            </button>
          </>
        )}
      </div>
    </header>
    </>
  )
}
