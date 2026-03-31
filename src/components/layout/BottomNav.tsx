import { NavLink } from 'react-router-dom'
import { Icon } from '../ui/Icon'

const navItems = [
  { to: '/', icon: 'home', label: 'Home' },
  { to: '/collection', icon: 'shelves', label: 'Collection' },
  { to: '/explore', icon: 'explore', label: 'Explore' },
  { to: '/layering-lab', icon: 'science', label: 'Lab' },
  { to: '/profile', icon: 'person', label: 'Profile' },
]

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 w-full z-50 glass-surface flex justify-around items-center px-4 pt-2 pb-6 shadow-[0_-8px_32px_rgba(25,18,16,0.6)]">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center px-4 py-1.5 transition-all duration-300 ${
              isActive
                ? 'text-primary bg-surface-container-highest rounded-2xl'
                : 'text-secondary/60'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <Icon name={item.icon} filled={isActive} />
              <span className="font-label text-[10px] uppercase tracking-widest font-medium mt-1">
                {item.label}
              </span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
