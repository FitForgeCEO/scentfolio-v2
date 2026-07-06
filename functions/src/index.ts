/**
 * signatureMeta -- crawler-visible OG meta tags for /signature/:slug.
 *
 * scentfolio.app is a Vite SPA: the initial HTML carries only generic
 * app-level OG tags, so link previews for shared Signature Audits
 * (Discord, Slack, iMessage, WhatsApp, X, LinkedIn) show a generic card
 * instead of the personalised one. Firebase Hosting rewrites /signature/**
 * through this function, which injects per-audit OG tags into the same
 * SPA index.html that Hosting would have served. Crawlers read the tags;
 * human visitors hydrate the full app exactly as before.
 *
 * No bot detection: everyone gets the tagged HTML (browsers ignore meta
 * tags they don't need). No secrets: signature_audits has a public-read
 * RLS policy, so the public anon key is sufficient.
 */
import { onRequest } from 'firebase-functions/v2/https'
import { logger } from 'firebase-functions'

// Both values are public by design -- they ship in the client bundle.
const SUPABASE_URL = 'https://xyktbygztvpadrhawvur.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5a3RieWd6dHZwYWRyaGF3dnVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4ODk4NjcsImV4cCI6MjA5MDQ2NTg2N30.inYv5Vni53aPAqnTqn4QVTx6ziaG_9GvZ-Y885ix4aU'

const CANONICAL_ORIGIN = 'https://scentfolio.app'
// Generic 1200x630 fallback -- used until the audit generation flow
// populates signature_audits.og_image_url (bucket is empty as of 6 July).
const FALLBACK_OG_IMAGE = `${CANONICAL_ORIGIN}/og-image.png`
const SLUG_RE = /^[A-Za-z0-9_-]{1,64}$/

interface AuditRow {
  slug: string
  og_image_url: string | null
  data: {
    ownerName?: string
    cards?: {
      dna?: {
        families?: Array<{ pct?: number; family?: string }>
      }
    }
  } | null
}

// ── SPA template ─────────────────────────────────────────────────────
// The built index.html references content-hashed assets that change on
// every hosting deploy, so we fetch it from Hosting at runtime (cached
// per instance) instead of bundling a copy that would go stale.
// Only /signature/** rewrites here, so fetching /index.html can't recurse.
let templateCache: { html: string; fetchedAt: number } | null = null
const TEMPLATE_TTL_MS = 5 * 60 * 1000

async function getSpaTemplate(origin: string): Promise<string | null> {
  if (templateCache && Date.now() - templateCache.fetchedAt < TEMPLATE_TTL_MS) {
    return templateCache.html
  }
  try {
    const res = await fetch(`${origin}/index.html`, {
      headers: { 'User-Agent': 'signatureMeta-fn' },
    })
    if (!res.ok) throw new Error(`template fetch status ${res.status}`)
    const html = await res.text()
    templateCache = { html, fetchedAt: Date.now() }
    return html
  } catch (err) {
    logger.warn('SPA template fetch failed; using stale copy if available', {
      origin,
      error: String(err),
    })
    return templateCache?.html ?? null // stale-if-error
  }
}

// Last-resort shell if Hosting itself is unreachable from the function.
// Crawlers don't execute JS, so the meta tags are all they need; the rare
// human who lands here gets a link through to the app.
function minimalShell(metaBlock: string, slug: string): string {
  return (
    '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">' +
    metaBlock +
    `</head><body><p><a href="${CANONICAL_ORIGIN}/signature/${escapeHtml(slug)}">View this Fragrance Signature on ScentFolio</a></p></body></html>`
  )
}

// ── Meta assembly ────────────────────────────────────────────────────
function escapeHtml(s: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }
  return s.replace(/[&<>"']/g, (c) => map[c])
}

function buildMetaBlock(audit: AuditRow): string {
  const ownerName = (audit.data?.ownerName ?? '').trim()
  // "Sofia K." -> "Sofia" (possessive first names read best in previews)
  const firstName = ownerName.split(/\s+/)[0] || ''

  const title = firstName
    ? `${firstName}'s Fragrance Signature — ScentFolio`
    : 'A Fragrance Signature — ScentFolio'

  const fams = (audit.data?.cards?.dna?.families ?? [])
    .filter((f) => typeof f.family === 'string' && typeof f.pct === 'number')
    .slice(0, 3)

  const description =
    fams.length === 3
      ? `${fams[0].pct}% ${fams[0].family}, ${fams[1].pct}% ${fams[1].family}, ${fams[2].pct}% ${fams[2].family} — see your own on ScentFolio`
      : 'A fragrance wardrobe, read like a signature — see your own on ScentFolio'

  const twitterDescription =
    fams.length >= 1
      ? `${fams[0].pct}% ${fams[0].family} · see your own on ScentFolio`
      : 'See your own fragrance signature on ScentFolio'

  const ogImage = audit.og_image_url || FALLBACK_OG_IMAGE
  const canonicalUrl = `${CANONICAL_ORIGIN}/signature/${audit.slug}`

  const e = escapeHtml
  return [
    `<title>${e(title)}</title>`,
    `<meta property="og:title" content="${e(title)}" />`,
    `<meta property="og:description" content="${e(description)}" />`,
    `<meta property="og:image" content="${e(ogImage)}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:url" content="${e(canonicalUrl)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="ScentFolio" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${e(firstName ? firstName + "'s Fragrance Signature" : 'A Fragrance Signature')}" />`,
    `<meta name="twitter:description" content="${e(twitterDescription)}" />`,
    `<meta name="twitter:image" content="${e(ogImage)}" />`,
  ].join('\n    ')
}

/** Swap the template's generic title + og/twitter tags for the audit's. */
function injectMeta(template: string, metaBlock: string): string {
  let html = template
  // Drop the generic tags (kept in index.html for every other route).
  html = html.replace(/[ \t]*<meta (?:property="og:|name="twitter:)[^>]*\/>\r?\n?/g, '')
  html = html.replace(/<title>[\s\S]*?<\/title>/, '')
  // Inject the personalised block just before </head>.
  return html.replace('</head>', `    ${metaBlock}\n  </head>`)
}

// ── Data fetch ───────────────────────────────────────────────────────
async function fetchAudit(slug: string): Promise<AuditRow | null | 'error'> {
  try {
    const url =
      `${SUPABASE_URL}/rest/v1/signature_audits` +
      `?slug=eq.${encodeURIComponent(slug)}&select=slug,og_image_url,data&limit=1`
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    })
    if (!res.ok) {
      logger.error('signature_audits query failed', { slug, status: res.status })
      return 'error'
    }
    const rows = (await res.json()) as AuditRow[]
    return rows[0] ?? null
  } catch (err) {
    logger.error('signature_audits query threw', { slug, error: String(err) })
    return 'error'
  }
}

// ── Handler ──────────────────────────────────────────────────────────
export const signatureMeta = onRequest(
  {
    // Hosting rewrites only reach functions in us-central1.
    region: 'us-central1',
    memory: '256MiB',
    timeoutSeconds: 10,
    maxInstances: 10,
    invoker: 'public',
  },
  async (req, res) => {
    // Original host (preview channel or prod) rides x-forwarded-host.
    const forwardedHost = (req.get('x-forwarded-host') ?? req.get('host') ?? 'scentfolio.app')
      .split(',')[0]
      .trim()
    const origin = `https://${forwardedHost}`

    const match = req.path.match(/^\/signature\/([^/]+)\/?$/)
    const slug = match ? decodeURIComponent(match[1]) : null

    const template = await getSpaTemplate(origin)

    // Invalid or missing slug -> plain SPA, uncached (spec: let the SPA 404).
    if (!slug || !SLUG_RE.test(slug)) {
      res.set('Cache-Control', 'no-store')
      res.status(200).send(template ?? minimalShell('', ''))
      return
    }

    const audit = await fetchAudit(slug)

    if (audit === 'error' || audit === null) {
      // Missing slug or Supabase down: degrade to the standard SPA.
      // no-store so a not-yet-generated audit isn't stuck behind a
      // cached miss the moment it exists.
      res.set('Cache-Control', 'no-store')
      res.status(200).send(template ?? minimalShell('', slug))
      return
    }

    const metaBlock = buildMetaBlock(audit)
    const html = template ? injectMeta(template, metaBlock) : minimalShell(metaBlock, slug)

    res.set('Cache-Control', 'public, max-age=3600, s-maxage=3600')
    res.set('Content-Type', 'text/html; charset=utf-8')
    res.status(200).send(html)
  }
)
