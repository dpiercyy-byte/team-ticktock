## Goal
Record the actual cash amount paid in the Pending tab, separate from the calculated owed amount, and track the difference (tip/rounding).

## Schema
Add to `public.weekly_payouts`:
- `actual_paid numeric` — what was handed over (e.g. 650.00)
- `tip_amount numeric` — computed delta `actual_paid - amount` (e.g. +4.69)

`amount` continues to store the calculated owed total (labor + reimb).

## Server (`src/lib/payout.functions.ts`)
- `markWeekPaid`: extend input with `actualPaid: number`. Validate `actualPaid >= 0`. Write `actual_paid`, `tip_amount = actualPaid - amount`. Audit log includes both.
- `listPendingWeeks` / `weeklyPayout` / `lifetimePayout`: include `actualPaid` and `tipAmount` in returned rows.
- Lifetime totals: add `lifetimeTips` aggregate.

## UI (Pending tab in `PayoutsTab`)
- "Mark paid" opens a small dialog:
  - Shows: "Owed: $645.31"
  - Blank numeric input: "Amount paid in cash"
  - Confirm button (disabled until a valid number entered)
  - On submit → `markWeekPaid({ ..., actualPaid })`
- Paid rows display: `$650.00 paid` with a subtle `+$4.69 tip` chip when delta > 0 (or `-$X short` chip in red when delta < 0).

## UI (Weekly cards)
- Keep existing one-click toggle behavior (no prompt).
- If a `tip_amount` exists, show the small tip chip next to the paid pill so the info is visible everywhere.

## CSV
- Payout CSV / Lifetime CSV: add `Actual Paid` and `Tip` columns.

## Out of scope
- No change to clock-in/out, reimbursements, or worker UI.
- No prompt on the Weekly card Mark-paid toggle (per your choice).
