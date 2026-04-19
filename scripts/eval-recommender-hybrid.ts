/**
 * eval-recommender-hybrid.ts
 * ----------------------------------------------------------------------------
 * Hybrid-variant counterpart to eval-recommender.ts. Evaluates the SAME
 * 0.6 * vector + 0.4 * heuristic combine that ships in
 * src/lib/taste-vector.ts:fetchHybrid, so the coverage number produced by
 * this harness is the one that matters for the user-facing recommender.
 *
 * Why both harnesses exist
 * ------------------------
 * notes/recommender-design.md Section 10 wants two baselines:
 *   (1) Pure vector -- the clean signal on the embedding leg alone.
 *       Produced by eval-recommender.ts. Baseline 1: 36.4% -> 43.2% coverage
 *       after the ivfflat-probes and Aventus-row fixes (18 April).
 *   (2) Hybrid -- what the app actually serves. This file.
 *
 * The delta between (1) and (2) tells us whether the heuristic leg is
 * carrying the recommender (or masking a weak vector leg). Before tuning
 * the 0.6/0.4 weight balance in Section 4.2, we need both numbers.
 *
 * Seed shape
 * ----------
 * Each eval runs with owned = [{...seed, rating: 5}]. Singleton at max
 * rating -> weighted centroid collapses to the seed's embedding verbatim
 * (weight 1.0), which is the same query vector the pure-vector harness
 * uses. Then the heuristic rescore + combine runs on top. Net effect: this
 * harness isolates the CONTRIBUTION of the heuristic leg relative to the
 * pure-vector baseline.
 *
 * What this does NOT test
 * -----------------------
 * Multi-seed centroid behaviour (5+ owned fragrances blending into a
 * taste-vector). That's a different eval shape (user-level, not pair-level)
 * and is deferred until click telemetry accumulates enough data to define
 * ground-truth "what should surface for this user".
 *
 * Heuristic duplication note
 * --------------------------
 * computeSimilarity() from src/lib/similarity.ts is duplicated inline
 * below rather than imported. tsx in scripts/ does not resolve the `@/`
 * Vite path alias, and wiring it up for a one-off eval would be ceremony.
 * If similarity.ts drifts, this harness's output will shift relative to
 * production -- that's fine and actually how we'd notice. Keep the inline
 * copy in sync by hand when touching similarity.ts's scoring logic.
 *
 * Usage
 * -----
 *   npm run eval:recommender:hybrid
 *   npx tsx scripts/eval-recommender-hybrid.ts --pairs scripts/eval-pairs.json
 *   npx tsx scripts/eval-recommender-hybrid.ts --top-k 50 --pool 80 --verbose
 *
 * Env (same as eval-recommender.ts)
 * ---------------------------------
 *   VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 * ----------------------------------------------------------------------------
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// ---------- CLI flags ---------------------------------------------------------
const argv = process.argv.slice(2);
const PAIRS_PATH = (() => {
  const i = argv.indexOf("--pairs");
  return i !== -1 ? (argv[i + 1] ?? "scripts/eval-pairs.json") : "scripts/eval-pairs.json";
})();
const TOP_K = (() => {
  const i = argv.indexOf("--top-k");
  return i !== -1 ? parseInt(argv[i + 1] ?? "", 10) : 20;
})();
const POOL = (() => {
  const i = argv.indexOf("--pool");
  return i !== -1 ? parseInt(argv[i + 1] ?? "", 10) : 40;
})();
const VERBOSE = argv.includes("--verbose");

// ---------- Production constants (mirror src/lib/taste-vector.ts) ------------
const VECTOR_WEIGHT = 0.6;
const HEURISTIC_WEIGHT = 0.4;
const UNRATED_WEIGHT = 0.6;   // unused at eval time (rating pinned to 5) but
                              // kept here so the file reads the same as prod.

// ---------- Env ---------------------------------------------------------------
function loadDotenv(path: string): Record<string, string> {
  try {
    const raw = readFileSync(path, "utf8");
    return Object.fromEntries(
      raw
        .split(/\r?\n/)
        .filter((l) => l && !l.startsWith("#") && l.includes("="))
        .map((l) => {
          const idx = l.indexOf("=");
          return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
        }),
    );
  } catch {
    return {};
  }
}
const env = { ...loadDotenv(resolve(process.cwd(), ".env")), ...process.env };
const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  console.error("Missing VITE_SUPABASE_URL. Add it to .env or export it.");
  process.exit(1);
}
if (!SERVICE_ROLE_KEY) {
  console.error(
    "Missing SUPABASE_SERVICE_ROLE_KEY. Grab it from the Supabase dashboard\n" +
      "(Settings -> API -> service_role) and export it locally. DO NOT commit.",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---------- Types -------------------------------------------------------------
type Ref = { brand: string; name: string };
type PairSpec = { a: Ref; b: Ref; note?: string };
type PairsFile = { pairs: PairSpec[] };

// Subset of Fragrance needed by computeSimilarity. Keep field list in sync
// with FRAGRANCE_SELECT below and with similarity.ts.
type FragranceRow = {
  id: string;
  brand: string | null;
  name: string | null;
  concentration: string | null;
  gender: string | null;
  accords: string[] | null;
  note_family: string | null;
  notes_top: string[] | null;
  notes_heart: string[] | null;
  notes_base: string[] | null;
};

type Resolved = FragranceRow & {
  embedding: number[];
};

type EvalOutcome = {
  direction: string;
  hit: boolean;
  rank: number | null;
  combined: number | null;         // 0-1 combined score at hit rank
  vectorScore: number | null;      // 0-1 vector score at hit rank
  heuristicScore: number | null;   // 0-1 heuristic score at hit rank
  note?: string;
};

const FRAGRANCE_SELECT =
  "id, brand, name, concentration, gender, accords, note_family, notes_top, notes_heart, notes_base";

// ---------- Inline computeSimilarity (duplicate of src/lib/similarity.ts) ----
// Keep in sync by hand when similarity.ts scoring changes.
function computeSimilarity(
  a: FragranceRow,
  b: FragranceRow,
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const maxScore = 100;

  // 1. Accord overlap (0-35 points)
  const accordsA = new Set((a.accords ?? []).map((x) => x.toLowerCase()));
  const accordsB = new Set((b.accords ?? []).map((x) => x.toLowerCase()));
  if (accordsA.size > 0 && accordsB.size > 0) {
    const intersection = [...accordsA].filter((x) => accordsB.has(x));
    const union = new Set([...accordsA, ...accordsB]);
    const jaccard = intersection.length / union.size;
    const accordScore = Math.round(jaccard * 35);
    score += accordScore;
    if (intersection.length >= 3) reasons.push(`${intersection.length} shared accords`);
  }

  // 2. Note family match (0-20 points)
  if (a.note_family && b.note_family) {
    if (a.note_family.toLowerCase() === b.note_family.toLowerCase()) {
      score += 20;
      reasons.push(`Same family: ${a.note_family}`);
    } else {
      const related: Record<string, string[]> = {
        woody: ["aromatic", "oriental"],
        oriental: ["woody", "amber"],
        floral: ["fruity", "green"],
        citrus: ["fresh", "aromatic", "aquatic"],
        aquatic: ["fresh", "citrus", "green"],
        fresh: ["citrus", "aquatic", "green"],
        aromatic: ["woody", "citrus", "green"],
        gourmand: ["oriental", "vanilla"],
      };
      const relA = related[a.note_family.toLowerCase()] ?? [];
      if (relA.includes(b.note_family.toLowerCase())) {
        score += 10;
        reasons.push("Related families");
      }
    }
  }

  // 3. Brand match (0-10 points)
  if (a.brand && b.brand && a.brand === b.brand) {
    score += 10;
    reasons.push(`Same house: ${a.brand}`);
  }

  // 4. Note overlap (0-25 points)
  const notesA = new Set(
    [...(a.notes_top ?? []), ...(a.notes_heart ?? []), ...(a.notes_base ?? [])].map((n) =>
      n.toLowerCase(),
    ),
  );
  const notesB = new Set(
    [...(b.notes_top ?? []), ...(b.notes_heart ?? []), ...(b.notes_base ?? [])].map((n) =>
      n.toLowerCase(),
    ),
  );
  if (notesA.size > 0 && notesB.size > 0) {
    const sharedNotes = [...notesA].filter((n) => notesB.has(n));
    const noteUnion = new Set([...notesA, ...notesB]);
    const noteJaccard = sharedNotes.length / noteUnion.size;
    score += Math.round(noteJaccard * 25);
    if (sharedNotes.length >= 3) reasons.push(`${sharedNotes.length} shared notes`);
  }

  // 5. Concentration & gender (0-10 points)
  if (a.concentration && b.concentration && a.concentration === b.concentration) {
    score += 5;
  }
  if (a.gender && b.gender && a.gender === b.gender) {
    score += 5;
  }

  return { score: Math.min(score, maxScore), reasons };
}

// ---------- pgvector serialisation (mirror src/lib/taste-vector.ts) ----------
function parseEmbedding(raw: unknown): number[] | null {
  if (Array.isArray(raw)) {
    return raw.every((v) => typeof v === "number" && Number.isFinite(v))
      ? (raw as number[])
      : null;
  }
  if (typeof raw === "string") {
    if (raw.length === 0) return null;
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) &&
        parsed.every((v) => typeof v === "number" && Number.isFinite(v))
        ? (parsed as number[])
        : null;
    } catch {
      return null;
    }
  }
  return null;
}

// ---------- Lookups -----------------------------------------------------------
async function resolveRef(ref: Ref): Promise<Resolved | null> {
  const { data, error } = await supabase
    .from("fragrances")
    .select(`${FRAGRANCE_SELECT}, embedding`)
    .eq("brand", ref.brand)
    .eq("name", ref.name)
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error(`  lookup error for ${ref.brand} - ${ref.name}: ${error.message}`);
    return null;
  }
  if (!data) {
    console.error(`  not found: ${ref.brand} - ${ref.name}`);
    return null;
  }
  const row = data as FragranceRow & { embedding: unknown };
  const embedding = parseEmbedding(row.embedding);
  if (!embedding) {
    console.error(`  ${ref.brand} - ${ref.name}: no usable embedding (null or malformed)`);
    return null;
  }
  return {
    id: row.id,
    brand: row.brand,
    name: row.name,
    concentration: row.concentration,
    gender: row.gender,
    accords: row.accords,
    note_family: row.note_family,
    notes_top: row.notes_top,
    notes_heart: row.notes_heart,
    notes_base: row.notes_base,
    embedding,
  };
}

// ---------- Hybrid eval -------------------------------------------------------
// Mirrors src/lib/taste-vector.ts:fetchHybrid with owned = [{...seed, rating:5}].
// Singleton at rating 5 collapses the weighted centroid to seed.embedding
// verbatim, so the RPC call matches the pure-vector harness, then heuristic
// rescore + combine layers on top.
async function evalHybrid(
  seed: Resolved,
  twin: Resolved,
  pool: number,
  topK: number,
): Promise<EvalOutcome> {
  const direction = `${seed.brand} - ${seed.name}  ->  ${twin.brand} - ${twin.name}`;

  // 1. RPC with seed's embedding directly (centroid of a singleton weight-1
  //    owned set == seed's own embedding).
  const { data: matches, error: matchErr } = await supabase.rpc("match_fragrances", {
    query_embedding: seed.embedding,
    match_count: pool,
    exclude_id: null,
  });
  if (matchErr) {
    console.error(`  RPC error for ${direction}: ${matchErr.message}`);
    return {
      direction,
      hit: false,
      rank: null,
      combined: null,
      vectorScore: null,
      heuristicScore: null,
    };
  }
  const vectorMatches = (matches ?? []) as { id: string; score: number }[];
  // Filter out the seed itself (fetchHybrid filters the full owned set; here
  // the owned set is just [seed]).
  const filtered = vectorMatches.filter((m) => m.id !== seed.id);
  if (filtered.length === 0) {
    return {
      direction,
      hit: false,
      rank: null,
      combined: null,
      vectorScore: null,
      heuristicScore: null,
    };
  }

  // 2. Hydrate candidates for heuristic rescore (RLS -> approved only).
  const ids = filtered.map((m) => m.id);
  const { data: rows, error: rowErr } = await supabase
    .from("fragrances")
    .select(FRAGRANCE_SELECT)
    .in("id", ids);
  if (rowErr) {
    console.error(`  hydrate error for ${direction}: ${rowErr.message}`);
    return {
      direction,
      hit: false,
      rank: null,
      combined: null,
      vectorScore: null,
      heuristicScore: null,
    };
  }
  const candidates = (rows ?? []) as FragranceRow[];
  const candidateById = new Map(candidates.map((c) => [c.id, c]));
  const vectorScoreById = new Map(filtered.map((m) => [m.id, m.score]));

  // 3. Combine. Singleton owned at rating 5 -> weight = 1.0, so
  //    heuristicMax = computeSimilarity(seed, cand).score exactly.
  const scored: {
    id: string;
    combined: number;
    vector: number;
    heuristic: number;
  }[] = [];
  for (const id of ids) {
    const cand = candidateById.get(id);
    if (!cand) continue;
    const { score: sim } = computeSimilarity(seed, cand);
    const vectorScore = vectorScoreById.get(id) ?? 0;
    const heuristicScore = sim / 100; // 0-100 -> 0-1
    const combined = VECTOR_WEIGHT * vectorScore + HEURISTIC_WEIGHT * heuristicScore;
    scored.push({ id, combined, vector: vectorScore, heuristic: heuristicScore });
  }

  scored.sort((a, b) => b.combined - a.combined);
  const ranked = scored.slice(0, topK);
  const idx = ranked.findIndex((r) => r.id === twin.id);
  if (idx === -1) {
    return {
      direction,
      hit: false,
      rank: null,
      combined: null,
      vectorScore: null,
      heuristicScore: null,
    };
  }
  const hit = ranked[idx];
  return {
    direction,
    hit: true,
    rank: idx + 1,
    combined: hit.combined,
    vectorScore: hit.vector,
    heuristicScore: hit.heuristic,
  };
}

// ---------- Main --------------------------------------------------------------
async function main() {
  console.log("=".repeat(72));
  console.log("eval-recommender-hybrid");
  console.log(`  pairs:  ${PAIRS_PATH}`);
  console.log(`  top-k:  ${TOP_K}`);
  console.log(`  pool:   ${POOL}   (VECTOR_CANDIDATE_POOL in prod = 40)`);
  console.log(`  weights: ${VECTOR_WEIGHT} vector + ${HEURISTIC_WEIGHT} heuristic`);
  console.log(`  (unrated weight ${UNRATED_WEIGHT} unused; eval pins rating=5)`);
  console.log("=".repeat(72));

  let parsed: PairsFile;
  try {
    const raw = readFileSync(resolve(process.cwd(), PAIRS_PATH), "utf8");
    parsed = JSON.parse(raw) as PairsFile;
  } catch (e: unknown) {
    console.error(
      `Failed to read/parse ${PAIRS_PATH}: ${e instanceof Error ? e.message : String(e)}`,
    );
    process.exit(1);
  }

  const pairs = parsed.pairs ?? [];
  if (pairs.length === 0) {
    console.error("No pairs in file. Exiting.");
    process.exit(1);
  }
  console.log(`Loaded ${pairs.length} pair(s).`);

  const outcomes: EvalOutcome[] = [];
  let skipped = 0;

  for (let i = 0; i < pairs.length; i++) {
    const p = pairs[i];
    console.log(
      `\n[pair ${i + 1}/${pairs.length}] ${p.a.brand} - ${p.a.name}  <->  ${p.b.brand} - ${p.b.name}`,
    );
    if (p.note && VERBOSE) console.log(`  note: ${p.note}`);

    const [ra, rb] = await Promise.all([resolveRef(p.a), resolveRef(p.b)]);
    if (!ra || !rb) {
      console.log("  skipped (unresolved)");
      skipped++;
      continue;
    }

    // Sequential (not parallel) so RPC logs are interleaved cleanly.
    const oAB = await evalHybrid(ra, rb, POOL, TOP_K);
    const oBA = await evalHybrid(rb, ra, POOL, TOP_K);
    for (const o of [oAB, oBA]) {
      if (p.note) o.note = p.note;
      outcomes.push(o);
      const badge = o.hit ? `HIT @${o.rank}` : "MISS";
      const breakdown =
        o.hit && o.combined !== null && o.vectorScore !== null && o.heuristicScore !== null
          ? ` (combined ${o.combined.toFixed(4)}  vec ${o.vectorScore.toFixed(4)}  heu ${o.heuristicScore.toFixed(4)})`
          : "";
      console.log(`  ${badge.padEnd(10)} ${o.direction}${breakdown}`);
    }
  }

  // --- summary ---------------------------------------------------------------
  const evaluated = outcomes.length;
  const hits = outcomes.filter((o) => o.hit);
  const misses = outcomes.filter((o) => !o.hit);
  const coverage = evaluated > 0 ? (hits.length / evaluated) * 100 : 0;
  const meanRank = hits.length
    ? hits.reduce((a, o) => a + (o.rank ?? 0), 0) / hits.length
    : NaN;
  const worstRank = hits.length ? Math.max(...hits.map((o) => o.rank ?? 0)) : NaN;

  console.log("\n" + "=".repeat(72));
  console.log("Summary (HYBRID: 0.6 vector + 0.4 heuristic)");
  console.log(`  pairs loaded:     ${pairs.length}`);
  console.log(`  pairs skipped:    ${skipped}`);
  console.log(`  evals:            ${evaluated}   (2 x resolved pairs)`);
  console.log(
    `  hits:             ${hits.length} / ${evaluated}   (${coverage.toFixed(1)}% coverage)`,
  );
  console.log(
    `  mean rank (hit):  ${Number.isNaN(meanRank) ? "n/a" : meanRank.toFixed(2)}`,
  );
  console.log(
    `  worst rank (hit): ${Number.isNaN(worstRank) ? "n/a" : String(worstRank)}`,
  );

  if (misses.length > 0) {
    console.log("\nMisses:");
    for (const m of misses) {
      console.log(`  ${m.direction}${m.note ? "   // " + m.note : ""}`);
    }
  }

  // CI-usable exit code. 0 on any hits, 2 on zero coverage, 1 on errors above.
  if (evaluated > 0 && hits.length === 0) {
    console.error("\nAll evals missed. Exiting non-zero.");
    process.exit(2);
  }
}

main().catch((e) => {
  console.error("Unhandled error:", e);
  process.exit(1);
});
