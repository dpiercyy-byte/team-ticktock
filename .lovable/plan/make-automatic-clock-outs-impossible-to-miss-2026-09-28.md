# Make automatic clock-outs impossible to miss

## Recommended treatment

When the system clocks someone out at 8:00 PM, treat that entry as a distinct issue requiring review—not as an ordinary timesheet row.

- Give the individual time entry a **light red background** with a strong red left border.
- Add a red alert icon and an explicit **“Auto clock-out — review time”** label beside the time.
- Include these entries in the existing review alert at the top of Entries, with red styling and the worker/date visible.
- Keep the warning visible until an admin opens **Edit**, confirms or corrects the clock-out time, and saves.
- Preserve the existing amber warning treatment for other review reasons, so automatic clock-outs remain visually distinct.

## Behaviour

1. The nightly 8:00 PM process marks every automatically closed entry as both auto-clocked-out and requiring review, regardless of shift length.
2. The Entries list returns that marker with each time entry.
3. Automatic rows receive the red treatment even when the surrounding week is paid, unpaid, or overdue.
4. Saving an edited entry clears the auto-clock-out marker, while the normal long-shift rule can still keep it flagged if it exceeds 14 hours.
5. Splitting hours across job sites does not dismiss the alert; the clock-out time must be reviewed through Edit.

## Technical notes

- Add a dedicated boolean marker to `time_entries` through a migration, defaulting to false. This avoids guessing from the audit history and lets the warning have a clear resolution state.
- Update `forceCloseEntry` so only the `auto_8pm` path sets the marker and forces `flagged_review` to true.
- Return the marker from `adminListEntries` and `adminFlaggedEntries`.
- Update the Entries review panel and row styling in `AdminApp.tsx` using the existing destructive colour tokens.
- Add focused coverage for auto-close marking and the visual review state.

No changes to payroll totals, payout status, or the worker experience.
