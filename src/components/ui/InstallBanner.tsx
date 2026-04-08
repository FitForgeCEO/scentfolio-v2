import { Icon } from './Icon'
import { usePWAInstall } from '@/hooks/usePWAInstall'
import { hapticLight } from '@/lib/haptics'

export function InstallBanner() {
  const { canInstall, install, dismiss } = usePWAInstall()

  if (!canInstall) return null

  return (
    <div className="fixed bottom-20 left-4 right-4 z-[var(--z-overlay)] max-w-[400px] mx-auto animate-slide-up">
      <div className="bg-surface-container-highest rounded-2xl p-4 shadow-xl border border-outline-variant/10">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl gold-gradient flex items-center justify-center flex-shrink-0 ambient-glow">
            <Icon name="install_mobile" className="text-on-primary text-xl" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-on-surface font-medium">Install ScentFolio</p>
            <p className="text-[10px] text-secondary/60">Works offline · Push reminders · Instant access</p>
          </div>
          <button
            onClick={dismiss}
            className="w-8 h-8 rounded-full flex items-center justify-center text-secondary/40 active:scale-90 transition-transform flex-shrink-0"
            aria-label="Dismiss"
          >
            <Icon name="close" size={18} />
          </button>
        </div>
        <button
          onClick={() => { hapticLight(); install() }}
          className="w-full mt-3 py-3 gold-gradient rounded-xl text-[10px] font-bold uppercase tracking-widest text-on-primary active:scale-[0.98] transition-all ambient-glow"
        >
          ADD TO HOME SCREEN
        </button>
      </div>
    </div>
  )
}
