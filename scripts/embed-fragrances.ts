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
 * Source string format (v3, 18 April 2026)
 * ----------------------------------------
 * v1 was `{brand}. {name}. {concentration}. {gender}. Accords: ... Top: ...`.
 * Brand-first placement gave the brand token outsized influence on the mean-
 * pooled vector; that was the root cause of the Creed/Aventus brand-monoculture
 * observed in eval (25+ consecutive Creed rows before a non-Creed neighbour).
 *
 * v2 (dead branch) tried to fix it by (a) pushing brand/name to the tail,
 * (b) repeating accord tokens weighted by `main_accords_percentage`,
 * (c) lowercasing, and (d) dropping concentration + gender. Problem: I assumed
 * main_accords_percentage stored NUMERIC percentages. It actually stores a
 * STRING enum ("Dominant" / "Prominent" / "Moderate" / "Subtle"), so the
 * `typeof percentRaw === "number" ? percentRaw : 0` check assigned 0 to every
 * accord, reps fell through to 0 for every row, and the weighted-accord path
 * was dead code -- every fragrance silently used the unweighted `f.accords`
 * fallback. Net result: regression vs v1 on the 22-pair eval (34.1% vs 36.4%;
 * mean hit rank 4.27 vs 2.31; worst hit rank 16 vs 5) because brand-at-tail
 * shipped without the compensating accord weighting, AND concentration+gender
 * (legit differentiators like EDT vs EDP or unisex vs masculine) were dropped.
 *
 * v3 fix:
 *   (a) Keep brand + name at the TAIL (that v2 change was correct in spirit).
 *   (b) Actually make the accord weighting work by handling BOTH numeric AND
 *       string-enum forms defensively in percentToReps():
 *           numeric: 100->4, 75->3, 50->2, 25->1, <25->0
 *           string : dominant->3, prominent->2, moderate->1, subtle->0
 *       (Subtle in the corpus is ~349 rows against ~20-23k each for the other
 *       three levels; trace-level, drop to reduce noise.)
 *   (c) Lowercase every token (kept from v2) so "Fruity"/"citrus"/"Woody"
 *       hash into the same token neighbourhood across rows.
 *   (d) RESTORE concentration and gender as tail metadata. These are real
 *       olfactive signals that differentiate flanker pairs (e.g. Parfums de
 *       Marly Layton unisex EDP vs Layton Exclusif men EDP). Ordering:
 *       dominant: ... concentration: ... gender: ... brand: ... name: ...
 *   (e) Add `note_family` (single-token family signal) -- kept from v2.
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
 *   # real backfill (processes ALL rows in one invocation)
 *   npx tsx scripts/embed-fragrances.ts
 *
 *   # re-embed everything (after a source-string change, bumps version)
 *   npx tsx scripts/embed-fragrances.ts --force --version 3
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
  concentration: string | null;
  gender: string | null;
  note_family: string | null;
  accords: string[] | null;
  main_accords_percentage: Record<string, unknown> | null;
  notes_top: string[] | null;
  notes_heart: string[] | null;
  notes_base: string[] | null;
};

/**
 * Map a main_accords_percentage value to a repetition count for weighted
 * accord repetition in the source string.
 *
 * main_accords_percentage in the live DB is a JSONB column whose values are
 * STRING enum labels ("Dominant" / "Prominent" / "Moderate" / "Subtle"), not
 * numeric percentages. v2 of this script assumed numeric and silently assigned
 * 0 reps to every accord; v3 handles both forms defensively so the script is
 * robust if the schema is ever normalised to numeric.
 *
 * Subtle is effectively trace-level (~349 rows vs ~20-23k each for the other
 * three strengths) -- drop it to reduce noise rather than let it bleed into
 * the centroid.
 */
function percentToReps(raw: unknown): number {
  if (typeof raw === "number") {
    if (raw >= 100) return 4;
    if (raw >= 75) return 3;
    if (raw >= 50) return 2;
    if (raw >= 25) return 1;
    return 0;
  }
  if (typeof raw === "string") {
    const s = raw.toLowerCase().trim();
    if (s === "dominant") return 3;
    if (s === "prominent") return 2;
    if (s === "moderate") return 1;
    return 0;
  }
  return 0;
}

function buildSourceString(f: FragranceRow): string {
  const lower = (s: string): string => s.toLowerCase().trim();
  const joinList = (xs: string[] | null): string =>
    xs && xs.length > 0
      ? xs
          .filter((x): x is string => Boolean(x))
          .map(lower)
          .join(", ")
      : "";

  // Weight repetition by strength so dominant accords dominate the embedding
  // proportional to their share. See percentToReps() for the mapping.
  const accordTokens: string[] = [];
  const pct = f.main_accords_percentage ?? {};
  const entries = Object.entries(pct).sort((a, b) => {
    return percentToReps(b[1]) - percentToReps(a[1]);
  });
  for (const [accord, raw] of entries) {
    const reps = percentToReps(raw);
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
  const concentration = f.concentration ? lower(f.concentration) : "";
  const gender = f.gender ? lower(f.gender) : "";

  // Olfactive signal first, concentration/gender/brand/name metadata last.
  // Everything lowercased.
  const parts: string[] = [];
  if (family) parts.push(`family: ${family}.`);
  const noteSections: string[] = [];
  if (top) noteSections.push(`top: ${top}`);
  if (heart) noteSections.push(`heart: ${heart}`);
  if (base) noteSections.push(`base: ${base}`);
  if (noteSections.length > 0) parts.push(`notes: ${noteSections.join("; ")}.`);
  if (dominant) parts.push(`dominant: ${dominant}.`);
  if (concentration) parts.push(`concentration: ${concentration}.`);
  if (gender) parts.push(`gender: ${gender}.`);
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
        "id, brand, name, concentration, gender, note_family, accords, main_accords_percentage, notes_top, notes_heart, notes_base",
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
