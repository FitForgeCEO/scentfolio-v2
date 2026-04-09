import { useState, useEffect, useRef } from 'react'
import { Icon } from './Icon'
import { usePWAInstall } from '@/hooks/usePWAInstall'
import { hapticLight } from '@/lib/haptics'
import { trackEvent, AnalyticsEvents } from '@/lib/analytics'

/* ─── iOS detection ─── */
function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function isInStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && (navigator as { standalone?: boolean }).standalone === true)
}

function isIOSSafari(): boolean {
  const ua = navigator.userAgent
  return isIOS() && /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS|EdgiOS/.test(ua)
}

const IOS_DISMISSED_KEY = 'scentfolio-ios-install-dismissed'

/* ─── iOS Install Guide ─── */
function IOSInstallGuide({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="fixed bottom-[5.5rem] left-4 right-4 z-[var(--z-overlay)] max-w-[400px] mx-auto animate-slide-up">
      <div className="bg-surface-container-highest rounded-2xl p-4 shadow-xl border border-outline-variant/10">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl gold-gradient flex items-center justify-center flex-shrink-0 ambient-glow">
            <Icon name="install_mobile" className="text-on-primary text-lg" />
          </div>
          <div className="flex-1">
            <p className="text-sm text-on-surface font-medium">Install ScentFolio</p>
            <p className="text-[10px] text-secondary/60 mt-0.5">Add to your home screen for the full app experience</p>
          </div>
          <button
            onClick={onDismiss}
            className="w-8 h-8 rounded-full flex items-center justify-center text-secondary/40 active:scale-90 transition-transform flex-shrink-0"
            aria-label="Dismiss"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        {/* Step-by-step iOS instructions */}
        <div className="space-y-2.5 mb-3">
          <div className="flex items-center gap-3 bg-surface-container rounded-xl px-3 py-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-primary text-xs font-bold">1</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-on-surface text-xs">Tap the</span>
              <Icon name="ios_share" className="text-primary text-base" />
              <span className="text-on-surface text-xs">share button below</span>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-surface-container rounded-xl px-3 py-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-primary text-xs font-bold">2</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-on-surface text-xs">Scroll down and tap</span>
              <span className="text-primary text-xs font-medium">&ldquo;Add to Home Screen&rdquo;</span>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-surface-container rounded-xl px-3 py-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-primary text-xs font-bold">3</span>
            </div>
            <span className="text-on-surface text-xs">Tap <span className="text-primary font-medium">&ldquo;Add&rdquo;</span> in the top right</span>
          </div>
        </div>

        {/* Arrow pointing down to Safari share button */}
        <div className="flex justify-center">
          <Icon name="arrow_downward" className="text-primary text-lg animate-bounce" />
        </div>
      </div>
    </div>
  )
}

/* ─── Main Install Banner ─── */
export function InstallBanner() {
  const { canInstall, isInstalled, install, dismiss } = usePWAInstall()
  const tracked = useRef(false)
  const [showIOSGuide, setShowIOSGuide] = useState(false)
  const [pageViews, setPageViews] = useState(0)

  // Track prompt shown
  useEffect(() => {
    if (canInstall && !tracked.current) {
      tracked.current = true
      trackEvent(AnalyticsEvents.PWA_INSTALL_PROMPT)
    }
  }, [canInstall])

  // Smart timing: show after 3 page views (not immediately)
  useEffect(() => {
    const count = parseInt(sessionStorage.getItem('sf-page-views') || '0', 10) + 1
    sessionStorage.setItem('sf-page-views', count.toString())
    setPageViews(count)
  }, [])

  // iOS detection
  useEffect(() => {
    if (isInStandalone()) return
    if (!isIOSSafari()) return
    if (isInstalled) return

    // Check if dismissed
    try {
      const ts = localStorage.getItem(IOS_DISMISSED_KEY)
      if (ts && Date.now() - parseInt(ts) < 7 * 86400000) return
    } catch { /* ignore */ }

    // Show after 3 page views
    if (pageViews >= 3) {
      setShowIOSGuide(true)
      trackEvent(AnalyticsEvents.PWA_INSTALL_PROMPT, { platform: 'ios' })
    }
  }, [pageViews, isInstalled])

  const dismissIOS = () => {
    setShowIOSGuide(false)
    try { localStorage.setItem(IOS_DISMISSED_KEY, Date.now().toString()) } catch { /* ignore */ }
  }

  // iOS guide
  if (showIOSGuide) {
    return <IOSInstallGuide onDismiss={dismissIOS} />
  }

  // Standard install banner (Android/Chrome) - also delay until 3 page views
  if (!canInstall || pageViews < 3) return null

  return (
    <div className="fixed bottom-[5.5rem] left-4 right-4 z-[var(--z-overlay)] max-w-[400px] mx-auto animate-slide-up">
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
          onClick={() => { hapticLight(); trackEvent(AnalyticsEvents.PWA_INSTALLED); install() }}
          className="w-full mt-3 py-3 gold-gradient rounded-xl text-[10px] font-bold uppercase tracking-widest text-on-primary active:scale-[0.98] transition-all ambient-glow"
        >
          ADD TO HOME SCREEN
        </button>
      </div>
    </div>
  )
}
