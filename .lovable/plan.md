## Current behavior

Clock-out captures GPS coords (`clock_out_lat/lng`) but does **not** resolve or store a geo tag for that location. The entry has a single `geo_status` + `job_site_id` pair that reflects only the clock-in. So a "Home Depot → Job Site" day shows up as Home Depot only, which is why we added the forced planned-job prompt to all non-client clock-ins.

You're right that this is overkill when the clock-out itself geo-verifies to the job site.

## Proposed change: dual tag (clock-in + clock-out), demote planned-job prompt

### 1. Stamp the clock-out location

Add two columns to `time_entries`:
- `clock_out_geo_status` (text)
- `clock_out_job_site_id` (uuid, FK → job_sites)

In `clockOut`, call `resolveSite(lat, lng)` (already done — result is currently discarded) and persist `clock_out_geo_status` + `clock_out_job_site_id` on the update.

### 2. Move the planned-job prompt to clock-out, and only when needed

Today: prompt fires at clock-in whenever the start location is supplier/off-site/no_gps.

New rule — prompt only when **both** endpoints are non-client (the 3+ point-of-contact case):

```text
clock-in tag   clock-out tag   action
─────────────  ──────────────  ──────────────────────────────
client         *               no prompt (clock-in is truth)
*              client          no prompt (clock-out is truth)
non-client     non-client      prompt for planned job
```

Flow:
- `clockIn` no longer returns `needsPlannedJob`; the planned-job dialog is removed from the clock-in path.
- `clockOut` returns `needsPlannedJob = (clockInNonClient && clockOutNonClient && !planned_job_site_id)`.
- Worker app shows the `PlannedJobDialog` after clock-out when that flag is set. Off-site reason prompt continues to fire at the endpoint that was off-site (unchanged).

### 3. Display both tags

Worker active-session card: keep showing clock-in tag (only one exists mid-shift). After clock-out the worker view returns to summary; no change needed.

Admin entries list: render two chips per row — "In: {label/status}" and "Out: {label/status}" — using the existing `GeoTagEditor` styling. `GeoTagEditor` gets a `field: "in" | "out"` prop so each chip is independently editable; `adminUpdateEntryGeo` takes a `field` arg and writes to the matching pair of columns.

Planned-job chip still renders when set (now mostly admin-corrections or true 3-stop days), and the planned-job selector stays in the popover.

### 4. Audit

- `clock_out` audit `after` payload includes `clock_out_geo_status` and `clock_out_job_site_id`.
- `entry_geo_update` audit gains a `field` metadata value ("in" | "out") so the log distinguishes which tag was edited.

## Technical details

**Migration**

```sql
ALTER TABLE public.time_entries
  ADD COLUMN clock_out_geo_status text,
  ADD COLUMN clock_out_job_site_id uuid REFERENCES public.job_sites(id);
CREATE INDEX time_entries_clock_out_job_site_id_idx
  ON public.time_entries(clock_out_job_site_id);
```
No RLS / grant changes (table already configured).

**Files touched**
- `src/lib/entries.functions.ts`
  - `clockIn`: drop `needsPlannedJob` from return; stop blocking on planned job.
  - `clockOut`: persist clock-out geo; compute & return `needsPlannedJob`.
  - `adminListEntries`: select new columns + `clock_out_site:job_sites!clock_out_job_site_id(label, kind, archived_at)`.
  - `adminUpdateEntryGeo`: add `field: "in"|"out"` and write to the right column pair.
- `src/components/worker/WorkerApp.tsx`
  - Move `PlannedJobDialog` trigger from clock-in result to clock-out result.
  - Drop the "Heading to" chip from the live session (no longer prompted up front); keep planned-job display when set by admin override.
- `src/components/admin/AdminApp.tsx`
  - Render two `GeoTagEditor` chips per entry (In / Out), pass `field`.
  - `GeoTagEditor` reads the appropriate status/job-site pair based on `field`.

**Backwards compatibility:** Old entries have NULL clock-out tag → the "Out" chip renders as a muted "—" with a "Set tag" affordance, identical to today's untagged behavior.

## Open question

When the worker clocks out off-site / no-gps (e.g., truck on the highway) and clock-in was at a supplier — that's still 2-point but neither endpoint is a client. Should that case:
(a) prompt for planned job (current proposed rule — "both non-client → prompt"), or
(b) skip the prompt and just leave both chips as supplier/off-site for the admin to interpret?

I've written the plan as (a). Say the word if you'd rather have (b).