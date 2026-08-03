# Phase 0 — Audit & Protect Clockwise

No CRM work, no destructive DB changes, no visual changes.

## What exists today (verified against live schema + code)

Row counts (live): audit_log 737, time_entries 248, reimbursements 62, job_sites 61, weekly_payouts 58, job_events 4, ledger_job_events 2, workers 2, os_jobs 1, app_settings 1, ledger_jobs 1, clients 1.

**Clockwise core (active, canonical, must be preserved)**

```text
workers ──< time_entries >── job_sites   (job_site_id, planned_job_site_id,
   │                                      clock_out_job_site_id, assigned_job_site_ids[])
   ├──< reimbursements >── job_sites     (parsed_job_site_id, billable_job_site_id)
   └──< weekly_payouts                   (worker_id + week_start)
app_settings (single row: admin hash, toggles, sheet IDs)
audit_log     (append-only; trigger audit_log_block_changes blocks UPDATE/DELETE)
```

**Ledger v2 (active, small)**: `ledger_jobs` ──< `ledger_job_events`. Referenced only by `src/lib/ledger.functions.ts` + the `/ledger/*` routes.

**Orphaned Ledger v1 (competing/dead)**: `clients` ──< `os_jobs` ──< `job_events`. Referenced by **zero** application code — leftovers from the pre-reset Ledger. They compete conceptually with both `job_sites` (Clockwise's site of record) and `ledger_jobs`.

**Canonical going forward**: `job_sites` = physical/geofenced location of record; `ledger_jobs` = job/project record; `workers`/`time_entries` = labour. `clients`/`os_jobs`/`job_events` are not canonical and must not be built on.

## Deliverables

### 1. Audit document (`docs/AUDIT-clockwise.md`)
- Full ER map of the 12 public tables with FK list and which module owns each.
- Table-by-table status: active / orphaned / append-only-protected, plus row counts.
- Inventory of all ~70 server functions grouped by surface (auth, entries, workers, job sites, reimbursements, receipts, payout, sheet export, audit, ledger, settings) marked **preserve** vs **ledger-only**.
- The two public HTTP hooks (`/api/public/hooks/auto-clockout`, `/api/public/hooks/sheet-export`).
- Overlap/risk register and the migration-history caveat (`ledger_jobs` defined, dropped and recreated across historical migrations — never replay them).

### 2. Freeze the orphan tables (one forward-only, non-destructive migration)
`COMMENT ON TABLE public.clients / os_jobs / job_events` marking them DEPRECATED — Ledger v1 residue, do not build on. No drops, no renames, no data touched, RLS untouched.

### 3. Smoke tests (mocked only — never touches the database)
Add Vitest for pure logic + extend the existing Playwright suite for flows. Both run headless with fixtures.

Unit (Vitest, `tests/unit/`):
- Token signing/verification: worker vs admin kind, expiry rejection, tamper rejection, admin sliding refresh.
- Geofence math: inside radius → verified, supplier site → supplier, outside all → off_site, missing GPS → no_gps, nearest-site tie-break.
- Payout math: hours rounding, wages = hours × rate, reimbursement roll-up, week boundary bucketing.
- Offline queue: enqueue/remove/update, failed-flag retention, cross-tab lock acquire/release.

Flow (Playwright, extending `tests/visual/mock.ts` fixtures):
- Worker PIN login → home; Admin password login → dashboard.
- Clock-in (GPS verified), clock-in off-site → reason prompt, clock-out.
- Receipt upload dialog submit; worker reimbursement submit (description optional, job mandatory).
- Admin entry list review + edit dialog opens with correct assigned-site title.
- Job site create/edit/archive dialog.
- Payout weekly/lifetime tabs render totals; Sheets export settings screen + export trigger (mocked response).

These assert behaviour/DOM state, not pixels, so they stay green through future styling work.

### 4. Confirm existing checks still run
Run `npm run lint:style` (allowlist ratchet) and `npm run test:visual` (34 baselines) and report results. No baseline updates unless something already drifted, which will be reported rather than silently re-recorded.

## Technical notes
- Vitest added as a dev dependency with a `test:unit` script; Playwright config untouched apart from ignoring the new unit dir.
- Testable pure helpers (haversine/geo classification, payout math) may need a thin extraction into a `.ts` module importable without the Supabase admin client — extraction only, no behaviour change; the existing `.server.ts` files keep their current exports.
- No `.env` values are read, printed, or committed; tests use synthetic secrets.

## Explicitly out of scope
CRM tables/UI, dropping or altering any production table, editing past migrations, visual redesign.
