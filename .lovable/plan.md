# Audit: Cash Tracking vs job sheets (last 60 days)

Read-only check. Nothing in any Google Sheet gets changed.

## What I'll compare
- **Cash Tracking sheet:** every row in Dylan's and Michael's columns from about Sep 22 to Nov 21, 2026.
- **8 job sheets:** 19 Raeburn, 141 Clifton, 55 Duncannon, 5039 Franklin, 473 Melrose, 420 Brookdale, 15 Tradewind, 99 Castlewood.

## How matching works
- Count each real expense on a job sheet (materials, labour, subs, gas, and so on) as found if Cash Tracking has a row with:
  - an amount within about $50 or 5%,
  - a date within 7 days,
  - and the same job, even if the address is misspelled.
- Also check whether two job-sheet lines add up to one Cash Tracking row, or the other way around.
- **"False" or projected expenses:** skip the lines in the lower section of each job sheet, under the main actual-expense list or past a projection or profit heading. I'll list every line I skip so you can confirm I read the sheet correctly.
- Only paid expenses count. Lines marked as paid by card or by the client are left out.

## What you'll get
- A short chat summary for each job: expenses missing from Cash Tracking, with date, amount and description.
- Close matches, shown separately so you can glance at them.
- A downloadable spreadsheet, cash-tracking-expense-audit.csv, with columns: job, job-sheet line, amount, date, matched Cash Tracking row (or "MISSING"), and Dylan or Michael.
- Totals of missing expenses for Dylan and for Michael.

## Technical notes
- One-off reads through the existing Google Sheets connection: discover the job workbooks, then batch reads to stay under the rate limit.
- The audit runs as a script in /tmp. The app code doesn't change.
