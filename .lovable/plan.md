## Goal

Rebuild the Ledger tab as a port of the **Job Flow** project — same UI, screens, and interactions — but backed by Lovable Cloud (Supabase) instead of `localStorage`, and fully independent from Clockwise (no worker/site sync). Clockwise stays untouched. The top `AppSwitcherBar` remains; Job Flow's floating bottom-pill nav lives underneath it while inside `/ledger/*`.

## Source app (Job Flow) — what we're mirroring

- Screens: Home (daily briefing), Jobs list, Job detail, New job, Calendar, Notifications, Profile.
- Data model: `Job { id, name, client{name,email,phone}, address, projectType, trades[], status, progress, budget, collected, expenses, workersOnSite, scheduledFor, createdAt, updatedAt, timeline[] }` with typed enums for status/project type/trades and a `TimelineEvent` union (created, status, note, visit, estimate, approval, payment, clockin, receipt, material, change_order, inspection, completed).
- Visual system: shadcn + Tailwind tokens (`--surface`, `--shadow-card`, `card-surface`, `card-lift`), soft rounded cards, floating pill nav, status-tone chips via `color-mix`.

## Database (one migration)

Create fresh Ledger tables — no reuse of the dropped `ledger_jobs` schema.

```text
ledger_jobs
  id, name, client_name, client_email, client_phone,
  address, project_type (enum text), trades text[],
  status (enum text), progress int (0-100),
  budget_cents bigint, collected_cents bigint, expenses_cents bigint,
  workers_on_site int, scheduled_for timestamptz,
  archived_at, created_at, updated_at

ledger_job_events   (timeline)
  id, job_id → ledger_jobs.id ON DELETE CASCADE,
  kind text (created|status|note|visit|estimate|approval|payment|
             clockin|receipt|material|change_order|inspection|completed),
  title, detail, occurred_at timestamptz, created_at
```

- GRANTs to `authenticated` + `service_role` (this app is admin-only under a custom HMAC token, so RLS policies stay `deny all` matching Clockwise's pattern; all reads/writes go through `createServerFn` with `verifyAdminToken`).
- `updated_at` trigger on `ledger_jobs`.
- No cron, no Sheets integration, no Clockwise linkage.

## Server functions — `src/lib/ledger.functions.ts`

Admin-guarded (reuse Clockwise's `verifyAdminToken` pattern):
- `listLedgerJobs()` — for Home + Jobs list + Calendar.
- `getLedgerJob(id)` — job + timeline (sorted desc).
- `createLedgerJob({ client, address, projectType, trades, status })` — auto-generates `name` (`"<lastName> <projectType>"`) and seeds two timeline events (`created`, `status`).
- `updateLedgerJob(id, patch)` — arbitrary field patch; appends a `status` event when status changes; bumps `updated_at`.
- `addLedgerJobEvent(id, { kind, title, detail, occurred_at? })` — for the "Add a note" button and any future event drops.
- `deleteLedgerJob(id)` — cascade removes events.

## Routes (nested under `/ledger`)

Replace the current placeholder with a nested tree:

```text
src/routes/
  ledger.tsx                → layout: <AppSwitcherBar/> + <Outlet/> + <LedgerBottomNav/>
  ledger/index.tsx          → Home (daily briefing)
  ledger/jobs.tsx           → Jobs list
  ledger/jobs.$jobId.tsx    → Job detail
  ledger/jobs.new.tsx       → New job form
  ledger/calendar.tsx       → Calendar
  ledger/notifications.tsx  → Alerts
  ledger/profile.tsx        → Profile
```

Each leaf gets a unique `head()` with title/description/OG tags. All data reads use `queryOptions` + `ensureQueryData` in the loader and `useSuspenseQuery` in the component, per the stack rules.

## Components — `src/components/ledger/`

- `LedgerShell.tsx` — the container (padding, max-width) from Job Flow's `AppShell` minus its nav (nav moves out).
- `LedgerBottomNav.tsx` — the floating pill (Home / Jobs / Calendar / Alerts / Profile), rendered by the `ledger.tsx` layout so it appears on every child but not outside Ledger.
- `JobCard.tsx`, `JobStatusBadge.tsx`, `JobTimeline.tsx`, `NewJobForm.tsx` — ported from Job Flow, restyled to use existing tokens.
- `jobs-client.ts` — thin TanStack Query hooks (`useLedgerJobs`, `useLedgerJob`, `useCreateLedgerJob`, …) wrapping the server fns.

## Nav / layout integration

- `AppSwitcherBar` stays as the top-of-screen Clockwise↔Ledger toggle (no changes).
- `ledger.tsx` renders: `<AppSwitcherBar /> <main class="pb-28"><Outlet/></main> <LedgerBottomNav/>`.
- Bottom nav highlights the active `/ledger/*` sub-route; on `/` (Clockwise) it is not rendered.

## Out of scope (per your answers)

- No sync between Ledger jobs and Clockwise `job_sites` / workers.
- No Google Sheets import/export, no `pg_net`, no cron.
- No auth changes — Ledger sits behind the same admin login as Clockwise.

## Deliverable order

1. `supabase--migration` creating `ledger_jobs` + `ledger_job_events` with GRANTs, RLS, updated_at trigger.
2. `src/lib/ledger.functions.ts` with the six server fns above.
3. Route tree + components port (single edit batch after types regenerate).
4. Verify build + a quick smoke test: create a job → shows on Home + Jobs list, timeline event added, status change appends event.

## What you'll want to decide later (not this turn)

- Whether Ledger should eventually mirror Active jobs into Clockwise `job_sites` (deferred by your answer today).
- Whether to persist a "seen" state for Notifications (currently just derived from jobs).
