# Remove the dark blue line on booked schedule days

On the Schedule grid, booked days currently show a thick blue line on their left edge. Remove it so booked days keep only their light blue fill.

## Technical details
- `src/components/admin/SchedulePanel.tsx` line 226: drop `border-l-[3px] border-primary` from the booked-cell class, keeping `bg-primary/10 hover:bg-primary/20`. Nothing else changes.
