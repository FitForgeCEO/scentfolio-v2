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
 * Pairs schema
 * ------------
 *   {
 *     "pairs": [
 *       {
 *         "a": { "brand": "Dior", "name": "Sauvage" },
 *         "b": { "brand": "Dior", "name": "Sauvage Parfum" },
 *         "note": "Same-house flanker -- should land top-5"
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
 * Overall summary: coverage %, mean rank when hit, worst hit rank, full
 * miss list with notes attached for curator debugging.
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
type PairSpec = { a: Ref; b: Ref; note?: string };
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
};

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
): Promise<EvalOutcome> {
  const direction = `${seed.brand} - ${seed.name}  ->  ${twin.brand} - ${twin.name}`;
  const { data, error } = await supabase.rpc("match_fragrances", {
    query_embedding: seed.embedding,
    match_count: topK,
    exclude_id: seed.id,
  });
  if (error) {
    console.error(`  RPC error for ${direction}: ${error.message}`);
    return { direction, hit: false, rank: null, score: null };
  }
  const rows = (data ?? []) as { id: string; score: number }[];
  const idx = rows.findIndex((r) => r.id === twin.id);
  if (idx === -1) return { direction, hit: false, rank: null, score: null };
  return { direction, hit: true, rank: idx + 1, score: rows[idx].score };
}

// ---------- Main --------------------------------------------------------------
async function main() {
  console.log("=".repeat(72));
  console.log("eval-recommender");
  console.log(`  pairs:  ${PAIRS_PATH}`);
  console.log(`  top-k:  ${TOP_K}`);
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

    const [oAB, oBA] = await Promise.all([
      evalOne(ra, rb, TOP_K),
      evalOne(rb, ra, TOP_K),
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

  if (misses.length > 0) {
    console.log("\nMisses:");
    for (const m of misses) {
      console.log(`  ${m.direction}${m.note ? "   // " + m.note : ""}`);
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
