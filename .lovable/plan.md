## Goal

Make the shift ticket's bold title strictly reflect the **assigned job site** (the project being billed), and always show the raw GPS punch locations in the footer audit timeline — regardless of whether they match the title.

## Changes (all in `src/components/admin/AdminApp.tsx`, entry card around L429–L560)

### 1. Rewrite the title resolver

Replace the current priority chain (worker-typed → clock-in client site → clock-out client site → planned → "Material run" → "Unassigned") with a strict assigned-job-only rule:

- `title = planned_job.label` when the entry has a `planned_job_site_id`.
- Otherwise `title = "Unassigned"` and `unassigned = true`.
- Drop `workerTyped`, `inClient`, `outClient`, `inSupplier`, `outSupplier`, and "Material run" branches from title selection. (The typed `project` field and supplier context can still surface as a small muted hint under the title — see step 2 — but never as the bold title.)

Result: a shift clocked in at a supplier no longer shows the supplier as the title; if no job is assigned it reads **Unassigned** with the existing `AssignJobButton`.

### 2. Source hint

- Remove the "From clock-in site" / "From clock-out site" / "Planned job" source line, since the title is now unambiguous.
- Keep a muted hint only when useful: if worker typed a `project` value different from the assigned job's label, render it as `text-[11px] text-muted-foreground` under the title ("Worker note: {project}"). Otherwise render nothing.

### 3. Always render the audit footer

- Delete `hideInTag`, `hideOutTag`, and the `matchesTitleOrPlanned` helper.
- The footer block always renders when the entry has any punch data: always show the **In** row; show the **Out** row whenever `e.clock_out` exists.
- Container keeps `mt-2 pt-2 border-t border-border/50 flex flex-col gap-1`.

### 4. Muted footer styling

In the `plain` branch of `GeoTagEditor` (around L3285–L3310):

- Change the trigger text color from the current `text-muted-foreground` to `text-xs text-gray-500` on both the `In:` / `Out:` prefix and the address span.
- Keep the green down-arrow (In) and red up-arrow (Out) icons and the existing `min-w-0 truncate` layout so long addresses still ellipsize.

## Out of scope

- No DB or server-function changes. `time_entries.project` and `planned_job_site_id` semantics stay the same; only the client-side display rule changes.
- No changes to the worker app, geo resolver, or clock-in flow.
- Desktop layout inherits the same rules — assigned job title, always-visible audit — with no separate breakpoint work.

## Files touched

- `src/components/admin/AdminApp.tsx` — entry card resolver + JSX (L429–L560) and the `plain` variant of `GeoTagEditor` (L3285–L3310).
