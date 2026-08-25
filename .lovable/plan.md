# Worker Lifetime Detail View

Make each Lifetime card tappable, opening a dedicated full-screen worker page with a back button in the top left.

## What you get

Tapping a card on Payout → Lifetime opens a worker detail screen (slides over the tab, back arrow + worker name in the top-left header, stays inside the admin shell so the bottom nav still works).

The screen has:

1. **Header summary** — avatar, name, hourly rate, all-time total earned, lifetime hours, lifetime reimbursements, and how much has actually been marked paid vs. still outstanding.
2. **Weeks list** — one row per week the worker has hours or reimbursements: week label (e.g. Aug 16 – Aug 22), hours, wages, reimbursements, week total, and a paid pill (Paid by Michael/Dylan with date, or Unpaid). Tapping a week expands it in place to show that week's day-by-day entries (date, in/out, hours, job site) and that week's receipts.
3. **Reimbursements list** — all-time receipts for that worker: date, vendor/description, job site, amount, thumbnail that opens the receipt image.
4. **Payments history** — every `weekly_payouts` row: week, amount owed, actual paid, tip, paid by, paid date.
5. **Per-worker CSV export** — one button that downloads that worker's full week-by-week history.
6. **Edit shortcuts** — inside an expanded week, an "Edit in Entries" link that closes the detail view and jumps to the Entries tab scoped to that worker and week, so you can fix hours right away.

## Extra suggestions (not included unless you say so)

- **Job site mix**: a small breakdown of lifetime hours by job site, so you can see where a worker spends their time.
- **Averages strip**: average hours/week, average weekly pay, first shift date, last shift date, weeks worked.
- **Unpaid callout**: if any past week is unpaid, show a red banner at the top with a jump link to that week.


## Technical notes

- New server function `workerLifetimeDetail` in `src/lib/payout.functions.ts`: takes `{ token, workerId }`, requires admin, and returns worker info plus all `time_entries` (with joined job site names), `reimbursements`, and `weekly_payouts` for that worker, grouped into weeks with `startOfWeekISO` from `payout-math`.
- New component `src/components/admin/WorkerLifetimeDetail.tsx` rendering the detail screen; `LifetimePayoutView` in `AdminApp.tsx` holds `selectedWorkerId` state and renders the detail instead of the grid when set (back button clears it). No routing change, so admin auth/session handling is untouched.
- Cards get button semantics (keyboard focus + hover state) without changing their current visual design.
- Reuses existing money/date formatting helpers and the receipt image viewer already in `AdminApp.tsx`.
