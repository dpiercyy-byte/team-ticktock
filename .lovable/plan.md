# Fix Colin's missing Cash Tracking row

## What happened
- Colin's Sep 20–26 week was saved as paid: $1,480 by Dylan, today at 6:00 PM.
- The Google Sheets write for that payout failed, so there's no row for it. The three payouts just before it (Colin Sep 13–19, Andrew and JR Sep 20–26) all made it into Dylan's column, in rows 97–99.
- The sheet itself is fine. Row 100 in Dylan's column is empty, and the "Dylan Total" row is much further down (row 135), so the "block is full" check wasn't the cause.
- The app doesn't save the actual error message when a sheet write fails, so the exact reason is lost. The timing points to Google briefly turning away the request after four writes in about two minutes.

## Fix
1. **Add Colin's row now:** write `-$1,480.00 | September 28 | (blank) | Colin Sep 20 to 26` into Dylan's column, row 100. Then read the row back to confirm it landed, and record it in the history log.
2. **Retry automatically:** if Google says "too many requests" or has a temporary error, the app waits and tries again up to 3 times before giving up.
3. **Keep the reason:** every failed sheet write gets recorded in the history log with Google's actual message, so we can see exactly what went wrong next time.
4. **Retry button:** if the write still fails, the warning after marking paid shows the reason and a "Retry sheet export" button. The payout card also gets a small "Not in sheet – retry" link until the row is written. Pressing it adds the row without marking the week paid again.

## Technical details
- `cash-export.server.ts`: the `gw()` helper retries on 429/5xx with backoff (honors `Retry-After`, capped at about 8 seconds total).
- `markWeekPaid`: in the catch block, call `logAudit` with action `cash_export_failed` and the error message.
- New `retryCashExport` server fn (admin token): loads the payout, refuses if a `cash_export_row_added` audit entry already exists for that worker and week, then calls `appendCashPayoutRow`.
- Payout list DTO gets an `inSheet` boolean, based on that audit entry. `AdminApp.tsx` uses it to show the toast action and the card link.
- Colin's backfill is a one-off sheet write through the linked Google Sheets connection, plus an audit insert.
