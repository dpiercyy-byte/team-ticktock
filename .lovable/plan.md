## Goal

Make each shift ticket read cleanly on ~360–400px screens: no orphaned "hrs" pill on its own line, no title being pushed under the action icons, no address truncating to a single character.

## Changes (mobile-first, `src/components/admin/AdminApp.tsx` only)

### 1. Reserve the top-right action strip

Action icons (force-clockout / pencil / trash) currently overlay the card with `absolute top-1.5 right-1.5` and the content uses `pr-24`. On 360px that eats ~40% of the row width. Switch to:

- Card becomes `grid grid-cols-[minmax(0,1fr)_auto] gap-2` so the icon column reserves exact width and the content column gets `min-w-0`.
- Icons drop from `size="icon"` (36px) to `h-8 w-8` and tighten to `gap-0` on mobile, `sm:gap-0.5`.
- Remove the `pr-24` hack.

### 2. Time row: keep time + hours pill together

- Wrap time range and hours pill in a single `flex items-center gap-2 flex-nowrap min-w-0` row.
- Time range: `tabular-nums text-sm`, `shrink-0`.
- Hours pill: `shrink-0 whitespace-nowrap`.
- Arrow between times becomes a lucide `ArrowRight` icon (`h-3.5 w-3.5`) instead of the literal "→" so it never wraps as a text glyph.
- "active" state stays a pill, same treatment.

### 3. Title row: single line with truncation

- Remove `max-w-[240px]` (fixed cap breaks on 320px).
- Title becomes `flex-1 min-w-0 truncate`.
- "Assign job" pill, `manual` / `flagged` badges move to a **separate second line** on mobile (`flex-wrap`) so they never squeeze the title. Amber unassigned dot stays inline with the title.
- Offsite reason string moves under the title as its own muted line instead of chained inline.

### 4. Source hint stays as-is (already `text-[11px]` on its own line).

### 5. Audit footer (In/Out lines)

- Container becomes `grid grid-cols-1 gap-0.5` (already stacked, but enforce `min-w-0` on the GeoTagEditor trigger).
- `GeoTagEditor` `plain` variant trigger: the outer `<span>` gets `min-w-0 max-w-full` and the address `<span>` keeps `truncate` — currently the parent isn't `min-w-0` so `truncate` no-ops inside a flex row.

### 6. Daily header row

Already single-line since we removed the hours total. No change.

## Out of scope

- No changes to entry data, resolver logic, or the desktop layout beyond what naturally scales up (`sm:` breakpoints preserve the current denser look).
- No changes to the worker app.

## Files touched

- `src/components/admin/AdminApp.tsx` — entry card JSX (around L430–L570) and the `plain` branch of `GeoTagEditor` (around L3280).
