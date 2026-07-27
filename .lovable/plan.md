## 1. Photo heroes instead of gradients

Generate one landscape photo per project type (8 total: Bathroom, Kitchen, Basement, Addition, Whole Home, Commercial, Maintenance, Custom) into `src/assets/ledger/`, imported as ES6 modules and mapped by project type.

- `ledger-ui.ts`: replace `heroClass()` with `heroImage(projectType)` returning the imported asset URL.
- `LedgerShell`: accept a `heroImage` prop, render the band with `background-image` + a dark scrim overlay (gradient from transparent to near-black at the bottom) so hero text stays legible. Keep the existing overlap (`-mt-16`, rounded sheet).
- `JobHero` text keeps the light ink tokens; status chip stays.
- Fallback to the current gradient class if an image is missing.

## 2. Consistent trade pills

Pills currently size to their text, so rows look ragged. Make them uniform:
- Fixed height, equal horizontal padding, single line, and a shared min-width so short words ("Tile", "HVAC") match longer ones.
- Same treatment in both `JobCard.tsx` and the job detail trades section, driven by one `.l-pill` class in `styles.css` (min-width ~86px, centered text, no wrap).

## 3. Stationary Continue footer in the new-job wizard

In `ledger.jobs.new.tsx`, move the Continue/Finish button out of the scrolling flow into a fixed bottom bar:
- Fixed, full-width, blurred/solid surface strip with a top hairline, safe-area padding.
- Contains the primary button (full-width) plus the small Cancel link; the step content gets bottom padding so nothing is hidden behind it.
- Error text moves just above the button inside the bar.

## 4. Bottom nav docked as a real footer

`LedgerBottomNav`: drop the floating detached pill. Make it a full-width fixed footer bar flush to the bottom edge — top hairline border, surface background with blur, safe-area inset padding, no side margins or pill radius. Reduce `LedgerShell`'s `pb-32` to match the shorter footer so pages don't leave a dead gap.

On the wizard route the fixed Continue bar sits above the nav footer (stacked), so both remain reachable.

### Technical notes
- Files touched: `src/components/ledger/ledger-ui.ts`, `LedgerShell.tsx`, `JobHero.tsx`, `JobCard.tsx`, `LedgerBottomNav.tsx`, `src/routes/ledger.jobs.$jobId.tsx`, `src/routes/ledger.jobs.new.tsx`, `src/styles.css`, plus new image assets.
- All styling stays inside `.ledger-scope`, so Clockwise is unaffected.
