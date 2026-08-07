# Passive site tracking with one clock-out confirmation

Replace the mid-shift pop-up with silent GPS-based site tracking, and ask the worker to confirm the day's split exactly once — at clock-out.

## What changes for the worker

- No more mid-shift "You've moved to another site" dialog.
- While clocked in, the app quietly checks location every ~12 minutes at coarse accuracy. If two consecutive checks put the worker inside a different job site's geofence, the app switches the segment silently and shows a small non-blocking toast ("Now tracking Maple Ave").
- The "Switch site" button stays as a manual override for when GPS is off or wrong.
- The read-only "Today's sites" list stays visible so the split is never a surprise.
- At clock-out, if the shift touched more than one site, a confirmation sheet appears:
  - "Today: 4.5h Maple Ave, 3.0h King St — look right?"
  - Confirm (one tap, done), or Adjust — a simple hours-per-site editor that must total the shift length.
  - Single-site shifts skip the sheet entirely.

## Why this shape

Two consecutive matches prevent a drive-by or a lunch run from stealing hours. Coarse accuracy at a 12-minute cadence is plenty for 250m geofences and materially cheaper on battery than the current 5-minute high-accuracy poll. The worker's only required interaction is one tap at the end of the day.

## Technical notes

- `src/components/worker/WorkerApp.tsx`
  - Poll interval 5 min -> 12 min; location requests use `enableHighAccuracy: false` with `maximumAge` around 5 min.
  - Remove the `autoPrompt` dialog and `autoDismissed` state. Replace with a `pendingMatch` ref: a candidate site must be seen on two consecutive checks before `workerSwitchSite` is called with `source: "auto"`; a toast reports the result.
  - Skip auto-switching when the worker manually switched within the last 20 minutes, so a manual choice isn't immediately overridden.
  - After a successful clock-out, if the finished entry has segments across 2+ distinct sites, open a new `ShiftSplitConfirmDialog`.
- `src/components/worker/ShiftSplitConfirmDialog.tsx` (new): lists each site with its hours, a Confirm action, and an Adjust mode with numeric hour inputs plus a live "must total Xh" validator.
- `src/lib/entries.functions.ts`
  - `workerSwitchSite`: accept an optional `source` of `"switch" | "auto"` and store it on the segment so admins can tell automatic from manual.
  - New `workerConfirmShiftSplit`: worker-token authenticated, takes an entry id and optional allocations. With allocations it reuses `allocationToSegments` from `src/lib/segment-math.ts` to rewrite the segments; without them it just records confirmation. Only the worker's own entry, and only within 12 hours of clock-out. Writes an `entry_split_confirmed` audit row either way.
  - `clockOut` response includes the finished entry id and its hydrated segments so the dialog can open without an extra round trip.
- Admin behavior is unchanged: the Split tool in Entries still overrides everything, and the audit log now shows whether a split was automatic, worker-confirmed, or worker-adjusted.
