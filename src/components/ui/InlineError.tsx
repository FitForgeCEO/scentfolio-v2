import { Icon } from './Icon'

interface InlineErrorProps {
  message?: string
  onRetry?: () => void
}

export function InlineError({ message = 'Something went wrong', onRetry }: InlineErrorProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
      <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center mb-4">
        <Icon name="cloud_off" className="text-secondary/60 text-2xl" />
      </div>
      <p className="text-sm text-secondary mb-1">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 px-6 py-2.5 bg-surface-container text-primary text-xs font-bold uppercase tracking-[0.1em] rounded-full active:scale-95 transition-transform"
        >
          Try Again
        </button>
      )}
    </div>
  )
}
