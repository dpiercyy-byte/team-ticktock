# Phase 4 — Activate Job (project → Clockwise field operations)

Connects an accepted project to the existing Clockwise system. No changes to how workers clock in or out, and no changes to geofence logic.

Note on scope: there is no Joist integration in the codebase today, and no "estimate accepted" flag. Activation is therefore offered for projects whose sales stage is **Won** (the existing "accepted" state). Everything else in the request is built as specified.

## 1. Database (one migration)

New table `project_crew`:
- `project_id` → ledger_jobs, `worker_id` → workers
- `role` (text, nullable), `assigned_at`, `removed_at` (nullable), `is_active` (generated from `removed_at IS NULL`)
- Unique partial index on (project_id, worker_id) where still active
- Deny-all RLS + service_role grant, matching every other table here

`ledger_jobs` gains `activated_at timestamptz` (nullable) — the idempotency marker.

Partial unique index on `job_sites(project_id)` for non-archived client sites, so a project can never end up with two active sites.

Crew assignment is data only: nothing in the clock-in path reads it. Current clock-in behaviour is untouched.

## 2. Server function `activateProject` (new `src/lib/activation.functions.ts`)

Admin-token guarded, single transaction-like handler, fully idempotent:

1. Load the project; refuse if it isn't `Won`, or if it's archived.
2. If `activated_at` is already set → return the existing job site and change nothing (no second event, no second site).
3. Confirm/persist the values passed from the wizard: client, property, accepted contract value (`budget_cents`), geofence address/lat/lng, radius, expected start date.
4. Job site: reuse the site already linked via `project_id`; otherwise look for an existing non-archived client site at the same address and link it; otherwise create one (`kind: 'client'`, given radius, `project_id` set). Suppliers are never matched or touched.
5. Set `delivery_status = 'Preconstruction'`, keep legacy `status` in sync through `stagesToStatus`, stamp `activated_at`.
6. Insert one `ledger_job_events` row of kind `job_activated`, plus an `audit_log` entry with before/after.

Supporting functions: `getActivationPreview` (prefills the wizard from client/property/estimate data, and geocodes the property address via the existing `geocodeAddress` helper) and `setProjectCrew` / `removeProjectCrew` for the crew table.

## 3. UI — Activate Job workflow

On `/ledger/jobs/$jobId`, a Won project that isn't activated shows a primary "Activate job" action. It opens a confirm-step flow reusing the existing `.l-wizard-footer` pattern:

1. Client — 2. Property — 3. Accepted contract value — 4. Geofence location (address + map-verified coordinates) — 5. Radius (defaults to 250 m) — 6. Expected start date — 7. Review & activate.

Every step is prefilled and editable. After activation the job detail shows an "Active in Clockwise" block: the linked site label, radius, and a link to the site in Clockwise admin; the Activate action is replaced, so it can't be run twice from the UI either.

Optional crew section on the same screen: add/remove workers with a role. Purely informational.

## 4. Untouched by design

Worker screens, `geo-math.ts` / `geo.server.ts` classification, `time_entries.job_site_id` references, receipt allocation to job sites, and supplier locations all stay exactly as they are.

## 5. Testing

- Unit tests for the activation decision helper (pure function: given project state + existing site, return create / reuse / no-op).
- Behavioural tests: activate twice → one site, one event; activate a project already linked to a site → reuses it; supplier site at the same address is ignored; a clock-in against the new site still returns `verified`; a receipt can be allocated to it.
- Full existing Clockwise unit + Playwright regression suite must stay green, with new baselines only for the changed Ledger job-detail screen.

Work stops once activation is complete and tested.
