## Plan

### What we’ll change
In the admin **Time Entries** tab, each shift currently shows only its clock-in → clock-out range. We’ll add the computed duration (e.g. `8.25 hrs`) directly beside that time strip, so admins can scan hours per shift without reading the day header.

### Where
- File: `src/components/admin/AdminApp.tsx`
- Component: `EntriesTab` → entry row rendering inside the daily grouped list.

### How
1. Compute per-entry hours with the existing `diffHours(e.clock_in, e.clock_out)` helper.
2. For entries that are still active (`!e.clock_out`), show `active` or `—` instead of a duration.
3. Insert the duration on the same line as the clock-in/clock-out time, separated by a subtle divider or muted text so it doesn’t compete with the time range.
4. Keep the day-level total in the date header unchanged — it still provides the daily rollup.

### Visual treatment options
Choose one of the following for the duration display:

**A. Muted inline pill (recommended)**
```
08:00 – 16:15  ·  8.25 hrs
```
Duration uses `text-muted-foreground` with a middle dot separator. Low visual weight, easy to scan.

**B. Right-aligned badge**
Duration sits in a small `Badge` at the right end of the time strip, using the same muted style as the day header total.

### Scope
- No data model or server changes.
- No changes to the day header total or pay estimate.
- Typecheck and preview verification after edit.

Which visual treatment do you prefer, A or B?