## Worker selector

Drop the `Card` wrapper around the Worker `Select` in `EntriesTab` (`src/components/admin/AdminApp.tsx` ~L324–L348). Replace with a plain full-width `SelectTrigger` styled as an input:

- Container: `w-full h-14 rounded-xl bg-muted/60 hover:bg-muted px-3` (soft gray, no border, no shadow — clearly not a stat card).
- Left: avatar circle (unchanged initials, `bg-background` so it pops against the gray field).
- Middle: two-line stack — tiny uppercase "Worker" label in `text-muted-foreground`, worker name in `font-semibold text-base`.
- Right: `ChevronDown` icon in muted color (kept from shadcn default) to signal it's an interactive picker.
- Empty state: same shell, placeholder text "Select worker".

Result: reads as an input control, not a KPI tile — visually distinct from the four Hours/Wages/Reimb/Total stat cards directly below it.

## Shift Ticket entry rows

Restructure each entry inside the day group (`src/components/admin/AdminApp.tsx` ~L433–L520) into a three-zone ticket:

**Row 1 — Time & duration**
- Left: `7:55 AM → 3:52 PM` in `font-semibold tabular-nums` (arrow replaces the current en dash).
- Immediately right of the time: hours pill `7.96 hrs` styled `text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary` (skip when still clocked in — show `active` chip in `--success` instead).
- Top-right action icons (pencil/trash/force-out) stay pinned via the existing `absolute top-1.5 right-1.5`.

**Row 2 — Job site (primary)**
- `e.project ?? "General"` promoted to `text-base font-semibold text-foreground`, single line with truncation.
- Inline chips remain to the right at small size: `manual`, `flagged`, planned-job `→ label`, offsite reason. Wrap allowed.

**Row 3 — Audit locations (bottom, muted)**
- New footer block separated by `mt-2 pt-2 border-t border-border/50`.
- Two lines, each `text-xs text-muted-foreground/80`:
  - `In:` prefix + green `ArrowDown` icon (h-3 w-3) + address text.
  - `Out:` prefix + red `ArrowUp` icon + address text (omit whole line if not clocked out).
- Existing "hide In line when it matches the job site" rule from the previous pass is preserved.
- Clicking either line still opens the `GeoTagEditor` popover — keep `variant="plain"` but update its internals to render as `In: <address>` / `Out: <address>` with the small colored arrow, muted text, no hover background, so the whole line reads as a subtle audit trail.

No other layout, tabs, filters, or business logic change.

### Technical notes
- All colors via existing tokens (`--muted`, `--primary`, `--success`, `--destructive`, `--border`) — no hardcoded hex.
- Duration pill formula unchanged: `diffHours(clock_in, clock_out).toFixed(2)`.
- `GeoTagEditor` plain variant gets a small refactor so the prefix (`In:` / `Out:`) is rendered by the trigger itself, keeping the popover behavior intact.
