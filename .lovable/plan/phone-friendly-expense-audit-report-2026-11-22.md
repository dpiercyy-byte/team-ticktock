# Phone-friendly expense audit report

Turn the Cash Tracking vs job-sheet audit into a PDF report that's easy to read on a phone. It replaces the CSV. Nothing in the app or your Google Sheets will change.

## What the report will look like
- **Page 1 – Summary:** total possible missing expenses (about $13,800), the dates covered (Sep 22 – Nov 21) and a short note on how matches were made.
- **One section per job** (Duncannon, Brookdale, Franklin, Clifton, Raeburn, Melrose, Trade Wind, Castlewood), each with:
  - **Possibly missing:** a card for each item showing the date, who the payment went to, the trade and a large dollar amount.
  - **Needs a look:** mismatches, such as Correy $3,051 vs $750, the Clifton/Duncannon drywall swap and the "55 castlewood" typo.
  - **Skipped (projected):** lower-section items left out because they're projected profit numbers.
- **Last page – To do:** a checklist of the items to confirm, with space to mark whether Dylan or Michael paid each one.

## Format
- Narrow page that fits a phone screen, one column, large text and no wide tables.
- Saved to your Files as `cash-tracking-expense-audit-v2.pdf`. The original CSV stays in place.
- Before sending, I'll turn every page into an image and check for cut-off text or layout problems.

## Technical details
Built with a Python script from the existing audit CSV and saved to /mnt/documents. No project code changes.
