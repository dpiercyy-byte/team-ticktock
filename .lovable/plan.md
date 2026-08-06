# Ongoing sheets → live job sites, plus a Completed tab

## Where things stand

The sheet sync already creates a Ledger job when no match is found (`createProjectFromSheet` in the sheet-jobs sync engine, recorded as match mode `created`). What it does **not** do is create the matching Clockwise **job site** (the geofence workers clock into). So a freshly imported "ongoing" job exists in Ledger but is invisible to GPS tagging.

## What gets built

### 1. Every ongoing sheet gets a Clockwise job site

During each sync, for a source whose file name still carries the `ongoing` marker:
- Look for an existing active client site whose address matches (same normalised address key already used for job matching).
- If none exists, geocode the sheet address and create a client job site (250 m radius, standard for this app), linked to the Ledger project.
- If one exists but isn't linked to the project, link it.

This is silent and automatic — no review queue. If geocoding fails, the source row gets a warning in the Job sheets console instead of a broken site.

### 2. Sites get a Completed state

A job site can now be **active**, **completed**, or **archived**.

- When a synced sheet stops matching the ongoing rule (renamed/marked done in Drive), its linked site flips to **completed** automatically on the next sync.
- Completed sites keep their address, coordinates and radius, so geotagging still works.
- Manual toggle stays available in the Sites tab for anything not driven by a sheet.
- Archiving is unchanged and still means "gone".

### 3. New "Completed" tab in Sites

Admin → Sites tab strip becomes: **Active · Completed · Suppliers · Archived** (Completed sits between Active and Suppliers, as asked). Same card layout, with the site's completion date shown and a one-tap "Reopen" to move it back to Active.

Completed sites are excluded from the normal active-site pickers (planned site, manual assignment) but remain available via a "Completed jobs" section so a callback can still be tagged deliberately.

### 4. Yellow callback pill

When a punch lands inside a **completed** site's radius, it is tagged as a **callback** rather than plain verified:
- Worker card / entry rows show a yellow pill: `Callback · 44 Raeburn Ave`.
- Worker app shows the same yellow state after clocking in.
- Verified (green), supplier (blue), off-site (red), no-GPS (grey) are unchanged.

Existing entries keep their stored status; the new tag applies from the change forward.

## Technical notes

- Migration: add `completed_at timestamptz` to `public.job_sites` (nullable). No change to `kind`, so supplier logic is untouched. Grants/RLS follow the existing deny-all + service-role pattern used by this table.
- `geo-math.ts`: extend `GeoStatus` with `"callback"`; `classifyPunch` returns it when the nearest matching site has `completed_at` set. `resolveSite` stops filtering completed sites out (it already filters only `archived_at`) and selects `completed_at`.
- Nearest-site tie-breaking is unchanged, so an active site always wins over a nearby completed one only by distance — acceptable given 250 m radii and distinct addresses.
- Sheet sync (`sheet-jobs.server.ts`): after project resolution, upsert the job site via the existing geocoding helper; when `parseFileName` reports `ongoing: false` for a previously-ongoing source, set `completed_at` on the linked site.
- Entry validation that currently rejects non-`client` sites is relaxed to accept completed client sites so callbacks can be assigned manually.
- Admin Sites UI (`AdminApp.tsx`): view state becomes `client | completed | supplier | archived`, with counts, plus the pill/legend updates in the geo status renderers and `WorkerApp.tsx`.
- Unit tests: `classifyPunch` callback cases, and sheet-source → site creation/completion mapping.

## Out of scope

Payroll, reimbursement and payout math are untouched. Cash Tracking and existing Sheets exports are untouched.
