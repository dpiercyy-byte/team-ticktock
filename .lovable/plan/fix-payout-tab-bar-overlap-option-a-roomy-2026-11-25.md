# Fix Payout tab bar overlap (Option A — Roomy)

The selected Payout tab (Pending / Weekly / Lifetime) grows bigger than the bar has room for, so it spills over the bar's edge. Option A keeps the separate outlined tabs, adds more space, and makes the "puff" small enough to stay inside the bar.

## Changes
- Give the bar more inner padding and wider gaps between tabs.
- Make the tabs a bit taller with slightly less rounded corners, matching the mockup.
- Shrink the selected tab's grow effect so it can't cross the bar's edge (the quick puff animation stays, just smaller).
- Keep the hover glow on desktop, but make sure it can't get cut off at the bar's edge.
- The bottom menu stays the same.

## Technical details
- `src/components/admin/AdminApp.tsx` (Payout TabsList): `gap-2 p-1.5` -> `gap-2.5 p-2`; triggers `rounded-2xl px-4 py-1.5` -> `rounded-xl px-4 py-2`.
- `src/styles.css`: `.c-subtab[data-state="active"]` scale 1.04 -> 1.02; `c-subtab-inflate` peak 1.08 -> 1.04, end 1.02; make sure `.c-subnav` doesn't clip the hover ring.
- Check the bar at phone (390px) and desktop widths with screenshots.
