import { useEffect, useRef } from 'react'

/**
 * Lightweight focus trap hook for modal/sheet components.
 * Traps Tab/Shift+Tab within the container, and closes on Escape.
 */
export function useFocusTrap(isOpen: boolean, onClose?: () => void) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen || !ref.current) return

    const container = ref.current
    const focusableSelector =
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

    // Store previously focused element to restore later
    const previouslyFocused = document.activeElement as HTMLElement | null

    // Focus first focusable element inside the trap
    const focusFirst = () => {
      const focusable = container.querySelectorAll<HTMLElement>(focusableSelector)
      if (focusable.length > 0) {
        focusable[0].focus()
      }
    }

    // Small delay to let the animation render
    const timer = setTimeout(focusFirst, 50)

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose?.()
        return
      }

      if (e.key !== 'Tab') return

      const focusable = container.querySelectorAll<HTMLElement>(focusableSelector)
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('keydown', handleKeyDown)
      // Restore focus when closing
      previouslyFocused?.focus()
    }
  }, [isOpen, onClose])

  return ref
}
