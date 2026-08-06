# Export payouts to the Cash Tracking sheet

When you mark a worker's week as paid in Clockwise, the app asks who paid (Michael or Dylan) and writes one row into that person's column block in the 2026 Cash Tracking sheet.

## What the row looks like

The sheet has two side-by-side blocks: Michael in columns B–E and Dylan in columns H–K, each with Amount / Date In/Out / Address / Comments.

For a payout the app appends to the first empty row of the chosen block:

- Amount: the actual cash paid, negative and currency-formatted (e.g. `-$1,440.00`)
- Date In/Out: the date you marked it paid, in the sheet's style (e.g. `August 5`)
- Address: blank (matches existing worker-pay rows)
- Comments: `Name Aug 3 to 9` — worker's first name plus the payout week range

## Mark-paid flow

Pressing "Mark paid" opens the existing dialog with a new required "Paid by" choice: Michael or Dylan. The payout is saved as it is today, then the sheet row is written. If the sheet write fails, the payout is still recorded and a warning toast explains the row wasn't added, with a retry.

The payer is stored on the payout record and shown on the payout card ("Paid by Michael").

## Unmark

Unmarking a week does not touch the sheet. The confirm dialog says the Cash Tracking row must be removed manually, and names the row (payer, amount, date) so it's easy to find.

## Settings

A new "Cash tracking export" section in Settings holds the sheet link and tab name (defaulting to the 2026 workbook and `Cash Tracking`), plus an on/off switch and a "Test connection" button. With the switch off, marking paid behaves exactly as it does today.

## Technical notes

- Migration: add `cash_export_sheet_id`, `cash_export_tab`, `cash_export_enabled` to `app_settings`; add `paid_by_person` to `weekly_payouts`.
- New `src/lib/cash-export.server.ts` using the existing Google Sheets gateway helper pattern from `sheet-export.server.ts`: read the block column (B or H) to find the first empty row, then a single `values` PUT into `Tab!B{n}:E{n}` or `Tab!H{n}:K{n}` with `valueInputOption=USER_ENTERED`.
- `markWeekPaid` in `src/lib/payout.functions.ts` gains a `paidByPerson` input, persists it, calls the export when enabled, logs an audit entry, and returns `{ sheetRow, sheetError }` so the UI can toast accurately.
- Week range label derived in `src/lib/payout-math.ts` (pure, unit-tested) so it matches the sheet's `Mon D to D` style.
- Dialog and payout-card changes stay in `src/components/admin/AdminApp.tsx`.
