import { useState, useEffect } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISSED_KEY = 'scentfolio-install-dismissed'

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isDismissed, setIsDismissed] = useState(() => {
    try {
      const ts = localStorage.getItem(DISMISSED_KEY)
      if (!ts) return false
      // Allow re-prompt after 7 days
      return Date.now() - parseInt(ts) < 7 * 86400000
    } catch { return false }
  })

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
      return
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', handler)

    // Track successful install
    window.addEventListener('appinstalled', () => setIsInstalled(true))

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  const canInstall = !!deferredPrompt && !isInstalled && !isDismissed

  const install = async () => {
    if (!deferredPrompt) return false
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    setDeferredPrompt(null)
    if (outcome === 'accepted') {
      setIsInstalled(true)
      return true
    }
    return false
  }

  const dismiss = () => {
    setIsDismissed(true)
    setDeferredPrompt(null)
    try { localStorage.setItem(DISMISSED_KEY, Date.now().toString()) } catch {}
  }

  return { canInstall, isInstalled, install, dismiss }
}
