/**
 * UTM capture + first-touch attribution.
 *
 * On app load (and on every SPA route change via AnalyticsTracker) we look
 * for utm_* / ref params in the URL. The FIRST tagged URL a visitor lands
 * on wins for the whole session -- an existing blob is never overwritten,
 * so a visitor who arrives from Reddit, browses, then signs up from a clean
 * URL keeps the Reddit attribution. sessionStorage (not localStorage) is
 * deliberate: attribution must not leak across days or browser sessions.
 *
 * Consumed at signup: AuthContext.signUp() writes the blob into
 * auth.users.raw_user_meta_data.utm_context and onto the sign_up
 * analytics event, then clears it so a second signup in the same
 * session isn't re-attributed.
 */

const STORAGE_KEY = 'sf_utm_context'

const UTM_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'ref',
] as const

// Cap individual values -- these land in raw_user_meta_data and
// analytics_events, so a crafted 10 kB query param shouldn't ride along.
const MAX_VALUE_LENGTH = 200

export interface UtmContext {
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_content?: string
  utm_term?: string
  ref?: string
  captured_at: string
}

/** Stash UTM params from the current URL, first-touch wins. Safe to call repeatedly. */
export function captureUtmContext(search: string = window.location.search): void {
  try {
    if (sessionStorage.getItem(STORAGE_KEY)) return // first-touch: never overwrite

    const params = new URLSearchParams(search)
    const ctx: Record<string, string> = {}
    for (const key of UTM_PARAMS) {
      const value = params.get(key)
      if (value) ctx[key] = value.slice(0, MAX_VALUE_LENGTH)
    }
    if (Object.keys(ctx).length === 0) return

    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...ctx, captured_at: new Date().toISOString() })
    )
  } catch {
    /* sessionStorage unavailable (private mode, quota) -- attribution is best-effort */
  }
}

/** The stored first-touch context, or null if this session arrived untagged. */
export function getUtmContext(): UtmContext | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') return parsed as UtmContext
    return null
  } catch {
    return null
  }
}

/** Drop the context after a successful signup so a second account created
 *  in the same session isn't credited with the same UTMs. */
export function clearUtmContext(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* best-effort */
  }
}
