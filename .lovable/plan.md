## Goal
Show the worker’s estimated daily wages next to the daily hours total in the admin Time Entries list, styled in green.

## Change
In `src/components/admin/AdminApp.tsx` (`EntriesTab`), inside the per-date grouping loop:

1. Read the selected worker’s `hourly_rate` from `wq.data`.
2. Compute `dayWages = dayHours * hourly_rate`.
3. Render both `dayHours` and `dayWages` in the grey date header (`bg-secondary`), with the dollar amount in green font (`text-emerald-600 font-semibold`).

### Before
```tsx
<div className="px-4 sm:px-5 py-2 bg-secondary text-sm">
  <span className="font-medium">{fmtDate(items[0].clock_in)}</span>
</div>
```

### After
```tsx
<div className="px-4 sm:px-5 py-2 bg-secondary text-sm flex items-center justify-between">
  <span className="font-medium">{fmtDate(items[0].clock_in)}</span>
  <span className="tabular-nums">
    {dayHours.toFixed(2)} hrs · <span className="text-emerald-600 font-semibold">{fmtMoney(dayWages)}</span>
  </span>
</div>
```

## Verification
- Open admin → Time Entries tab, pick a worker with entries.
- Each date group header should show hours + green dollar amount.
- If rate is 0 or missing, show `$0.00`.

No new dependencies. No backend changes.