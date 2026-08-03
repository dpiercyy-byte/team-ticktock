## Phase 1 — Canonical project structure

Goal: one project record moves from inquiry → estimating → construction → completion → warranty. `ledger_jobs` stays the single canonical project table. No new competing job table, no interface redesign.

### Current state (verified)
- `ledger_jobs`: 1 row (test data: "Smsks Whole Home"), with embedded `client_name / client_email / client_phone / address`.
- `ledger_job_events`: 2 rows — already the Ledger timeline table, and the one canonical event structure to keep.
- `clients`: exists, 1 row, deny-all RLS, currently unused by app code (Ledger v1 residue) — will be reused and extended rather than recreated.
- `os_jobs` (1 row) and `job_events` (0 rows): deprecated Ledger v1 residue, left untouched this phase.
- `job_sites`: 61 rows (18 client-kind, rest supplier). 248 time entries, 62 reimbursements reference it — geofence logic untouched.
- Only `src/lib/ledger.functions.ts` reads/writes Ledger tables.

### Database work (single forward-only migration, guarded)

Everything uses `if not exists` / `add column if not exists` / conditional policy creation so re-running is safe. No table is dropped, reset, or renamed. No existing column is removed.

1. **clients** — add missing columns: `lead_source`, `preferred_contact_method`, `notes`/`archived_at` already present. Add `updated_at` trigger if absent.
2. **properties** — new table: `id`, `client_id → clients(id)`, `address`, `unit`, `city`, `province`, `postal_code`, `latitude`, `longitude`, `notes`, `created_at`, `updated_at`, `archived_at`. GRANTs + deny-all RLS to match the rest of the schema (all access goes through the service-role server functions).
3. **ledger_jobs** — add nullable columns only: `client_id`, `property_id`, `sales_stage`, `delivery_status`, `estimated_value_cents`, `assigned_owner`, `next_action`, `next_action_due_at`, `expected_start_date`, `actual_start_date`, `expected_completion_date`, `actual_completion_date`, `lost_reason`. Existing `status`, `client_name`, `client_email`, `client_phone`, `address` are preserved untouched for rollback. IDs preserved.
4. **job_sites** — add nullable `project_id → ledger_jobs(id)`. Supplier rows stay `null`; nothing about radius, kind, or geofencing changes.
5. **Status mapping** (existing `status` → the two new axes, applied as a backfill; `status` keeps being written in parallel this phase):

```text
Lead                 -> New Lead        / Not Started
Site Visit Required  -> Site Visit      / Not Started
Estimate Required    -> Estimating      / Not Started
Waiting For Approval -> Estimate Sent   / Not Started
Scheduled            -> Won             / Scheduled
Active               -> Won             / Active
Completed            -> Won             / Completed
```

6. **Backfill** — for each existing `ledger_jobs` row without `client_id`: upsert a `clients` row from the embedded client fields (matched on name+email), upsert a `properties` row from `address` (+ existing lat/lng if any), then set `client_id`/`property_id`. Idempotent: skips rows already linked.
7. **Event kinds** — extend the allowed `ledger_job_events.kind` set to cover calls, stage changes, and the rest of the required list, keeping all existing kinds valid.

### Application work (minimum needed to support relationships)

In `src/lib/ledger.functions.ts` only:
- Job reads join `clients` and `properties`, returning client/property objects; fall back to the embedded fields when a link is missing, so nothing can blank out.
- `createLedgerJob` finds-or-creates the client and property, then writes both the new FK columns and the legacy embedded fields (dual-write for rollback safety).
- `updateLedgerJob` accepts `salesStage`, `deliveryStatus`, and the lifecycle date/owner/next-action fields, keeps writing legacy `status` from the mapping, and logs a `stage` timeline event on change.
- New helpers: list clients, list a client's properties/projects, and link a `job_sites` row to a project (`project_id`) — backend only, no new screens.

Existing Ledger screens keep working unchanged because the returned job shape stays backward compatible.

### Testing
- Run `npm test` (37 unit + Playwright visual/flow suites). Clockwise baselines must be unchanged — no Clockwise file is edited.
- Verify by query: every Ledger project has exactly one client and one property; client → multiple projects works; time entries and receipts counts unchanged (248 / 62).

### Out of scope this phase
CRM interface, dropping deprecated columns/tables, and any Ledger visual redesign.
