/**
 * Unit tests for archetypeFrom + archetype-led shareCaptions.
 *
 * Run: npm run test:archetype   (tsx, no test-runner dependency — same
 * pattern as the eval-recommender scripts). Exit 0 = all pass.
 */

import {
  archetypeFrom,
  shareCaptions,
  type SignatureAuditData,
  type DnaFamily,
} from '../src/lib/signature-audit'

let failures = 0
function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    console.log(`  ok  ${name}`)
  } else {
    failures++
    console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

function payload(opts: {
  families?: DnaFamily[] | null
  bottles?: number
  wears?: number
  brands?: number
  streak?: number
}): SignatureAuditData {
  const families = opts.families === null ? null : (opts.families ?? [])
  return {
    version: 1,
    generatedAt: '2026-07-11T00:00:00.000Z',
    ownerName: 'Dan',
    wearLogCount: opts.wears ?? 0,
    collectionCount: opts.bottles ?? 0,
    cards: {
      dna: families && families.length > 0
        ? { families, personality: 'warm, deliberate, evening-first' }
        : null,
      twin: null,
      mostWorn: null,
      ghost: null,
      season: null,
      verdict: {
        bottles: opts.bottles ?? 0,
        wears: opts.wears ?? 0,
        longestStreak: opts.streak ?? 0,
        brands: opts.brands ?? 0,
      },
    },
  }
}

const fams = (a: number, b: number, c: number): DnaFamily[] => [
  { family: 'Amber', pct: a },
  { family: 'Woody', pct: b },
  { family: 'Citrus', pct: c },
]

// ── Rule table, first match wins ──────────────────────────────────────────────
check(
  'Purist: top family >= 55%',
  archetypeFrom(payload({ families: fams(60, 25, 15), bottles: 12, brands: 5, wears: 10 }))?.name === 'The Amber Purist',
)
check(
  'Purist outranks Maximalist (rule order)',
  archetypeFrom(payload({ families: fams(60, 25, 15), bottles: 30, brands: 12, wears: 90 }))?.name === 'The Amber Purist',
)
check(
  'Minimalist: <= 8 bottles',
  archetypeFrom(payload({ families: fams(50, 30, 20), bottles: 6, brands: 3, wears: 10 }))?.name === 'The Amber Minimalist',
)
check(
  'Maximalist: >= 25 bottles',
  archetypeFrom(payload({ families: fams(50, 30, 20), bottles: 30, brands: 12, wears: 90 }))?.name === 'The Amber Maximalist',
)
check(
  'Explorer: >= 10 brands',
  archetypeFrom(payload({ families: fams(50, 30, 20), bottles: 12, brands: 11, wears: 90 }))?.name === 'The Amber Explorer',
)
check(
  'Devotee: >= 50 wears',
  archetypeFrom(payload({ families: fams(50, 30, 20), bottles: 12, brands: 5, wears: 60 }))?.name === 'The Amber Devotee',
)
check(
  'Polyglot: even spread (top - third <= 10)',
  archetypeFrom(payload({ families: fams(36, 34, 30), bottles: 12, brands: 5, wears: 10 }))?.name === 'The Amber Polyglot',
)
check(
  'Polyglot boundary: spread exactly 10 matches',
  archetypeFrom(payload({ families: fams(40, 30, 30), bottles: 12, brands: 5, wears: 10 }))?.name === 'The Amber Polyglot',
)
check(
  'Collector: default when nothing else matches',
  archetypeFrom(payload({ families: fams(45, 35, 20), bottles: 12, brands: 5, wears: 10 }))?.name === 'The Amber Collector',
)

// ── Family label overrides ────────────────────────────────────────────────────
check(
  'Warm Spicy -> Spiced',
  archetypeFrom(payload({
    families: [{ family: 'Warm Spicy', pct: 60 }, { family: 'Amber', pct: 40 }],
    bottles: 12, brands: 5, wears: 10,
  }))?.name === 'The Spiced Purist',
)
check(
  'White Floral -> Floral',
  archetypeFrom(payload({
    families: [{ family: 'White Floral', pct: 70 }, { family: 'Rose', pct: 30 }],
    bottles: 12, brands: 5, wears: 10,
  }))?.name === 'The Floral Purist',
)
check(
  'Mossy -> Chypre',
  archetypeFrom(payload({
    families: [{ family: 'Mossy', pct: 80 }, { family: 'Citrus', pct: 20 }],
    bottles: 12, brands: 5, wears: 10,
  }))?.name === 'The Chypre Purist',
)

// ── Edge cases ────────────────────────────────────────────────────────────────
check('null on missing dna card', archetypeFrom(payload({ families: null })) === null)
check('null on empty families', archetypeFrom(payload({ families: [] })) === null)
check(
  'single family still resolves',
  archetypeFrom(payload({
    families: [{ family: 'Amber', pct: 100 }], bottles: 12, brands: 5, wears: 10,
  }))?.name === 'The Amber Purist',
)
check(
  'two families cannot be Polyglot (needs a third)',
  archetypeFrom(payload({
    families: [{ family: 'Amber', pct: 52 }, { family: 'Woody', pct: 48 }],
    bottles: 12, brands: 5, wears: 10,
  }))?.name === 'The Amber Collector',
)
check(
  'tagline reuses the stored personality',
  archetypeFrom(payload({ families: fams(60, 25, 15), bottles: 12 }))?.tagline ===
    'warm, deliberate, evening-first',
)

// ── Determinism ───────────────────────────────────────────────────────────────
{
  const p = payload({ families: fams(45, 35, 20), bottles: 12, brands: 5, wears: 10 })
  const a = archetypeFrom(p)
  const b = archetypeFrom(p)
  check('deterministic over identical payloads', JSON.stringify(a) === JSON.stringify(b))
}

// ── Captions ──────────────────────────────────────────────────────────────────
{
  const dna = { families: fams(42, 31, 27), personality: 'warm, deliberate, evening-first' }
  const url = 'https://scentfolio.app/signature/abc'
  const withArch = shareCaptions(url, dna, { name: 'The Amber Maximalist', tagline: 'x' })
  const tiktok = withArch.find((c) => c.target === 'tiktok')
  check(
    'TikTok caption leads with the identity claim',
    tiktok?.caption === `Apparently I’m The Amber Maximalist. What’s your fragrance signature? ${url}`,
    tiktok?.caption,
  )
  const ig = withArch.find((c) => c.target === 'ig_story')
  check('IG caption keeps the % line as second sentence', !!ig && ig.caption.includes('42% Amber'))
  check('every archetype caption carries the name', withArch.every((c) => c.caption.includes('The Amber Maximalist')))

  const without = shareCaptions(url, dna, null)
  check(
    'no archetype -> legacy captions unchanged',
    without.find((c) => c.target === 'ig_story')?.caption.startsWith('My Fragrance DNA — 42% Amber') === true,
  )
  check(
    'omitted archetype param -> legacy captions (backwards compatible)',
    shareCaptions(url, dna).find((c) => c.target === 'imessage')?.caption.startsWith('My fragrance signature —') === true,
  )
}

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`)
  process.exit(1)
}
console.log('\nAll archetype tests passed.')
