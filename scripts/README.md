# scripts/

Ad-hoc / one-off scripts. Run locally via `tsx`. NOT bundled into the app.

## embed-fragrances.ts

Backfill the 384-dim embedding column on `public.fragrances` using
`Xenova/all-MiniLM-L6-v2` via Transformers.js. Part of the recommender rollout
(see `notes/recommender-design.md` §3).

**Prereqs**

1. Install dependencies (one-time):
   ```bash
   npm install
   ```
   This picks up `@xenova/transformers` + `tsx` (added to devDependencies on
   17 April).

2. Local env — add to `.env` (or export, or put in `.env.local`):
   ```
   SUPABASE_SERVICE_ROLE_KEY=<grab from Supabase dashboard → Settings → API>
   ```
   The script bypasses RLS with the service role so it can write to every
   row regardless of `submitted_by`. **Never commit the service role key.**

**Dry-run first**

```bash
npm run embed:fragrances:dry
```

This fetches the first five fragrances, builds their source strings, encodes
them, and prints the first few vector values — no database writes. Good for
sanity-checking the source string format and that the model loads.

**Full backfill**

```bash
npm run embed:fragrances
```

~3067 fragrances. On a modern laptop (CPU inference, no GPU), MiniLM-L6-v2
runs at roughly 5–15 rows/sec — expect somewhere in the 5–10 minute range
end-to-end. First run downloads the model (~23MB) to `~/.cache/huggingface/`.
Safe to re-run — the script only processes rows where `embedding IS NULL`
unless `--force` is passed.

**After it finishes**

Apply the ivfflat index migration (Step 2b of the rollout — that file lands
once this script has populated the column). Without the index, queries on
`embedding` still work but do a full scan.
