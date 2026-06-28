## Planned-job prompt for non-client clock-ins

When a worker clocks in and GPS resolves to a **supplier** or **off-site** location, force them to pick the client job site they're planning to work at that day before the clock-in completes. The entry's primary geo tag stays truthful to where they actually clocked in (supplier or off-site), and the planned job is attached as a separate field that admins can see on the entry. Clock-out at a supplier later in the day does NOT re-prompt — the planned job set at clock-in covers the whole entry.

### Worker experience

1. Worker taps Clock In. GPS resolves.
2. If `geo_status` is `supplier` or `off_site` → a **required** dialog appears listing active client job sites (searchable dropdown, same source as admin's active jobs). Includes a "No job today / other" option that falls back to the existing free-text off-site reason.
3. Worker picks a planned job → clock-in completes. The site label is stored on the entry as `planned_job_site_id`.
4. Clock-in card shows two chips: the actual geo badge ("At Home Depot — Castlefield") plus a secondary "Heading to: 123 Main St".
5. The existing off-site reason dialog still fires for off-site clock-ins (material pickup, client visit, etc.) — the planned-job prompt is in addition to it, not a replacement.

### Admin experience

- Entries list: existing geo badge is unchanged. A small "→ Planned: 123 Main St" chip appears next to it on supplier/off-site entries.
- `GeoTagEditor` popover gains a "Planned job" row showing the chosen site, with a dropdown to change/clear it (audit logged).
- Payouts / reporting unchanged — the planned job is metadata only for now.

### Technical details

**Schema** — new migration:
- `time_entries.planned_job_site_id uuid references public.job_sites(id) on delete set null`

**Server functions** (`src/lib/entries.functions.ts`):
- `clockIn` — accepts optional `plannedJobSiteId`. If geo resolves to `supplier` or `off_site` and `plannedJobSiteId` is missing, return `{ needsPlannedJob: true, geo, entryId }` without committing (or commit and flag `needsPlannedJob` so the worker app can prompt and then call a follow-up). Simpler path: always create the entry, return `needsPlannedJob`, and let the worker app submit the choice via a new `workerSetPlannedJob` fn.
- `workerSetPlannedJob({ token, entryId, jobSiteId | null })` — writes `planned_job_site_id`, audit logs `entry_planned_job_set`.
- `adminUpdateEntryPlannedJob({ token, entryId, jobSiteId | null })` — admin override, audit logged.
- `adminListEntries` — extend select to include `planned_job:job_sites!planned_job_site_id(label)`.
- `getWorkerState` — include `planned_job_site_id` and label on the active entry so the worker card can show the "Heading to" chip.

**Worker UI** (`src/components/worker/WorkerApp.tsx`):
- New `PlannedJobDialog` component: required Select listing active client job sites (fetched via a new lightweight `workerListActiveClientSites` server fn that returns `{id, label}` only — no admin token needed), plus "No job today" option. Cannot be dismissed without a choice.
- After `clockIn` returns `needsPlannedJob: true`, open `PlannedJobDialog` first; on save call `workerSetPlannedJob`. Then chain into the existing `OffsiteReasonDialog` if `needsReason` is also true.
- Active session card shows the planned-job chip when present.

**Admin UI** (`src/components/admin/AdminApp.tsx`):
- Entries list row: render planned-job chip next to geo badge when `planned_job` is present.
- `GeoTagEditor` popover: add "Planned job" Select bound to active client sites, calls `adminUpdateEntryPlannedJob`.

**Audit** — three new actions: `entry_planned_job_set` (worker), `entry_planned_job_update` (admin), included in before/after diffs.

### Out of scope

- Multi-site visit timeline within one entry (deferred).
- Auto-splitting hours across planned vs actual sites.
- Re-prompt on supplier clock-out.
- Changing payout/job-costing logic.
