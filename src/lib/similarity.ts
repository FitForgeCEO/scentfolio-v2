/**
 * Fragrance Similarity Engine
 * Computes similarity between fragrances using multiple signals
 */

import type { Fragrance } from '@/types/database'

interface SimilarityResult {
  fragrance: Fragrance
  score: number
  reasons: string[]
}

/**
 * Compute similarity score between two fragrances (0-100)
 */
export function computeSimilarity(a: Fragrance, b: Fragrance): { score: number; reasons: string[] } {
  let score = 0
  const reasons: string[] = []
  const maxScore = 100

  // 1. Accord overlap (0-35 points)
  const accordsA = new Set((a.accords ?? []).map(x => x.toLowerCase()))
  const accordsB = new Set((b.accords ?? []).map(x => x.toLowerCase()))
  if (accordsA.size > 0 && accordsB.size > 0) {
    const intersection = [...accordsA].filter(x => accordsB.has(x))
    const union = new Set([...accordsA, ...accordsB])
    const jaccard = intersection.length / union.size
    const accordScore = Math.round(jaccard * 35)
    score += accordScore
    if (intersection.length >= 3) reasons.push(`${intersection.length} shared accords`)
  }

  // 2. Note family match (0-20 points)
  if (a.note_family && b.note_family) {
    if (a.note_family.toLowerCase() === b.note_family.toLowerCase()) {
      score += 20
      reasons.push(`Same family: ${a.note_family}`)
    } else {
      // Related families get partial credit
      const related: Record<string, string[]> = {
        woody: ['aromatic', 'oriental'],
        oriental: ['woody', 'amber'],
        floral: ['fruity', 'green'],
        citrus: ['fresh', 'aromatic', 'aquatic'],
        aquatic: ['fresh', 'citrus', 'green'],
        fresh: ['citrus', 'aquatic', 'green'],
        aromatic: ['woody', 'citrus', 'green'],
        gourmand: ['oriental', 'vanilla'],
      }
      const relA = related[a.note_family.toLowerCase()] ?? []
      if (relA.includes(b.note_family.toLowerCase())) {
        score += 10
        reasons.push('Related families')
      }
    }
  }

  // 3. Brand match (0-10 points)
  if (a.brand === b.brand) {
    score += 10
    reasons.push(`Same house: ${a.brand}`)
  }

  // 4. Note overlap — top, heart, base (0-25 points)
  const notesA = new Set([...(a.notes_top ?? []), ...(a.notes_heart ?? []), ...(a.notes_base ?? [])].map(n => n.toLowerCase()))
  const notesB = new Set([...(b.notes_top ?? []), ...(b.notes_heart ?? []), ...(b.notes_base ?? [])].map(n => n.toLowerCase()))
  if (notesA.size > 0 && notesB.size > 0) {
    const sharedNotes = [...notesA].filter(n => notesB.has(n))
    const noteUnion = new Set([...notesA, ...notesB])
    const noteJaccard = sharedNotes.length / noteUnion.size
    score += Math.round(noteJaccard * 25)
    if (sharedNotes.length >= 3) reasons.push(`${sharedNotes.length} shared notes`)
  }

  // 5. Concentration & character match (0-10 points)
  if (a.concentration && b.concentration && a.concentration === b.concentration) {
    score += 5
  }
  if (a.gender && b.gender && a.gender === b.gender) {
    score += 5
  }

  return { score: Math.min(score, maxScore), reasons }
}

/**
 * Find the most similar fragrances from a candidate list
 */
export function findSimilar(
  target: Fragrance,
  candidates: Fragrance[],
  limit = 8,
  minScore = 15,
): SimilarityResult[] {
  return candidates
    .filter(c => c.id !== target.id)
    .map(c => {
      const { score, reasons } = computeSimilarity(target, c)
      return { fragrance: c, score, reasons }
    })
    .filter(r => r.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

/**
 * Find fragrances similar to a user's taste profile
 * (based on what they own and rate highly)
 */
export function findSimilarToCollection(
  owned: (Fragrance & { rating?: number | null })[],
  candidates: Fragrance[],
  limit = 10,
): SimilarityResult[] {
  // Weight by personal rating (higher rated = more influence)
  const ownedIds = new Set(owned.map(f => f.id))
  const scored = new Map<string, { score: number; reasons: Set<string> }>()

  for (const candidate of candidates) {
    if (ownedIds.has(candidate.id)) continue

    for (const own of owned) {
      const weight = own.rating ? own.rating / 5 : 0.6
      const { score, reasons } = computeSimilarity(own, candidate)
      const weighted = score * weight

      const existing = scored.get(candidate.id)
      if (existing) {
        existing.score = Math.max(existing.score, weighted)
        reasons.forEach(r => existing.reasons.add(r))
      } else {
        scored.set(candidate.id, { score: weighted, reasons: new Set(reasons) })
      }
    }
  }

  return [...scored.entries()]
    .map(([id, { score, reasons }]) => ({
      fragrance: candidates.find(c => c.id === id)!,
      score: Math.round(score),
      reasons: [...reasons],
    }))
    .filter(r => r.fragrance && r.score >= 10)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}
