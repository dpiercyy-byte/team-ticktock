# Clockwise — Phase 0 Audit & Protection

Status: **complete**. No CRM work started. No table dropped, renamed, or emptied.

Verified against the live database schema, live row counts, and a full grep of
`src/` on the date of writing.

---

## 1. What exists

### 1.1 Tables (public schema)

| Table | Rows | Owner module | Status |
|---|---:|---|---|
| `audit_log` | 737 | `src/lib/audit.server.ts`, `audit.functions.ts` | **Active — append-only, trigger-protected** |
| `time_entries` | 248 | `src/lib/entries.functions.ts` | **Active — canonical** |
| `reimbursements` | 62 | `reimbursements.functions.ts`, `receipts.functions.ts` | **Active — canonical** |
| `job_sites` | 61 | `jobsites.functions.ts`, `geo.server.ts` | **Active — canonical** |
| `weekly_payouts` | 58 | `payout.functions.ts` | **Active — canonical** |
| `workers` | 2 | `workers.functions.ts`, `auth.functions.ts` | **Active — canonical** |
| `app_settings` | 1 | `settings.functions.ts`, `sheet-export.*` | **Active — single config row** |
| `ledger_jobs` | 1 | `ledger.functions.ts` | Active (Ledger v2) |
| `ledger_job_events` | 2 | `ledger.functions.ts` | Active (Ledger v2) |
| `clients` | 1 | — none — | **Deprecated (Ledger v1 residue)** |
| `os_jobs` | 1 | — none — | **Deprecated (Ledger v1 residue)** |
| `job_events` | 4 | — none — | **Deprecated (Ledger v1 residue)** |

Every table has RLS enabled with a deny-all policy (or no policy at all). All
application access goes through the service-role client in
`src/lib/db.server.ts`, gated by the custom HMAC token check in
`src/lib/auth.server.ts`. The Supabase linter's `rls_enabled_no_policy` INFO
entries are the intended posture, not findings to "fix".

### 1.2 Relationship map

```text
workers ─┬─< time_entries ──> job_sites   (job_site_id, planned_job_site_id,
         │                                 clock_out_job_site_id,
         │                                 assigned_job_site_ids[])
         ├─< reimbursements ──> job_sites (parsed_job_site_id,
         │                                 billable_job_site_id)
         └─< weekly_payouts               (unique on worker_id + week_start)

app_settings  (id = 1: admin_password_hash, feature toggles, sheet IDs)
audit_log     (no FKs by design; actor_id is a soft reference to workers)

ledger_jobs ──< ledger_job_events          (Ledger v2, independent of the above)

clients ──< os_jobs ──< job_events         (DEPRECATED, zero code references)
```

### 1.3 Database functions and triggers

- `hash_password(text)` / `verify_hash(text, text)` — SECURITY DEFINER, bcrypt
  via pgcrypto. Backs worker PIN and admin password checks.
- `audit_log_block_changes()` — raises on any UPDATE/DELETE against
  `audit_log`. This is what makes the audit trail immutable; **never drop it**.
- `os_touch_updated_at()` — generic `updated_at` trigger function.

### 1.4 Server surface

All server access is `createServerFn` in `src/lib/*.functions.ts` (no Supabase
edge functions). Two public HTTP routes exist for external schedulers:

| Route | Purpose |
|---|---|
| `src/routes/api/public/hooks/auto-clockout.ts` | Nightly forced clock-out of dangling sessions |
| `src/routes/api/public/hooks/sheet-export.ts` | Scheduled Google Sheets export |

Function inventory by surface — everything in the **preserve** rows is part of
the proven operational core and must keep working unchanged through the CRM
build:

| Surface | File | Functions | Class |
|---|---|---|---|
| Auth | `auth.functions.ts` | `listWorkersPublic`, `workerLogin`, `adminLogin`, `adminVerify`, `adminChangePassword` | preserve |
| Time entries | `entries.functions.ts` | `getWorkerState`, `clockIn`, `clockOut`, `adminForceClockOut`, `workerSetEntryReason`, `adminListEntries`, `adminAddEntry`, `adminEditEntry`, `adminDeleteEntry`, `adminUpdateEntryGeo`, `adminFlaggedEntries`, `workerListActiveClientSites`, `workerSetPlannedJob`, `adminUpdateEntryPlannedJob` | preserve |
| Workers | `workers.functions.ts` | `listWorkersAdmin`, `createWorker`, `updateWorkerProfile`, `deleteWorker`, `setWorkerRate`, `setWorkerName`, `resetWorkerPin` | preserve |
| Job sites | `jobsites.functions.ts` | `adminListJobSites`, `adminAddJobSite`, `adminUpdateJobSite`, `adminArchiveJobSite`, `adminDeleteJobSite`, `adminSearchPlaces`, `adminBulkAddJobSites` | preserve |
| Reimbursements | `reimbursements.functions.ts` | `listReimbursements`, `listAllReceipts`, `adminAddStandaloneReceipt`, `updateStandaloneReceipt`, `addReimbursement`, `deleteReimbursement`, `uploadReceipt`, `workerUploadReceipt`, `workerListActiveSites`, `workerSubmitReimbursement`, `workerListReimbursements`, `workerDeleteReimbursement` | preserve |
| Receipt parsing | `receipts.functions.ts` | `parseReceipt`, `updateParsedReceipt`, `getSheetSettings`, `updateSheetSettings`, `backfillSheet`, `parseUnprocessed`, `workerTriggerParse` | preserve |
| Payouts | `payout.functions.ts` | `weeklyPayout`, `lifetimePayout`, `exportEntriesCsv`, `listPendingWeeks`, `markWeekPaid`, `unmarkWeekPaid`, `workerWeekSummary` | preserve |
| Sheets export | `sheet-export.functions.ts` | `getWorkerExportSettings`, `updateWorkerExportSettings`, `runWorkerSheetExportFn` | preserve |
| Audit | `audit.functions.ts` | `adminListAuditLog` | preserve |
| Settings | `settings.functions.ts` | `getPublicSettings`, `updateSettings` | preserve |
| Ledger v2 | `ledger.functions.ts` | `listLedgerJobs`, `getLedgerJob`, `createLedgerJob`, `updateLedgerJob`, `addLedgerJobEvent`, `deleteLedgerJob` | ledger-only |

---

## 2. What overlaps

1. **Three competing "job" concepts.** `job_sites` (Clockwise's geofenced
   location), `ledger_jobs` (Ledger v2's project), and `os_jobs` (Ledger v1's
   dead project table). Only the first two are real.
2. **Two event/timeline tables.** `job_events` (dead, hangs off `os_jobs`) and
   `ledger_job_events` (live). Plus `audit_log`, which is a different thing —
   a system trail, not a user-facing timeline.
3. **Two client concepts.** The dead `clients` table, and the denormalised
   `client_name` / `client_email` / `client_phone` columns on `ledger_jobs`.
   The CRM will need one canonical client entity; neither of these is it yet.

---

## 3. What becomes canonical

| Concept | Canonical home | Notes |
|---|---|---|
| Physical / geofenced location | `job_sites` | Drives all clock verification. Default radius 250m. |
| Labour | `workers` + `time_entries` | Never bypass `clockIn`/`clockOut`; they own the geo tagging. |
| Money out | `reimbursements` + `weekly_payouts` | Weeks are Sunday-based, keyed `worker_id + week_start`. |
| Project / job record | `ledger_jobs` | The CRM should extend this, not `os_jobs`. |
| System trail | `audit_log` | Append-only. Write via `logAudit()` only. |
| Config | `app_settings` (single row) | |

Not canonical, do not build on: `clients`, `os_jobs`, `job_events`.

---

## 4. What must be preserved

- The **dual-tag** model on `time_entries`: the assigned/planned site is the
  billing truth (`planned_job_site_id` / `assigned_job_site_ids`), while
  `job_site_id`, `geo_status`, `clock_out_job_site_id` and
  `clock_out_geo_status` are raw GPS audit data. UI must never promote the raw
  punch location into a primary title.
- The **HMAC token scheme** in `auth.server.ts`: worker tokens (1-year TTL,
  localStorage) and admin tokens (30-minute sliding, sessionStorage). Every
  server function calls `requireWorker` / `requireAdmin` first.
- **Deny-all RLS + service-role-only access.** No table should gain broad
  `anon` / `authenticated` grants during the CRM build.
- The **append-only audit trigger**.
- The **offline queue** contract in `src/lib/offline-queue.ts`: the localStorage
  key `clockwise.offlineQueue.v1`, the cross-tab lock, and the client-captured
  timestamp that survives a delayed flush.
- The **Sunday week boundary** used everywhere payout math happens.

---

## 5. Risk register (resolved this phase unless noted)

| # | Risk | State |
|---|---|---|
| R1 | Dead Ledger v1 tables invite the CRM to be built on the wrong schema | **Resolved** — `clients`, `os_jobs`, `job_events` carry a `COMMENT ON TABLE ... DEPRECATED` marker. Data untouched. |
| R2 | Business logic (geofence, payout math, tokens) had zero automated coverage | **Resolved** — 37 unit tests in `tests/unit/`. |
| R3 | Critical flows only covered by pixel screenshots, which restyling invalidates | **Resolved** — 11 behavioural flow tests in `tests/visual/flows.spec.ts` (22 runs across mobile + desktop). |
| R4 | `payout.functions.ts` held runtime helpers at module scope, which the server-fn splitter can strip | **Resolved** — moved to `src/lib/payout-math.ts`; the module is now a thin wrapper. |
| R5 | Historical migrations create, drop and recreate `ledger_jobs` (7 of 30 migration files touch it) | **Documented** — migration history is not replayable from scratch. Always migrate forward against the live database; never rebuild from the folder. |
| R6 | The `receipts` storage bucket is public and listable | **Open** — pre-existing, flagged by the Supabase linter. Receipt URLs are guessable/enumerable. Worth closing before the CRM widens who can upload. |
| R7 | Deleting a worker cascades to their time entries and reimbursements | **Open** — `deleteWorker` is a hard delete. Consider archiving instead once CRM history matters. |

---

## 6. Test harness (how to run)

```bash
npm run test:unit     # vitest — pure logic, no network, no DB
npm run test:flows    # playwright — behavioural smoke tests, all calls mocked
npm run test:visual   # playwright — the full suite incl. pixel baselines
npm run lint:style    # bans literal colour utilities outside the allowlist
npm test              # unit + style + visual
```

Nothing in the suite touches the production database: every server function
call is intercepted in `tests/visual/mock.ts` and answered from
`tests/visual/fixtures.ts`, and the unit tests import only pure modules.

Coverage:

- `tests/unit/auth-token.test.ts` — worker/admin separation, expiry, tamper
  rejection, admin sliding refresh, malformed tokens.
- `tests/unit/geo-math.test.ts` — haversine, verified / supplier / off_site /
  no_gps classification, nearest-site tie-break, string coords from the DB.
- `tests/unit/payout-math.test.ts` — Sunday bucketing, week boundaries, hours
  summing (open entries excluded), wages/reimbursement totals, tips, the
  14-day overdue threshold.
- `tests/unit/offline-queue.test.ts` — enqueue/patch/remove, failed retention,
  persistence, corrupt-storage recovery, subscriber fan-out, sync lock + stale
  lock expiry.
- `tests/visual/flows.spec.ts` — worker PIN login, clock in (with GPS), clock
  out, assigned-job title, reimbursement form contract (job required,
  description optional), admin login, and the Entries / Payout / Receipts /
  Workers / Sites / Audit Log surfaces.
