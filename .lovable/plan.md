# Fix the Cash Tracking export and push today's payouts

I read the live sheet. Two separate problems, and the earlier $1,600 / $850 confusion is explained.

## What's actually wrong

1. **The export picks the wrong row.** It looks for the *last* filled cell in a payer's amount column and writes underneath it. But each block ends with a totals cell far below the transactions — `Dylan Total: $8,085.00` sits in row 112, and Michael has totals rows at 110 and 112. So the export aims at row 113, i.e. below the totals, outside the running list. Dylan's last real entry is row 70; Michael's is row 108.
2. **"Test connection" tests the saved settings, not what's on screen.** It reads the sheet ID and tab from the database, so pressing Test before Save (or with a typo saved) fails with no useful message. The connection itself is fine — I read the Cash Tracking tab successfully just now, and the sheet ID and tab currently saved are correct, with the export switch on.

The two rows you saw earlier (-$1,600 "Colin July 26 – August 1, 2026" and -$850 "Jr July 26 – August 1, 2026", both Aug 4) are last week's payouts and are correct for that week. Today's $1,800 / $740 never reached the sheet.

## The fix

1. **Row targeting**: find the first empty amount cell at or below row 3, ignoring the totals rows (identified by the "Total:" label in the column beside the block). New rows then land directly under the last transaction — row 71 for Dylan, row 109 for Michael.
2. **Test connection**: save the form values first (or send them with the test), and report the actual error text plus the row it would write to, instead of a bare failure.
3. **Push today's payouts** into Dylan's block, rows 71 and 72:

```text
-$1,800.00 | Aug 10 |  | colin aug 2 to 8
-$740.00   | Aug 10 |  | jr aug 2 to 8
```

Comment wording follows the sheet's own short style (`colin apr 6 to 10`) rather than the long "July 26 – August 1, 2026" form used on Aug 4.

4. **Silent skips become visible**: when the export is off or unconfigured, "Mark paid" says so in the toast instead of showing a plain success.

## Technical notes

- `src/lib/cash-export.server.ts`: rewrite `nextEmptyRow` to read the label column plus the amount column (`A:B` for Michael, `G:H` for Dylan) and return the first row from 3 down whose amount is blank and whose label does not contain "total"; `testCashExport` returns that row per payer.
- `src/lib/payout.functions.ts`: `markWeekPaid` returns `sheetSkipped: 'disabled' | 'unconfigured' | null`.
- `src/components/admin/AdminApp.tsx`: mark-paid toasts branch on `sheetSkipped`; the settings card saves before testing and surfaces the error text.
- Backfill of the two rows is a one-time write through the same append path, run after the row-targeting fix is in.
