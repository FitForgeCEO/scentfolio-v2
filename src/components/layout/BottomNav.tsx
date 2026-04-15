import { NavLink } from 'react-router-dom'
import { prefetchRoute } from '../ui/PrefetchLink'

const navItems = [
  { to: '/', label: 'Home' },
  { to: '/collection', label: 'Collection' },
  { to: '/explore', label: 'Explore' },
  { to: '/layering-lab', label: 'Lab' },
  { to: '/signature', label: 'Signature' },
]

export function BottomNav() {
  return (
    <nav aria-label="Main navigation" className="fixed bottom-0 w-full z-[var(--z-appbar)] glass-surface flex justify-around items-center px-4 pt-2 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-[0_-8px_32px_rgba(25,18,16,0.6)]">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          aria-label={item.label}
          onMouseEnter={() => prefetchRoute(item.to)}
          onFocus={() => prefetchRoute(item.to)}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center min-h-[44px] px-4 py-2 transition-opacity duration-300 ${
              isActive
                ? 'text-primary'
                : 'text-secondary/60 hover:opacity-80'
            }`
          }
        >
          {({ isActive }) => (
            <span className={`font-label text-[10px] uppercase tracking-widest font-medium ${
              isActive ? 'font-bold' : ''
            }`}>
              {item.label}
              {isActive && (
                <span className="block mx-auto mt-1 h-[1px] w-4" style={{
                  backgroundImage: 'linear-gradient(90deg, transparent, var(--color-primary), transparent)',
                }} />
              )}
            </span>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
