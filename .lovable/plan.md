# Sync Ledger jobs ↔ Clockwise active job sites

Today the two apps share workers but not jobs. `ledger_jobs.linked_job_site_id` already exists as an FK to `job_sites(id)` but nothing writes to it. Plan makes them one conceptual "active job" list, with worker-clocked hours flowing into Ledger's labor total.

## Behavior

**Create**
- New Ledger active job → auto-create a matching `job_sites` row (`kind='client'`, `radius_m=250`, geocoded from address). Store the id in `ledger_jobs.linked_job_site_id`.
- New Clockwise client job site → auto-create a matching active `ledger_jobs` row (address = site address, `client_name` = site label if distinct).
- Both surfaces show the same job under one identity.

**Close/finish**
- Setting `ledger_jobs.finish_date` archives the linked `job_sites` row (`archived_at = now()`), so workers can no longer clock into it.
- Archiving a `job_sites` row sets `finish_date` on the linked Ledger job (today, if empty).

**Delete**
- Deleting either side detaches the link but doesn't cascade-delete the other (safer; preserves history).

**Hours flow (labor cost)**
- `ledger_jobs.labor` is derived from `time_entries` where the assigned/planned site matches `linked_job_site_id`, using each worker's hourly rate at entry time. Recomputed on entry insert/update/delete and on rate change. Updates `net` and `profit_margin` accordingly.
- Existing manual `labor` overrides are preserved via a new `labor_manual_override` flag; auto-compute skips when set.

## Data model changes

- Backfill: for each active `ledger_jobs` without a link, find-or-create a `job_sites` row by fuzzy address match, then set `linked_job_site_id`. For each active client `job_sites` without a Ledger job, create one.
- Add `ledger_jobs.labor_manual_override boolean not null default false`.
- Add `ledger_jobs.labor_synced_at timestamptz`.
- Realtime already enabled on `ledger_jobs`; add `job_sites` to `supabase_realtime` for cross-app UI refresh.

## Server-side logic

- `src/lib/ledger-jobs-sync.server.ts` — helpers: `ensureJobSiteForLedgerJob(jobId)`, `ensureLedgerJobForSite(siteId)`, `archiveLinkedSite(jobId)`, `finishLinkedLedgerJob(siteId)`, `recomputeLedgerLabor(jobId | siteId)`.
- Hook into existing server fns:
  - `createLedgerJob` → call `ensureJobSiteForLedgerJob` after insert.
  - `updateLedgerJob` (finish_date set) → `archiveLinkedSite`.
  - `createJobSite` (kind=client) / archive → mirror to Ledger.
  - `time_entries` clock-out / edit / delete paths in `entries.functions.ts` → `recomputeLedgerLabor` for the affected site.
  - Nightly Ledger sheet pull (`pullAllActiveJobs`) → recompute labor after pull, and respect `labor_manual_override`.

## UI changes

- `src/routes/ledger/active.tsx`: on each job card, small "Clocked hours: Xh · $Y labor" line (live via realtime). Badge "Linked to Clockwise site" replaces the current unlinked state.
- `src/routes/ledger/sync.tsx`: the "Link a Google Sheet" section already scoped to active jobs — no change. The linker's job list is now guaranteed to be in sync with Clockwise's active client sites.
- `EditJobDialog`: add a "Labor auto-synced from Clockwise hours" toggle (flips `labor_manual_override`); when off, `labor` input is read-only and shows computed value.
- Admin Job Sites tab: show "Linked to Ledger job" indicator; archiving prompts "This will also finish the Ledger job. Continue?"

## Edge cases

- Address geocoding fails on Ledger create → still create the Ledger job; skip site creation; show a "Link Clockwise site" action on the card.
- Multiple Ledger jobs at the same address (e.g., phase 1 / phase 2) → link is 1:1 by id, not address; second one prompts admin to pick "share existing site" or "create new".
- Renaming/moving a site address updates the site only; Ledger address stays (it's the contract identity).
- Worker mid-clock when a site is archived → their open entry finishes normally; site is hidden from new clock-ins.

## Out of scope

- Reimbursements/materials are not auto-added to Ledger's expense buckets — separate follow-up if wanted.
- Closed Ledger jobs stay closed; no un-archive flow.
