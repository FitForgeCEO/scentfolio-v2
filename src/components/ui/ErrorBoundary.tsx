import { Component, type ReactNode, type ErrorInfo } from 'react'
import { trackEvent } from '@/lib/analytics'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack)
    trackEvent('app_error', {
      message: error.message,
      name: error.name,
      stack: (error.stack ?? '').slice(0, 500),
      component_stack: (info.componentStack ?? '').slice(0, 500),
    })
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center px-8 text-center">
          <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center mb-6">
            <span className="text-primary text-3xl">?</span>
          </div>
          <h2 className="font-headline text-xl text-on-surface mb-2">Something went wrong</h2>
          <p className="text-sm text-secondary mb-8 max-w-xs">
            An unexpected error occurred. Please try again.
          </p>
          <button
            onClick={this.handleReset}
            className="px-8 py-3 gold-gradient text-on-primary font-bold uppercase tracking-[0.1em] rounded-sm hover:opacity-80 transition-all text-sm"
          >
            Try Again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
