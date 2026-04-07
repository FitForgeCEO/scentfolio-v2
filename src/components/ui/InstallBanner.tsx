import { Icon } from './Icon'
import { usePWAInstall } from '@/hooks/usePWAInstall'

export function InstallBanner() {
  const { canInstall, install, dismiss } = usePWAInstall()

  if (!canInstall) return null

  return (
    <div className="fixed bottom-20 left-4 right-4 z-[var(--z-overlay)] max-w-[400px] mx-auto animate-slide-up">
      <div className="bg-surface-container-highest rounded-2xl p-4 shadow-xl border border-outline-variant/10 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl gold-gradient flex items-center justify-center flex-shrink-0 ambient-glow">
          <Icon name="install_mobile" className="text-on-primary text-xl" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-on-surface font-medium">Install ScentFolio</p>
          <p className="text-[10px] text-secondary/60">Add to home screen for the full experience</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={dismiss}
            className="w-8 h-8 rounded-full flex items-center justify-center text-secondary/40 active:scale-90 transition-transform"
            aria-label="Dismiss"
          >
            <Icon name="close" size={18} />
          </button>
          <button
            onClick={install}
            className="px-4 py-2 gold-gradient rounded-lg text-[10px] font-bold uppercase tracking-wider text-on-primary active:scale-95 transition-transform"
          >
            INSTALL
          </button>
        </div>
      </div>
    </div>
  )
}
