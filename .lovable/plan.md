# Schedule tab: match the Entries / Payout look

Only the Schedule page's look changes. No schedule data, assigning, or saving behavior changes.

## What changes
1. **Week picker** (arrows + date range): placed in the same soft bar used for Payout's Pending/Weekly/Lifetime, with outlined arrow buttons that glow on hover.
2. **"Assign crew" button**: solid blue swapped for the light blue fill with a thin blue line at the bottom (same as the Add entry button and day headers).
3. **"+ Add sub trade" button**: same light blue style, keeps its half-width centered spot under the last row.
4. **Schedule grid**:
   - Outer box gets the same soft rounded corners, faint outline and hover glow as the Entries day cards.
   - Top row of day names gets the light blue header tint with the thin blue line underneath (instead of grey).
   - Today's column gets a slightly stronger light blue tint so it stands out.
   - Filled job cells keep the faint blue fill, plus a thin blue left line to match the new In/Out tag style.
   - Empty "+" cells stay dashed but with softer corners and a gentle light-blue hover.
5. **Pop-ups (Assign crew / Add sub trade)**: selected chips (trade, arrival time, days, job site) switch from solid blue to light blue fill with a blue outline. Save stays solid blue so the main action is still obvious.

## Technical details
- Edit only `src/components/admin/SchedulePanel.tsx`; reuse existing `cw-day-card`, `cw-day-head` and payout tab-bar classes in `src/styles.css`, adding one small `cw-soft-btn` class for the light-blue button if no reusable one exists (Add entry button styling gets moved into it).
- Selected chips: replace `variant="default"` with outline + `bg-primary/10 border-primary text-primary` tokens. No hardcoded colors.
