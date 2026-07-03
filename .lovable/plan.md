## Goal

Every shift ticket should read the same way regardless of whether the worker clocked in at a client site, a supplier, off-site, or with no GPS. No more "50 Red Maple Rd" on one card and "General" on the next for the same kind of work. Also declutter the daily header by removing its duplicate hours total.

## Changes

### 1. Rework the primary title on each entry card

Replace the current `e.project ?? "General"` with a resolver that picks the best available job context, in this priority order:

1. Worker-typed `project` (only if it's not just a mirror of the geo site label)
2. Clock-in **client** job site label
3. Clock-out **client** job site label (dual-tag)
4. **Planned job** (already captured when clock-in/out is at a supplier/off-site)
5. Fallback label based on what actually happened, not the word "General":
   - Supplier in + supplier out → **"Material run"**
   - Supplier/off-site with no planned job → **"Unassigned"** (muted + amber dot to flag admin)
   - No GPS at all → **"Unassigned"**

"General" goes away entirely — ambiguous and reads like a real project.

### 2. Add a small "source" hint under the title

One line of `text-xs text-muted-foreground` explaining where the title came from:
- "From clock-in site" / "From clock-out site" / "Planned job" / "Entered by worker" / "Needs assignment"

Skipped when it adds no information.

### 3. Make "Unassigned" actionable

When the title resolves to "Unassigned", show a tiny inline "Assign job" button that opens the existing planned-job picker and writes to `planned_job_site_id`. Fixes cases like Mon Jun 29 without opening the full edit dialog.

### 4. Stop the audit lines duplicating the title

Extend the current `hideInTag` and add a matching `hideOutTag`: hide the In/Out audit line when its address matches the resolved title OR the planned job label.

### 5. Remove the daily-header hours total

In the light-gray day header row, drop the daily hours total. The per-shift blue hours pill on each ticket becomes the single source of truth for hours.

### 6. Backfill

Display-only — resolver runs client-side from data already loaded (`job_sites`, `planned_job`, `clock_out_site`). No migration, `time_entries.project` untouched.

## Files touched

- `src/components/admin/AdminApp.tsx` — new `resolveEntryTitle()`, updated ticket header JSX, extended hide logic, inline "Assign job" affordance, and removal of the daily header hours total.

## Out of scope

- No schema changes.
- No changes to worker clock-in flow or the worker app.
