# Today's payouts did export — they landed in the wrong place

Short answer: the export is immediate. When you press Mark paid, the row is written to the Cash Tracking sheet in the same action, no delay or queue.

## What actually happened

Both of today's payouts were written seconds after you marked them paid:

```text
-$1,140.00 | August 17 |  | Colin Aug 9 to 15   -> row 112
-$810.00   | August 17 |  | JR Aug 9 to 15      -> row 113
```

The problem is where they went. Dylan's block ends its transaction list at row 75, then has a long empty gap and the `Dylan Total: $11,630.00` line at row 111. The two new rows were written at 112 and 113 — underneath the totals line, in dead space, which is why they look missing and why they aren't in the total.

That is the exact bug fixed on Aug 11 (stop at the totals row, write under the last real transaction). The row numbers show the running app still used the old behaviour, so the fix is in the code but not in the build that served the Mark paid action.

## The fix

1. Confirm which build the live app is serving and republish so the corrected export logic is actually in use.
2. Harden the row targeting so this can't recur: pick the first empty amount cell after the last transaction and strictly above the block's totals row; if no free row exists above the totals, fail loudly with a clear message instead of writing below it.
3. Clean up the sheet: move the two rows to 76 and 77 (directly under the Aug 17 materials entry) and clear 112 and 113.
4. Add a one-line confirmation in the Mark paid toast showing the sheet row that was written, so a misplaced row is visible immediately.

## Technical notes

- `src/lib/cash-export.server.ts`: `nextEmptyRow` gains a hard totals-row boundary — record the totals row index while scanning `G/A` labels and clamp the returned row to below the last transaction and above that boundary; throw when the block is full.
- `src/lib/payout.functions.ts`: already returns `sheetRow`; surface it in the success toast in `src/components/admin/AdminApp.tsx`.
- Sheet cleanup is a one-time write through the gateway after the code fix is in.
- No database changes; both payouts are correctly recorded in `weekly_payouts` already.
