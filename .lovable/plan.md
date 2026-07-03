# Add "Ledger" as App 2 with app chooser and shared data

Port the pipeline app (`ledger-app-from-emergent-labs`) into this project as **App 2 — Ledger**, keep Clockwise as **App 1**, and give every logged-in user (admin + worker) a chooser to switch between them. Preserve Ledger's existing visual style (pill-card, display font, emerald accent, grain background) exactly as in the repo.

## App chooser

- New public route `/apps` — after any successful login (admin or worker), redirect here instead of straight into the app.
- Full-screen chooser with two large cards:
  - **Clockwise** — time tracking, payouts, receipts (current app)
  - **Ledger** — construction job financials (new app)
- Persist the last-picked app in `localStorage` so refresh keeps the user in place. A small "Switch app" button in each app's header returns to `/apps`.
- Workers see both cards (per your earlier answer). Ledger is fully accessible; role-based hiding can be layered later.

## Ledger routes (App 2)

Nest under `/ledger/*`, mirroring the repo's four tabs:

- `/ledger` → **Executive Dashboard** (KPIs across all jobs)
- `/ledger/active` → **Active Jobs**
- `/ledger/closed` → **Closed Out Jobs**
- `/ledger/sync` → **Data Sync** (xlsx upload, reset, seed)

Port these components 1:1 from `frontend/src/components/` (JSX → TSX):
`JobCard`, `JobDetailDialog`, `KpiCard`, `LeadSourceSelect`, and the four `tabs/*.jsx` files. Reuse the existing shadcn UI primitives already in this project (Tabs, Dialog, Button, etc.) — do not re-copy `components/ui`.

Copy the repo's Ledger-specific CSS (pill-card, display font, grain, emerald tokens) into a scoped block in `src/styles.css` so only the `/ledger` subtree picks it up (wrap the ledger layout in a `.ledger-scope` class).

## Backend port (Mongo/FastAPI → Supabase + server functions)

New table `public.ledger_jobs` — one row per job, mirrors the repo's `Job` model:

```
id uuid pk, address text, client_name text, start_date date, finish_date date,
total_price numeric, gross_cash numeric, gross_with_hst numeric,
finish_materials numeric, building_materials numeric, subs numeric, labor numeric,
net numeric, profit_margin numeric, lead_source text default 'unknown',
payments_received numeric default 0,
payments_log jsonb default '[]', expense_log jsonb default '[]', price_log jsonb default '[]',
linked_job_site_id uuid null references public.job_sites(id) on delete set null,
created_at timestamptz default now(), updated_at timestamptz default now()
```

RLS: same posture as the rest of this project — deny-all, all access via `supabaseAdmin` inside server functions gated by the existing custom HMAC auth (`requireAdmin` / `requireWorker`).

New server-function module `src/lib/ledger.functions.ts` exposing the ported FastAPI routes:

- `listLedgerJobs` — GET all
- `createLedgerJob(payload)` — POST
- `updateLedgerJob(id, patch)` — PATCH (whitelist: `lead_source`, `payments_received`, `finish_date`, `linked_job_site_id`)
- `deleteLedgerJob(id)` — DELETE
- `uploadLedgerJobXlsx(base64File, filename)` — parses the sheet, upserts by address (case-insensitive), same field mapping as `parse_job_xlsx` in `backend/server.py`
- `seedLedgerJobs` / `resetLedgerJobs`

The xlsx parser is rewritten in TypeScript using **SheetJS (`xlsx`)** — Worker-safe, no native deps. Same cell layout (C1/C2/C3/F3/B6/E6/F6/G6/H6/J6, price log walk starting row 10 cols J/K/L, payments cols B/C/D, expenses cols E/F/G/H with I/J).

## Cross-app sync

- **`ledger_jobs.linked_job_site_id`** (nullable FK to `job_sites.id`) is the sync bridge. On xlsx upload, we auto-match by normalized address; users can also link/unlink from the Job Detail dialog.
- Real-time both directions via Supabase Realtime:
  - Ledger tabs subscribe to `ledger_jobs` AND `job_sites` (address changes reflect back on cards).
  - Clockwise Job Sites tab subscribes to `ledger_jobs` to show a small "$ Ledger linked" badge when a linked ledger job exists.
- Add `ALTER PUBLICATION supabase_realtime ADD TABLE public.ledger_jobs;` in the same migration.

## Auth flow tweak

- Update the post-login redirect (worker PIN success + admin login success) from the current direct route to `/apps`.
- If `localStorage.lastApp` is set, `/apps` auto-forwards there; otherwise it renders the chooser.

## Technical details

- Files added:
  - `src/routes/apps.tsx` (chooser)
  - `src/routes/ledger.tsx` (layout with tabs + `<Outlet/>`) and children `ledger.index.tsx`, `ledger.active.tsx`, `ledger.closed.tsx`, `ledger.sync.tsx`
  - `src/components/ledger/*` — ported JSX files as TSX
  - `src/lib/ledger.functions.ts` — server functions
  - `src/lib/ledger-xlsx.ts` — SheetJS parser (server-only helper)
- Package add: `xlsx` (SheetJS community build).
- Migration: create `ledger_jobs`, indexes on `address` (lower) and `linked_job_site_id`, GRANTs to `service_role`, RLS enabled deny-all, add to realtime publication.
- No changes to Clockwise business logic; only header gains a "Switch app" button and the login redirects change target.
- Seed data from the repo's `DEMO_JOBS` is available behind the Data Sync "Seed" button — not auto-run.

## Out of scope (ask if you want it)

- Worker-side write access to Ledger (currently read/write for anyone logged in, same as repo behavior).
- Migrating existing `job_sites` rows into `ledger_jobs` automatically — linking is opt-in per job.
- Exporting Ledger data to the existing Google Sheets sync pipeline.
