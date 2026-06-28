## Goal
Make the auto-generated "friendly name" for job sites use only the street portion of the address (everything before the first comma), and backfill existing active sites.

## Changes

### 1. `src/lib/jobsites.functions.ts` — `adminAddJobSite`
- When `data.label` is empty, default to the first comma-delimited segment of `geo.formatted` instead of the whole formatted string.
- Small helper: `const shortLabel = (addr: string) => addr.split(",")[0].trim();`
- `adminBulkAddJobSites` is unchanged (labels come from the user/Places `displayName`, not the formatted address).
- `adminUpdateJobSite` is unchanged (label is user-provided).

### 2. Data backfill (active sites only, `archived_at IS NULL`)
Run a one-shot UPDATE that sets `label = split_part(address, ',', 1)` for every active site.

Assumption: this overwrites any custom label on active sites too. Most current labels match the full formatted address (the old default), so the practical effect is a cleanup. If you'd rather only touch rows where `label = address` (i.e. never customized), say so and I'll scope the UPDATE with `WHERE label = address`.

Archived sites are left as-is to preserve historical display.

## Out of scope
- No schema change.
- No UI change (the Add Job Site form already shows "Friendly name (optional)" and falls back to whatever the server picks).
- Audit log entries for the backfill: emitted as a single `job_site_label_backfill` admin audit row with a metadata count, not one row per site, to avoid noise.
