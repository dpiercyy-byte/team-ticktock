
## Goal

Replace the current "one shared sheet with every job" export with **one Google Sheet per active job**. The sheet is the source of truth: edits made in the sheet flow back into that job in the app, and edits made in the app push up to the sheet. Closed jobs are left alone.

## How it works

1. On each active job card (Ledger → Active), add a **Google Sheet** field showing the linked sheet URL, plus two buttons: **Sync now** and **Open sheet**.
2. When admin pastes a sheet URL and hits Sync, the app wipes that sheet and writes only that one job's data into fixed tabs: `Summary`, `Payments`, `Expenses`, `Price Log`.
3. A **Pull from sheet** action (and a background cron every 5 min) reads those same tabs back and overwrites the job's fields in the app — the sheet wins on any conflict.
4. Closing a job (setting Finish Date) stops future syncs for that job so its historical sheet is frozen.
5. The old "one master sheet" sync on the `/ledger/sync` page is removed — that page becomes upload-only plus a short note pointing to per-job sheets.

## What changes

### Database
- New column `ledger_jobs.sheet_id text` (parsed from URL) and `sheet_last_sync_at timestamptz`.
- Drop `app_settings.ledger_export_sheet_id` / `ledger_export_last_sync_at` usage (leave columns, just stop reading).

### Server functions (`src/lib/ledger-sheet-export.functions.ts`)
- Replace `runLedgerSheetExport` with:
  - `setJobSheet({ jobId, url })` — parse & save sheet ID on the job.
  - `pushJobToSheet({ jobId })` — write one job's Summary/Payments/Expenses/PriceLog tabs.
  - `pullJobFromSheet({ jobId })` — read those tabs, update the job row and its JSON logs. Sheet values overwrite app values; rows deleted in the sheet are deleted in the app.
- New server route `src/routes/api/public/hooks/ledger-sheet-pull.ts` — iterates every active job with a `sheet_id` and runs `pullJobFromSheet`. Scheduled via `pg_cron` every 5 minutes.

### UI
- `src/components/ledger/JobCard.tsx` (active jobs): add "Google Sheet" row with URL input + Sync/Pull/Open buttons and "last synced" timestamp.
- `src/routes/ledger/sync.tsx`: remove the `GoogleSheetsCard` (master-sheet sync). Keep spreadsheet upload.
- Auto-push: any admin edit that mutates a job (add payment, add expense, edit price log, edit totals) triggers `pushJobToSheet` in the background if the job has a `sheet_id`.

## Tab layout (per job)

```text
Summary       A/B key-value: Address, Client, Start Date, Lead Source,
              Total Price, Gross Cash, Gross w/ HST, Finish Materials,
              Building Materials, Subs, Labor, Net, Margin,
              Payments Received, Balance
Payments      Date | Amount | Method
Expenses      Date | Vendor | Category | Amount
Price Log     Date | Amount | Has HST | Comment
```

Editing any cell in these tabs and waiting up to 5 min (or clicking Pull) updates the job in the app.

## Out of scope
- Closed jobs keep their existing individual sheets frozen (no sync).
- No historical migration of the old master sheet — admin re-links sheets per active job.
