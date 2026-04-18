/**
 * embed-fragrances.ts
 * ----------------------------------------------------------------------------
 * One-off backfill: compute a 384-dim sentence-transformer embedding for every
 * fragrance in the public.fragrances table and write it to the `embedding`
 * column added by migration 20260417160000_add_fragrance_embedding.sql.
 *
 * Model:   Xenova/all-MiniLM-L6-v2  (384-dim, cosine)
 * Runtime: @xenova/transformers (Transformers.js) running locally in Node.
 *          First run downloads the ~23MB model and caches it under
 *          `.cache/transformers/` in the repo.
 *
 * Why this script is idempotent by design:
 *   - Only reads rows where embedding IS NULL (or --force overrides all).
 *   - Bumps embedding_version only when we actually write.
 *   - Safe to re-run after a crash -- picks up where it left off.
 *
 * Source string format (v2, 18 April 2026)
 * ----------------------------------------
 * v1 was `{brand}. {name}. {concentration}. {gender}. Accords: ... Top: ...`.
 * Problem: MiniLM is contrastively trained and the leading brand token got
 * outsized weight in the mean-pooled vector. With ~40 Creed rows in the corpus
 * the Aventus neighbourhood degenerated into 25 consecutive Creed rows before
 * any non-Creed candidate showed up (verified 18 April via raw SQL). Same
 * mechanism explained the medium-tier eval misses (BR540 - Yara,
 * Santal 33 - Cedrat Boise, etc.) where the correct twin is cross-house.
 *
 * v2 fix:
 *   (a) Lead with olfactive content; push brand + name to the TAIL as
 *       metadata rather than the semantic anchor of the sentence.
 *   (b) Repeat accord tokens weighted by `main_accords_percentage` so
 *       dominant accords contribute proportionally to their share:
 *           100%    -> 4 reps
 *            75-99  -> 3 reps
 *            50-74  -> 2 reps
 *            25-49  -> 1 rep
 *           <25     -> dropped (noise)
 *   (c) Lowercase every token so rows ingested with different casing
 *       (e.g. Creed Aventus has `Fruity`/`Sweet`/`Woody`, Creed Aventus
 *       Cologne has `citrus`/`woody`/`musky`) hash into the same token
 *       neighbourhood.
 *   (d) Drop `concentration` and `gender` entirely. "eau de parfum" /
 *       "men" appear thousands of times across the corpus and only add
 *       noise to a 60-token input against a 512-token model.
 *   (e) Add `note_family` (single-token family signal).
 *
 * Pagination
 * ----------
 * PostgREST caps a single .select() at 1000 rows by default, so we paginate
 * in PAGE_SIZE batches. Two pagination strategies, picked automatically:
 *   - FORCE or DRY_RUN: offset-based. The filter set (either "all rows" for
 *     --force, or "rows with embedding IS NULL" for dry-run) is stable across
 *     batches because we either don't write or overwrite in place without
 *     changing which rows match. Increment offset by batch size each loop.
 *   - Normal mode with writes: offset stays 0. Each write flips an
 *     embedding from NULL to a vector, removing it from the next fetch's
 *     filter set -- so the "window" of remaining NULL rows just shrinks.
 *     Re-fetching from offset 0 returns the next unembedded rows.
 *
 * Usage
 * -----
 *   # dry run (no writes) -- for sanity-checking the source string + model
 *   npx tsx scripts/embed-fragrances.ts --dry-run --limit 5
 *
 *   # real backfill (now processes ALL rows in one invocation)
 *   npx tsx scripts/embed-fragrances.ts
 *
 *   # re-embed everything (after a source-string change, bumps version)
 *   npx tsx scripts/embed-fragrances.ts --force --version 2
 *
 * Env
 * ---
 *   VITE_SUPABASE_URL           -- reused from the app .env
 *   SUPABASE_SERVICE_ROLE_KEY   -- must be set locally; NEVER commit.
 *                                  Bypasses RLS so we can write embedding for
 *                                  every fragrance regardless of submitted_by.
 * ----------------------------------------------------------------------------
 */

import { createClient } from "@supabase/supabase-js";
import { pipeline, type FeatureExtractionPipeline } from "@xenova/transformers";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// ---------- CLI flags ---------------------------------------------------------
const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has("--dry-run");
const FORCE = args.has("--force");
const LIMIT = (() => {
  const i = process.argv.indexOf("--limit");
  return i !== -1 ? parseInt(process.argv[i + 1] ?? "", 10) : undefined;
})();
const VERSION = (() => {
  const i = process.argv.indexOf("--version");
  return i !== -1 ? parseInt(process.argv[i + 1] ?? "", 10) : 1;
})();

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

// ---------- Source string -----------------------------------------------------
type FragranceRow = {
  id: string;
  brand: string;
  name: string;
  note_family: string | null;
  accords: string[] | null;
  main_accords_percentage: Record<string, number> | null;
  notes_top: string[] | null;
  notes_heart: string[] | null;
  notes_base: string[] | null;
};

function buildSourceString(f: FragranceRow): string {
  const lower = (s: string): string => s.toLowerCase().trim();
  const joinList = (xs: string[] | null): string =>
    xs && xs.length > 0
      ? xs
          .filter((x): x is string => Boolean(x))
          .map(lower)
          .join(", ")
      : "";

  // Weight repetition by percentage so dominant accords dominate the
  // embedding proportional to their fragrance share. See header for why.
  const accordTokens: string[] = [];
  const pct = f.main_accords_percentage ?? {};
  const entries = Object.entries(pct).sort(
    (a, b) => (b[1] ?? 0) - (a[1] ?? 0),
  );
  for (const [accord, percentRaw] of entries) {
    const percent = typeof percentRaw === "number" ? percentRaw : 0;
    let reps = 0;
    if (percent >= 100) reps = 4;
    else if (percent >= 75) reps = 3;
    else if (percent >= 50) reps = 2;
    else if (percent >= 25) reps = 1;
    if (reps > 0 && accord) {
      const tok = lower(accord);
      for (let i = 0; i < reps; i++) accordTokens.push(tok);
    }
  }
  // Fallback for rows missing main_accords_percentage: use the flat
  // `accords` array with no weighting. Better than nothing.
  if (accordTokens.length === 0 && f.accords && f.accords.length > 0) {
    for (const a of f.accords) {
      if (a) accordTokens.push(lower(a));
    }
  }

  const family = f.note_family ? lower(f.note_family) : "";
  const top = joinList(f.notes_top);
  const heart = joinList(f.notes_heart);
  const base = joinList(f.notes_base);
  const dominant = accordTokens.join(" ");

  // Olfactive signal first, brand/name metadata last. Everything lowercased.
  const parts: string[] = [];
  if (family) parts.push(`family: ${family}.`);
  const noteSections: string[] = [];
  if (top) noteSections.push(`top: ${top}`);
  if (heart) noteSections.push(`heart: ${heart}`);
  if (base) noteSections.push(`base: ${base}`);
  if (noteSections.length > 0) parts.push(`notes: ${noteSections.join("; ")}.`);
  if (dominant) parts.push(`dominant: ${dominant}.`);
  parts.push(
    `brand: ${lower(f.brand ?? "")}. name: ${lower(f.name ?? "")}.`,
  );

  return parts.join(" ").replace(/\s+/g, " ").trim();
}

// ---------- Embedding ---------------------------------------------------------
async function loadModel(): Promise<FeatureExtractionPipeline> {
  console.log("Loading Xenova/all-MiniLM-L6-v2...");
  const extractor = await pipeline(
    "feature-extraction",
    "Xenova/all-MiniLM-L6-v2",
  );
  console.log("Model loaded.");
  return extractor;
}

async function embed(
  extractor: FeatureExtractionPipeline,
  text: string,
): Promise<number[]> {
  const output = await extractor(text, { pooling: "mean", normalize: true });
  // output.data is Float32Array of length 384
  return Array.from(output.data as Float32Array);
}

// ---------- Main --------------------------------------------------------------
async function main() {
  console.log("=".repeat(72));
  console.log("embed-fragrances");
  console.log(`  dry-run: ${DRY_RUN}   force: ${FORCE}   version: ${VERSION}${
    LIMIT ? `   limit: ${LIMIT}` : ""
  }`);
  console.log("=".repeat(72));

  // --- count total up-front (for progress logging) --------------------------
  const countQueryBase = supabase
    .from("fragrances")
    .select("id", { count: "exact", head: true });
  const { count: totalMatching, error: countErr } = FORCE
    ? await countQueryBase
    : await countQueryBase.is("embedding", null);
  if (countErr) {
    console.error("Count query failed:", countErr);
    process.exit(1);
  }
  const grandTotal = LIMIT
    ? Math.min(totalMatching ?? 0, LIMIT)
    : (totalMatching ?? 0);
  console.log(`Rows matching filter: ${totalMatching ?? 0}. Will process: ${grandTotal}.`);
  if (grandTotal === 0) {
    console.log("Nothing to do. Exiting.");
    return;
  }

  // --- load model ------------------------------------------------------------
  const extractor = await loadModel();

  // --- paginated iterate -----------------------------------------------------
  // See header comment "Pagination" for why the offset strategy differs by mode.
  const PAGE_SIZE = 1000;
  const batchesShiftFilter = !FORCE && !DRY_RUN;
  let offset = 0;
  let totalProcessed = 0;
  let ok = 0;
  let failed = 0;
  const failures: { id: string; error: string }[] = [];
  const startedAt = Date.now();
  let batchNum = 0;

  async function fetchBatch(fetchOffset: number, batchSize: number): Promise<FragranceRow[]> {
    let q = supabase
      .from("fragrances")
      .select(
        "id, brand, name, note_family, accords, main_accords_percentage, notes_top, notes_heart, notes_base",
      )
      .order("created_at", { ascending: true })
      .range(fetchOffset, fetchOffset + batchSize - 1);
    if (!FORCE) q = q.is("embedding", null);
    const { data, error: fetchErr } = await q;
    if (fetchErr) throw fetchErr;
    return (data ?? []) as FragranceRow[];
  }

  while (true) {
    const remaining = grandTotal - totalProcessed;
    if (remaining <= 0) break;
    const batchSize = Math.min(PAGE_SIZE, remaining);

    batchNum++;
    const batch = await fetchBatch(offset, batchSize);
    if (batch.length === 0) break;

    console.log(
      `\n[batch ${batchNum}] fetched ${batch.length} rows ` +
        `(offset=${offset}, mode=${batchesShiftFilter ? "filter-shift" : "offset"})`,
    );

    for (let i = 0; i < batch.length; i++) {
      const f = batch[i];
      const src = buildSourceString(f);
      const overallIdx = totalProcessed + i + 1;

      try {
        const vec = await embed(extractor, src);

        if (vec.length !== 384) {
          throw new Error(`Expected 384-dim vector, got ${vec.length}`);
        }

        if (DRY_RUN) {
          if (overallIdx <= 3) {
            console.log(`\n[dry-run ${overallIdx}] ${f.brand} - ${f.name}`);
            console.log(`  src: ${src.slice(0, 180)}${src.length > 180 ? "..." : ""}`);
            console.log(
              `  vec[0..4]: [${vec
                .slice(0, 5)
                .map((v) => v.toFixed(4))
                .join(", ")}] ...`,
            );
          }
          ok++;
        } else {
          const { error: upErr } = await supabase
            .from("fragrances")
            .update({ embedding: vec, embedding_version: VERSION })
            .eq("id", f.id);
          if (upErr) throw upErr;
          ok++;
        }
      } catch (e: unknown) {
        failed++;
        failures.push({
          id: f.id,
          error: e instanceof Error ? e.message : String(e),
        });
        console.error(`  x ${f.brand} - ${f.name}: ${failures.at(-1)!.error}`);
      }

      // Progress line every 25 rows (across the whole run)
      const globalCount = totalProcessed + i + 1;
      if (globalCount % 25 === 0 || (i === batch.length - 1 && globalCount === grandTotal)) {
        const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
        const rate = (globalCount / Number(elapsed)).toFixed(1);
        console.log(
          `  [${globalCount}/${grandTotal}]  ok=${ok}  failed=${failed}  ${elapsed}s  (${rate}/s)`,
        );
      }
    }

    totalProcessed += batch.length;
    if (batch.length < batchSize) break; // fewer than asked = end of data
    if (!batchesShiftFilter) offset += batch.length;
  }

  // --- summary ---------------------------------------------------------------
  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log("\n" + "=".repeat(72));
  console.log(`Done in ${elapsed}s. ok=${ok}  failed=${failed}`);
  if (failures.length > 0) {
    console.log("\nFailures:");
    for (const f of failures.slice(0, 20))
      console.log(`  ${f.id}  ${f.error}`);
    if (failures.length > 20)
      console.log(`  ... and ${failures.length - 20} more`);
  }
  if (DRY_RUN) console.log("\n(DRY RUN -- nothing was written.)");
}

main().catch((e) => {
  console.error("Unhandled error:", e);
  process.exit(1);
});
