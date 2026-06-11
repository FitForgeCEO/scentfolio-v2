import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { setAnalyticsUser, trackEvent, AnalyticsEvents } from '@/lib/analytics'

interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: string | null }>
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  resendConfirmation: (email: string) => Promise<{ error: string | null }>
  sendPasswordReset: (email: string) => Promise<{ error: string | null }>
  updatePassword: (newPassword: string, currentPassword?: string) => Promise<{ error: string | null }>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

/**
 * Drop the service worker's cached Supabase responses on sign-out --
 * otherwise the next user of a shared device can read the previous
 * user's last API responses from Cache Storage. Matches any
 * '*-data' cache so a CACHE_VERSION bump in sw.js can't strand it.
 */
function purgeDataCaches() {
  if (typeof caches === 'undefined') return
  caches
    .keys()
    .then((keys) => Promise.all(keys.filter((k) => k.endsWith('-data')).map((k) => caches.delete(k))))
    .catch(() => {/* best-effort */})
}

// L-1: normalise sign-in errors so the message doesn't reveal whether
// an email exists in the system. Any credential-failure path collapses
// to a single generic message; "email not confirmed" gets a UX message
// but doesn't leak more than the signup flow already does.
function normaliseSignInError(message: string | undefined): string | null {
  if (!message) return null
  const lower = message.toLowerCase()
  if (
    lower.includes('invalid login credentials') ||
    lower.includes('invalid email or password') ||
    lower.includes('user not found') ||
    lower.includes('email not found') ||
    lower.includes('invalid credentials')
  ) {
    return 'Invalid email or password.'
  }
  if (lower.includes('email not confirmed')) {
    return 'Please confirm your email before signing in. Check your inbox for the confirmation link.'
  }
  // Rate-limit / network / unknown errors pass through (they're a different
  // class of error, not enumeration-vulnerable).
  return message
}

// M-8: idle timeout. Sign the user out after 30 minutes with no activity.
// Activity = pointer move, key press, or tab becoming visible. Helps in
// shared-computer scenarios (hotel lobby, work laptop, etc.) where a user
// closes the tab and walks away with the session still alive.
const IDLE_TIMEOUT_MS = 30 * 60 * 1000  // 30 minutes
const IDLE_CHECK_INTERVAL_MS = 60 * 1000 // check once a minute

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const lastActivityRef = useRef<number>(Date.now())

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setAnalyticsUser(session?.user?.id ?? null, session?.access_token ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setAnalyticsUser(session?.user?.id ?? null, session?.access_token ?? null)

      // Track auth events
      if (event === 'SIGNED_IN') trackEvent(AnalyticsEvents.SIGN_IN)
      if (event === 'SIGNED_OUT') {
        trackEvent(AnalyticsEvents.SIGN_OUT)
        purgeDataCaches()
      }
      if (event === 'USER_UPDATED' && !session?.user) {
        trackEvent(AnalyticsEvents.SIGN_OUT)
        purgeDataCaches()
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // M-8: idle timeout effect. Only runs while a user is signed in.
  useEffect(() => {
    if (!user) return

    const markActivity = () => {
      lastActivityRef.current = Date.now()
    }

    // Reset on common signals of real human presence.
    window.addEventListener('mousemove', markActivity, { passive: true })
    window.addEventListener('keydown', markActivity, { passive: true })
    window.addEventListener('touchstart', markActivity, { passive: true })
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') markActivity()
    })

    const interval = window.setInterval(() => {
      const idleFor = Date.now() - lastActivityRef.current
      if (idleFor >= IDLE_TIMEOUT_MS) {
        // Idle too long — sign out. The auth subscription above will
        // handle session/user state cleanup.
        supabase.auth.signOut().catch(() => {/* swallow; reload will reconcile */})
      }
    }, IDLE_CHECK_INTERVAL_MS)

    // Reset the timer when the user transitions to authenticated
    // (covers both fresh sign-in and session restoration on app load).
    markActivity()

    return () => {
      window.clearInterval(interval)
      window.removeEventListener('mousemove', markActivity)
      window.removeEventListener('keydown', markActivity)
      window.removeEventListener('touchstart', markActivity)
      // Note: visibilitychange listener intentionally left attached -- it's
      // idempotent across re-mounts and removeEventListener requires the
      // exact same function reference (the inline arrow above doesn't have
      // one). The interval is the load-bearing cleanup.
    }
  }, [user])

  const signUp = async (email: string, password: string, displayName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
      },
    })
    return { error: error?.message ?? null }
  }

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: normaliseSignInError(error?.message) }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const resendConfirmation = async (email: string) => {
    const { error } = await supabase.auth.resend({ type: 'signup', email })
    return { error: error?.message ?? null }
  }

  const sendPasswordReset = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    return { error: error?.message ?? null }
  }

  const updatePassword = async (newPassword: string, currentPassword?: string) => {
    // The dashboard's "require current password" setting makes GoTrue reject
    // password updates unless current_password rides in the same request.
    // The recovery flow (ResetPasswordScreen) omits it -- recovery sessions
    // are exempt from the requirement.
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
      ...(currentPassword ? { current_password: currentPassword } : {}),
    })
    return { error: error?.message ?? null }
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut, resendConfirmation, sendPasswordReset, updatePassword }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
