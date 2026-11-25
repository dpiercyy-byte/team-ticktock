# Softer, separated time entry cards

Bring the new tab look (soft corners, faint outline, light blue for "selected") into the Entries timesheet. Only appearance changes; editing, flags and totals behave the same.

## What changes

1. **One card per day instead of one big box**
   - Each day becomes its own rounded card (same corner softness as the Payout tab bar), with a small gap (about 8px) between days.
   - Faint outline like the tabs, with a gentle glow when the mouse is over it on a computer.

2. **Softer day header**
   - The grey header strip becomes a light blue-tinted band inside the card, rounded at the top, with the date on the left and day pay on the right.
   - Add the day's hours next to the pay (e.g. "7.9h · $198") so you can scan the week faster.

3. **Shifts inside a day**
   - Multiple shifts in one day are separated by a faint thin line instead of a hard border.
   - GPS In/Out pills and status badges get fully rounded pill corners to match.

4. **Flags keep their meaning, just softer**
   - Auto clock-out shifts keep the light red fill, but the red becomes a rounded left accent inside the card instead of a hard square bar.
   - The "jumped to" highlight uses the same blue outline as a selected tab.

5. **Week bar matches the tabs**
   - The week picker (arrows + date range) sits in the same soft bar style as the Payout tabs, so Entries and Payout feel alike.

## Other consistency ideas (not included unless you say so)
- Apply the same day-card style to Payout's weekly lists and the Lifetime worker view.
- Use one rounded style for every "Add" button across tabs.

## Technical details
- Add shared classes in `src/styles.css` (e.g. `.cw-day-card`, `.cw-day-head`) using existing tokens (`--primary`, `--border`, `--accent`).
- In `AdminApp.tsx` Entries view, replace the wrapping `<Card><div className="divide-y">` with a `space-y-2` list of day cards; keep `data-entry-id`, highlight scrolling and status border logic.
- No data or server changes.
