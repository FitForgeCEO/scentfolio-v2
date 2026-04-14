import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

// ── "The Rekeying" ──
// Arrived via a recovery link. Supabase has already consumed the token and
// created a session by the time React mounts here; onAuthStateChange fires
// PASSWORD_RECOVERY. We give the user a quiet place to set a new key.

type Phase = 'verifying' | 'ready' | 'updating' | 'done' | 'error'

export function ResetPasswordScreen() {
  const navigate = useNavigate()
  const { updatePassword } = useAuth()
  const [phase, setPhase] = useState<Phase>('verifying')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let recovered = false

    // Supabase fires PASSWORD_RECOVERY when the user lands via a recovery link.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        recovered = true
        setPhase('ready')
      }
    })

    // Fallback: if we already have a session (recovery redirect completes before
    // onAuthStateChange fires in some browsers), allow the reset form to render.
    const t = window.setTimeout(() => {
      if (recovered) return
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) {
          setPhase('ready')
        } else {
          setPhase('error')
          setError('This reset link is invalid or has expired. Request a new one.')
        }
      })
    }, 600)

    return () => {
      sub.subscription.unsubscribe()
      window.clearTimeout(t)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('At least six characters, please.')
      return
    }
    if (password !== confirm) {
      setError('The two keys don’t match.')
      return
    }

    setPhase('updating')
    const { error } = await updatePassword(password)
    if (error) {
      setError(error)
      setPhase('ready')
      return
    }
    setPhase('done')
    // Sign out so the user explicitly signs back in with the new password.
    await supabase.auth.signOut()
    window.setTimeout(() => navigate('/', { replace: true }), 1800)
  }

  return (
    <main className="relative min-h-screen bg-background text-on-background overflow-x-hidden">
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{ background: 'radial-gradient(circle at 50% 20%, rgba(229,194,118,0.08) 0%, rgba(25,18,16,0) 70%)' }}
      />

      <section className="relative z-10 flex flex-col items-center justify-between min-h-screen px-8 py-16">
        <header className="flex flex-col items-center text-center space-y-6 pt-8">
          <span className="text-[10px] tracking-[0.3em] text-primary/40 uppercase">
            Est · MMXXVI · London
          </span>
          <div className="flex flex-col items-center space-y-4">
            <h1 className="font-headline text-5xl md:text-6xl font-bold text-[#f0dfdb] tracking-tight">
              ScentFolio
            </h1>
            <div className="w-10 h-px bg-primary/30" />
            <p className="font-headline italic text-secondary/80 text-sm md:text-base max-w-xs">
              Set a new key for your shelf.
            </p>
          </div>
        </header>

        <section className="w-full max-w-[320px] mt-12 flex-grow flex flex-col justify-center">
          {phase === 'verifying' && (
            <p className="font-headline italic text-center text-on-surface-variant/50 text-sm">
              Unlocking…
            </p>
          )}

          {phase === 'error' && (
            <div className="space-y-6 text-center">
              <p className="font-headline italic text-error text-sm leading-relaxed">
                {error}
              </p>
              <button
                type="button"
                onClick={() => navigate('/', { replace: true })}
                className="w-full gold-gradient text-on-primary py-4 rounded-sm text-xs font-bold tracking-[0.2em] uppercase hover:opacity-80 transition"
              >
                Back to sign in
              </button>
            </div>
          )}

          {phase === 'done' && (
            <div className="space-y-4 text-center">
              <span className="text-[10px] tracking-[0.3em] text-primary/60 uppercase">Done</span>
              <div className="w-10 h-px bg-primary/30 mx-auto" />
              <p className="font-headline italic text-on-background/80 text-sm leading-relaxed">
                Your new key is set. Returning you to the entrance…
              </p>
            </div>
          )}

          {(phase === 'ready' || phase === 'updating') && (
            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="space-y-2">
                <label className="block text-[10px] tracking-[0.15em] text-primary/60 uppercase">New password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="at least six characters"
                  required
                  minLength={6}
                  autoFocus
                  className="w-full bg-surface-container border-none rounded-sm py-4 px-5 text-on-surface placeholder:text-on-surface-variant/30 text-sm transition-all duration-300 focus:outline-none focus:ring-1 focus:ring-primary/30"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] tracking-[0.15em] text-primary/60 uppercase">Confirm</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="one more time"
                  required
                  minLength={6}
                  className="w-full bg-surface-container border-none rounded-sm py-4 px-5 text-on-surface placeholder:text-on-surface-variant/30 text-sm transition-all duration-300 focus:outline-none focus:ring-1 focus:ring-primary/30"
                />
              </div>

              {error && (
                <p className="font-headline italic text-xs text-error text-center">
                  {error}
                </p>
              )}

              <div className="pt-4 space-y-6">
                <button
                  type="submit"
                  disabled={phase === 'updating'}
                  className="w-full gold-gradient text-on-primary py-5 rounded-sm text-xs font-bold tracking-[0.2em] uppercase hover:opacity-80 transition-transform duration-200 disabled:opacity-50"
                  style={{ boxShadow: '0 12px 32px rgba(25,18,16,0.6)' }}
                >
                  {phase === 'updating' ? 'Setting…' : 'Set new key'}
                </button>
              </div>
            </form>
          )}
        </section>

        <footer className="mt-16 flex items-center space-x-6 text-[9px] tracking-[0.2em] text-on-surface-variant/20 uppercase">
          <a href="#" className="hover:text-primary transition-colors">Terms</a>
          <span className="w-1 h-1 bg-on-surface-variant/20 rounded-full" />
          <a href="#" className="hover:text-primary transition-colors">Privacy</a>
        </footer>
      </section>
    </main>
  )
}
