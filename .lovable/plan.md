## Goal

Remove the current Ledger implementation completely — code, routes, server functions, DB tables, and cron — so we can rebuild it from your written spec against a clean slate. Clockwise (App 1) stays untouched. The `/ledger` route and `AppSwitcherBar` stay in place but point at a minimal placeholder until the new spec lands.

## Scope of removal

### Frontend / routes
- Delete `src/routes/ledger.tsx` and everything under `src/routes/ledger/` (`index.tsx`, `active.tsx`, `closed.tsx`, `sync.tsx`).
- Delete `src/components/ledger/` (Header, JobCard, EditJobDialog, ExecutiveDashboard, KpiCard, RecentSheets).
- Delete the public API route `src/routes/api/public/hooks/ledger-sheet-pull.ts`.

### Server / lib
- Delete `src/lib/ledger.functions.ts`, `src/lib/ledger-client.ts`, `src/lib/ledger-xlsx.ts`, `src/lib/ledger-jobs-sync.server.ts`, `src/lib/ledger-sheet-import.server.ts`, `src/lib/ledger-sheet-export.server.ts`, `src/lib/ledger-sheet-export.functions.ts`.
- Remove all imports/calls into those modules from Clockwise code (notably any `mirrorJobToLedger` / labor-rollup hooks in `entries.functions.ts`, `jobsites.functions.ts`, clock-in/out paths). Clockwise keeps working with no Ledger side-effects.

### Database (migration)
- `DROP TABLE public.ledger_jobs CASCADE;`
- Drop `public.ledger_jobs_touch_updated_at()` trigger function.
- Drop any `pg_cron` job that pulls Ledger sheets (leave Clockwise auto-clockout cron alone, per prior instruction).
- Leave `app_settings`, `audit_log`, `job_sites`, `reimbursements`, `time_entries`, `weekly_payouts`, `workers`, `receipts` bucket untouched.

### Placeholder
- New `src/routes/ledger.tsx` (or `ledger/index.tsx`) rendering a simple "Ledger is being rebuilt" panel inside `AppSwitcherBar`, so the app tab still routes cleanly and there are no broken links.

## Why "hard reset" over "paste code"

You picked hybrid — spec first, code as reference. That means:
1. This turn: clean removal only, no new Ledger business logic.
2. Next turn: you send the written spec (data model, screens, flows, sync rules). Optionally paste snippets from your other app for visual reference.
3. Turn after: I design tables + routes native to this stack (Supabase + TanStack Start + shadcn) and build.

Reasons to do the wipe as its own step:
- Avoids merge/type conflicts between old `ledger_jobs` columns and whatever the new schema needs.
- Lets us decide the job-sync question later without carrying dead mirroring code.
- Keeps the diff reviewable — deletions in one commit, new build in the next.

## Deliverable this turn
1. One `supabase--migration` dropping `ledger_jobs` + related function/cron.
2. File deletions + import cleanup in Clockwise.
3. Placeholder `/ledger` route.
4. Confirmation that Clockwise (worker + admin) still builds and runs.

## What you send next
- The spec (screens, entities, flows, required fields, permissions, whether Google Sheets is involved at all this time).
- Optional: the other app's repo/snippets as visual reference.
- Answer to the deferred "sync Ledger jobs with Clockwise job sites?" question once the spec is clearer.
