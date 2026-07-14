## Bug
`getWorkerState` in `src/lib/entries.functions.ts` computes `todayHours` / `weekHours` by treating an open entry's `clock_out` as `now` (line 63). The worker UI (`WorkerApp.tsx` line 367-370) then adds `sessionHours` on top, so the live session gets counted twice while clocked in.

## Fix
Change the server aggregation to only count completed entries (skip rows with `clock_out == null`). The client already adds the live `sessionHours` for the currently-open shift, so totals stay live and stop double-counting.

Single edit in `src/lib/entries.functions.ts` `getWorkerState` handler:
```ts
for (const r of weekRows ?? []) {
  if (!r.clock_out) continue; // open entry; live hours added on client
  const h = hoursBetween(r.clock_in, r.clock_out);
  weekHours += h;
  if (new Date(r.clock_in) >= dayStart) todayHours += h;
}
```

No client changes needed.