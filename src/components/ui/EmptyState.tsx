import { Icon } from './Icon'

interface EmptyStateProps {
  icon: string
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
  }
}

/**
 * Consistent branded empty state used across all screens.
 * Shows an icon, title, description, and optional CTA button.
 */
export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 animate-fade-in">
      <div className="w-20 h-20 rounded-full bg-surface-container flex items-center justify-center mb-5">
        <Icon name={icon} className="text-4xl text-primary/40" />
      </div>
      <h4 className="font-headline text-xl text-on-surface mb-2 text-center">{title}</h4>
      <p className="text-sm text-secondary/60 text-center max-w-[260px] leading-relaxed">
        {description}
      </p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-6 gold-gradient text-on-primary-container px-6 py-3 rounded-xl font-label text-[10px] font-bold uppercase tracking-widest active:scale-95 transition-all"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
