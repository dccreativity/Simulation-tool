# Eco Field Lab

**Real Data. Real Decisions. Healthier Planets.**

An interactive ecology and statistics lab for secondary, IB and Cambridge students.
Students either sample simulated ecosystems with quadrats and transects, or bring their own
data, and then follow the same path every ecologist does:

**Field → Data → Analysis → Evidence → Conclusion**

## What it does

### Simulation mode
- **Eight ecosystems**: grassland, woodland, pond, coastal (rocky shore), desert, wetland,
  urban park and tropical forest. Each has a research question (mission), hypothesis,
  habitat zones and 5–7 species.
- **A real population, not canned numbers.** Each site is an environmental model (water,
  paths, canopy shade, shore height, road edges) and species densities respond to it, with
  clumping and competitive spacing. Thousands of individual organisms are generated from a
  **site code**, so a whole class can sample the same site, and every sampling choice changes
  the data.
- **Quadrats** (0.25–2 m) placed at random, on a systematic grid, stratified by zone, or by
  hand. **Line transects** record individuals touching the tape; **belt transects** count
  individuals in each section of a strip.
- **Sampling-bias detection.** Because the true population is known, the lab tests whether
  the sample positions favour dense or sparse areas or are bunched together, and shows
  *actual population vs your sample* side by side.
- Pan / zoom / pinch field map with zones and a "true density" layer, keyboard operable.

### My Data mode
Paste simple values, two groups or a frequency table (auto-detected), import CSV, or load
example data — then go straight to statistics. No simulation needed.

### Data Lab
Editable tables for quadrat, line-transect, belt-transect and custom data: add, delete and
duplicate rows, typed columns, invalid-value highlighting, CSV import/export.

### Statistics Lab
- Descriptive statistics: mean, median, all modes, range, standard deviation, n, quartiles,
  standard error — with live editing and an SD visualisation.
- Guided **t-test** (Student's or Welch's, one- or two-tailed, α = 0.05 / 0.01 / 0.10).
- **Chi-squared** goodness of fit (editable expected ratios) and species association from
  quadrat presence/absence.
- "**Which test should I use?**" reasoning pathway.

**Conventions:** SD is the *sample* SD (÷ n − 1) by default (the population SD is one click
away); quartiles use linear interpolation (QUARTILE.INC); no continuity correction in
chi-squared. Interpretations never claim proof or causation and separate statistical from
biological significance. All statistics are implemented in TypeScript and checked against
SciPy in the unit tests.

### Field Notebook, achievements, accounts
Save investigations (question, hypothesis, method, data, statistics, tests, charts,
conclusion, limitations); print to PDF or export Markdown/CSV. Mature achievements build a
"scientific reputation". Accounts are optional — guests can use everything and their work is
saved on the device; signing in syncs the notebook to Supabase.

The original **Quadrat & Transect Lab** (hand-counting practice and repeated-survey
experiments) is kept as a static page at `/quadrat-lab/index.html`.

## Technology

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Framer Motion · Recharts · Zustand ·
Supabase (Postgres, Auth, Row Level Security) · Lucide icons · Vitest · Playwright.

## Local setup

```sh
npm install
cp .env.example .env.local   # then fill in your Supabase URL and publishable key
npm run dev                  # http://localhost:3000
```

The app runs without Supabase variables too: everything works in guest mode and saves to the
browser.

### Environment variables

| Variable | Where | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | browser | Project URL, e.g. `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | browser | Publishable (`sb_publishable_…`) or legacy anon key |

Both are public by design; Row Level Security protects user data. **No service-role key is
used or needed.** Never commit `.env.local`.

## Supabase

1. Create a project.
2. Run `supabase/migrations/20260925000100_init_schema.sql`, then `supabase/seed/seed.sql`
   (SQL editor, or `supabase db push` with the CLI).
3. *Authentication → URL configuration*: set the **Site URL** to your deployed URL and add
   `https://<your-domain>/auth` to the redirect allow list, so email-confirmation links
   return to the app.
4. Optional: run `supabase/tests/rls_isolation_check.sql` — every row should say
   `passed = true`.

Tables: `profiles`, `ecosystems`, `missions`, `achievements` (public catalogue), and the
user-owned `investigations`, `datasets`, `dataset_rows`, `analyses`, `notebook_entries`,
`user_achievements`. Simulation state is not stored — sites are reconstructed from the
ecosystem and site code.

## Commands

| Command | |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript |
| `npm test` | Unit tests (statistics vs SciPy, simulation engine, bias detection) |
| `npm run test:e2e` | Playwright on desktop, tablet and phone (run `npm run build` first; set `PLAYWRIGHT_CHROMIUM_PATH` to use a system Chromium) |

## Deployment (GitHub → Vercel → Supabase)

1. Import the GitHub repository in Vercel (framework preset: Next.js; defaults are fine).
2. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for Production
   and Preview.
3. Set the production branch, deploy, then add the production URL to Supabase's Site URL and
   redirect list (step 3 above).

## Project structure

```
app/                 routes (home, explore, simulation, my-data, data-lab, statistics, notebook, achievements, auth)
components/          ui, navigation, layout, ecosystem, sampling, data, statistics, charts, notebook, providers
data/                ecosystem definitions, missions, achievements
lib/statistics       descriptive stats, distributions, t-test, chi-squared, interpretation
lib/simulation       seeded generation, spatial index, rendering, palette
lib/sampling         quadrats, transects, location strategies, bias detection
lib/data             datasets, parsing, CSV, examples
lib/store            local-first Zustand stores
lib/supabase         client and sync
supabase/            migrations, seed, RLS check
tests/               unit (Vitest) and e2e (Playwright)
public/quadrat-lab/  the original Quadrat & Transect Lab
```
