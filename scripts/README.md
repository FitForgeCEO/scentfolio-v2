# scripts/

Ad-hoc / one-off scripts. Run locally via `tsx`. NOT bundled into the app.

## embed-fragrances.ts

Backfill the 384-dim embedding column on `public.fragrances` using
`Xenova/all-MiniLM-L6-v2` via Transformers.js. Part of the recommender rollout
(see `notes/recommender-design.md` Section 3).

**Prereqs**

1. Install dependencies (one-time):
   ```bash
   npm install
   ```
   This picks up `@xenova/transformers` + `tsx` (added to devDependencies on
   17 April).

2. Local env -- add to `.env` (or export, or put in `.env.local`):
   ```
   SUPABASE_SERVICE_ROLE_KEY=<grab from Supabase dashboard -> Settings -> API>
   ```
   The script bypasses RLS with the service role so it can write to every
   row regardless of `submitted_by`. **Never commit the service role key.**

**Dry-run first**

```bash
npm run embed:fragrances:dry
```

This fetches the first five fragrances, builds their source strings, encodes
them, and prints the first few vector values -- no database writes. Good for
sanity-checking the source string format and that the model loads.

**Full backfill**

```bash
npm run embed:fragrances
```

~3067 fragrances. On a modern laptop (CPU inference, no GPU), MiniLM-L6-v2
runs at roughly 5-15 rows/sec -- expect somewhere in the 5-10 minute range
end-to-end. First run downloads the model (~23MB) to `~/.cache/huggingface/`.
Safe to re-run -- the script only processes rows where `embedding IS NULL`
unless `--force` is passed.

**After it finishes**

Apply the ivfflat index migration (Step 2b of the rollout -- that file lands
once this script has populated the column). Without the index, queries on
`embedding` still work but do a full scan.

## eval-recommender.ts

Offline evaluation harness for the hybrid recommender's vector leg. Loads a
JSON file of hand-curated twin pairs, calls `public.match_fragrances` with
each fragrance's embedding as the seed, and asserts the paired twin appears
in the seed's top-K results. Part of the recommender rollout (see
`notes/recommender-design.md` Section 10).

**Why this exists**

The design doc requires an offline eval before we touch the 0.6/0.4 weight
balance (Section 4.2) or swap the embedding model. Production click-telemetry
(the `recommender_click` event, wired in Step 10(a)) takes weeks to
accumulate -- the harness gives us a same-day signal.

**What a "twin" is**

Pairs a human would expect BOTH directions to surface each other:

- Same-house flankers (Sauvage / Sauvage Parfum)
- Notorious dupe pairs
- Olfactory cousins across houses (any two barbershop fougeres, etc.)

Dan curates. 20 is the target. The repo ships with a 3-placeholder
`eval-pairs.sample.json` so the harness mechanics can be exercised before
curation is complete.

**Pairs schema**

```json
{
  "pairs": [
    {
      "a": { "brand": "Dior", "name": "Sauvage" },
      "b": { "brand": "Dior", "name": "Sauvage Parfum" },
      "note": "Same-house flanker -- should land top-5"
    }
  ]
}
```

Brand+name is preferred over UUIDs -- curators don't have the IDs to hand.
Lookup is exact-match, case-sensitive on both fields. If a row doesn't
resolve, the pair is skipped with a logged reason; a partly-curated file
still produces signal rather than hard-failing the run.

**Prereqs**

Same env as `embed-fragrances.ts`: `VITE_SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY`. The script only reads, but uses the service
role so that it can read the `embedding` column on any row regardless of
RLS (the column is normally readable via the `is_approved` policy, but the
service role sidesteps any future tightening).

**Run**

```bash
# Sample pairs (3 placeholders, ships with the repo)
npm run eval:recommender

# Custom file
npx tsx scripts/eval-recommender.ts --pairs scripts/eval-pairs.json

# Widen the net, print notes
npx tsx scripts/eval-recommender.ts --top-k 50 --verbose
```

**Output**

Each pair contributes TWO evals (a->b and b->a). For each eval the harness
prints `HIT @<rank> (score <x>)` or `MISS`. The summary block reports:

- `coverage %` -- fraction of evals that hit
- `mean rank (hit)` -- average rank of twin within top-K when found
- `worst rank (hit)` -- farthest-back a twin was still surfaced
- full miss list with curator notes attached for debugging

Exit code is `0` on any hits, `2` if every eval missed (so CI can fail
usefully if the harness is ever wired into a pipeline), `1` on unexpected
errors.

**Interpreting results**

Coverage on a well-curated 20-pair file should comfortably clear 80% at
top-20. Sub-50% is a red flag: check whether the seed/twin rows have
embeddings at all, whether `embedding_version` is the same across pairs,
and whether the miss list reveals a pattern (e.g. all cross-house pairs
missing = the heuristic leg is carrying more weight than the vector leg
thinks).
