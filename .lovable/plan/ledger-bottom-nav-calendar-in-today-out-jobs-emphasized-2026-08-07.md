# Ledger bottom nav: Calendar in, Today out, Jobs emphasized

## What changes

1. **Remove the Today tab.** The first nav slot becomes **Calendar**, pointing at the existing calendar screen.
2. **Take Calendar out of the More menu**, since it now lives in the bottom nav.
3. **Landing behavior.** `/ledger` currently renders the Today search screen. It will redirect straight to Jobs, so opening Ledger (or the app switcher) lands on the jobs list instead of a tab that no longer exists in the nav.
4. **Make Jobs visually dominant** in the bottom nav: larger icon and larger label than the other four tabs, with a slightly wider tap target, while keeping the same active/inactive coloring.

Final nav order: Calendar · Pipeline · **Jobs** · People · More.

## Technical notes

- `src/components/ledger/LedgerBottomNav.tsx` — swap the `/ledger` Today item for `/ledger/calendar` (CalendarDays icon); add a `prominent` flag on the Jobs item that bumps icon box to ~44px, icon to ~23px, and label to ~12px semibold.
- `src/routes/ledger.more.tsx` — drop the Calendar link from `LINKS`.
- `src/routes/ledger.index.tsx` — replace the Today component with a `redirect({ to: "/ledger/jobs" })` in `beforeLoad`; keep the route file so `/ledger` stays valid. The search-first job list already exists at `/ledger/jobs`.
- Tap-target visual baselines under `tests/visual/tap-baseline/` for the ledger home screens become stale; the home spec/baselines get removed or updated to point at Jobs.
