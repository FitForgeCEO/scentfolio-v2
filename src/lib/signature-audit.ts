/**
 * Signature Audit — pure computation + copy layer.
 *
 * Everything in this module is side-effect-free (except drawOgImage, which
 * touches an offscreen canvas). The hook (useSignatureAudit) does the data
 * fetching; this module turns raw rows into the six-card audit payload and
 * carries every line of user-facing copy so tone lives in ONE place.
 *
 * Copy register: ScentFolio noir editorial ("The Endpaper" / "The Rekeying").
 * Warm, spare, slightly literary. Never exclamation marks. British English.
 */

// ── Payload types (stored as jsonb in signature_audits.data) ────────────────

export interface DnaFamily {
  family: string // display form, e.g. "Amber"
  pct: number    // integer, top-3 renormalised to sum ~100
}

export interface AuditBottle {
  brand: string
  name: string
  imageUrl: string | null
}

export interface SignatureAuditData {
  version: 1
  generatedAt: string
  ownerName: string | null
  wearLogCount: number
  collectionCount: number
  cards: {
    dna: { families: DnaFamily[]; personality: string } | null
    twin: (AuditBottle & { reason: string }) | null
    mostWorn: (AuditBottle & { count: number; window: '90d' | 'all' }) | null
    ghost: (AuditBottle & { lastWorn: string | null }) | null
    season: { season: Season; top: AuditBottle[] } | null
    verdict: { bottles: number; wears: number; longestStreak: number; brands: number }
  }
}

export type Season = 'Winter' | 'Spring' | 'Summer' | 'Autumn'

// ── Slug ─────────────────────────────────────────────────────────────────────

const SLUG_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

/** 10-char URL-safe random slug (nanoid-equivalent without the dependency). */
export function generateSlug(length = 10): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  let out = ''
  for (let i = 0; i < length; i++) out += SLUG_ALPHABET[bytes[i] % SLUG_ALPHABET.length]
  return out
}

// ── Note-family normalisation ────────────────────────────────────────────────
// The corpus carries case variants ("Woody"/"woody") and near-synonyms.
// Normalise to lowercase for arithmetic, Title Case for display.

const FAMILY_SYNONYMS: Record<string, string> = {
  oriental: 'amber',
  marine: 'aquatic',
  ozonic: 'aquatic',
  chypre: 'mossy',
}

export function normaliseFamily(raw: string | null | undefined): string | null {
  if (!raw) return null
  const f = raw.trim().toLowerCase()
  if (!f || f === 'n/a') return null
  return FAMILY_SYNONYMS[f] ?? f
}

export function displayFamily(family: string): string {
  return family.replace(/\b\w/g, (c) => c.toUpperCase())
}

// ── Card 1: Fragrance DNA ────────────────────────────────────────────────────
// Weight = 0.25 presence + 1.0 per wear. Wear frequency dominates (the brief:
// "actual signature, not aspirational shelf") but an unworn shelf still
// registers faintly so brand-new users get a real read.

export function computeDnaFamilies(
  owned: { note_family: string | null; wears: number }[],
): DnaFamily[] {
  const weights = new Map<string, number>()
  for (const o of owned) {
    const fam = normaliseFamily(o.note_family)
    if (!fam) continue
    weights.set(fam, (weights.get(fam) ?? 0) + 0.25 + o.wears)
  }
  const ranked = [...weights.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
  const total = ranked.reduce((s, [, w]) => s + w, 0)
  if (total <= 0) return []
  const out = ranked.map(([family, w]) => ({
    family: displayFamily(family),
    pct: Math.round((w / total) * 100),
  }))
  // Rounding can drift the sum off 100; pin the drift on the top family.
  const drift = 100 - out.reduce((s, f) => s + f.pct, 0)
  if (out.length > 0) out[0].pct += drift
  return out
}

// ── Personality map ──────────────────────────────────────────────────────────
// Pair lookup first (order-insensitive), then primary-family fallback, then
// a default that still reads as a compliment.

const PAIR_PERSONALITY: Record<string, string> = {
  'amber|woody': 'warm, deliberate, evening-first',
  'amber|warm spicy': 'slow-burning, magnetic, built for winter nights',
  'amber|vanilla': 'golden-hour warmth, kept deliberately close',
  'aromatic|citrus': 'crisp, exacting, first out the door',
  'aromatic|woody': 'composed, understated, sharper than it lets on',
  'citrus|woody': 'polished, daylight-first, quietly ambitious',
  'sweet|vanilla': 'comfort worn as confidence',
  'fruity|white floral': 'radiant, generous, the loudest quiet person in the room',
  'oud|rose': 'old-world, uncompromising, velvet over steel',
  'leather|tobacco': 'after-dark, storied, signs in ink',
  'leather|woody': 'assured, unhurried, more presence than perfume',
  'floral|powdery': 'tender, exact, an heirloom quality',
  'aquatic|citrus': 'clear-headed, open-window energy',
  'fruity|sweet': 'playful, indulgent, entirely unrepentant about it',
}

const FAMILY_PERSONALITY: Record<string, string> = {
  amber: 'warm, unhurried, built for the evening',
  woody: 'grounded, quietly certain, more depth than noise',
  citrus: 'bright, precise, first out the door',
  aromatic: 'clean-cut, composed, dangerous in a white shirt',
  'white floral': 'luminous, a little dramatic, never accidental',
  floral: 'romantic, exact, drawn to beautiful things',
  'warm spicy': 'magnetic, slow-burning, arrives without asking',
  'fresh spicy': 'sharp, awake, a cold morning taken personally',
  fruity: 'playful, generous, impossible to ignore',
  rose: 'classic, defiant, wears history lightly',
  vanilla: 'soft-spoken, disarming, warmer than it admits',
  sweet: 'indulgent, unapologetic, dessert before dinner',
  powdery: 'tender, nostalgic, an heirloom quality',
  musky: 'second-skin, intimate, kept close',
  green: 'sharp-eyed, outdoors-in, allergic to the obvious',
  leather: 'assured, a little severe, signs in ink',
  oud: 'uncompromising, ceremonial, deliberately not for everyone',
  gourmand: 'warm-blooded, comfort-first, dangerous at close range',
  aquatic: 'clear-headed, open-window energy',
  fresh: 'clean, unfussy, quietly relentless',
  iris: 'cool, exacting, quietly expensive',
  lavender: 'orderly, calm, a made bed of a person',
  tobacco: 'after-dark, storied, keeps good company',
  patchouli: 'earthy, contrarian, comfortable in shadow',
}

const DEFAULT_PERSONALITY = 'layered, particular, hard to place — which is rather the point'

export function personalityFor(displayFamilies: string[]): string {
  const fams = displayFamilies.map((f) => f.toLowerCase())
  if (fams.length >= 2) {
    const key = [fams[0], fams[1]].sort().join('|')
    if (PAIR_PERSONALITY[key]) return PAIR_PERSONALITY[key]
  }
  if (fams.length >= 1 && FAMILY_PERSONALITY[fams[0]]) return FAMILY_PERSONALITY[fams[0]]
  return DEFAULT_PERSONALITY
}

// ── Card 5: Season ───────────────────────────────────────────────────────────
// Northern-hemisphere meteorological seasons (UK default per brief).

export function seasonOf(dateStr: string): Season {
  const m = new Date(dateStr + 'T00:00:00').getMonth() // 0-11
  if (m === 11 || m <= 1) return 'Winter'
  if (m <= 4) return 'Spring'
  if (m <= 7) return 'Summer'
  return 'Autumn'
}

// ── Card 6: Longest streak ───────────────────────────────────────────────────

export function longestStreak(wearDates: string[]): number {
  const unique = [...new Set(wearDates)].sort()
  let best = 0
  let run = 0
  let prev: number | null = null
  for (const d of unique) {
    const t = new Date(d + 'T00:00:00').getTime()
    run = prev !== null && t - prev === 86_400_000 ? run + 1 : 1
    if (run > best) best = run
    prev = t
  }
  return best
}

// ── Card copy (single source of truth — the screen renders these verbatim) ──

export const CARD_COPY = {
  dna: {
    title: 'Your Fragrance DNA',
    body: 'This is your Signature. It’s the shape of what you actually reach for — not just what’s on the shelf.',
  },
  twin: {
    title: 'Your Fragrance Twin',
    body: 'Your closest twin is a bottle you don’t own yet. This is what your taste is quietly asking for.',
  },
  mostWorn: {
    title: 'Most Worn',
    body: 'This is the one you keep coming back to. There’s a reason.',
    badge: 'your top rotation',
  },
  ghost: {
    title: 'The Ghost',
    body: 'This one’s collecting dust. Give it a night this month.',
  },
  season: {
    title: 'Signature Season',
    body: (season: Season) => `You are a ${season} wearer. It shows in what you reach for.`,
  },
  verdict: {
    title: 'Wardrobe Verdict',
    body: (wears: number, bottles: number) =>
      `You’ve logged ${wears} ${wears === 1 ? 'wear' : 'wears'} across ${bottles} ${bottles === 1 ? 'bottle' : 'bottles'}. This is your wardrobe. It’s real, and it’s yours.`,
  },
  anonCta: {
    title: 'Get yours — free.',
    body: 'See what your collection says about you.',
    button: 'Read my Signature',
  },
} as const

// ── Share captions ───────────────────────────────────────────────────────────

export type ShareTarget = 'ig_story' | 'tiktok' | 'imessage' | 'x' | 'copy_link' | 'save_image'

export function shareCaptions(
  url: string,
  dna: { families: DnaFamily[]; personality: string } | null,
): { target: ShareTarget; label: string; caption: string }[] {
  const line = dna && dna.families.length >= 3
    ? `${dna.families[0].pct}% ${dna.families[0].family} · ${dna.families[1].pct}% ${dna.families[1].family} · ${dna.families[2].pct}% ${dna.families[2].family}`
    : 'My fragrance signature, read from what I actually wear'
  const personality = dna?.personality ?? ''
  return [
    {
      target: 'ig_story',
      label: 'Instagram Story',
      caption: `My Fragrance DNA — ${line}. Read by ScentFolio. ${url}`,
    },
    {
      target: 'tiktok',
      label: 'TikTok',
      caption: `What my fragrance collection says about me, apparently: ${personality || line}. ${url}`,
    },
    {
      target: 'imessage',
      label: 'Message',
      caption: `My fragrance signature — ${line}. See yours: ${url}`,
    },
    {
      target: 'x',
      label: 'X',
      caption: `${line}. My Fragrance DNA, via ScentFolio. ${url}`,
    },
  ]
}

// ── OG image (1200×630) ──────────────────────────────────────────────────────
// Drawn on generation, uploaded to the signature-og bucket. Composition:
// noir field, gold DNA bars left, bottle anchor right (skipped silently if
// the image can't be loaded CORS-clean), brand line bottom-left.

const NOIR = '#191210'
const GOLD = '#e5c276'
const CREAM = '#e8dfd3'

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

export async function drawOgImage(params: {
  ownerName: string | null
  dna: { families: DnaFamily[]; personality: string } | null
  bottleImageUrl: string | null
}): Promise<Blob | null> {
  const W = 1200
  const H = 630
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  // Field
  ctx.fillStyle = NOIR
  ctx.fillRect(0, 0, W, H)
  const glow = ctx.createRadialGradient(W * 0.32, H * 0.42, 60, W * 0.32, H * 0.42, 620)
  glow.addColorStop(0, 'rgba(229, 194, 118, 0.10)')
  glow.addColorStop(1, 'rgba(229, 194, 118, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  // Hairline frame
  ctx.strokeStyle = 'rgba(229, 194, 118, 0.35)'
  ctx.lineWidth = 2
  ctx.strokeRect(24, 24, W - 48, H - 48)

  const serif = '"Noto Serif", Georgia, serif'
  const sans = 'Inter, system-ui, sans-serif'

  // Kicker
  ctx.fillStyle = GOLD
  ctx.font = `600 22px ${sans}`
  ctx.textBaseline = 'alphabetic'
  ctx.fillText('Y O U R   F R A G R A N C E   D N A', 80, 116)

  // Owner line
  ctx.fillStyle = CREAM
  ctx.font = `italic 700 52px ${serif}`
  const owner = params.ownerName ? `${params.ownerName}’s Signature` : 'A Signature, read from real wears'
  ctx.fillText(owner, 80, 190, 680)

  // DNA bars
  const families = params.dna?.families ?? []
  const barX = 80
  const barMaxW = 560
  let y = 268
  ctx.font = `500 26px ${sans}`
  for (const f of families) {
    ctx.fillStyle = CREAM
    ctx.fillText(`${f.pct}%  ${f.family}`, barX, y)
    const w = Math.max(40, (f.pct / 100) * barMaxW)
    ctx.fillStyle = 'rgba(229, 194, 118, 0.18)'
    ctx.fillRect(barX, y + 16, barMaxW, 10)
    ctx.fillStyle = GOLD
    ctx.fillRect(barX, y + 16, w, 10)
    y += 88
  }
  if (families.length === 0 && params.dna?.personality) {
    ctx.fillStyle = CREAM
    ctx.font = `italic 400 30px ${serif}`
    ctx.fillText(params.dna.personality, barX, 300, 640)
  }

  // Bottle anchor (right third) — best-effort, never blocks
  if (params.bottleImageUrl) {
    const img = await loadImage(params.bottleImageUrl)
    if (img) {
      try {
        const maxH = 430
        const scale = Math.min(maxH / img.height, 300 / img.width)
        const dw = img.width * scale
        const dh = img.height * scale
        ctx.save()
        ctx.shadowColor = 'rgba(0,0,0,0.6)'
        ctx.shadowBlur = 40
        ctx.drawImage(img, W - 130 - dw, (H - dh) / 2, dw, dh)
        ctx.restore()
      } catch {
        /* tainted or draw failure — compose without the bottle */
      }
    }
  }

  // Brand line
  ctx.fillStyle = GOLD
  ctx.font = `600 24px ${sans}`
  ctx.fillText('your Fragrance DNA · scentfolio.app', 80, H - 72)

  return new Promise((resolve) => {
    try {
      canvas.toBlob((b) => resolve(b), 'image/png')
    } catch {
      resolve(null) // tainted canvas — caller skips the OG upload
    }
  })
}
