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

const FLUSH_INTERVAL = 5_000 // 5 seconds
const MAX_BATCH = 50
const MAX_EVENTS_PER_SESSION = 500 // matches server-side trigger
let eventCount = 0

async function flush() {
  if (queue.length === 0) return
  const batch = queue.splice(0, MAX_BATCH)

  try {
    await supabase.from('analytics_events').insert(batch)
  } catch {
    // If insert fails, push back to front of queue for retry
    queue.unshift(...batch)
  }
}

function startFlushing() {
  if (flushTimer) return
  flushTimer = setInterval(flush, FLUSH_INTERVAL)

  // Flush on page hide (tab close, navigate away, mobile background)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush()
  })
}

// ── Public API ───────────────────────────────────────────────────────

/** Set the current user ID (call on auth state change) */
export function setAnalyticsUser(userId: string | null) {
  currentUserId = userId
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
} as const
