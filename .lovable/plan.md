## Goal
Restructure the admin **Time Entries** list to a week-paginated view (mirroring the Payout tab header) and add a per-day color tint synced to that week's payout status.

## UX

**Header bar** (replaces unscoped scrollable list)
- `<` `>` arrows to step weeks
- Range label: "June 22 – June 28, 2025"
- Relative badge: "This week" / "Last week" / "3 weeks ago"
- Calendar popover for jumping to older weeks
- Quick chips: "This week", "Last week"
- Wraps cleanly on mobile (same pattern as Payout)

**Week status badge** (top-right of header bar)
- Pulled from `weekly_payouts` for the selected worker + week
- `Paid` (green), `Unpaid` (muted), `Overdue` (red, ≥14 days past week-end)
- Same `text-sm px-2.5` sizing as the Payout tab badges

**Day rows** (existing layout preserved)
- Each day's sticky header keeps date + total hours
- Add a 3px colored **left border** on the day group tied to the week's status:
  - green-500/60 = paid
  - amber-500/60 = unpaid
  - red-500/60 = overdue
- Subtle background tint (`bg-success/[0.03]` etc.) so it reads without shouting
- Entry rows inside keep current content (times, project, geo tags, actions)

**Totals strip**
- Replace "Today / This Week / This Month" with **Week hours / Wages / Reimb / Total** for the selected week — matches what Payout shows, removes redundancy.

## Technical

### `src/components/admin/AdminApp.tsx` — `EntriesTab`
- Add `weekStart` state (default = current Sunday) + `calOpen` state.
- New query `["week-status", workerId, weekStart]` calling existing `listPendingWeeks` (with `includePaid: true`) and finding the matching row — no new server function needed.
- Filter `eq.data` to entries whose `clock_in` falls in `[weekStart, weekStart+7)` before grouping into `byDate`.
- Replace the "Today / Week / Month" `Stat` grid with week-scoped stats.
- Build the same header bar JSX used in `PayoutsTab` (extract a small `WeekNavHeader` helper inside the file to share between both tabs, or duplicate inline — duplicate is fine, keeps blast radius small).
- Wrap each day group in a div with `border-l-[3px]` + status color class derived from the week status.

### Reused utilities
- `addDaysISO`, `weekRangeLabel`, `relativeWeekLabel` from `src/lib/format.ts` (already added for Payout).
- `listPendingWeeks` from `src/lib/payout.functions.ts` (already returns `status` for every worker/week).

### No backend changes
- No schema, no new server functions, no migrations.

## Out of scope
- Per-day independent paid status (rejected: redundant — payouts are weekly).
- Changes to the Payout tab or Worker UI.
- CSV export changes.