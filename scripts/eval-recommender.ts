/**
 * eval-recommender.ts
 * ----------------------------------------------------------------------------
 * Offline evaluation harness for the hybrid recommender.
 *
 * MODES
 * -----
 *   # Default: pure-vector baseline (W=1.0, backwards-compat with pre-#65 runs)
 *   npm run eval:recommender
 *
 *   # Single hybrid weight
 *   npx tsx scripts/eval-recommender.ts --weight 0.6
 *
 *   # Weight sweep across [1.0, 0.8, 0.6, 0.5, 0.4, 0.3, 0.2, 0.0]
 *   npx tsx scripts/eval-recommender.ts --sweep
 *
 * Hybrid scoring mirrors production (src/hooks/useSimilarFragrances.ts):
 *
 *     combined = W * vectorScore + (1 - W) * (heuristicScore / 100)
 *
 * where vectorScore = 1 - cosine_distance from match_fragrances, and
 * heuristicScore is the inlined mirror of src/lib/similarity.ts
 * computeSimilarity(). We don't import from src because tsx path-aliasing
 * is unreliable for standalone scripts -- if similarity.ts changes, update
 * computeHeuristicSimilarity() here in lockstep.
 *
 * CACHING
 * -------
 * Each unique seed's top-N RPC pool + hydrated candidate rows are fetched
 * ONCE and replayed across sweep weights synchronously. An 8-weight sweep
 * over 22 pairs (39 unique seeds) does 39 RPC calls + 39 hydrate queries,
 * not 8 x 44 = 352.
 *
 * Why this exists
 * ---------------
 * notes/recommender-design.md Section 10 demands an offline eval before we touch
 * the 0.6/0.4 weight balance (Section 4.2) or swap the embedding model. Production
 * click-telemetry (src/lib/analytics.ts RECOMMENDER_CLICK, wired in Section 10(a))
 * needs weeks to accumulate -- this harness gives a same-day signal.
 *
 * Cohorts (added 19 April)
 * ------------------------
 * The 18 April hybrid-eval run surfaced a weight-tuning trap: aggregate coverage
 * hid the fact that most "twin" pairs are really same-name-different-juice or
 * cross-house-cousin -- pairs where the note pyramids legitimately diverge.
 * See Recommender-Eval-Audit-19Apr2026.md. The harness reports per-cohort
 * breakdowns:
 *
 *   - genuine-twin              (heart_ov >= 0.5 AND base_ov >= 0.5)
 *   - same-name-different-juice (same brand, note pyramid diverges)
 *   - cross-house-cousin        (everything else)
 *
 * Pairs without a `cohort` field land in `uncategorised`.
 *
 * Pairs schema
 * ------------
 *   {
 *     "pairs": [
 *       {
 *         "a": { "brand": "Dior", "name": "Sauvage" },
 *         "b": { "brand": "Dior", "name": "Sauvage Parfum" },
 *         "note": "Same-house flanker -- should land top-5",
 *         "cohort": "same-name-different-juice"
 *       }
 *     ]
 *   }
 *
 * Brand+name is preferred over UUIDs because curators don't have the IDs
 * to hand. Lookup is exact-match, case-sensitive on both fields. If a row
 * doesn't resolve, the pair is skipped with a logged reason -- a partly
 * curated file still produces signal rather than hard-failing the run.
 *
 * Usage
 * -----
 *   # Sample pairs (ships with the repo)
 *   npm run eval:recommender
 *
 *   # Custom file
 *   npx tsx scripts/eval-recommender.ts --pairs scripts/eval-pairs.json
 *
 *   # Single hybrid weight (default 1.0 = pure vector)
 *   npx tsx scripts/eval-recommender.ts --weight 0.6
 *
 *   # Weight sweep
 *   npx tsx scripts/eval-recommender.ts --sweep
 *
 *   # Widen the net
 *   npx tsx scripts/eval-recommender.ts --top-k 50 --pool 80 --verbose
 *
 *   # Restrict to a cohort
 *   npx tsx scripts/eval-recommender.ts --cohort genuine-twin
 *
 * Env (same as embed-fragrances.ts)
 * ---------------------------------
 *   VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   -- bypasses RLS so we can read the embedding
 *                                  column directly; never commit.
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
const WEIGHT = (() => {
  const i = argv.indexOf("--weight");
  return i !== -1 ? parseFloat(argv[i + 1] ?? "") : 1.0;
})();
const POOL = (() => {
  const i = argv.indexOf("--pool");
  return i !== -1 ? parseInt(argv[i + 1] ?? "", 10) : 40;
})();
const SWEEP = argv.includes("--sweep");
const COHORT_FILTER = (() => {
  const i = argv.indexOf("--cohort");
  if (i === -1) return null;
  const raw = (argv[i + 1] ?? "").trim();
  if (!raw) return null;
  return new Set(raw.split(",").map((s) => s.trim()).filter(Boolean));
})();
const VERBOSE = argv.includes("--verbose");

if (Number.isNaN(TOP_K) || TOP_K <= 0) {
  console.error(`Invalid --top-k: ${TOP_K}`);
  process.exit(1);
}
if (Number.isNaN(WEIGHT) || WEIGHT < 0 || WEIGHT > 1) {
  console.error(`Invalid --weight: ${WEIGHT} (must be in [0, 1])`);
  process.exit(1);
}
if (Number.isNaN(POOL) || POOL <= 0) {
  console.error(`Invalid --pool: ${POOL}`);
  process.exit(1);
}
if (POOL < TOP_K) {
  console.error(
    `--pool (${POOL}) must be >= --top-k (${TOP_K}); cannot rerank a pool smaller than K`,
  );
  process.exit(1);
}

// Fixed sweep ladder: pure-vector at W=1.0 down to pure-heuristic at W=0.0.
const SWEEP_WEIGHTS = [1.0, 0.8, 0.6, 0.5, 0.4, 0.3, 0.2, 0.0] as const;

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
type PairSpec = { a: Ref; b: Ref; note?: string; cohort?: string };
type PairsFile = { pairs: PairSpec[] };

// Full fragrance row with columns the inlined heuristic needs.
type FragranceRow = {
  id: string;
  brand: string;
  name: string;
  accords: string[] | null;
  note_family: string | null;
  notes_top: string[] | null;
  notes_heart: string[] | null;
  notes_base: string[] | null;
  concentration: string | null;
  gender: string | null;
};

type Resolved = FragranceRow & {
  embedding: number[];
};

type SeedCache = {
  // Pre-sorted DESC by vectorScore (match_fragrances returns in that order).
  rpcRows: { id: string; score: number }[];
  // FragranceRow by id for any row hydrated from the pool (respects RLS).
  candidateById: Map<string, FragranceRow>;
};

type ResolvedPair = {
  spec: PairSpec;
  a: Resolved;
  b: Resolved;
  cohort: string;
};

type EvalOutcome = {
  direction: string; // "Dior Sauvage -> Dior Sauvage Parfum"
  hit: boolean;
  rank: number | null; // 1-indexed rank where twin appeared, or null
  score: number | null; // combined score at hit rank
  note?: string;
  cohort: string; // falls back to "uncategorised" when pair omits the field
};

const UNCATEGORISED = "uncategorised";
const SELECT_COLS =
  "id, brand, name, embedding, accords, note_family, notes_top, notes_heart, notes_base, concentration, gender";

// ---------- pgvector serialisation helper ------------------------------------
// Mirrors src/lib/taste-vector.ts: supabase-js returns vector(384) as a JSON
// string "[0.1,0.2,...]". Parse before use. Memory:
// project_scentfolio_pgvector_column_returns_string.
function parseEmbedding(raw: unknown): number[] | null {
  if (Array.isArray(raw)) {
    return raw.every((v) => typeof v === "number" && Number.isFinite(v))
      ? (raw as number[])
      : null;
  }
  if (typeof raw === "string") {
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

// ---------- Inlined heuristic scorer ------------------------------------------
// Mirror of src/lib/similarity.ts computeSimilarity(). Returns just the score
// (0-100); the eval harness does not need `reasons[]`. KEEP IN LOCKSTEP with
// src/lib/similarity.ts -- both files are the source of truth on different
// surfaces (production rerank vs offline eval).
const RELATED_FAMILIES: Record<string, string[]> = {
  woody: ["aromatic", "oriental"],
  oriental: ["woody", "amber"],
  floral: ["fruity", "green"],
  citrus: ["fresh", "aromatic", "aquatic"],
  aquatic: ["fresh", "citrus", "green"],
  fresh: ["citrus", "aquatic", "green"],
  aromatic: ["woody", "citrus", "green"],
  gourmand: ["oriental", "vanilla"],
};

function computeHeuristicSimilarity(a: FragranceRow, b: FragranceRow): number {
  let score = 0;

  // 1. Accord Jaccard (0-35)
  const accordsA = new Set((a.accords ?? []).map((x) => x.toLowerCase()));
  const accordsB = new Set((b.accords ?? []).map((x) => x.toLowerCase()));
  if (accordsA.size > 0 && accordsB.size > 0) {
    const intersection = [...accordsA].filter((x) => accordsB.has(x));
    const union = new Set([...accordsA, ...accordsB]);
    const jaccard = intersection.length / union.size;
    score += Math.round(jaccard * 35);
  }

  // 2. Note family exact=20 or related=10
  if (a.note_family && b.note_family) {
    const af = a.note_family.toLowerCase();
    const bf = b.note_family.toLowerCase();
    if (af === bf) {
      score += 20;
    } else {
      const related = RELATED_FAMILIES[af] ?? [];
      if (related.includes(bf)) score += 10;
    }
  }

  // 3. Brand match (10)
  if (a.brand === b.brand) score += 10;

  // 4. Note overlap Jaccard across top+heart+base (0-25)
  const notesA = new Set(
    [...(a.notes_top ?? []), ...(a.notes_heart ?? []), ...(a.notes_base ?? [])].map(
      (n) => n.toLowerCase(),
    ),
  );
  const notesB = new Set(
    [...(b.notes_top ?? []), ...(b.notes_heart ?? []), ...(b.notes_base ?? [])].map(
      (n) => n.toLowerCase(),
    ),
  );
  if (notesA.size > 0 && notesB.size > 0) {
    const shared = [...notesA].filter((n) => notesB.has(n));
    const noteUnion = new Set([...notesA, ...notesB]);
    const jaccard = shared.length / noteUnion.size;
    score += Math.round(jaccard * 25);
  }

  // 5. Concentration + gender (5 each)
  if (a.concentration && b.concentration && a.concentration === b.concentration) {
    score += 5;
  }
  if (a.gender && b.gender && a.gender === b.gender) {
    score += 5;
  }

  return Math.min(score, 100);
}

// ---------- Lookups -----------------------------------------------------------
async function resolveRef(ref: Ref): Promise<Resolved | null> {
  const { data, error } = await supabase
    .from("fragrances")
    .select(SELECT_COLS)
    .eq("brand", ref.brand)
    .eq("name", ref.name)
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error(
      `  lookup error for ${ref.brand} - ${ref.name}: ${error.message}`,
    );
    return null;
  }
  if (!data) {
    console.error(`  not found: ${ref.brand} - ${ref.name}`);
    return null;
  }
  const d = data as Record<string, unknown>;
  const embedding = parseEmbedding(d.embedding);
  if (!embedding) {
    console.error(
      `  ${ref.brand} - ${ref.name}: no usable embedding (null or malformed)`,
    );
    return null;
  }
  return {
    id: d.id as string,
    brand: d.brand as string,
    name: d.name as string,
    embedding,
    accords: (d.accords as string[] | null) ?? null,
    note_family: (d.note_family as string | null) ?? null,
    notes_top: (d.notes_top as string[] | null) ?? null,
    notes_heart: (d.notes_heart as string[] | null) ?? null,
    notes_base: (d.notes_base as string[] | null) ?? null,
    concentration: (d.concentration as string | null) ?? null,
    gender: (d.gender as string | null) ?? null,
  };
}

// ---------- Seed pool fetch (RPC + hydrate) ----------------------------------
// Pulls a seed's top-N candidates from match_fragrances and hydrates the
// fragrance rows the reranker needs for heuristic scoring. Called ONCE per
// unique seed across a sweep (cached by caller) so we don't re-hammer the RPC.
async function fetchSeedPool(seed: Resolved, pool: number): Promise<SeedCache | null> {
  const { data: rpcData, error: rpcErr } = await supabase.rpc("match_fragrances", {
    query_embedding: seed.embedding,
    match_count: pool,
    exclude_id: seed.id,
  });
  if (rpcErr) {
    console.error(
      `  RPC error for seed ${seed.brand} - ${seed.name}: ${rpcErr.message}`,
    );
    return null;
  }
  const rpcRows = (rpcData ?? []) as { id: string; score: number }[];
  if (rpcRows.length === 0) {
    return { rpcRows: [], candidateById: new Map() };
  }
  const ids = rpcRows.map((r) => r.id);
  const { data: rows, error: rowErr } = await supabase
    .from("fragrances")
    .select(SELECT_COLS)
    .in("id", ids);
  if (rowErr) {
    console.error(
      `  hydrate error for seed ${seed.brand} - ${seed.name}: ${rowErr.message}`,
    );
    return null;
  }
  const candidateById = new Map<string, FragranceRow>();
  for (const r of (rows ?? []) as Record<string, unknown>[]) {
    const row: FragranceRow = {
      id: r.id as string,
      brand: r.brand as string,
      name: r.name as string,
      accords: (r.accords as string[] | null) ?? null,
      note_family: (r.note_family as string | null) ?? null,
      notes_top: (r.notes_top as string[] | null) ?? null,
      notes_heart: (r.notes_heart as string[] | null) ?? null,
      notes_base: (r.notes_base as string[] | null) ?? null,
      concentration: (r.concentration as string | null) ?? null,
      gender: (r.gender as string | null) ?? null,
    };
    candidateById.set(row.id, row);
  }
  return { rpcRows, candidateById };
}

// ---------- Eval (sync) -------------------------------------------------------
// Given a cached seed pool, rerank at the supplied weight and check whether
// twin lands in top-K. Sync because all the expensive work happens upstream
// in fetchSeedPool -- this function is the hot loop of the sweep.
//
// At weight >= 1.0 (pure vector) we short-circuit the rerank since rpcRows is
// already sorted DESC. Top-K of the pool then equals top-K of the full
// ranking (guaranteed because POOL >= TOP_K is enforced at CLI parse time),
// so the output is byte-identical to the pre-#65 pure-vector harness.
function evalOne(
  seed: Resolved,
  twin: Resolved,
  topK: number,
  cohort: string,
  weight: number,
  cache: SeedCache | null,
): EvalOutcome {
  const direction = `${seed.brand} - ${seed.name}  ->  ${twin.brand} - ${twin.name}`;
  if (!cache || cache.rpcRows.length === 0) {
    return { direction, hit: false, rank: null, score: null, cohort };
  }

  let ranked: { id: string; combined: number }[];
  if (weight >= 1.0) {
    ranked = cache.rpcRows.map((r) => ({ id: r.id, combined: r.score }));
  } else {
    ranked = cache.rpcRows.map((r) => {
      const cand = cache.candidateById.get(r.id);
      const heuristic = cand ? computeHeuristicSimilarity(seed, cand) : 0;
      const combined = weight * r.score + (1 - weight) * (heuristic / 100);
      return { id: r.id, combined };
    });
    ranked.sort((a, b) => b.combined - a.combined);
  }

  const topRanked = ranked.slice(0, topK);
  const idx = topRanked.findIndex((r) => r.id === twin.id);
  if (idx === -1) return { direction, hit: false, rank: null, score: null, cohort };
  return {
    direction,
    hit: true,
    rank: idx + 1,
    score: topRanked[idx].combined,
    cohort,
  };
}

// ---------- Cohort stats helper ----------------------------------------------
type CohortStats = {
  name: string;
  total: number;
  hits: number;
  coverage: number; // percentage
  meanRank: number; // NaN if no hits
  worstRank: number; // NaN if no hits
};

function computeCohortStats(outcomes: EvalOutcome[]): CohortStats[] {
  const byCohort = new Map<string, EvalOutcome[]>();
  for (const o of outcomes) {
    const arr = byCohort.get(o.cohort) ?? [];
    arr.push(o);
    byCohort.set(o.cohort, arr);
  }
  // Stable ordering: genuine-twin, same-name-different-juice, cross-house-cousin,
  // then anything else alphabetically, then uncategorised last.
  const preferred = [
    "genuine-twin",
    "same-name-different-juice",
    "cross-house-cousin",
  ];
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const name of preferred) {
    if (byCohort.has(name)) {
      ordered.push(name);
      seen.add(name);
    }
  }
  const rest = [...byCohort.keys()].filter((k) => !seen.has(k) && k !== UNCATEGORISED).sort();
  ordered.push(...rest);
  if (byCohort.has(UNCATEGORISED)) ordered.push(UNCATEGORISED);

  return ordered.map((name) => {
    const arr = byCohort.get(name) ?? [];
    const hits = arr.filter((o) => o.hit);
    const meanRank = hits.length
      ? hits.reduce((a, o) => a + (o.rank ?? 0), 0) / hits.length
      : NaN;
    const worstRank = hits.length ? Math.max(...hits.map((o) => o.rank ?? 0)) : NaN;
    return {
      name,
      total: arr.length,
      hits: hits.length,
      coverage: arr.length > 0 ? (hits.length / arr.length) * 100 : 0,
      meanRank,
      worstRank,
    };
  });
}

// ---------- Single-weight run -------------------------------------------------
// Preserves the pre-#65 console output at W=1.0 (pure-vector regression test).
// At W<1.0 the output format is identical but the score column reflects the
// combined score, not the raw vectorScore.
async function runSingleWeight(resolvedPairs: ResolvedPair[]): Promise<number> {
  const outcomes: EvalOutcome[] = [];

  for (let i = 0; i < resolvedPairs.length; i++) {
    const rp = resolvedPairs[i];
    console.log(
      `\n[pair ${i + 1}/${resolvedPairs.length}] [${rp.cohort}] ${rp.a.brand} - ${rp.a.name}  <->  ${rp.b.brand} - ${rp.b.name}`,
    );
    if (rp.spec.note && VERBOSE) console.log(`  note: ${rp.spec.note}`);

    const [cacheA, cacheB] = await Promise.all([
      fetchSeedPool(rp.a, POOL),
      fetchSeedPool(rp.b, POOL),
    ]);

    const oAB = evalOne(rp.a, rp.b, TOP_K, rp.cohort, WEIGHT, cacheA);
    const oBA = evalOne(rp.b, rp.a, TOP_K, rp.cohort, WEIGHT, cacheB);

    for (const o of [oAB, oBA]) {
      if (rp.spec.note) o.note = rp.spec.note;
      outcomes.push(o);
      const badge = o.hit ? `HIT @${o.rank}` : "MISS";
      const scoreText = o.score !== null ? ` (score ${o.score.toFixed(4)})` : "";
      console.log(`  ${badge.padEnd(10)} ${o.direction}${scoreText}`);
    }
  }

  const evaluated = outcomes.length;
  const hits = outcomes.filter((o) => o.hit);
  const misses = outcomes.filter((o) => !o.hit);
  const coverage = evaluated > 0 ? (hits.length / evaluated) * 100 : 0;
  const meanRank = hits.length
    ? hits.reduce((a, o) => a + (o.rank ?? 0), 0) / hits.length
    : NaN;
  const worstRank = hits.length
    ? Math.max(...hits.map((o) => o.rank ?? 0))
    : NaN;

  const weightLabel =
    WEIGHT >= 1 ? "  (pure vector)" : WEIGHT <= 0 ? "  (pure heuristic rerank)" : "";

  console.log("\n" + "=".repeat(72));
  console.log("Summary");
  console.log(`  weight:           ${WEIGHT.toFixed(2)}${weightLabel}`);
  console.log(`  pairs evaluated:  ${resolvedPairs.length}`);
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

  const cohortStats = computeCohortStats(outcomes);
  if (cohortStats.length > 0) {
    console.log("\nPer-cohort breakdown:");
    console.log(
      "  " +
        "cohort".padEnd(28) +
        "n".padStart(5) +
        "  " +
        "hits".padStart(5) +
        "   " +
        "coverage".padStart(9) +
        "   " +
        "mean".padStart(6) +
        "   " +
        "worst".padStart(5),
    );
    console.log("  " + "-".repeat(72));
    for (const s of cohortStats) {
      const mean = Number.isNaN(s.meanRank) ? "n/a" : s.meanRank.toFixed(2);
      const worst = Number.isNaN(s.worstRank) ? "n/a" : String(s.worstRank);
      console.log(
        "  " +
          s.name.padEnd(28) +
          String(s.total).padStart(5) +
          "  " +
          String(s.hits).padStart(5) +
          "   " +
          (s.coverage.toFixed(1) + "%").padStart(9) +
          "   " +
          mean.padStart(6) +
          "   " +
          worst.padStart(5),
      );
    }
    console.log(
      "\n  Note: n counts directions (2 per pair). Low-n cohorts are noisy --\n" +
        "  treat genuine-twin coverage as advisory until the cohort grows past\n" +
        "  ~10 directions. See Recommender-Eval-Audit-19Apr2026.md.",
    );
  }

  if (misses.length > 0) {
    console.log("\nMisses:");
    for (const m of misses) {
      const cohortTag = `[${m.cohort}]`;
      console.log(
        `  ${cohortTag.padEnd(30)} ${m.direction}${m.note ? "   // " + m.note : ""}`,
      );
    }
  }

  return evaluated > 0 && hits.length === 0 ? 2 : 0;
}

// ---------- Weight sweep ------------------------------------------------------
// Prefetches each unique seed's pool ONCE, then replays the eval across
// SWEEP_WEIGHTS. Emits two comparison tables (coverage %, mean hit rank),
// cohort rows x weight columns, with overall row appended.
async function runSweep(resolvedPairs: ResolvedPair[]): Promise<number> {
  console.log(`\nSweep mode: weights [${SWEEP_WEIGHTS.join(", ")}]`);

  // Dedupe seeds across pairs so we only call fetchSeedPool once per unique id.
  const seedById = new Map<string, Resolved>();
  for (const rp of resolvedPairs) {
    seedById.set(rp.a.id, rp.a);
    seedById.set(rp.b.id, rp.b);
  }
  console.log(
    `Prefetching ${seedById.size} unique seed pool(s) ` +
      `(${resolvedPairs.length} pair(s) * 2 directions with dedupe, pool size ${POOL})...`,
  );

  const poolCache = new Map<string, SeedCache>();
  let done = 0;
  for (const seed of seedById.values()) {
    const cache = await fetchSeedPool(seed, POOL);
    done++;
    if (cache) poolCache.set(seed.id, cache);
    if (done % 10 === 0 || done === seedById.size) {
      console.log(`  prefetched ${done}/${seedById.size}`);
    }
  }

  // Replay evals across SWEEP_WEIGHTS for each pair direction.
  type WeightRun = { weight: number; outcomes: EvalOutcome[] };
  const runs: WeightRun[] = [];
  for (const w of SWEEP_WEIGHTS) {
    const outcomes: EvalOutcome[] = [];
    for (const rp of resolvedPairs) {
      const cacheA = poolCache.get(rp.a.id) ?? null;
      const cacheB = poolCache.get(rp.b.id) ?? null;
      const oAB = evalOne(rp.a, rp.b, TOP_K, rp.cohort, w, cacheA);
      const oBA = evalOne(rp.b, rp.a, TOP_K, rp.cohort, w, cacheB);
      if (rp.spec.note) {
        oAB.note = rp.spec.note;
        oBA.note = rp.spec.note;
      }
      outcomes.push(oAB, oBA);
    }
    runs.push({ weight: w, outcomes });
  }

  // Cohort ordering stable from the W=1.0 run (all runs share the same set).
  const firstStats = computeCohortStats(runs[0].outcomes);
  const cohortNames = firstStats.map((s) => s.name);
  const nOverall = runs[0].outcomes.length;

  const weightHeader = SWEEP_WEIGHTS.map((w) => `W=${w.toFixed(1)}`.padStart(6)).join(" ");
  const weightDivider = SWEEP_WEIGHTS.map(() => "------").join(" ");

  console.log("\n" + "=".repeat(72));
  console.log("Coverage % (hits / n * 100). Rows = cohort, columns = vector weight.\n");
  console.log(`${"cohort".padEnd(28)}${"n".padStart(5)}   ${weightHeader}`);
  console.log(`${"".padEnd(28)}${"---".padStart(5)}   ${weightDivider}`);
  for (const cname of cohortNames) {
    const n = firstStats.find((s) => s.name === cname)?.total ?? 0;
    const cells = runs
      .map((r) => {
        const s = computeCohortStats(r.outcomes).find((x) => x.name === cname);
        return (s ? s.coverage.toFixed(1) : "  -  ").padStart(6);
      })
      .join(" ");
    console.log(`${cname.padEnd(28)}${String(n).padStart(5)}   ${cells}`);
  }
  const overallCov = runs
    .map((r) => {
      const hits = r.outcomes.filter((o) => o.hit).length;
      return (r.outcomes.length > 0 ? (hits / r.outcomes.length) * 100 : 0)
        .toFixed(1)
        .padStart(6);
    })
    .join(" ");
  console.log(`${"OVERALL".padEnd(28)}${String(nOverall).padStart(5)}   ${overallCov}`);

  console.log(
    "\nMean hit rank (lower = tighter; '--' = zero hits at that weight/cohort).\n",
  );
  console.log(`${"cohort".padEnd(28)}${"n".padStart(5)}   ${weightHeader}`);
  console.log(`${"".padEnd(28)}${"---".padStart(5)}   ${weightDivider}`);
  for (const cname of cohortNames) {
    const n = firstStats.find((s) => s.name === cname)?.total ?? 0;
    const cells = runs
      .map((r) => {
        const s = computeCohortStats(r.outcomes).find((x) => x.name === cname);
        const val = s && !Number.isNaN(s.meanRank) ? s.meanRank.toFixed(2) : "--";
        return val.padStart(6);
      })
      .join(" ");
    console.log(`${cname.padEnd(28)}${String(n).padStart(5)}   ${cells}`);
  }
  const overallMean = runs
    .map((r) => {
      const hits = r.outcomes.filter((o) => o.hit);
      const v = hits.length
        ? (hits.reduce((a, o) => a + (o.rank ?? 0), 0) / hits.length).toFixed(2)
        : "--";
      return v.padStart(6);
    })
    .join(" ");
  console.log(`${"OVERALL".padEnd(28)}${String(nOverall).padStart(5)}   ${overallMean}`);

  console.log(
    "\nReading guide:\n" +
      "  - W=1.0 is the pure-vector baseline (same output as pre-#65 runs).\n" +
      "  - W=0.0 reranks the RPC pool by the inlined heuristic alone.\n" +
      "  - Production ships at W=0.6 (src/hooks/useSimilarFragrances.ts).\n" +
      "  - Low-n cohorts (genuine-twin at n<10 directions) are noisy; advisory only.\n" +
      "  - A weight that maximises cross-house-cousin coverage without wrecking\n" +
      "    same-name-different-juice is the production-relevant pick. Mean rank\n" +
      "    is the tiebreaker when coverage is flat across adjacent weights.",
  );

  return 0;
}

// ---------- Main --------------------------------------------------------------
async function main() {
  console.log("=".repeat(72));
  console.log("eval-recommender");
  console.log(`  pairs:   ${PAIRS_PATH}`);
  console.log(`  top-k:   ${TOP_K}`);
  console.log(`  pool:    ${POOL}`);
  if (SWEEP) {
    console.log(`  sweep:   [${SWEEP_WEIGHTS.join(", ")}]`);
  } else {
    const label =
      WEIGHT >= 1 ? "  (pure vector)" : WEIGHT <= 0 ? "  (pure heuristic rerank)" : "";
    console.log(`  weight:  ${WEIGHT.toFixed(2)}${label}`);
  }
  if (COHORT_FILTER) {
    console.log(`  cohort:  ${[...COHORT_FILTER].join(", ")}`);
  }
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

  const allPairs = parsed.pairs ?? [];
  if (allPairs.length === 0) {
    console.error("No pairs in file. Exiting.");
    process.exit(1);
  }

  const pairs = COHORT_FILTER
    ? allPairs.filter((p) => COHORT_FILTER.has(p.cohort ?? UNCATEGORISED))
    : allPairs;
  if (pairs.length === 0) {
    console.error(
      `No pairs match cohort filter ${[...(COHORT_FILTER ?? [])].join(", ")}. Exiting.`,
    );
    process.exit(1);
  }

  console.log(
    `Loaded ${allPairs.length} pair(s)${
      COHORT_FILTER ? `, ${pairs.length} after cohort filter` : ""
    }.`,
  );

  // Resolve every pair up front -- sweep needs unique seeds dedup'd, and both
  // modes benefit from failing fast on unresolvable rows before any RPC cost.
  const resolvedPairs: ResolvedPair[] = [];
  let skipped = 0;
  for (let i = 0; i < pairs.length; i++) {
    const p = pairs[i];
    const cohort = p.cohort ?? UNCATEGORISED;
    const [ra, rb] = await Promise.all([resolveRef(p.a), resolveRef(p.b)]);
    if (!ra || !rb) {
      console.log(
        `  [resolve ${i + 1}/${pairs.length}] [${cohort}] skipped (unresolved)`,
      );
      skipped++;
      continue;
    }
    resolvedPairs.push({ spec: p, a: ra, b: rb, cohort });
  }
  console.log(
    `Resolved ${resolvedPairs.length}/${pairs.length} pairs (${skipped} skipped).`,
  );
  if (resolvedPairs.length === 0) {
    console.error("No pairs resolved. Exiting.");
    process.exit(1);
  }

  const code = SWEEP
    ? await runSweep(resolvedPairs)
    : await runSingleWeight(resolvedPairs);

  if (code !== 0) {
    console.error(`\nExiting with code ${code}.`);
    process.exit(code);
  }
}

main().catch((e) => {
  console.error("Unhandled error:", e);
  process.exit(1);
});
