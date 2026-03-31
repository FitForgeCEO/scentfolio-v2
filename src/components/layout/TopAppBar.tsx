import { useNavigate, useLocation } from 'react-router-dom'
import { Icon } from '../ui/Icon'

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
  showMenu = true,
  rightAction,
}: TopAppBarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const isHome = location.pathname === '/'

  return (
    <header className="fixed top-0 w-full z-50 glass-surface flex justify-between items-center px-6 h-16">
      {/* Left */}
      <div className="flex items-center gap-4">
        {showBack ? (
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-surface-container-highest/40 backdrop-blur-xl flex items-center justify-center active:scale-95 transition-transform"
          >
            <Icon name="arrow_back" className="text-primary" />
          </button>
        ) : showMenu ? (
          <Icon name="menu" className="text-primary" />
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
        {showSearch && <Icon name="search" className="text-primary" />}
        {isHome && !showBack && (
          <>
            <span className="text-[10px] uppercase tracking-[0.1em] font-label text-secondary">
              LEVEL 12
            </span>
            <div className="w-8 h-8 rounded-full overflow-hidden bg-surface-container-highest">
              <div className="w-full h-full bg-gradient-to-br from-primary/30 to-surface-container-highest" />
            </div>
          </>
        )}
        {showBack && (
          <button className="w-10 h-10 flex items-center justify-center active:scale-95 transition-transform">
            <Icon name="more_vert" className="text-primary" />
          </button>
        )}
      </div>
    </header>
  )
}
