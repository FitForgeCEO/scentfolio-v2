/**
 * useSignatureAudit — fetch, generate and cache Signature Audits.
 *
 * Read path (public): fetch a cached audit row by slug. Anonymous visitors
 * only ever touch this cached jsonb payload — the recommender RPC and the
 * owner's RLS-scoped rows are never queried on a public view.
 *
 * Write path (owner only): recompute the six-card payload from live data,
 * upsert the signature_audits row (stable slug), stamp
 * profiles.signature_slug, best-effort render + upload the 1200×630 OG
 * image, and fire the signature_audit_generated analytics event.
 *
 * Staleness: the payload stores wearLogCount at generation. When the owner
 * views their own audit and their live wear count has moved by >= 3, the
 * hook regenerates automatically (brief §Regeneration).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { trackEvent, AnalyticsEvents } from '@/lib/analytics'
import { fetchPersonalisedRecsScored, type OwnedItem } from '@/lib/taste-vector'
import {
  archetypeFrom,
  computeDnaFamilies,
  personalityFor,
  seasonOf,
  longestStreak,
  generateSlug,
  drawOgImage,
  type SignatureAuditData,
  type Season,
  type AuditBottle,
} from '@/lib/signature-audit'
import type { Fragrance } from '@/types/database'

const REGEN_WEAR_DELTA = 3
const NINETY_DAYS_MS = 90 * 86_400_000
const SIXTY_DAYS_MS = 60 * 86_400_000

export interface AuditRow {
  id: string
  user_id: string
  slug: string
  generated_at: string
  data: SignatureAuditData
  og_image_url: string | null
  view_count: number
}

interface WearRow {
  fragrance_id: string
  wear_date: string
}

interface CollectionRow {
  fragrance_id: string
  personal_rating: number | null
  date_added: string
  fragrances: Fragrance
}

function bottleOf(f: Fragrance): AuditBottle {
  return { brand: f.brand, name: f.name, imageUrl: f.image_url }
}

// ── Payload computation (owner-scoped queries) ──────────────────────────────

async function computeAuditData(userId: string): Promise<SignatureAuditData> {
  const [collRes, wearRes, profileRes] = await Promise.all([
    supabase
      .from('user_collections')
      .select('fragrance_id, personal_rating, date_added, fragrances(*)')
      .eq('user_id', userId)
      .eq('status', 'own'),
    supabase
      .from('wear_logs')
      .select('fragrance_id, wear_date')
      .eq('user_id', userId)
      .order('wear_date', { ascending: false })
      .limit(2000),
    supabase.from('profiles').select('display_name').eq('id', userId).single(),
  ])
  if (collRes.error) throw collRes.error
  if (wearRes.error) throw wearRes.error

  const collection = (collRes.data ?? []) as unknown as CollectionRow[]
  const wears = (wearRes.data ?? []) as WearRow[]
  const ownerName = profileRes.data?.display_name ?? null

  const owned = collection.filter((c) => c.fragrances)
  const fragById = new Map(owned.map((c) => [c.fragrance_id, c.fragrances]))

  // Wear counts per fragrance (all-time + 90-day window)
  const now = Date.now()
  const wearCount = new Map<string, number>()
  const wearCount90 = new Map<string, number>()
  const lastWorn = new Map<string, string>()
  for (const w of wears) {
    wearCount.set(w.fragrance_id, (wearCount.get(w.fragrance_id) ?? 0) + 1)
    const t = new Date(w.wear_date + 'T00:00:00').getTime()
    if (now - t <= NINETY_DAYS_MS) {
      wearCount90.set(w.fragrance_id, (wearCount90.get(w.fragrance_id) ?? 0) + 1)
    }
    const prev = lastWorn.get(w.fragrance_id)
    if (!prev || w.wear_date > prev) lastWorn.set(w.fragrance_id, w.wear_date)
  }

  // ── Card 1: DNA ──
  const dnaFamilies = computeDnaFamilies(
    owned.map((c) => ({
      note_family: c.fragrances.note_family,
      wears: wearCount.get(c.fragrance_id) ?? 0,
    })),
  )
  const dna = dnaFamilies.length > 0
    ? { families: dnaFamilies, personality: personalityFor(dnaFamilies.map((f) => f.family)) }
    : null

  // ── Card 2: Twin (hybrid recommender, top non-owned result) ──
  let twin: SignatureAuditData['cards']['twin'] = null
  if (owned.length > 0) {
    try {
      const ownedItems: OwnedItem[] = owned.map((c) => ({
        ...c.fragrances,
        rating: c.personal_rating,
      }))
      const recs = await fetchPersonalisedRecsScored(ownedItems, 3)
      const top = recs[0]
      if (top) {
        twin = {
          ...bottleOf(top.fragrance),
          reason: top.reasons[0] ?? 'It sits closest to the centre of your taste',
        }
      }
    } catch {
      /* recommender unavailable — card is skipped, audit still generates */
    }
  }

  // ── Card 3: Most worn (90d window, all-time fallback) ──
  let mostWorn: SignatureAuditData['cards']['mostWorn'] = null
  const pickTop = (counts: Map<string, number>): [string, number] | null => {
    let best: [string, number] | null = null
    for (const [id, n] of counts) {
      if (fragById.has(id) && (!best || n > best[1])) best = [id, n]
    }
    return best
  }
  const top90 = pickTop(wearCount90)
  const topAll = top90 ?? pickTop(wearCount)
  if (topAll) {
    const f = fragById.get(topAll[0])
    if (f) mostWorn = { ...bottleOf(f), count: topAll[1], window: top90 ? '90d' : 'all' }
  }

  // ── Card 4: Ghost (owned > 60 days with < 3 wears preferred; skip if < 5 owned) ──
  let ghost: SignatureAuditData['cards']['ghost'] = null
  if (owned.length >= 5) {
    const candidates = owned
      .map((c) => ({
        c,
        wears: wearCount.get(c.fragrance_id) ?? 0,
        ownedMs: now - new Date(c.date_added).getTime(),
      }))
      .sort((a, b) => a.wears - b.wears || b.ownedMs - a.ownedMs)
    // Only surface a ghost when a bottle has genuinely gathered dust --
    // owned 60+ days with under 3 wears. Brand-new shelves (onboarding
    // cold-start) skip the card rather than shaming a bottle added today;
    // the audit screen shows an owner-only unlock placeholder instead.
    const pick = candidates.find((x) => x.ownedMs > SIXTY_DAYS_MS && x.wears < 3) ?? null
    if (pick) {
      ghost = {
        ...bottleOf(pick.c.fragrances),
        lastWorn: lastWorn.get(pick.c.fragrance_id) ?? null,
      }
    }
  }

  // ── Card 5: Season (>= 20 wear logs) ──
  let season: SignatureAuditData['cards']['season'] = null
  if (wears.length >= 20) {
    const bySeason = new Map<Season, number>()
    for (const w of wears) {
      const s = seasonOf(w.wear_date)
      bySeason.set(s, (bySeason.get(s) ?? 0) + 1)
    }
    const modal = [...bySeason.entries()].sort((a, b) => b[1] - a[1])[0][0]
    const seasonWearCount = new Map<string, number>()
    for (const w of wears) {
      if (seasonOf(w.wear_date) === modal) {
        seasonWearCount.set(w.fragrance_id, (seasonWearCount.get(w.fragrance_id) ?? 0) + 1)
      }
    }
    const top = [...seasonWearCount.entries()]
      .filter(([id]) => fragById.has(id))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id]) => bottleOf(fragById.get(id)!))
    season = { season: modal, top }
  }

  // ── Card 6: Verdict ──
  const verdict = {
    bottles: owned.length,
    wears: wears.length,
    longestStreak: longestStreak(wears.map((w) => w.wear_date)),
    brands: new Set(owned.map((c) => c.fragrances.brand)).size,
  }

  const data: SignatureAuditData = {
    version: 1,
    generatedAt: new Date().toISOString(),
    ownerName,
    wearLogCount: wears.length,
    collectionCount: owned.length,
    cards: { dna, twin, mostWorn, ghost, season, verdict },
  }
  // Stored at generation so the OG image can bake the name; old cached
  // payloads derive it on read (archetypeFrom is pure over stored fields).
  const archetype = archetypeFrom(data)
  if (archetype) data.archetype = archetype
  return data
}

// ── OG image (best-effort — never blocks generation) ────────────────────────

async function uploadOgImage(
  userId: string,
  data: SignatureAuditData,
): Promise<string | null> {
  try {
    const blob = await drawOgImage({
      ownerName: data.ownerName,
      dna: data.cards.dna,
      bottleImageUrl: data.cards.mostWorn?.imageUrl ?? data.cards.twin?.imageUrl ?? null,
      archetype: data.archetype ?? archetypeFrom(data),
    })
    if (!blob) return null
    const path = `${userId}.png`
    const { error } = await supabase.storage
      .from('signature-og')
      .upload(path, blob, { upsert: true, contentType: 'image/png' })
    if (error) return null
    const { data: pub } = supabase.storage.from('signature-og').getPublicUrl(path)
    // Cache-bust: the path is stable across regenerations
    return pub.publicUrl ? `${pub.publicUrl}?v=${Date.now()}` : null
  } catch {
    return null
  }
}

// ── Generation (owner only) ─────────────────────────────────────────────────

export async function generateSignatureAudit(userId: string): Promise<AuditRow> {
  const data = await computeAuditData(userId)

  // Reuse the existing slug if the user already has an audit (stable URLs).
  const { data: existing, error: exErr } = await supabase
    .from('signature_audits')
    .select('id, slug')
    .eq('user_id', userId)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (exErr) throw exErr

  const ogImageUrl = await uploadOgImage(userId, data)

  let row: AuditRow
  if (existing) {
    const { data: updated, error } = await supabase
      .from('signature_audits')
      .update({
        data,
        generated_at: data.generatedAt,
        ...(ogImageUrl ? { og_image_url: ogImageUrl } : {}),
      })
      .eq('id', existing.id)
      .select()
      .single()
    if (error) throw error
    row = updated as AuditRow
  } else {
    // Two attempts on the astronomically-unlikely slug collision.
    let inserted: AuditRow | null = null
    let lastError: unknown = null
    for (let attempt = 0; attempt < 2 && !inserted; attempt++) {
      const { data: ins, error } = await supabase
        .from('signature_audits')
        .insert({ user_id: userId, slug: generateSlug(), data, og_image_url: ogImageUrl })
        .select()
        .single()
      if (!error) inserted = ins as AuditRow
      else lastError = error
    }
    if (!inserted) throw lastError
    row = inserted
  }

  // Point the profile at the current audit (column-level grant added 04 Jul).
  const { error: profErr } = await supabase
    .from('profiles')
    .update({ signature_slug: row.slug })
    .eq('id', userId)
  if (profErr) console.warn('[signature-audit] profile slug stamp failed:', profErr.message)

  trackEvent(AnalyticsEvents.SIGNATURE_AUDIT_GENERATED, {
    slug: row.slug,
    archetype: data.archetype?.name ?? null,
    wear_log_count: data.wearLogCount,
    collection_count: data.collectionCount,
    cards_present: Object.entries(data.cards)
      .filter(([, v]) => v !== null)
      .map(([k]) => k),
  })

  return row
}

// ── The hook (public read + owner auto-regen) ───────────────────────────────

export function useSignatureAudit(slug: string | undefined) {
  const { user } = useAuth()
  const [audit, setAudit] = useState<AuditRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [regenerating, setRegenerating] = useState(false)
  const reqRef = useRef(0)

  const isOwner = !!user && !!audit && user.id === audit.user_id

  const load = useCallback(async () => {
    if (!slug) {
      setAudit(null)
      setLoading(false)
      setError('No audit specified')
      return
    }
    const req = ++reqRef.current
    setLoading(true)
    setError(null)
    const { data, error: fetchErr } = await supabase
      .from('signature_audits')
      .select('*')
      .eq('slug', slug)
      .maybeSingle()
    if (req !== reqRef.current) return
    if (fetchErr) {
      setError(fetchErr.message)
      setAudit(null)
    } else if (!data) {
      setError('not_found')
      setAudit(null)
    } else {
      setAudit(data as AuditRow)
    }
    setLoading(false)
  }, [slug])

  useEffect(() => {
    void load()
  }, [load])

  const regenerate = useCallback(async () => {
    if (!user) return
    setRegenerating(true)
    try {
      const row = await generateSignatureAudit(user.id)
      setAudit(row)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Regeneration failed')
    } finally {
      setRegenerating(false)
    }
  }, [user])

  // Owner staleness check: live wear count moved >= 3 since generation.
  const autoRegenDone = useRef(false)
  useEffect(() => {
    if (!isOwner || !audit || autoRegenDone.current || regenerating) return
    let cancelled = false
    void (async () => {
      const { count, error: cntErr } = await supabase
        .from('wear_logs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', audit.user_id)
      if (cancelled || cntErr || count == null) return
      if (Math.abs(count - audit.data.wearLogCount) >= REGEN_WEAR_DELTA) {
        autoRegenDone.current = true
        void regenerate()
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isOwner, audit, regenerate, regenerating])

  return { audit, loading, error, isOwner, regenerating, regenerate, reload: load }
}
