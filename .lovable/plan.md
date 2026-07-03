## Restructure Time Entry Card Layout

Rework each entry row in the admin **Entries** tab (`src/components/admin/AdminApp.tsx`, ~lines 430–495) so the billed job is the eye-catching title and the raw GPS punches sit quietly in a footer.

### New row anatomy

```text
┌──────────────────────────────────────────────────────┐
│ 07:32 – 15:48         7.60 hrs             [⋯ edit]  │  ← time strip (unchanged)
│                                                      │
│ 118 Maple Ave        [manual] [flagged]              │  ← PRIMARY TITLE (bold, text-base)
│                      → Planned: 42 Oak St            │  ← optional planned-job chip
│                                                      │
│ ── GPS audit ─────────────────────────────────────── │  ← footer divider + label
│ In  📍 50 Red Maple Rd (Home Depot)      [edit tag]  │
│ Out 📍 118 Maple Ave                     [edit tag]  │
└──────────────────────────────────────────────────────┘
```

### Rules

1. **Primary title = billed job only.** Render `e.project ?? "General"` in `font-semibold text-base` at the top of the content column. Never substitute a supplier / raw GPS address here, even when the in-tag resolves to a supplier.
2. **Inline chips next to the title**: `manual`, `flagged`, planned-job arrow, and the offsite-reason italic note. No GPS pills here.
3. **Footer "GPS audit" timeline**: a thin `border-t border-dashed` block with a muted `GPS` label, then two lines — `In` and (if closed) `Out`. Each line shows the resolved geo status/address via the existing `GeoTagEditor` component (kept as-is so admins can still correct tags in place). Suppliers, off-site, unknown, etc. all live here and only here.
4. **Time strip** (clock-in–clock-out + hours) stays at the top; action buttons (force-close / edit / delete) stay on the right of that strip.
5. Day-header (date + day total) and the colored left border for payment status are untouched.

### Files

- `src/components/admin/AdminApp.tsx` — the map over `items` (~430–511): split the current single `<p>` meta line into (a) title row with chips and (b) footer GPS block. Move both `GeoTagEditor` invocations (in + out) into the footer block, each prefixed with an `In` / `Out` label and a small `MapPin` icon.

No schema, server-function, or worker-side changes. Purely a presentation refactor of the admin entries list.
