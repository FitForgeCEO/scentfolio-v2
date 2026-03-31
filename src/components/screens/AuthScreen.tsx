import { useState } from 'react'
import { Icon } from '../ui/Icon'
import { useAuth } from '@/contexts/AuthContext'

type Mode = 'sign_in' | 'sign_up'

export function AuthScreen() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<Mode>('sign_in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [confirmSent, setConfirmSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (mode === 'sign_up') {
      if (!displayName.trim()) {
        setError('Display name is required')
        setLoading(false)
        return
      }
      const { error } = await signUp(email, password, displayName.trim())
      if (error) {
        setError(error)
      } else {
        setConfirmSent(true)
      }
    } else {
      const { error } = await signIn(email, password)
      if (error) setError(error)
    }

    setLoading(false)
  }

  if (confirmSent) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-8 bg-background">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
          <Icon name="mark_email_read" className="text-primary text-3xl" />
        </div>
        <h2 className="font-headline text-2xl text-on-surface text-center mb-3">Check your email</h2>
        <p className="text-sm text-secondary/70 text-center max-w-[280px] mb-8">
          We sent a confirmation link to <span className="text-on-surface font-medium">{email}</span>. Click it to activate your account.
        </p>
        <button
          onClick={() => { setConfirmSent(false); setMode('sign_in') }}
          className="text-primary text-sm font-medium"
        >
          Back to sign in
        </button>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-8 bg-background">
      {/* Logo */}
      <div className="mb-10 text-center">
        <h1 className="font-headline text-3xl text-on-surface tracking-tight">SCENTFOLIO</h1>
        <p className="text-xs text-secondary/50 tracking-[0.3em] uppercase mt-1">Your fragrance journey</p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-[320px] space-y-4">
        {mode === 'sign_up' && (
          <div>
            <label className="font-label text-[10px] tracking-[0.15em] text-secondary/60 uppercase block mb-1.5">
              Display name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              className="w-full bg-surface-container rounded-xl px-4 py-3.5 text-sm text-on-surface placeholder:text-secondary/70 focus:outline-none focus:ring-1 ring-primary/30"
            />
          </div>
        )}

        <div>
          <label className="font-label text-[10px] tracking-[0.15em] text-secondary/60 uppercase block mb-1.5">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            className="w-full bg-surface-container rounded-xl px-4 py-3.5 text-sm text-on-surface placeholder:text-secondary/70 focus:outline-none focus:ring-1 ring-primary/30"
          />
        </div>

        <div>
          <label className="font-label text-[10px] tracking-[0.15em] text-secondary/60 uppercase block mb-1.5">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            minLength={6}
            className="w-full bg-surface-container rounded-xl px-4 py-3.5 text-sm text-on-surface placeholder:text-secondary/70 focus:outline-none focus:ring-1 ring-primary/30"
          />
        </div>

        {error && (
          <div className="bg-error/10 border border-error/20 rounded-xl px-4 py-3 text-xs text-error">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full gold-gradient text-on-primary-container py-3.5 rounded-xl font-label text-[10px] font-bold uppercase tracking-widest active:scale-[0.98] transition-all shadow-lg disabled:opacity-50"
        >
          {loading ? 'Please wait...' : mode === 'sign_in' ? 'SIGN IN' : 'CREATE ACCOUNT'}
        </button>
      </form>

      <div className="mt-8">
        <button
          onClick={() => { setMode(mode === 'sign_in' ? 'sign_up' : 'sign_in'); setError(null) }}
          className="text-sm text-secondary/60"
        >
          {mode === 'sign_in' ? (
            <>Don&apos;t have an account? <span className="text-primary font-medium">Sign up</span></>
          ) : (
            <>Already have an account? <span className="text-primary font-medium">Sign in</span></>
          )}
        </button>
      </div>
    </main>
  )
}
