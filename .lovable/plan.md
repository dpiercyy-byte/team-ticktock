## Problem
The current week selector in the Payout tab uses a bare `<input type="date">` labeled "Week starting (Sunday)". It provides no context about the selected week range, how it relates to today, or a fast way to step between weeks.

## Proposed Change
Replace the current date input with a **combined week header bar** that includes:

1. **Prev / Next arrows** (`<` `>`) to step backward/forward by one week instantly.
2. **Week range label** displayed prominently in the center, e.g.  
   `June 22 – June 28, 2025` instead of only showing the Sunday date.
3. **Relative context badge** next to the range:  
   "This week", "Last week", or "2 weeks ago" when applicable.
4. **Quick-jump chips** for instant navigation to common weeks:  
   `This week` · `Last week` · `2 weeks ago` (horizontally scrollable on small screens).
5. **Calendar popover trigger** (small calendar icon) that opens a Shadcn `Calendar` in a `Popover` for rare jumps to older weeks, replacing the raw date input.

## Layout Sketch

```text
┌────────────────────────────────────────────────────┐
│  <   June 22 – June 28, 2025   This week   >   🗓  │
├────────────────────────────────────────────────────┤
│  [This week] [Last week] [2 weeks ago]             │
└────────────────────────────────────────────────────┘
```

- Top row: stepper arrows + centered range label + relative badge + calendar trigger.
- Second row (optional, collapsible on mobile): quick-jump chips.

## Technical Details
- Update `PayoutsTab` in `src/components/admin/AdminApp.tsx` (~lines 853–874).
- Use existing `startOfWeekISO` / `fmtDate` utilities to compute ranges.
- Re-use Shadcn `Popover`, `Calendar`, and `Button` components.
- No backend changes required — this is purely a frontend UX refactor.
- Ensure the calendar popover still snaps the selected date to the preceding Sunday.