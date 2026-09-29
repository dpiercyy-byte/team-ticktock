# Audit: Cash Tracking sheet vs. job sheets ($5,000 short)

A one-off investigation. Nothing in the app changes, and nothing is written to any Google Sheet.

## What I'll do

1. **Read the Cash Tracking sheet in full.** I'll read both Michael's and Dylan's columns: every amount, date, address and comment, plus the totals rows. I'll re-add every column myself to check whether the sheet's own totals are right (for example, a formula range that stops too early or a row sitting below the totals row).
2. **Read every job sheet in the Drive.** That means ongoing and completed jobs. From each one I'll take the payments (amount, method, date) and the expenses (amount, comment, date).
3. **Match the two by address, amount and date.** Every cash row that names a job gets compared with that job's sheet.
4. **Flag every mismatch:**
   - Cash payments on a job sheet that aren't in Cash Tracking, and the reverse
   - Amounts that differ, for example one extra zero, a flipped +/- sign, or a missing digit
   - Rows entered twice
   - Worker payouts from the app that are missing or doubled in Cash Tracking. I'll compare these against the paid weeks the app has on record.
   - Any single row, or pair of rows, adding up to about $5,000
5. **Report back** with a short list of likely causes for the $5,000, ranked from most to least likely. I'll also save a spreadsheet of every discrepancy (sheet, row, expected vs. found) to your Files.

## Technical notes
- Reads go through the linked Google Sheets connection, and through Drive for finding the files. I'll reuse the existing job-sheet parser and address matching.
- Payout history comes from the weekly payouts table, compared against the Cash Tracking rows written on "Mark paid".
- Only read calls. No database changes and no sheet writes.
