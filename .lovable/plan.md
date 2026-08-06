# Pull "ongoing" job sheets into Ledger

Yes, this is possible. Each of your ongoing jobs is its own Google Sheet file, named like
`06/15 ongoing *** 44 Raeburn Avenue`, with a consistent single-tab layout (client name,
revenue/expense summary, a payments table, an expenses table, and a price/scope table).
I read `44 Raeburn Avenue` end to end already, so the parser has a real reference layout.

One prerequisite: reading a *list* of files by name needs Google Drive access. The Sheets
connection can only read a file once we know its ID. So step 1 is linking a Google Drive
connection (same Google account) to let the app discover every file with "ongoing" in the title.

## What gets built

**1. Discovery**
- Link Google Drive; search the Drive for spreadsheets whose name contains "ongoing".
- Store one row per discovered file: file ID, current file name, parsed address, parsed
  start-date prefix, last import time, link status.
- Files previously imported stay tracked by file ID even if renamed. If "ongoing" disappears
  from a name, the linked Ledger job is marked completed instead of being dropped.

**2. Parsing one job sheet**
From the standard layout:
- Client name, start/finish date, address (from file title).
- Contract/price lines (right-hand PRICE block: date, price, scope comment) → contract value
  plus itemised scope lines.
- Payments block (amount, method, date) → project payment register rows.
- Expenses block (finish materials / building materials / subs / labour, comment, date)
  → project cost rows tagged to the right bucket. Negative lines (returns) supported.
- Sheet's own totals are kept alongside for a reconciliation check against our computed totals.

**3. Matching to existing jobs**
- Normalise the address (street number + street name, unit/suffix aware) and auto-link to the
  closest matching active Ledger/Clockwise job.
- No match → create a new Ledger job (active, with client, address, contract, payments, costs).
- The chosen match is recorded so later refreshes always hit the same job.

**4. Sync behaviour (sheet is source of truth)**
- Every refresh replaces the sheet-sourced payments, costs, contract value and change lines
  for that job with what the sheet currently says.
- Rows created inside Ledger (manual costs, tasks, documents, Clockwise labour, receipts)
  are tagged separately and never touched by the import.
- Clockwise labour and receipt costs continue to come from Clockwise; the sheet's Labor column
  is imported as a sheet-reported figure and shown next to the Clockwise-derived labour so you
  can see where they diverge, rather than double-counting.
- Every import writes an audit_log entry with before/after.

**5. UI**
- Ledger → a "Sheet jobs" section in Settings listing every discovered ongoing file, its match,
  last sync time, and any parse warnings; buttons for Sync all / Sync one / relink match.
- On the job's Financials tab, a badge showing "Synced from sheet · <time>" plus a warning when
  the sheet's own totals disagree with the computed totals.

**6. Continuous pull**
- Scheduled hourly refresh (pg_cron → a public app endpoint) re-runs discovery and re-imports
  every tracked file, so new "ongoing" files appear in Ledger on their own.

## Technical notes

- New tables: `sheet_job_sources` (file id, name, address, job_id, last_sync_at, status,
  parse warnings) and a `source` / `source_row_key` tag column on `project_payments`,
  `project_costs` and change-order rows so sheet-owned rows can be replaced cleanly.
- New modules: `src/lib/sheet-jobs.server.ts` (Drive discovery + Sheets fetch + parse),
  `src/lib/sheet-jobs-parse.ts` (pure parsing/normalising, unit-tested against the
  44 Raeburn layout), `src/lib/sheet-jobs.functions.ts` (server fns for list/sync/relink).
- Cron route at `src/routes/api/public/hooks/sync-sheet-jobs.ts`.
- Existing exports (Cash Tracking, Receipts, Time Entries, Project Summary) are untouched;
  this is read-only inbound and never writes back to the job sheets.
- Risk: sheets that deviate from the reference layout. The parser is tolerant (locates blocks
  by header text, not fixed rows) and records a warning instead of importing garbage.
