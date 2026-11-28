# Fix sideways scrolling on the Schedule page (mobile)

## Cause
When the schedule grid got the new soft card style, that card style includes "hide anything that overflows". It overrides the grid's sideways-scroll setting, so on a phone the later days are cut off instead of scrollable.

## Fix
- Wrap the schedule table in its own inner scroll area inside the card, so the card keeps its rounded corners and the grid scrolls left/right with your finger.
- Keep the worker name column pinned on the left while the days scroll.
- Make sure the scroll area allows horizontal finger swipes and has smooth iPhone momentum scrolling.

## Technical details
- `src/components/admin/SchedulePanel.tsx`: change `<div className="cw-day-card overflow-x-auto">` to `<div className="cw-day-card"><div className="overflow-x-auto overscroll-x-contain" data-swipe-ignore style={{WebkitOverflowScrolling:"touch"}}>...</div></div>`; give the table `min-w-max` so columns don't squash.
- Root cause: unlayered `.cw-day-card { overflow: hidden }` in styles.css beats the layered Tailwind `overflow-x-auto` utility.
- Verify with Playwright at a 390px mobile viewport that the grid's scrollWidth > clientWidth and scrollLeft changes.
