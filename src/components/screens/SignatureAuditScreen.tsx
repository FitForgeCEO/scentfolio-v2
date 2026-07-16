/**
 * SignatureAuditScreen — the public, shareable Signature Audit.
 *
 * Route: /signature/:userSlug (no AppLayout — full-bleed cards, no nav
 * chrome, so a phone screenshot of any card is clean).
 *
 * Anyone with the URL can view (Letterboxd Wrapped pattern). Owners get the
 * share sheet + refresh; strangers get the "Get yours" signup CTA.
 *
 * Every card is hard-coded noir regardless of theme — these exist to be
 * screenshotted, and the screenshot is the brand.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toPng } from 'html-to-image'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { useSignatureAudit } from '@/hooks/useSignatureAudit'
import { supabase } from '@/lib/supabase'
import { trackEvent, AnalyticsEvents } from '@/lib/analytics'
import { archetypeFrom, CARD_COPY, shareCaptions, type ShareTarget, type SignatureAuditData } from '@/lib/signature-audit'

const NOIR = '#191210'
const GOLD = '#e5c276'
const CREAM = '#e8dfd3'

// ── Shared card scaffolding ─────────────────────────────────────────────────

function AuditCard({
  index,
  total,
  children,
  cardRef,
}: {
  index: number | null // null = CTA card, unnumbered
  total: number
  children: React.ReactNode
  cardRef?: React.Ref<HTMLElement>
}) {
  return (
    <section
      ref={cardRef}
      className="h-dvh relative flex flex-col justify-center px-8 overflow-hidden"
      style={{ backgroundColor: NOIR }}
    >
      {index !== null && (
        <span
          className="absolute top-6 right-6 font-label text-[9px] tracking-[0.25em] uppercase"
          style={{ color: `${GOLD}66` }}
        >
          Card {index} of {total}
        </span>
      )}
      {children}
      <span
        className="absolute bottom-5 inset-x-0 text-center font-headline font-bold text-[11px] tracking-[0.3em] uppercase"
        style={{ color: `${GOLD}59` }}
      >
        ScentFolio
      </span>
    </section>
  )
}

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-label text-[10px] tracking-[0.3em] uppercase block mb-4" style={{ color: GOLD }}>
      {children}
    </span>
  )
}

function Body({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-headline italic text-sm leading-relaxed mt-6 max-w-[300px]" style={{ color: `${CREAM}b3` }}>
      {children}
    </p>
  )
}

function Bottle({ imageUrl, brand, name }: { imageUrl: string | null; brand: string; name: string }) {
  return (
    <div className="space-y-4">
      {imageUrl && (
        <img
          src={imageUrl}
          alt=""
          className="h-44 w-auto max-w-[220px] object-contain drop-shadow-[0_12px_32px_rgba(0,0,0,0.7)]"
        />
      )}
      <div>
        <p className="font-label text-[10px] tracking-[0.25em] uppercase" style={{ color: `${CREAM}80` }}>
          {brand}
        </p>
        <h2 className="font-headline text-3xl mt-1" style={{ color: CREAM }}>
          {name}
        </h2>
      </div>
    </div>
  )
}

function formatDate(iso: string): string {
  return new Date(iso + (iso.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function timeAgo(iso: string): string {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60_000))
  if (mins < 60) return `${mins} ${mins === 1 ? 'minute' : 'minutes'} ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`
  const days = Math.round(hours / 24)
  return `${days} ${days === 1 ? 'day' : 'days'} ago`
}

// ── Meta tags (client-side; crawler limitation flagged in build report) ─────

function useAuditMeta(data: SignatureAuditData | null, ogImageUrl: string | null) {
  useEffect(() => {
    if (!data) return
    const prevTitle = document.title
    const archetype = data.archetype ?? archetypeFrom(data)
    document.title = archetype
      ? data.ownerName
        ? `${data.ownerName} is ${archetype.name} — ScentFolio`
        : `${archetype.name} — ScentFolio`
      : data.ownerName
        ? `${data.ownerName}’s Fragrance DNA — ScentFolio`
        : 'A Fragrance DNA — ScentFolio'
    const ensure = (property: string, content: string) => {
      let el = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`)
      if (!el) {
        el = document.createElement('meta')
        el.setAttribute('property', property)
        document.head.appendChild(el)
      }
      el.setAttribute('content', content)
      return el
    }
    const created: HTMLMetaElement[] = []
    created.push(ensure('og:title', document.title))
    created.push(ensure('og:description', 'This is what a collection says about its keeper. Read yours at scentfolio.app.'))
    if (ogImageUrl) created.push(ensure('og:image', ogImageUrl))
    return () => {
      document.title = prevTitle
    }
  }, [data, ogImageUrl])
}

// ── The screen ──────────────────────────────────────────────────────────────

export function SignatureAuditScreen() {
  const { userSlug } = useParams<{ userSlug: string }>()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const { showToast } = useToast()
  const { audit, loading, error, isOwner, regenerating, regenerate } = useSignatureAudit(userSlug)
  const dnaCardRef = useRef<HTMLElement>(null)
  const [saving, setSaving] = useState(false)

  useAuditMeta(audit?.data ?? null, audit?.og_image_url ?? null)

  // View counter + analytics — non-owners only, once per mount, after auth
  // has resolved (so a slow-hydrating owner isn't miscounted as a stranger).
  const counted = useRef(false)
  useEffect(() => {
    if (!audit || authLoading || counted.current) return
    if (user && user.id === audit.user_id) return
    counted.current = true
    // PostgrestBuilder is lazy — it only fires on .then/await. A bare `void`
    // would silently never send the request.
    supabase
      .rpc('increment_signature_audit_view', { p_slug: audit.slug })
      .then(({ error: rpcErr }) => {
        if (rpcErr) console.warn('[signature-audit] view increment failed:', rpcErr.message)
      })
    trackEvent(AnalyticsEvents.SIGNATURE_AUDIT_VIEW, {
      slug: audit.slug,
      referrer: document.referrer || null,
    })
  }, [audit, user, authLoading])

  const shareUrl = `https://scentfolio.app/signature/${audit?.slug ?? ''}`

  const handleShare = useCallback(
    async (target: ShareTarget, caption: string) => {
      trackEvent(AnalyticsEvents.SIGNATURE_AUDIT_SHARED, { target })
      if (navigator.share) {
        try {
          await navigator.share({ text: caption })
          return
        } catch {
          /* cancelled or unsupported payload — fall through to clipboard */
        }
      }
      try {
        await navigator.clipboard.writeText(caption)
        showToast('Caption copied', 'success')
      } catch {
        showToast('Could not copy — long-press to copy the link instead', 'error')
      }
    },
    [showToast],
  )

  const handleCopyLink = useCallback(async () => {
    trackEvent(AnalyticsEvents.SIGNATURE_AUDIT_SHARED, { target: 'copy_link' })
    try {
      await navigator.clipboard.writeText(shareUrl)
      showToast('Link copied', 'success')
    } catch {
      showToast('Could not copy the link', 'error')
    }
  }, [shareUrl, showToast])

  const handleSaveImage = useCallback(async () => {
    if (!dnaCardRef.current || saving) return
    setSaving(true)
    trackEvent(AnalyticsEvents.SIGNATURE_AUDIT_SHARED, { target: 'save_image' })
    try {
      const dataUrl = await toPng(dnaCardRef.current, {
        pixelRatio: 1080 / dnaCardRef.current.clientWidth,
        backgroundColor: NOIR,
      })
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = 'scentfolio-signature.png'
      a.click()
    } catch {
      showToast('Could not render the image on this device', 'error')
    } finally {
      setSaving(false)
    }
  }, [saving, showToast])

  const handleSignupCta = useCallback(() => {
    trackEvent(AnalyticsEvents.SIGNATURE_AUDIT_SIGNUP_CTA_CLICK, { owner_slug: audit?.slug ?? null })
    navigate(
      `/auth?utm_source=signature_audit&utm_medium=share&utm_campaign=organic&ref=${audit?.slug ?? ''}`,
    )
  }, [audit, navigate])

  // ── Loading / not-found states ──
  if (loading) {
    return (
      <main className="h-dvh flex items-center justify-center" style={{ backgroundColor: NOIR }}>
        <p className="font-headline italic text-sm" style={{ color: `${CREAM}80` }}>
          Reading the signature…
        </p>
      </main>
    )
  }
  if (error || !audit) {
    return (
      <main className="h-dvh flex flex-col items-center justify-center px-8 text-center" style={{ backgroundColor: NOIR }}>
        <h1 className="font-headline text-2xl mb-3" style={{ color: CREAM }}>
          This signature isn’t on file.
        </h1>
        <p className="font-headline italic text-sm max-w-[280px]" style={{ color: `${CREAM}80` }}>
          The link may be incomplete, or the audit has been withdrawn.
        </p>
        <button
          onClick={() => navigate('/')}
          className="mt-8 px-8 py-3 rounded-sm font-label text-[10px] font-bold uppercase tracking-widest"
          style={{ background: GOLD, color: NOIR }}
        >
          ScentFolio Home
        </button>
      </main>
    )
  }

  const d = audit.data
  const archetype = d.archetype ?? archetypeFrom(d)
  const cards: { key: string; render: (i: number, n: number) => React.ReactNode }[] = []

  if (archetype) {
    const a = archetype
    const v = d.cards.verdict
    const topFamily = d.cards.dna?.families[0]
    const stats = [
      topFamily ? `${topFamily.pct}% ${topFamily.family}` : null,
      `${v.bottles} ${v.bottles === 1 ? 'bottle' : 'bottles'}`,
      `${v.wears} ${v.wears === 1 ? 'wear' : 'wears'}`,
    ]
      .filter(Boolean)
      .join('  ·  ')
    // Card 0 — the screenshot moment. Mirrors the video end card
    // (tools/v3_build/make_archetype_card.py): gold kicker, serif name,
    // gold rule, italic tagline, muted tracked stats.
    cards.push({
      key: 'archetype',
      render: (i, n) => (
        <AuditCard key="archetype" index={i} total={n} cardRef={dnaCardRef}>
          <Kicker>Your Signature</Kicker>
          <h1 className="font-headline text-5xl leading-tight" style={{ color: CREAM }}>
            {a.name}
          </h1>
          <div className="w-16 h-[3px] mt-6 mb-5" style={{ backgroundColor: GOLD }} />
          <p className="font-headline italic text-lg max-w-[300px]" style={{ color: CREAM }}>
            {a.tagline}
          </p>
          <p className="font-label text-[10px] tracking-[0.2em] uppercase mt-8" style={{ color: `${CREAM}80` }}>
            {stats}
          </p>
        </AuditCard>
      ),
    })
  }
  if (d.cards.dna) {
    const dna = d.cards.dna
    cards.push({
      key: 'dna',
      render: (i, n) => (
        <AuditCard key="dna" index={i} total={n} cardRef={archetype ? undefined : dnaCardRef}>
          <Kicker>{CARD_COPY.dna.title}</Kicker>
          <p className="font-headline italic text-xl mb-8" style={{ color: CREAM }}>
            {dna.personality}
          </p>
          <div className="space-y-5">
            {dna.families.map((f) => (
              <div key={f.family}>
                <div className="flex justify-between items-baseline mb-1.5">
                  <span className="font-headline text-lg" style={{ color: CREAM }}>{f.family}</span>
                  <span className="font-label text-xs font-bold" style={{ color: GOLD }}>{f.pct}%</span>
                </div>
                <div className="h-[6px] rounded-sm" style={{ backgroundColor: `${GOLD}26` }}>
                  <div className="h-full rounded-sm" style={{ width: `${f.pct}%`, backgroundColor: GOLD }} />
                </div>
              </div>
            ))}
          </div>
          <Body>{CARD_COPY.dna.body}</Body>
        </AuditCard>
      ),
    })
  }
  if (d.cards.twin) {
    const twin = d.cards.twin
    cards.push({
      key: 'twin',
      render: (i, n) => (
        <AuditCard key="twin" index={i} total={n}>
          <Kicker>{CARD_COPY.twin.title}</Kicker>
          <Bottle imageUrl={twin.imageUrl} brand={twin.brand} name={twin.name} />
          <p className="font-label text-[11px] mt-4 tracking-wide" style={{ color: GOLD }}>
            {twin.reason}
          </p>
          <Body>{CARD_COPY.twin.body}</Body>
        </AuditCard>
      ),
    })
  }
  if (d.cards.mostWorn) {
    const mw = d.cards.mostWorn
    cards.push({
      key: 'mostWorn',
      render: (i, n) => (
        <AuditCard key="mostWorn" index={i} total={n}>
          <Kicker>{CARD_COPY.mostWorn.title}</Kicker>
          <Bottle imageUrl={mw.imageUrl} brand={mw.brand} name={mw.name} />
          <p className="font-label text-[11px] mt-4 tracking-wide" style={{ color: GOLD }}>
            {mw.count} {mw.count === 1 ? 'wear' : 'wears'}
            {mw.window === '90d' ? ' in the last 90 days' : ' logged'} · {CARD_COPY.mostWorn.badge}
          </p>
          <Body>{CARD_COPY.mostWorn.body}</Body>
        </AuditCard>
      ),
    })
  }
  if (d.cards.ghost) {
    const g = d.cards.ghost
    cards.push({
      key: 'ghost',
      render: (i, n) => (
        <AuditCard key="ghost" index={i} total={n}>
          <Kicker>{CARD_COPY.ghost.title}</Kicker>
          <Bottle imageUrl={g.imageUrl} brand={g.brand} name={g.name} />
          <p className="font-label text-[11px] mt-4 tracking-wide" style={{ color: `${CREAM}80` }}>
            {g.lastWorn ? `Last worn ${formatDate(g.lastWorn)}` : 'Never worn'}
          </p>
          <Body>{CARD_COPY.ghost.body}</Body>
        </AuditCard>
      ),
    })
  }
  if (d.cards.season) {
    const s = d.cards.season
    cards.push({
      key: 'season',
      render: (i, n) => (
        <AuditCard key="season" index={i} total={n}>
          <Kicker>{CARD_COPY.season.title}</Kicker>
          <h2 className="font-headline italic text-6xl mb-8" style={{ color: GOLD }}>
            {s.season}
          </h2>
          <div className="space-y-2">
            {s.top.map((b, idx) => (
              <p key={`${b.brand}-${b.name}`} className="font-headline text-base" style={{ color: CREAM }}>
                <span className="italic mr-3" style={{ color: `${GOLD}99` }}>{['I', 'II', 'III'][idx]}</span>
                {b.name}
                <span className="font-label text-[10px] uppercase tracking-widest ml-2" style={{ color: `${CREAM}66` }}>
                  {b.brand}
                </span>
              </p>
            ))}
          </div>
          <Body>{CARD_COPY.season.body(s.season)}</Body>
        </AuditCard>
      ),
    })
  }
  {
    const v = d.cards.verdict
    cards.push({
      key: 'verdict',
      render: (i, n) => (
        <AuditCard key="verdict" index={i} total={n}>
          <Kicker>{CARD_COPY.verdict.title}</Kicker>
          <div className="grid grid-cols-2 gap-3 mb-2">
            {[
              [v.bottles, v.bottles === 1 ? 'bottle' : 'bottles'],
              [v.wears, v.wears === 1 ? 'wear logged' : 'wears logged'],
              [v.longestStreak, 'day longest streak'],
              [v.brands, v.brands === 1 ? 'house' : 'houses'],
            ].map(([num, label]) => (
              <div key={String(label)} className="rounded-sm p-4" style={{ backgroundColor: `${GOLD}14`, border: `1px solid ${GOLD}26` }}>
                <p className="font-headline text-3xl" style={{ color: GOLD }}>{num}</p>
                <p className="font-label text-[9px] uppercase tracking-[0.2em] mt-1" style={{ color: `${CREAM}99` }}>{label}</p>
              </div>
            ))}
          </div>
          <Body>{CARD_COPY.verdict.body(v.wears, v.bottles)}</Body>
        </AuditCard>
      ),
    })
  }

  const total = cards.length
  const captions = shareCaptions(shareUrl, d.cards.dna, archetype)

  // Owner-only placeholders for cards that need more history (Ghost: a
  // bottle owned 60+ days with < 3 wears; Season: 20+ logged wears).
  // Public/shared views stay clean -- strangers only see real cards.
  const locked: { key: string; title: string; line: string }[] = []
  if (isOwner && !archetype) {
    locked.push({
      key: 'locked-archetype',
      title: 'Your Signature',
      line: 'Your signature is still forming — log a few wears.',
    })
  }
  if (isOwner && !d.cards.ghost) {
    locked.push({
      key: 'locked-ghost',
      title: CARD_COPY.ghost.title,
      line: 'Sixty days of shelf life before anything can gather dust.',
    })
  }
  if (isOwner && !d.cards.season) {
    locked.push({
      key: 'locked-season',
      title: CARD_COPY.season.title,
      line: 'Twenty logged wears and your season shows itself.',
    })
  }

  return (
    <main style={{ backgroundColor: NOIR }}>
      {cards.map((c, idx) => c.render(idx + 1, total))}

      {/* ── Locked cards (owner only): not enough data yet ── */}
      {locked.map((l) => (
        <AuditCard key={l.key} index={null} total={total}>
          <Kicker>{l.title}</Kicker>
          <p className="font-headline italic text-xl mb-3" style={{ color: `${CREAM}99` }}>
            Not enough data yet.
          </p>
          <p className="font-headline italic text-sm max-w-[300px]" style={{ color: `${CREAM}66` }}>
            {l.line}
          </p>
          <button
            onClick={() => navigate('/')}
            className="mt-8 self-start font-label text-[10px] font-bold uppercase tracking-[0.2em] underline underline-offset-4"
            style={{ color: GOLD }}
          >
            Keep logging to unlock
          </button>
        </AuditCard>
      ))}

      {/* ── CTA card (unnumbered, the growth mechanic) ── */}
      <AuditCard index={null} total={total}>
        {isOwner ? (
          <>
            <Kicker>Share your Signature</Kicker>
            <p className="font-headline italic text-lg mb-8" style={{ color: CREAM }}>
              {archetype ? `You sign as ${archetype.name}.` : 'A signature is for signing with.'}
            </p>
            <div className="space-y-2.5">
              {captions.map((c) => (
                <button
                  key={c.target}
                  onClick={() => void handleShare(c.target, c.caption)}
                  className="w-full py-3.5 px-4 rounded-sm font-label text-[10px] font-bold uppercase tracking-widest text-left"
                  style={{ backgroundColor: `${GOLD}14`, border: `1px solid ${GOLD}33`, color: CREAM }}
                >
                  Share to {c.label}
                </button>
              ))}
              <button
                onClick={() => void handleCopyLink()}
                className="w-full py-3.5 px-4 rounded-sm font-label text-[10px] font-bold uppercase tracking-widest"
                style={{ background: GOLD, color: NOIR }}
              >
                Copy shareable link
              </button>
              <button
                onClick={() => void handleSaveImage()}
                disabled={saving}
                className="w-full py-3.5 px-4 rounded-sm font-label text-[10px] font-bold uppercase tracking-widest"
                style={{ backgroundColor: `${GOLD}14`, border: `1px solid ${GOLD}33`, color: CREAM, opacity: saving ? 0.6 : 1 }}
              >
                {saving ? 'Rendering…' : 'Save image'}
              </button>
            </div>
            <div className="mt-8 flex items-center justify-between">
              <span className="font-label text-[9px] uppercase tracking-[0.2em]" style={{ color: `${CREAM}59` }}>
                Regenerated {timeAgo(audit.generated_at)}
              </span>
              <button
                onClick={() => void regenerate()}
                disabled={regenerating}
                className="font-label text-[9px] uppercase tracking-[0.2em] underline underline-offset-4"
                style={{ color: GOLD, opacity: regenerating ? 0.5 : 1 }}
              >
                {regenerating ? 'Reading…' : 'Refresh my Signature'}
              </button>
            </div>
          </>
        ) : (
          <>
            <Kicker>Your turn</Kicker>
            <h2 className="font-headline text-4xl mb-4" style={{ color: CREAM }}>
              {CARD_COPY.anonCta.title}
            </h2>
            <p className="font-headline italic text-base mb-10 max-w-[280px]" style={{ color: `${CREAM}b3` }}>
              {CARD_COPY.anonCta.body}
            </p>
            <button
              onClick={handleSignupCta}
              className="w-full py-4 rounded-sm font-label text-[11px] font-bold uppercase tracking-[0.2em]"
              style={{ background: GOLD, color: NOIR }}
            >
              {CARD_COPY.anonCta.button}
            </button>
          </>
        )}
      </AuditCard>
    </main>
  )
}
