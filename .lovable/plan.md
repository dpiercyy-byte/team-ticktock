## Goal

Let admins set the primary "billed job" title on any time entry from the Edit dialog, and support assigning **multiple active job sites** to a single entry so the title stacks them (e.g. worker who visited two sites in one day).

## Data model

Add a new column on `time_entries`:

- `assigned_job_site_ids uuid[] not null default '{}'` — ordered list of active job sites the admin has manually billed this entry to.

No destructive changes. The existing `job_site_id`, `clock_out_site_id`, `planned_job_site_id`, and `project` fields stay intact and continue to drive the GPS-audit footer + fallback title.

## Title resolution (new precedence)

Primary title in the entry card becomes:

1. If `assigned_job_site_ids` is non-empty → render each site's label as its own line, stacked top-to-bottom (with a subtle divider between them).
2. Else → current fallback: verified in-site → verified out-site → `project` → "General".

## Edit dialog changes (`EntryDialog`)

Add an **"Assigned job sites"** section above the Project field:

- Multi-select chooser populated from active job sites (`sitesQ.data`).
- Shows selected sites as removable pills in the order chosen (order = stack order).
- "+ Add job site" dropdown to append another.
- Empty selection = fall back to auto-derived title.

Pass `assignedJobSiteIds: string[]` through `onSubmit` → `adminEditEntry` (and `adminAddEntry` for consistency).

## Server function updates

`src/lib/entries.functions.ts`:

- Extend `adminEditEntry` and `adminAddEntry` input validators with optional `assignedJobSiteIds: z.array(z.string().uuid()).max(5)`.
- Persist to the new column. Validate each id exists and is active.
- Update `adminListEntries` select to include `assigned_job_site_ids` and hydrate labels via a lookup map (or a joined view) so the client gets `assigned_sites: {id,label}[]` in stack order.

## UI rendering (`AdminApp.tsx` entry card, ~line 446)

Replace the single-line title span with:

- If `e.assigned_sites?.length` → `<div className="flex flex-col gap-0.5">` of `<span className="font-semibold text-base leading-tight">` per site.
- Else keep existing single-line fallback.

Badges (`manual`, `flagged`, planned `→`) render to the right of the top line only.

## Out of scope

- No changes to worker-facing clock-in flow.
- No change to GPS audit footer, geo tagging, or payout math (payouts remain worker-level, not per-site split).
- No auto-assignment from GPS; assignment is admin-driven only.

## Files touched

- `supabase` migration: add column + backfill empty array.
- `src/lib/entries.functions.ts`: schema + list/edit/add handlers.
- `src/components/admin/AdminApp.tsx`: `EntryDialog` multi-select + title render block.
