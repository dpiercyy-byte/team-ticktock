# Fix receipt date misreads (day/month swap)

Yes — I can see it, and it is broader than the one receipt you fixed by hand.

## What's happening

The receipt reader is told to assume **US month/day order** when a printed date is ambiguous. Your receipts print Canadian **day/month/year**, so every receipt dated on the 1st–12th of a month gets flipped. Dates with a day of 13 or higher can't be flipped, which is why nothing else looked wrong.

Confirmed in the data:

```text
uploaded Aug 16  ->  stored 2026-12-08   (Home Depot $99.63)   should be Aug 12
uploaded Aug 12  ->  stored 2026-12-08   ($109.02)             should be Aug 12
uploaded Aug 12  ->  stored 2026-11-08   ($358.66)             should be Aug 11
uploaded Aug 10  ->  stored 2026-10-08   ($124.82, $355.92, $7.89)  should be Aug 10
uploaded Jul 9-12 ->  stored 2026-09-07 / 2026-10-07           should be Jul 9 / Jul 10
```

A handful of older receipts also landed in 2020–2022, which is a separate misread of the year (loyalty/expiry line picked up instead of the transaction date).

Nothing rejects an impossible value today: a receipt "purchased" four months in the future is saved and exported to Sheets as-is.

## The fix

1. **Read dates as day/month.** Tell the reader the receipts are Canadian: for an ambiguous numeric date prefer DD/MM/YYYY, and also have it report the raw date string it saw so a swap is auditable.
2. **Sanity check on save.** A transaction date after today, or more than 18 months before upload, is not accepted silently: if swapping day and month produces a valid date on or before today, use the swapped date; otherwise leave the date blank and mark the receipt as needing review, so it shows up in the admin list instead of quietly exporting a wrong month.
3. **Correct the existing rows.** One-time cleanup of receipts whose stored date is in the future but becomes a sensible past date when day and month are swapped (the eight rows above). Receipts stuck in 2020–2022 get flagged for review rather than guessed at — I'll list them for you to confirm.
4. **Re-sync the receipts tab** in Sheets after the cleanup so the exported dates match.

## Technical notes

- `src/lib/receipts.functions.ts`: change the date rule in the parse prompt (DD/MM preference, add a `date_raw` field), and add a post-parse `normalizeReceiptDate()` guard applied before insert/update that performs the swap-or-flag logic.
- Flagging reuses the existing `parse_status` field (`needs_review`) so no schema change is needed; the admin receipts list surfaces that state.
- Backfill runs as a one-off SQL update over `public.reimbursements` on the identified IDs, with the original value written into the audit log.
- Cash Tracking and Project Summary exports are unaffected — their dates come from app timestamps, not from receipt text.
