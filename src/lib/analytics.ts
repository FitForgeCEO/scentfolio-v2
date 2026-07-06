/**
 * ScentFolio Analytics — lightweight, Supabase-backed event tracking.
 *
 * Events are batched in memory and flushed every 5 s (or on page hide)
 * to minimise DB writes. No third-party scripts, no cookies.
 */

import { supabase } from './supabase'

// ── Types ────────────────────────────────────────────────────────────
export interface AnalyticsEvent {
  event_name: string
  event_data?: Record<string, unknown>
  page_path?: string
  referrer?: string
}

interface QueuedEvent extends AnalyticsEvent {
  user_id: string | null
  session_id: string
  device_type: string
  created_at: string
}

/** Retry bookkeeping -- kept out of the row payload sent to PostgREST. */
const retriedOnce = new WeakSet<QueuedEvent>()

// ── Session & device helpers ─────────────────────────────────────────
function getSessionId(): string {
  const key = 'scentfolio_session_id'
  let id = sessionStorage.getItem(key)
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem(key, id)
  }
  return id
}

function getDeviceType(): string {
  const w = window.innerWidth
  if (w < 768) return 'mobile'
  if (w < 1024) return 'tablet'
  return 'desktop'
}

// ── Queue + flush ────────────────────────────────────────────────────
let queue: QueuedEvent[] = []
let flushTimer: ReturnType<typeof setInterval> | null = null
let currentUserId: string | null = null
let currentAccessToken: string | null = null

const FLUSH_INTERVAL = 5_000 // 5 seconds
const MAX_BATCH = 50
const MAX_EVENTS_PER_SESSION = 500 // matches server-side trigger
let eventCount = 0

async function flush() {
  if (queue.length === 0) return
  const batch = queue.splice(0, MAX_BATCH)

  // supabase-js resolves with { error } rather than throwing, so the retry
  // path must inspect the result. Each event gets exactly one retry --
  // permanently-rejected batches (RLS, rate-limit trigger) must not loop.
  const { error } = await supabase.from('analytics_events').insert(batch)
  if (error) {
    const retryable = batch.filter((e) => !retriedOnce.has(e))
    retryable.forEach((e) => retriedOnce.add(e))
    queue.unshift(...retryable)
  }
}

/**
 * Final flush on page hide. The normal supabase-js fetch is routinely
 * cancelled by the browser during unload, losing the last batch (the
 * usual cause of missing sign_out / final page_view events). A direct
 * PostgREST call with keepalive survives the page teardown.
 */
function flushKeepalive() {
  if (queue.length === 0) return
  const batch = queue.splice(0, MAX_BATCH)

  const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/analytics_events`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    Prefer: 'return=minimal',
  }
  if (currentAccessToken) {
    headers.Authorization = `Bearer ${currentAccessToken}`
  }
  // Without a user JWT, RLS only accepts anonymous rows -- strip the
  // attribution rather than losing the events entirely.
  const rows = currentAccessToken ? batch : batch.map((e) => ({ ...e, user_id: null }))

  try {
    fetch(url, { method: 'POST', headers, body: JSON.stringify(rows), keepalive: true })
  } catch {
    /* page is going away; nothing more to do */
  }
}

function startFlushing() {
  if (flushTimer) return
  flushTimer = setInterval(flush, FLUSH_INTERVAL)

  // Flush on page hide (tab close, navigate away, mobile background)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushKeepalive()
  })
}

// ── Public API ───────────────────────────────────────────────────────

/** Set the current user ID + access token (call on auth state change).
 *  The token lets the page-hide keepalive flush authenticate -- the
 *  analytics_events INSERT policy requires auth.uid() to match user_id. */
export function setAnalyticsUser(userId: string | null, accessToken: string | null = null) {
  currentUserId = userId
  currentAccessToken = accessToken
}

/** Track an event */
export function trackEvent(
  eventName: string,
  eventData?: Record<string, unknown>
) {
  // Client-side rate limit (mirrors server trigger)
  if (eventCount >= MAX_EVENTS_PER_SESSION) return
  eventCount++

  startFlushing()

  const event: QueuedEvent = {
    event_name: eventName,
    event_data: eventData ?? {},
    page_path: window.location.pathname,
    referrer: document.referrer || null as unknown as string,
    user_id: currentUserId,
    session_id: getSessionId(),
    device_type: getDeviceType(),
    created_at: new Date().toISOString(),
  }

  queue.push(event)

  // If queue is getting large, flush immediately
  if (queue.length >= MAX_BATCH) flush()
}

/** Track a page view (convenience wrapper) */
export function trackPageView(path?: string) {
  trackEvent('page_view', { path: path ?? window.location.pathname })
}

// ── Pre-defined event names (type-safe helpers) ──────────────────────
export const AnalyticsEvents = {
  // Navigation
  PAGE_VIEW: 'page_view',

  // Auth
  SIGN_UP: 'sign_up',
  SIGN_IN: 'sign_in',
  SIGN_OUT: 'sign_out',

  // Collection
  ADD_TO_COLLECTION: 'add_to_collection',
  REMOVE_FROM_COLLECTION: 'remove_from_collection',
  RATE_FRAGRANCE: 'rate_fragrance',
  LOG_WEAR: 'log_wear',

  // Discovery
  SEARCH: 'search',
  VIEW_FRAGRANCE: 'view_fragrance',
  VIEW_BOARD: 'view_board',
  VIEW_LIST: 'view_list',

  // Social
  FOLLOW_USER: 'follow_user',
  UNFOLLOW_USER: 'unfollow_user',
  LIKE_REVIEW: 'like_review',
  WRITE_REVIEW: 'write_review',
  SHARE_COLLECTION: 'share_collection',
  SHARE_PROFILE_CARD: 'share_profile_card',

  // Engagement
  COMPLETE_ONBOARDING: 'complete_onboarding',
  COMPLETE_CHALLENGE: 'complete_challenge',
  EARN_BADGE: 'earn_badge',
  TAKE_QUIZ: 'take_quiz',
  USE_LAYERING_LAB: 'use_layering_lab',
  USE_MOOD_PICKER: 'use_mood_picker',
  USE_COMPARE: 'use_compare',

  // PWA
  PWA_INSTALL_PROMPT: 'pwa_install_prompt',
  PWA_INSTALLED: 'pwa_installed',

  // Landing
  LANDING_CTA_CLICK: 'landing_cta_click',
  LANDING_SCROLL_DEPTH: 'landing_scroll_depth',
  LANDING_PAGE_VIEWED: 'landing_page_viewed',
  LANDING_HERO_CTA_CLICKED: 'landing_hero_cta_clicked',
  LANDING_FOOTER_CTA_CLICKED: 'landing_footer_cta_clicked',

  // Recommender
  RECOMMENDER_CLICK: 'recommender_click',
  RECOMMENDER_THUMBS: 'recommender_thumbs',

  // Signature Audit (growth funnel — see Signature-Audit-Build-Brief-04Jul2026)
  SIGNATURE_AUDIT_GENERATED: 'signature_audit_generated',
  SIGNATURE_AUDIT_VIEW: 'signature_audit_view',
  SIGNATURE_AUDIT_SHARED: 'signature_audit_shared',
  SIGNATURE_AUDIT_SIGNUP_CTA_CLICK: 'signature_audit_signup_cta_click',
} as const
