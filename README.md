# Restaurant Swipe

Find every restaurant within ~25 miles, auto-categorize them (cuisine + tags), and swipe through
them Tinder-style. Each yes/no teaches the ranking what you like.

- **Next.js 16** (App Router) for the UI and API routes
- **Supabase Postgres + PostGIS** for restaurants, swipes and learned preferences
- **Google Places API (New)** for restaurant data, **Geocoding API** for addresses
- **Claude Haiku 5.5** for cuisine and tag classification

## Setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in all four values (plain text, `KEY=value`, no spaces).
3. Create the database schema, either:
   - **Supabase dashboard:** SQL Editor -> paste `supabase/migrations/20261011000000_init.sql` -> Run, or
   - **CLI:** `npx supabase login`, `npx supabase link --project-ref <ref>`, then `npm run db:push`.
4. In Google Cloud, set a monthly budget alert (Billing -> Budgets & alerts).

## Run

```bash
npm run dev            # http://localhost:3000
```

Open the app, enter an address (or use your location), and press **Find restaurants**. The sweep
runs in the background, then restaurants are categorized; the page shows progress. When it's done,
go to **Swipe**.

Command-line alternatives:

```bash
npm run ingest -- --address "Austin, TX" --dry-run   # show tile count and cost estimate only
npm run ingest -- --address "Austin, TX"              # sweep + categorize
npm run tag                                           # categorize anything left untagged
npm run tag:sample                                    # check the Claude tagger with 3 sample places (no DB)
npm test                                              # unit tests (tiling, ranking, hours)
```

## How it works

**Fetching (`lib/tiling.ts`, `lib/ingest.ts`, `lib/places.ts`).** Nearby Search returns at most 20
places per call, so the search circle is covered by a hex grid of tiles. Each sweep is capped at
60 calls (about $2); the tile size is chosen so the first pass uses ~70% of that (for 25 miles:
37 tiles of 5.5 miles) and the rest splits the busiest tiles into 7 half-size tiles. Because each
call returns Google's 20 most prominent places, a capped sweep favors popular restaurants in dense
areas. Raise the cap with `--max-requests` for more coverage. A sweep that already covers the
requested area within the last 30 days is reused without calling Google.

**Categorizing (`lib/taxonomy.ts`, `lib/tagging.ts`).** Claude Haiku labels batches of 20
restaurants with exactly one cuisine and up to 6 tags, constrained by a JSON schema to the fixed
vocabulary in `lib/taxonomy.ts`. Google's place type is passed as a hint. Price tags come from
Google's price level, not the model.

**Ranking (`lib/ranking.ts`).** Score = 0.5 x quality (rating shrunk toward the mean for places
with few reviews) + 0.15 x closeness + 0.35 x learned affinity. Each swipe adds or subtracts 0.3
from the weights of the place's cuisine, tags and price level (clamped to +/-3). A "no" while
browsing one cuisine doesn't count against that cuisine. With no cuisine filter, about 1 card in
10 is a well-rated place from a cuisine you haven't tried yet. Undo reverses the exact weight
change.

## Costs

- Google, once per area per 30 days: up to 60 Nearby Search calls at about $0.035 each (about $2).
- Google, ongoing: each card photo is one Place Photo call (about $0.007); the browser caches it
  for a day. Geocoding is about $0.005 per search. Google's monthly free usage allowance may
  cover small amounts of this.
- Claude Haiku: well under $0.01 per 100 restaurants.

## Notes

- Google's terms limit how long Places content may be cached (about 30 days). Re-run a sweep with
  "Re-fetch from Google" checked to refresh.
- The service-role key is only used server-side (`lib/supabase.ts` imports `server-only`); RLS is on
  for every table with no public policies.
- Background sweeps use `after()`, which is fine on `next dev` / `next start`. On serverless hosts
  with short time limits, run `npm run ingest` instead.
