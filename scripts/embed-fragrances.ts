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
 * Usage
 * -----
 *   # dry run (no writes) -- for sanity-checking the source string + model
 *   npx tsx scripts/embed-fragrances.ts --dry-run --limit 5
 *
 *   # real backfill
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
 *
 * Source string
 * -------------
 * See notes/recommender-design.md §3. Built from brand, name, concentration,
 * gender, accords, notes_top/heart/base. The `description` field mentioned in
 * the design doc does NOT exist on the real schema (verified 17 April) and is
 * therefore omitted here -- when that column lands, append it and bump
 * embedding_version.
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
  accords: string[] | null;
  notes_top: string[] | null;
  notes_heart: string[] | null;
  notes_base: string[] | null;
};

function buildSourceString(f: FragranceRow): string {
  const joinList = (xs: string[] | null): string =>
    xs && xs.length > 0 ? xs.filter(Boolean).join(", ") : "—";

  return [
    `${f.brand}. ${f.name}. ${f.concentration ?? ""}. ${f.gender ?? ""}.`,
    `Accords: ${joinList(f.accords)}.`,
    `Top notes: ${joinList(f.notes_top)}.`,
    `Heart notes: ${joinList(f.notes_heart)}.`,
    `Base notes: ${joinList(f.notes_base)}.`,
  ]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------- Embedding ---------------------------------------------------------
async function loadModel(): Promise<FeatureExtractionPipeline> {
  console.log("Loading Xenova/all-MiniLM-L6-v2…");
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

  // --- fetch rows to embed ---------------------------------------------------
  let query = supabase
    .from("fragrances")
    .select(
      "id, brand, name, concentration, gender, accords, notes_top, notes_heart, notes_base",
    )
    .order("created_at", { ascending: true });
  if (!FORCE) query = query.is("embedding", null);
  if (LIMIT) query = query.limit(LIMIT);

  const { data: rows, error } = await query;
  if (error) {
    console.error("Fetch failed:", error);
    process.exit(1);
  }
  const fragrances = rows as FragranceRow[];
  console.log(`Fetched ${fragrances.length} rows to embed.`);
  if (fragrances.length === 0) {
    console.log("Nothing to do. Exiting.");
    return;
  }

  // --- load model ------------------------------------------------------------
  const extractor = await loadModel();

  // --- iterate ---------------------------------------------------------------
  let ok = 0;
  let failed = 0;
  const failures: { id: string; error: string }[] = [];
  const startedAt = Date.now();

  for (let i = 0; i < fragrances.length; i++) {
    const f = fragrances[i];
    const src = buildSourceString(f);

    try {
      const vec = await embed(extractor, src);

      if (vec.length !== 384) {
        throw new Error(`Expected 384-dim vector, got ${vec.length}`);
      }

      if (DRY_RUN) {
        if (i < 3) {
          console.log(`\n[dry-run ${i + 1}] ${f.brand} — ${f.name}`);
          console.log(`  src: ${src.slice(0, 140)}${src.length > 140 ? "…" : ""}`);
          console.log(
            `  vec[0..4]: [${vec
              .slice(0, 5)
              .map((v) => v.toFixed(4))
              .join(", ")}] …`,
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
      console.error(`  ✗ ${f.brand} — ${f.name}: ${failures.at(-1)!.error}`);
    }

    // Progress line every 25 rows
    if ((i + 1) % 25 === 0 || i === fragrances.length - 1) {
      const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
      const rate = ((i + 1) / Number(elapsed)).toFixed(1);
      console.log(
        `  [${i + 1}/${fragrances.length}]  ok=${ok}  failed=${failed}  ${elapsed}s  (${rate}/s)`,
      );
    }
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
      console.log(`  … and ${failures.length - 20} more`);
  }
  if (DRY_RUN) console.log("\n(DRY RUN — nothing was written.)");
}

main().catch((e) => {
  console.error("Unhandled error:", e);
  process.exit(1);
});
