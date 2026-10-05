# Faster time-entry fixes for admins

## What's clunky today
- Fixing a time means: pick worker, pick week, find the shift, tap the pencil, then fight a full date+time picker for every field, then Save.
- The phone date/time picker makes you re-select the date even when only the time is wrong.
- No quick way to see who is still clocked in (or forgot to clock in) across the whole team.
- Each shift row has 4 small icons plus a GPS block, so the important action gets buried.

## Changes

1. **Tap the time to fix it**
   - Tap the clock-in or clock-out time on any shift to open a small time-only editor (the date stays the same).
   - Quick buttons: "7:00", "7:30", "3:30", "4:00", "5:00" (your common start/end times), plus -15 / +15 min nudges.
   - Saves right away, with an "Undo" option for a few seconds. No full dialog.

2. **Simpler edit form (when you do open it)**
   - Separate Date and Time fields instead of one combined picker.
   - Clock out defaults to the same day as clock in.
   - Shows the total hours live as you change times.
   - Job site picker on top with the worker's most-used site pre-selected.

3. **"Team today" panel at the top of Entries**
   - One list of every worker: clocked in (with start time), clocked out, or no shift today.
   - One tap: "Clock in now" / "Clock out now" for someone with a dead or forgotten phone, or "Add shift" with default times filled in.
   - Auto clock-out alerts show here too, with a "Fix time" button.

4. **Copy a shift**
   - "Same as yesterday" button to add a shift with the same times and job site — handy for guys who work the same hours every day.

5. **Less clutter on each shift**
   - Keep Edit and Delete visible; move Split hours, Force clock-out and GPS tags into a "More" menu.

Nothing changes for payroll totals, payouts, or the worker app. Every change is still recorded in the Audit Log.

## Technical details
- All in `AdminApp.tsx` EntriesTab/EntryDialog; reuse existing `adminEditEntry`, `adminAddEntry`, `adminForceClockOut` (edit still clears `auto_clocked_out`, overlap check unchanged).
- Inline time editor: popover with `<input type="time">` + preset chips; combines with the entry's existing local date.
- Undo: keep previous values in memory, re-call `adminEditEntry`.
- Team today: one new read-only server fn returning each worker's open entry / today's entries (admin token auth, like the others).
- "Same as yesterday": client-side copy of the previous day's last entry into `adminAddEntry`.
- Preset times configurable later; hardcoded for now.
