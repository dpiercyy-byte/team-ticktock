# Show payment date and cash paid on payout cards

## What changes

### Payout cards (Weekly payout tab)
- The green "Paid" pill also shows the date the worker was paid, e.g. `● Paid · Aug 2`.
- The card footer gets a second figure beside "Total owed": **Total cash paid**, showing the amount actually paid out.
- Both the "Total owed" and "Total cash paid" amounts render in green.
- If no cash amount is recorded for that week, the second figure is hidden.

### Entries tab
- The status pill under the week date shows the paid date in the same style when the week is paid (`● Paid · Aug 2`). Unpaid/Overdue pills stay as they are.

## Technical notes

All in `src/components/admin/AdminApp.tsx` — presentation only, no backend or math changes.

- Payout card (~lines 1992–2015, 2065–2079): append a formatted `s.paidAt` date to the Paid pill; add a `Total cash paid` block using the existing `s.actualPaid` value; apply `text-[var(--success)]` to both totals.
- Entries tab (~line 599): the week row already exposes `paidAt` via `weekRow`; append the same formatted date to the pill label when status is `paid`.
- Reuse the existing `fmtMoney` helper and short-date formatting already used elsewhere in the file.
- Visual regression tap baselines are unaffected (no button label/height changes).
