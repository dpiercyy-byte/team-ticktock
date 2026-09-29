# Tighten the cash audit: re-check the near-miss flags

A one-off re-check of the flags in the audit file. Nothing in the app changes, and nothing is written to any Google Sheet.

## What I'll re-check (only these rows)
The 31 flagged rows in the first audit. The $5,000 Castlewood row and Andrew's $1,450 week stay as they are.

## How each flag gets a second look
For each flagged row, I'll search the matching job sheet again using looser rules:
1. **Amount close:** within about $50 or 5%, or off by a typo (extra/missing zero, swapped digits, wrong sign).
2. **Date close:** within 7 days either way, or the date is missing. Rows like "up to Apr 3" count as that date.
3. **Split or combined:** two or three rows that add up to one entry on the other side (e.g. $1,500 + $50 = $1,550 at Huntington).
4. **Address close:** spelling variations ("Folway" vs "Folkway", "Brookedale" vs "Brookdale", "Claredon" vs "Clarendon"). This will also retry the "no job sheet" rows, including Manitoba.
5. **Worker pay rows:** compare against labour lines on the job sheet and paid weeks in the app, not just payments.
6. **Before the tab started:** job-sheet cash payments dated before Cash Tracking begins (mid-March), or with an impossible date like Dec 2026, get marked "outside range" rather than "missing".

## Result
Each row gets one of three labels:
- **Matched:** closed out, with what it matched and why (for example, "same amount, 3 days apart").
- **Close match, check:** probably the same entry, but one detail differs, shown side by side.
- **Real discrepancy:** still nothing close.

I'll save a new file, cash-tracking-audit_v2.csv, to your Files and give you a short summary of what's still open.

## Technical notes
- Read-only calls through the linked Google Sheets/Drive connection, reusing the job-sheet parser and address matching.
- Paid weeks read from the payouts table for worker-pay rows.
