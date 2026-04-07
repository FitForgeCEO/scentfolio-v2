import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { Icon } from '@/components/ui/Icon'

type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: number
  message: string
  type: ToastType
  icon?: string
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, icon?: string) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

let nextId = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((message: string, type: ToastType = 'success', icon?: string) => {
    const id = ++nextId
    setToasts((prev) => [...prev, { id, message, type, icon }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3000)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast container */}
      <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[200] flex flex-col items-center gap-2 pointer-events-none w-full max-w-[400px] px-4">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl backdrop-blur-md animate-slide-down ${
              toast.type === 'success'
                ? 'bg-primary/20 text-primary'
                : toast.type === 'error'
                ? 'bg-error/20 text-error'
                : 'bg-surface-container-highest/90 text-on-surface'
            }`}
          >
            <Icon
              name={toast.icon ?? (toast.type === 'success' ? 'check_circle' : toast.type === 'error' ? 'error' : 'info')}
              filled
              className="text-lg flex-shrink-0"
            />
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
