/**
 * eval-recommender.ts
 * ----------------------------------------------------------------------------
 * Offline evaluation harness for the hybrid recommender's VECTOR leg.
 * Loads a JSON file of hand-curated twin pairs, calls public.match_fragrances
 * with each fragrance's embedding as the seed, and asserts the paired twin
 * appears in the seed's top-K results.
 *
 * Why this exists
 * ---------------
 * notes/recommender-design.md Section 10 demands an offline eval before we touch
 * the 0.6/0.4 weight balance (Section 4.2) or swap the embedding model. Production
 * click-telemetry (src/lib/analytics.ts RECOMMENDER_CLICK, wired in Section 10(a))
 * needs weeks to accumulate -- the harness gives us a same-day signal.
 *
 * What a "twin" is
 * ----------------
 * Pairs a human would expect BOTH directions to surface each other:
 *   - Same-house flankers (Sauvage / Sauvage Parfum)
 *   - Notorious dupe pairs
 *   - Olfactory cousins across houses (e.g. any two barbershop fougeres)
 * Dan curates. 20 is the target (Section 10 design doc). Sample file ships with 3
 * placeholders so the harness itself is testable before curation is complete.
 *
 * Cohorts (added 19 April)
 * ------------------------
 * The 18 April hybrid-eval run surfaced a weight-tuning trap: aggregate coverage
 * hid the fact that most "twin" pairs are really same-name-different-juice or
 * cross-house-cousin -- pairs where the note pyramids legitimately diverge.
 * See Recommender-Eval-Audit-19Apr2026.md. To keep the signal honest the harness
 * now reports per-cohort breakdowns:
 *
 *   - genuine-twin              (heart_ov >= 0.5 AND base_ov >= 0.5)
 *   - same-name-different-juice (same brand, note pyramid diverges)
 *   - cross-house-cousin        (everything else)
 *
 * Pairs without a `cohort` field land in `uncategorised` so partial annotation
 * still produces useful output.
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
 * Output
 * ------
 * Each pair contributes TWO evals (a->b and b->a). For each eval we report:
 *   - HIT (at rank N) or MISS (twin not in top-K)
 *   - Similarity score at hit rank (informational -- higher is tighter)
 * Overall summary: coverage %, mean rank when hit, worst hit rank. Then a
 * per-cohort table, then the full miss list with notes + cohort attached
 * for curator debugging.
 *
 * Usage
 * -----
 *   # Sample pairs (3 placeholders, ships with the repo)
 *   npm run eval:recommender
 *
 *   # Custom file
 *   npx tsx scripts/eval-recommender.ts --pairs scripts/eval-pairs.json
 *
 *   # Widen the net
 *   npx tsx scripts/eval-recommender.ts --top-k 50 --verbose
 *
 *   # Restrict to a single cohort (comma-separated names are OR'd)
 *   npx tsx scripts/eval-recommender.ts --cohort genuine-twin
 *   npx tsx scripts/eval-recommender.ts --cohort genuine-twin,same-name-different-juice
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
const COHORT_FILTER = (() => {
  const i = argv.indexOf("--cohort");
  if (i === -1) return null;
  const raw = (argv[i + 1] ?? "").trim();
  if (!raw) return null;
  return new Set(raw.split(",").map((s) => s.trim()).filter(Boolean));
})();
const VERBOSE = argv.includes("--verbose");

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

type Resolved = {
  id: string;
  brand: string;
  name: string;
  embedding: number[];
};

type EvalOutcome = {
  direction: string; // "Dior Sauvage -> Dior Sauvage Parfum"
  hit: boolean;
  rank: number | null; // 1-indexed rank where twin appeared, or null
  score: number | null; // similarity score at hit rank
  note?: string;
  cohort: string; // falls back to "uncategorised" when pair omits the field
};

const UNCATEGORISED = "uncategorised";

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

// ---------- Lookups -----------------------------------------------------------
async function resolveRef(ref: Ref): Promise<Resolved | null> {
  const { data, error } = await supabase
    .from("fragrances")
    .select("id, brand, name, embedding")
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
  const embedding = parseEmbedding((data as { embedding: unknown }).embedding);
  if (!embedding) {
    console.error(
      `  ${ref.brand} - ${ref.name}: no usable embedding (null or malformed)`,
    );
    return null;
  }
  return {
    id: data.id as string,
    brand: data.brand as string,
    name: data.name as string,
    embedding,
  };
}

// ---------- Eval --------------------------------------------------------------
async function evalOne(
  seed: Resolved,
  twin: Resolved,
  topK: number,
  cohort: string,
): Promise<EvalOutcome> {
  const direction = `${seed.brand} - ${seed.name}  ->  ${twin.brand} - ${twin.name}`;
  const { data, error } = await supabase.rpc("match_fragrances", {
    query_embedding: seed.embedding,
    match_count: topK,
    exclude_id: seed.id,
  });
  if (error) {
    console.error(`  RPC error for ${direction}: ${error.message}`);
    return { direction, hit: false, rank: null, score: null, cohort };
  }
  const rows = (data ?? []) as { id: string; score: number }[];
  const idx = rows.findIndex((r) => r.id === twin.id);
  if (idx === -1) return { direction, hit: false, rank: null, score: null, cohort };
  return { direction, hit: true, rank: idx + 1, score: rows[idx].score, cohort };
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

// ---------- Main --------------------------------------------------------------
async function main() {
  console.log("=".repeat(72));
  console.log("eval-recommender");
  console.log(`  pairs:   ${PAIRS_PATH}`);
  console.log(`  top-k:   ${TOP_K}`);
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

  // Apply cohort filter, if any.
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

  const outcomes: EvalOutcome[] = [];
  let skipped = 0;

  for (let i = 0; i < pairs.length; i++) {
    const p = pairs[i];
    const cohort = p.cohort ?? UNCATEGORISED;
    console.log(
      `\n[pair ${i + 1}/${pairs.length}] [${cohort}] ${p.a.brand} - ${p.a.name}  <->  ${p.b.brand} - ${p.b.name}`,
    );
    if (p.note && VERBOSE) console.log(`  note: ${p.note}`);

    const [ra, rb] = await Promise.all([resolveRef(p.a), resolveRef(p.b)]);
    if (!ra || !rb) {
      console.log("  skipped (unresolved)");
      skipped++;
      continue;
    }

    const [oAB, oBA] = await Promise.all([
      evalOne(ra, rb, TOP_K, cohort),
      evalOne(rb, ra, TOP_K, cohort),
    ]);
    for (const o of [oAB, oBA]) {
      if (p.note) o.note = p.note;
      outcomes.push(o);
      const badge = o.hit ? `HIT @${o.rank}` : "MISS";
      const scoreText = o.score !== null ? ` (score ${o.score.toFixed(4)})` : "";
      console.log(`  ${badge.padEnd(10)} ${o.direction}${scoreText}`);
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
  const worstRank = hits.length
    ? Math.max(...hits.map((o) => o.rank ?? 0))
    : NaN;

  console.log("\n" + "=".repeat(72));
  console.log("Summary");
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

  // --- per-cohort breakdown --------------------------------------------------
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

  // Non-zero exit on zero coverage so CI can fail usefully if we ever wire it.
  if (evaluated > 0 && hits.length === 0) {
    console.error("\nAll evals missed. Exiting non-zero.");
    process.exit(2);
  }
}

main().catch((e) => {
  console.error("Unhandled error:", e);
  process.exit(1);
});
