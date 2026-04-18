/**
 * fragdb-etl-prototype.ts
 * ----------------------------------------------------------------------------
 * Dry-run ETL prototype for the FragDB commercial dataset MIT sample.
 *
 * Purpose:
 *   Prove the pipe-delimited CSV ingestion + normalisation path BEFORE
 *   committing money to a commercial licence ($200 one-time / $1,000/yr).
 *   Runs against the 10-row MIT-licensed sample at
 *     https://github.com/FragDB/fragrance-database/tree/main/samples
 *   and emits normalised rows shaped like ScentFolio's public.fragrances.
 *
 *   NO Supabase writes. NO network calls. Pure file I/O.
 *
 * Sample-vs-commercial caveat
 * ---------------------------
 * The MIT sample ships only 10 rows per lookup table (brands, notes,
 * accords, perfumers). Real fragrance rows reference thousands of note/
 * accord/brand IDs that will NOT be in the sample. Expect most
 * notes_top/notes_heart/notes_base/accords values on the sample output to
 * appear as raw IDs (`n2415`, `a33`, etc.) because the name lookup fails.
 * This is EXPECTED on the sample and resolves on the full commercial
 * dataset (full brands.csv / notes.csv / accords.csv).
 * The meta block in the output records an `unresolved_lookups` count so
 * you can see at a glance how much of the sample had missing references.
 *
 * Usage:
 *   npx tsx scripts/fragdb-etl-prototype.ts <input-dir> [output-file]
 * ----------------------------------------------------------------------------
 */

import * as fs from "node:fs";
import * as path from "node:path";

// --- types ----------------------------------------------------------------

interface SeasonRanking {
  name: string;
  score: number;
}

interface NormalisedFragrance {
  id: string;
  brand: string;
  name: string;
  concentration: string | null;
  gender: string | null;
  year_released: number | null;
  image_url: string | null;
  notes_top: string[] | null;
  notes_heart: string[] | null;
  notes_base: string[] | null;
  note_family: string | null;
  accords: string[] | null;
  general_notes: string[] | null;
  main_accords_percentage: Record<string, string> | null;
  longevity: number | null;
  sillage: number | null;
  rating: number | null;
  country: string | null;
  popularity: string | null;
  price: string | null;
  price_value: string | null;
  season_ranking: SeasonRanking[] | null;
  occasion_ranking: null;
  is_approved: boolean;

  // debug passthroughs
  fragdb_pid: string;
  fragdb_url: string;
  fragdb_perfumers: string[];
  fragdb_description_html: string;
  fragdb_reviews_count: number | null;
  fragdb_appreciation: string | null;
  fragdb_gender_votes_top: string | null;
  fragdb_unresolved_refs: number;
}

// --- CSV parsing ---------------------------------------------------------

function parsePipeCsv(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  return lines.map((line) => line.split("|"));
}

function loadCsv(filepath: string): { header: string[]; rows: string[][] } {
  const text = fs.readFileSync(filepath, "utf8");
  const parsed = parsePipeCsv(text);
  const [header, ...rows] = parsed;
  return { header, rows };
}

function rowToObj(
  header: string[],
  row: string[],
): Record<string, string> {
  const obj: Record<string, string> = {};
  for (let i = 0; i < header.length; i++) obj[header[i]] = row[i] ?? "";
  return obj;
}

// --- lookup builders --------------------------------------------------------

function buildTranslations(rows: string[][]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const row of rows) {
    const [id, , en] = row;
    if (id) map[id] = en ?? "";
  }
  return map;
}

function buildBrandMap(
  header: string[],
  rows: string[][],
): Record<string, { name: string; country: string }> {
  const map: Record<string, { name: string; country: string }> = {};
  for (const row of rows) {
    const o = rowToObj(header, row);
    map[o.id] = { name: o.name, country: o.country };
  }
  return map;
}

function buildNoteMap(
  header: string[],
  rows: string[][],
): Record<string, { name: string; group: string }> {
  const map: Record<string, { name: string; group: string }> = {};
  for (const row of rows) {
    const o = rowToObj(header, row);
    map[o.id] = { name: o.name, group: o.group ?? "" };
  }
  return map;
}

function buildAccordMap(
  header: string[],
  rows: string[][],
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const row of rows) {
    const o = rowToObj(header, row);
    map[o.id] = o.name;
  }
  return map;
}

function buildPerfumerMap(
  header: string[],
  rows: string[][],
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const row of rows) {
    const o = rowToObj(header, row);
    map[o.id] = o.name;
  }
  return map;
}

// --- transforms -------------------------------------------------------------

function parseAccords(
  raw: string,
  accordMap: Record<string, string>,
  unresolvedCounter: { n: number },
): { names: string[]; pct: Record<string, string> } {
  if (!raw) return { names: [], pct: {} };
  const pct: Record<string, string> = {};
  const names: string[] = [];
  for (const pair of raw.split(";")) {
    const [id, percent] = pair.split(":");
    const resolved = accordMap[id];
    if (!resolved) unresolvedCounter.n++;
    const name = resolved ?? id;
    names.push(name);
    pct[name] = percent ?? "";
  }
  return { names, pct };
}

function parseNotesPyramid(
  raw: string,
  noteMap: Record<string, { name: string; group: string }>,
  unresolvedCounter: { n: number },
): {
  top: string[];
  heart: string[];
  base: string[];
  firstHeartGroup: string | null;
} {
  const result = {
    top: [] as string[],
    heart: [] as string[],
    base: [] as string[],
    firstHeartGroup: null as string | null,
  };
  if (!raw) return result;

  const sectionRe = /(top|middle|base)\(([^)]*)\)/g;
  let m: RegExpExecArray | null;
  while ((m = sectionRe.exec(raw))) {
    const section = m[1];
    const body = m[2];
    if (!body) continue;
    const names: string[] = [];
    const seen = new Set<string>();
    for (const triple of body.split(";")) {
      if (!triple) continue;
      const [noteId] = triple.split(",");
      const note = noteMap[noteId];
      if (!note) unresolvedCounter.n++;
      const name = note?.name ?? noteId;
      if (!seen.has(name)) {
        seen.add(name);
        names.push(name);
      }
      // Derive note_family from the FIRST resolvable heart note's group.
      if (
        section === "middle" &&
        result.firstHeartGroup === null &&
        note?.group
      ) {
        result.firstHeartGroup = note.group;
      }
    }
    if (section === "top") result.top = names;
    else if (section === "middle") result.heart = names;
    else if (section === "base") result.base = names;
  }
  return result;
}

interface BucketVote {
  id: string;
  votes: number;
  percent: number;
}
function parseTriples(raw: string): BucketVote[] {
  if (!raw) return [];
  return raw
    .split(";")
    .map((t) => {
      const [id, votes, percent] = t.split(":");
      return {
        id: id ?? "",
        votes: Number(votes ?? 0),
        percent: Number(percent ?? 0),
      };
    })
    .filter((b) => b.id)
    .sort((a, b) => b.percent - a.percent);
}

function mapLongevityToScore(buckets: BucketVote[]): number | null {
  if (!buckets.length) return null;
  const midpoints: Record<string, number> = {
    longevity_very_weak: 1,
    longevity_weak: 3,
    longevity_moderate: 5,
    longevity_long_lasting: 7,
    longevity_eternal: 9.5,
  };
  let totalVotes = 0;
  let weightedSum = 0;
  for (const b of buckets) {
    const mid = midpoints[b.id];
    if (mid === undefined) continue;
    totalVotes += b.votes;
    weightedSum += mid * b.votes;
  }
  if (!totalVotes) return null;
  return Number((weightedSum / totalVotes).toFixed(1));
}

function mapSillageToScore(buckets: BucketVote[]): number | null {
  if (!buckets.length) return null;
  const midpoints: Record<string, number> = {
    sillage_intimate: 2,
    sillage_moderate: 5,
    sillage_strong: 7.5,
    sillage_enormous: 9.5,
  };
  let totalVotes = 0;
  let weightedSum = 0;
  for (const b of buckets) {
    const mid = midpoints[b.id];
    if (mid === undefined) continue;
    totalVotes += b.votes;
    weightedSum += mid * b.votes;
  }
  if (!totalVotes) return null;
  return Number((weightedSum / totalVotes).toFixed(1));
}

function mapSeasonRanking(buckets: BucketVote[]): SeasonRanking[] {
  const name: Record<string, string> = {
    season_spring: "spring",
    season_summer: "summer",
    season_fall: "fall",
    season_winter: "winter",
  };
  return buckets
    .filter((b) => name[b.id])
    .map((b) => ({
      name: name[b.id],
      score: Number((b.percent / 10).toFixed(2)),
    }));
}

function mapGenderVote(buckets: BucketVote[]): string | null {
  if (!buckets.length) return null;
  const map: Record<string, string> = {
    gvotes_female: "female",
    gvotes_more_female: "more female",
    gvotes_unisex: "unisex",
    gvotes_shared: "shared",
    gvotes_more_male: "more male",
    gvotes_male: "male",
  };
  return map[buckets[0].id] ?? null;
}

function mapAppreciation(buckets: BucketVote[]): string | null {
  if (!buckets.length) return null;
  const map: Record<string, string> = {
    like_love: "love",
    like_like: "like",
    like_ok: "ok",
    like_dislike: "dislike",
    like_hate: "hate",
  };
  return map[buckets[0].id] ?? null;
}

function mapPriceValue(
  buckets: BucketVote[],
  translations: Record<string, string>,
): string | null {
  if (!buckets.length) return null;
  return translations[buckets[0].id] ?? buckets[0].id;
}

function simplifyGender(translationId: string): string | null {
  const map: Record<string, string> = {
    gender_for_women: "women",
    gender_for_men: "men",
    gender_for_women_and_men: "unisex",
  };
  return map[translationId] ?? null;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * FragDB perfumers field: `Olivier Cresp;p39` -- alternating name, id.
 * Strip perfumer-id tokens (shape /^p\d+$/) and keep names only.
 */
function parsePerfumers(raw: string): string[] {
  if (!raw) return [];
  return raw
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !/^p\d+$/.test(s));
}

// --- main ------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2);
  const inputDir = args[0];
  const outputFile =
    args[1] ?? path.join(process.cwd(), "fragdb-etl-prototype.out.json");

  if (!inputDir) {
    console.error("Usage: tsx fragdb-etl-prototype.ts <input-dir> [output-file]");
    process.exit(1);
  }

  console.log(`Loading from ${inputDir} ...`);
  const frag = loadCsv(path.join(inputDir, "fragrances.csv"));
  const brands = loadCsv(path.join(inputDir, "brands.csv"));
  const perfumers = loadCsv(path.join(inputDir, "perfumers.csv"));
  const notes = loadCsv(path.join(inputDir, "notes.csv"));
  const accords = loadCsv(path.join(inputDir, "accords.csv"));
  const translationsCsv = loadCsv(path.join(inputDir, "translations.csv"));

  const translations = buildTranslations(translationsCsv.rows);
  const brandMap = buildBrandMap(brands.header, brands.rows);
  const noteMap = buildNoteMap(notes.header, notes.rows);
  const accordMap = buildAccordMap(accords.header, accords.rows);
  const perfumerMap = buildPerfumerMap(perfumers.header, perfumers.rows);
  void perfumerMap; // name resolution happens inline on the fragrance row

  console.log(
    `Loaded ${frag.rows.length} fragrances, ${brands.rows.length} brands, ` +
      `${notes.rows.length} notes, ${accords.rows.length} accords, ` +
      `${perfumers.rows.length} perfumers, ${translationsCsv.rows.length} translations.`,
  );

  const normalised: NormalisedFragrance[] = [];
  let skipped = 0;
  let totalUnresolved = 0;

  for (const row of frag.rows) {
    const o = rowToObj(frag.header, row);
    const perRowUnresolved = { n: 0 };
    try {
      const brandName = (o.brand ?? "").split(";")[0] ?? "Unknown";
      const brandId = (o.brand ?? "").split(";")[1] ?? "";
      const country = brandMap[brandId]?.country || null;

      const { names: accordNames, pct: accordPct } = parseAccords(
        o.accords,
        accordMap,
        perRowUnresolved,
      );
      const pyramid = parseNotesPyramid(
        o.notes_pyramid,
        noteMap,
        perRowUnresolved,
      );

      const general = Array.from(
        new Set([...pyramid.top, ...pyramid.heart, ...pyramid.base]),
      );

      const longevityBuckets = parseTriples(o.longevity);
      const sillageBuckets = parseTriples(o.sillage);
      const seasonBuckets = parseTriples(o.season);
      const priceBuckets = parseTriples(o.price_value);
      const genderVoteBuckets = parseTriples(o.gender_votes);
      const appreciationBuckets = parseTriples(o.appreciation);

      const [ratingRaw] = (o.rating ?? "").split(";");
      const rating = ratingRaw ? Number(ratingRaw) : null;

      const perfumerNames = parsePerfumers(o.perfumers ?? "");

      totalUnresolved += perRowUnresolved.n;

      normalised.push({
        id: `fragdb-${o.pid}`,
        brand: brandName,
        name: o.name,
        concentration: null, // FragDB has no concentration column
        gender: simplifyGender(o.gender ?? ""),
        year_released: o.year ? Number(o.year) : null,
        image_url: o.main_photo || null,
        notes_top: pyramid.top.length ? pyramid.top : null,
        notes_heart: pyramid.heart.length ? pyramid.heart : null,
        notes_base: pyramid.base.length ? pyramid.base : null,
        note_family: pyramid.firstHeartGroup,
        accords: accordNames.length ? accordNames : null,
        general_notes: general.length ? general : null,
        main_accords_percentage: Object.keys(accordPct).length ? accordPct : null,
        longevity: mapLongevityToScore(longevityBuckets),
        sillage: mapSillageToScore(sillageBuckets),
        rating,
        country,
        popularity: o.reviews_count || null,
        price: null,
        price_value: mapPriceValue(priceBuckets, translations),
        season_ranking: mapSeasonRanking(seasonBuckets),
        occasion_ranking: null,
        is_approved: false,

        fragdb_pid: o.pid,
        fragdb_url: o.url,
        fragdb_perfumers: perfumerNames,
        fragdb_description_html: stripHtml(o.description ?? "").slice(0, 400),
        fragdb_reviews_count: o.reviews_count ? Number(o.reviews_count) : null,
        fragdb_appreciation: mapAppreciation(appreciationBuckets),
        fragdb_gender_votes_top: mapGenderVote(genderVoteBuckets),
        fragdb_unresolved_refs: perRowUnresolved.n,
      });
    } catch (err) {
      skipped++;
      console.error(
        `Row pid=${o.pid ?? "?"} failed: ${(err as Error).message}`,
      );
    }
  }

  const meta = {
    generated_at: new Date().toISOString(),
    source: "FragDB MIT sample (samples/ folder, 10 rows)",
    input_dir: inputDir,
    fragrances_loaded: frag.rows.length,
    fragrances_normalised: normalised.length,
    fragrances_skipped: skipped,
    unresolved_lookups_total: totalUnresolved,
    unresolved_lookups_note:
      "IDs that could not be resolved to human names on the sample. " +
      "Every fragrance references thousands of note/accord/brand IDs " +
      "that the 10-row sample doesn't include. This count will drop to " +
      "~0 on the full commercial dataset.",
    lookup_sizes: {
      brands: brands.rows.length,
      perfumers: perfumers.rows.length,
      notes: notes.rows.length,
      accords: accords.rows.length,
      translations: translationsCsv.rows.length,
    },
    field_coverage: {
      with_image_url: normalised.filter((r) => r.image_url).length,
      with_rating: normalised.filter((r) => r.rating !== null).length,
      with_longevity: normalised.filter((r) => r.longevity !== null).length,
      with_sillage: normalised.filter((r) => r.sillage !== null).length,
      with_season_ranking: normalised.filter(
        (r) => r.season_ranking && r.season_ranking.length > 0,
      ).length,
      with_perfumers: normalised.filter((r) => r.fragdb_perfumers.length > 0)
        .length,
      with_accords: normalised.filter((r) => r.accords && r.accords.length > 0)
        .length,
    },
  };

  const out = { _meta: meta, rows: normalised };
  fs.mkdirSync(path.dirname(path.resolve(outputFile)), { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(out, null, 2), "utf8");
  console.log(
    `\nWrote ${normalised.length} normalised rows -> ${outputFile}`,
  );
  console.log(
    `Skipped: ${skipped}. Unresolved lookups: ${totalUnresolved} (expected on sample).`,
  );
}

main();
