import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { trackEvent, AnalyticsEvents } from '@/lib/analytics'

type Mode = 'sign_in' | 'sign_up'

// ── Noir editorial calibration: "The Endpaper" & "The Wax Seal" ──
// The Endpaper  = the form itself (sign-in / sign-up).
// The Wax Seal  = the confirmation state after a successful sign-up.
// Typography carries the whole screen — no cards, no boxes, just
// tonal depth, a hairline gold rule, and italic serif copy.

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
        setError('A name is required for your shelf')
        setLoading(false)
        return
      }
      const { error } = await signUp(email, password, displayName.trim())
      if (error) {
        setError(error)
      } else {
        trackEvent(AnalyticsEvents.SIGN_UP)
        setConfirmSent(true)
      }
    } else {
      const { error } = await signIn(email, password)
      if (error) setError(error)
    }

    setLoading(false)
  }

  // ── The Wax Seal — post-signup confirmation ───────────────────────────
  if (confirmSent) {
    const firstName = displayName.trim().split(' ')[0] ?? ''
    return (
      <main className="relative min-h-screen bg-background text-on-background overflow-hidden">
        {/* Ambient radial glow */}
        <div
          className="fixed inset-0 z-0 pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(229,194,118,0.08) 0%, rgba(25,18,16,0) 70%)' }}
        />

        {/* Corner accents — ghost hairlines at 20% opacity */}
        <div className="fixed bottom-8 left-8 opacity-20 pointer-events-none hidden md:block">
          <div className="w-12 h-px bg-outline-variant mb-2" />
          <div className="w-px h-12 bg-outline-variant" />
        </div>
        <div className="fixed top-8 right-8 opacity-20 pointer-events-none hidden md:block">
          <div className="flex justify-end"><div className="w-12 h-px bg-outline-variant mb-2" /></div>
          <div className="flex justify-end"><div className="w-px h-12 bg-outline-variant" /></div>
        </div>

        <section className="relative z-10 flex flex-col items-center justify-center min-h-screen px-8 text-center">
          {/* The Seal */}
          <div className="flex flex-col items-center mb-16">
            <div className="relative mb-6">
              <div className="absolute inset-0 rounded-full blur-xl bg-primary/10" />
              <div
                className="relative w-[72px] h-[72px] rounded-full bg-surface-container-highest flex items-center justify-center"
                style={{ boxShadow: 'inset 0 0 12px rgba(229,194,118,0.3)' }}
              >
                <span className="font-headline italic text-4xl text-primary leading-none select-none">S</span>
              </div>
            </div>
            <p className="font-headline text-[10px] tracking-[0.25em] text-primary uppercase select-none">
              A letter is on its way
            </p>
          </div>

          {/* Message */}
          <div className="max-w-xs space-y-4 mb-16">
            <h1 className="font-headline text-3xl md:text-4xl text-on-background leading-tight">
              {firstName ? `Check your inbox, ${firstName}.` : 'Check your inbox.'}
            </h1>
            <div className="space-y-1">
              <p className="font-headline italic text-on-background/80 text-lg leading-relaxed">
                We've sent a confirmation to <span className="not-italic font-body text-base">{email}</span>.
              </p>
              <p className="font-headline text-sm tracking-wide text-on-background/60">
                Open it to unlock your shelf.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col items-center space-y-8">
            {/* Resend — decorative for now, no reset flow wired */}
            {/* TODO: wire to supabase.auth.resend when the flow lands */}
            <div className="group flex flex-col items-center cursor-default">
              <span className="text-[11px] font-bold tracking-[0.2em] text-primary/60 uppercase transition-all duration-300">
                Resend the letter
              </span>
              <div className="h-px bg-primary/40 w-1/2 mt-1.5" />
            </div>
            <button
              onClick={() => { setConfirmSent(false); setMode('sign_in') }}
              className="font-headline italic text-on-background/40 hover:text-on-background/70 text-sm transition-colors duration-300"
            >
              back to sign in
            </button>
          </div>
        </section>
      </main>
    )
  }

  // ── The Endpaper — sign-in / sign-up form ─────────────────────────────
  const isSignUp = mode === 'sign_up'
  const ctaLabel = loading
    ? 'Please wait…'
    : isSignUp
      ? 'Begin a New Volume'
      : 'Return to Your Shelf'

  return (
    <main className="relative min-h-screen bg-background text-on-background overflow-x-hidden">
      {/* Ambient radial glow — top-weighted */}
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{ background: 'radial-gradient(circle at 50% 20%, rgba(229,194,118,0.08) 0%, rgba(25,18,16,0) 70%)' }}
      />

      <section className="relative z-10 flex flex-col items-center justify-between min-h-screen px-8 py-16">
        {/* Masthead */}
        <header className="flex flex-col items-center text-center space-y-6 pt-8">
          <span className="text-[10px] tracking-[0.3em] text-primary/40 uppercase">
            Est · MMXXVI · London
          </span>
          <div className="flex flex-col items-center space-y-4">
            <h1 className="font-headline text-5xl md:text-6xl font-bold text-[#f0dfdb] tracking-tight">
              ScentFolio
            </h1>
            {/* 40px gold hairline rule — the editorial anchor */}
            <div className="w-10 h-px bg-primary/30" />
            <p className="font-headline italic text-secondary/80 text-sm md:text-base max-w-xs">
              a quiet room for the scents that mean something.
            </p>
          </div>
        </header>

        {/* Form column */}
        <section className="w-full max-w-[320px] mt-12 flex-grow flex flex-col justify-center">
          <form onSubmit={handleSubmit} className="space-y-8">
            {isSignUp && (
              <div className="space-y-2">
                <label className="block text-[10px] tracking-[0.15em] text-primary/60 uppercase">Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="the name on your shelf"
                  className="w-full bg-surface-container border-none rounded-lg py-4 px-5 text-on-surface placeholder:text-on-surface-variant/30 text-sm transition-all duration-300 focus:outline-none focus:ring-1 focus:ring-primary/30"
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-[10px] tracking-[0.15em] text-primary/60 uppercase">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full bg-surface-container border-none rounded-lg py-4 px-5 text-on-surface placeholder:text-on-surface-variant/30 text-sm transition-all duration-300 focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] tracking-[0.15em] text-primary/60 uppercase">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="at least six characters"
                required
                minLength={6}
                className="w-full bg-surface-container border-none rounded-lg py-4 px-5 text-on-surface placeholder:text-on-surface-variant/30 text-sm transition-all duration-300 focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
            </div>

            {error && (
              <p className="font-headline italic text-xs text-error text-center">
                {error}
              </p>
            )}

            {/* CTA + mode toggle */}
            <div className="pt-4 space-y-6">
              <button
                type="submit"
                disabled={loading}
                className="w-full gold-gradient text-on-primary py-5 rounded-lg text-xs font-bold tracking-[0.2em] uppercase active:scale-[0.98] transition-transform duration-200 disabled:opacity-50"
                style={{ boxShadow: '0 12px 32px rgba(25,18,16,0.6)' }}
              >
                {ctaLabel}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => { setMode(isSignUp ? 'sign_in' : 'sign_up'); setError(null) }}
                  className="font-headline italic text-sm text-secondary/70 hover:text-primary transition-colors"
                >
                  {isSignUp ? 'Already have a shelf?' : 'No shelf yet?'}
                  <span className="text-primary not-italic text-[10px] tracking-widest ml-2 uppercase">
                    {isSignUp ? 'Sign in' : 'Begin a new volume'}
                  </span>
                </button>
              </div>
            </div>
          </form>
        </section>

        {/* Footer */}
        <footer className="mt-16 flex flex-col items-center space-y-8 w-full">
          {/* TODO: surface "forgot your key?" link when reset-password flow lands */}
          <div className="flex items-center space-x-6 text-[9px] tracking-[0.2em] text-on-surface-variant/20 uppercase">
            <a href="#" className="hover:text-primary transition-colors">Terms</a>
            <span className="w-1 h-1 bg-on-surface-variant/20 rounded-full" />
            <a href="#" className="hover:text-primary transition-colors">Privacy</a>
          </div>
        </footer>
      </section>
    </main>
  )
}
