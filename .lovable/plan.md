# Pause the time-split feature

Hide and switch off all split behaviour without deleting any saved data, so it can come back later.

## What changes
- **Clock-out:** no more automatic 50/50 split when a worker starts and ends at different sites, and those shifts are no longer flagged for that reason. Shifts over 14 hours still get flagged.
- **Worker screen:** remove the "Switch site" button/list, the automatic background site switch, the segment list under the live timer, and the "confirm your split" pop-up after clock-out.
- **Admin Entries:** remove "Split hours across sites" from the ··· menu and the per-site segment breakdown under entries.
- **Existing flags:** any open entries flagged only because of an auto-split (like Andrew's Nov 18) will have that flag cleared.

## What stays
- Clock-in and clock-out site tags (In/Out GPS pills) stay exactly as they are.
- Previously saved split data stays in the database untouched, but job cost reports will count each shift's hours to its clock-in site (as before splits existed).
- Code files for the split dialogs are kept, just not shown, so it's easy to turn back on.

## Technical details
- `entries.functions.ts` clockOut: drop `fiftyFiftySplit` block and `entry_auto_split` audit; `flagged = longShift`.
- `WorkerApp.tsx`: remove switch-site UI/auto-switch effect, segment list, `ShiftSplitConfirmDialog` render.
- `AdminApp.tsx`: remove menu item, segment list, `AllocationDialog` render.
- `ledger-rollup.server.ts` / `workspace.server.ts`: stop loading `time_entry_segments` (pass empty list) so labour goes to the entry's site.
- One data update: clear `flagged_review` on entries whose only reason was auto-split (not auto-clocked-out, not >14h).
